import { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, supabaseLong, cache, flushCache } from "./_lib.js";

export { flushCache };

function handleDatabaseError(
  error: any,
  contextMessage: string,
  res: VercelResponse,
) {
  const errMsg =
    error?.message ||
    (typeof error === "string" ? error : JSON.stringify(error)) ||
    "";
  console.warn(
    `[Stats API] Database error during ${contextMessage}:`,
    errMsg.substring(0, 500),
  );

  if (
    errMsg.includes("<!DOCTYPE html>") ||
    errMsg.includes("522") ||
    errMsg.includes("502") ||
    errMsg.includes("504") ||
    errMsg.includes("Connection timed out") ||
    errMsg.includes("timeout") ||
    errMsg.includes("failed to fetch") ||
    errMsg.includes("fetch failed") ||
    errMsg.includes("57014")
  ) {
    return res.status(503).json({
      error: "Database Temporarily Unavailable",
      message: `The database connection timed out. The Supabase Free Tier processing is taking longer than 15-20 seconds. I have generated a highly-optimized query! Please copy the ENTIRE contents of the "supabase_schema.sql" file and run it in your Supabase SQL Editor to apply these index and query optimizations.`,
    });
  }

  return res.status(400).json({
    error: `Upstream database error fetching data (${contextMessage})`,
    message: errMsg.substring(0, 150),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Stats API] Request received: ${req.method} ${req.url}`);
  try {
    if (req.method !== "GET")
      return res.status(405).json({ error: "Method not allowed" });

    const { municipality, barangay, year, quarter, month, week, refresh } =
      req.query;
    const normalizedQueryObj = {
      municipality: municipality || null,
      barangay: barangay || null,
      year: year || null,
      quarter: quarter || null,
      month: month || null,
      week: week || null,
    };
    const cacheKey = `stats-${JSON.stringify(normalizedQueryObj)}`;

    const isBackground = req.query.background === "true";

    if (refresh === "true" && !isBackground) {
      cache.del(cacheKey);
      console.log(
        `[Stats API] Cache key deleted for: ${cacheKey} (forced refresh)`,
      );
    } else if (!isBackground) {
      const cached = cache.get(cacheKey) as any;
      if (cached) {
        console.log(`[Stats API] Cache hit for key: ${cacheKey}`);
        
        // Handle migration from old raw data cache to new structured cache
        const dataToReturn = cached.timestamp ? cached.data : cached;
        const timestamp = cached.timestamp || Date.now();
        const isStale = Date.now() - timestamp > 5 * 60 * 1000; // 5 minutes stale threshold

        if (isStale && !cached.fetching) {
          console.log(`[Stats API] Cache is stale, triggering background revalidate for ${cacheKey}`);
          
          if (cached.timestamp) {
            cache.set(cacheKey, { ...cached, fetching: true });
          }

          // Trigger background fetch (loopback call with background=true)
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host || 'localhost:3000';
          const urlStr = `${protocol}://${host}${req.url}`;
          try {
            const url = new URL(urlStr);
            url.searchParams.set('background', 'true');
            // Background fetch, deliberately not awaited
            fetch(url.toString()).catch(e => console.error("[Stats API] Background fetch error", e));
          } catch (e) {
             console.error("[Stats API] Error parsing loopback URL", e);
          }
        }

        return res.json(dataToReturn);
      }
    }

    // 1. Fetch patient services with filters
    let servicesRaw: any[] = [];
    let from = 0;
    const step = 1000;

    let filterStart = "";
    let filterEnd = "";

    if (year) {
      const y = Number(year);
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;

      if (week) {
        const w = Number(week);
        const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
        const dow = simple.getUTCDay();
        const day = dow === 0 ? 7 : dow; // 1 = Monday, 7 = Sunday
        const ISOweekStart = new Date(simple.valueOf());
        if (day <= 4) {
          ISOweekStart.setUTCDate(simple.getUTCDate() - day + 1);
        } else {
          ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - day);
        }
        filterStart = ISOweekStart.toISOString().split("T")[0];

        const ISOweekEnd = new Date(ISOweekStart.valueOf());
        ISOweekEnd.setUTCDate(ISOweekEnd.getUTCDate() + 6);
        filterEnd = ISOweekEnd.toISOString().split("T")[0];
      } else if (month) {
        const m = Number(month);
        filterStart = `${y}-${String(m).padStart(2, "0")}-01`;
        filterEnd = new Date(y, m, 0).toISOString().split("T")[0];
      } else if (quarter) {
        const q = Number(quarter);
        const startMonth = (q - 1) * 3 + 1;
        filterStart = `${y}-${String(startMonth).padStart(2, "0")}-01`;
        filterEnd = new Date(y, q * 3, 0).toISOString().split("T")[0];
      } else {
        filterStart = start;
        filterEnd = end;
      }
    }

    // 1. Fetch barangays for targets (always needed)
    let barangays: any[] = [];
    let bFrom = 0;

    while (true) {
      let barangayQuery = supabase.from("barangays").select("*");
      if (municipality)
        barangayQuery = barangayQuery.ilike(
          "municipality",
          municipality as string,
        );
      if (barangay) barangayQuery = barangayQuery.eq("barangay_name", barangay);

      barangayQuery = barangayQuery.order("id", { ascending: true });

      const { data, error: bError } = await barangayQuery.range(
        bFrom,
        bFrom + step - 1,
      );
      if (bError) {
        return handleDatabaseError(bError, "fetching barangays", res);
      }

      if (data && data.length > 0) {
        barangays.push(...data);
        if (data.length < step) break;
      } else {
        break;
      }
      bFrom += step;
    }

    const programs = [
      { key: "nutrition", label: "Nutrition", targetKey: "program1_target" },
      { key: "cancer", label: "Cancer", targetKey: "program2_target" },
      {
        key: "immunization",
        label: "Immunization",
        targetKey: "program3_target",
      },
      { key: "hpn", label: "HPN", targetKey: "program4_target" },
      { key: "dm", label: "DM" },
      { key: "maternal_health", label: "Maternal Health" },
      { key: "road_safety", label: "Road Safety" },
      { key: "mental_health", label: "Mental Health" },
      { key: "tb", label: "TB" },
      { key: "hiv", label: "HIV" },
      { key: "wash", label: "WASH" },
    ];

    // 2. Try RPC for fast stats
    try {
      const { data: rpcData, error: rpcError } = await supabaseLong.rpc(
        "get_dashboard_service_stats",
        {
          p_municipality: (municipality as string) || null,
          p_barangay: (barangay as string) || null,
          p_start_date: filterStart || null,
          p_end_date: filterEnd || null,
        },
      );

      if (!rpcError && rpcData) {
        console.log(`[Stats API] RPC successful. Building response...`);

        const priorityProgramStats: any = {};
        programs.forEach((p) => {
          const served = rpcData.programStats[p.key] || 0;
          let target = 0;
          if (p.label === "Nutrition") {
            target =
              barangays?.reduce(
                (acc, b) => acc + (b.program1_target || 0),
                0,
              ) || 0;
          } else {
            target =
              barangays?.reduce((acc, b) => {
                let t = 0;
                if (b.program2_name === p.label) t += b.program2_target || 0;
                if (b.program3_name === p.label) t += b.program3_target || 0;
                if (b.program4_name === p.label) t += b.program4_target || 0;
                return acc + t;
              }, 0) || 0;
          }
          priorityProgramStats[p.label] = {
            target,
            served,
            percentage: target > 0 ? (served / target) * 100 : 0,
          };
        });

        const result: any = {
          totalMunicipalities: new Set(
            barangays.map((b) => b.municipality?.toLowerCase()),
          ).size,
          totalTargetBarangays: barangays.length,
          actualPopulation: barangays.reduce(
            (acc, b) => acc + (b.actual_population || 0),
            0,
          ),
          totalTarget:
            barangays?.reduce((acc, b) => {
              let t = b.program1_target || 0;
              if (b.program2_name !== "WASH") t += b.program2_target || 0;
              if (b.program3_name !== "WASH") t += b.program3_target || 0;
              if (b.program4_name !== "WASH") t += b.program4_target || 0;
              return acc + t;
            }, 0) || 0,
          totalServed: rpcData.programStats.total_served || 0,
          totalPopulationReached:
            rpcData.programStats.total_population_reached || 0,
          totalHealthPromotion: rpcData.programStats.health_promotion || 0,
          totalFPE: rpcData.programStats.fpe || 0,
          totalPhilHealth: rpcData.programStats.philhealth || 0,
          totalReferral: rpcData.programStats.referral || 0,
          totalWashTarget: priorityProgramStats["WASH"]?.target || 0,
          totalWashServed: priorityProgramStats["WASH"]?.served || 0,
          totalPKActivities: rpcData.largeScaleStats.total_pk_activities || 0,
          totalLargeScaleActivities:
            rpcData.largeScaleStats.total_large_scale_activities || 0,
          totalLargeScaleClientsServed:
            rpcData.largeScaleStats.total_large_scale_clients_served || 0,
          totalPKLargeScalePatients:
            rpcData.largeScaleStats.total_large_scale_clients_served || 0,
          totalPriorityLargeScalePatients:
            rpcData.largeScaleStats.total_priority_large_scale_patients || 0,
          totalPuroks:
            barangays?.reduce((acc, b) => acc + (b.puroks || 0), 0) || 0,
          totalPKTeams:
            barangays?.reduce((acc, b) => acc + (b.pk_teams || 0), 0) || 0,
          totalPKTeamMembers:
            barangays?.reduce((acc, b) => acc + (b.pk_team_members || 0), 0) ||
            0,
          totalPKKitsReceived:
            barangays?.reduce((acc, b) => acc + (b.pk_kits_received || 0), 0) ||
            0,
          totalPKMembersOriented:
            barangays?.reduce(
              (acc, b) => acc + (b.pk_members_oriented || 0),
              0,
            ) || 0,
          priorityProgramStats,
          largeScaleProgramCounts: {},
        };

        programs.forEach((p) => {
          result.largeScaleProgramCounts[p.label] =
            rpcData.largeScaleStats[`ls_${p.key}`] || 0;
        });

        // Municipality Stats
        const munis = [
          ...new Set(barangays?.map((b) => b.municipality?.toLowerCase())),
        ];
        result.municipalityStats = munis
          .map((m) => {
            const originalMuni =
              barangays?.find((b) => b.municipality?.toLowerCase() === m)
                ?.municipality || m;
            const muniBarangays =
              barangays?.filter((b) => b.municipality?.toLowerCase() === m) ||
              [];

            const muniServed =
              rpcData.muniStats.find((rm: any) => rm.muni === m)?.served || 0;
            const householdsServed =
              rpcData.muniStats.find((rm: any) => rm.muni === m)
                ?.households_served || 0;

            const target = muniBarangays.reduce((acc, b) => {
              let t = b.program1_target || 0;
              if (b.program2_name !== "WASH") t += b.program2_target || 0;
              if (b.program3_name !== "WASH") t += b.program3_target || 0;
              if (b.program4_name !== "WASH") t += b.program4_target || 0;
              return acc + t;
            }, 0);

            const householdsTarget = muniBarangays.reduce((acc, b) => {
              let t = 0;
              if (b.program2_name === "WASH") t += b.program2_target || 0;
              if (b.program3_name === "WASH") t += b.program3_target || 0;
              if (b.program4_name === "WASH") t += b.program4_target || 0;
              return acc + t;
            }, 0);

            const householdsPercentage =
              householdsTarget > 0
                ? (householdsServed / householdsTarget) * 100
                : 0;
            const totalCombinedTarget = target + householdsTarget;
            const totalCombinedServed = muniServed + householdsServed;
            const totalPercentage =
              totalCombinedTarget > 0
                ? (totalCombinedServed / totalCombinedTarget) * 100
                : 0;

            return {
              name: originalMuni,
              target,
              served: muniServed,
              percentage: target > 0 ? (muniServed / target) * 100 : 0,
              householdsTarget,
              householdsServed,
              householdsPercentage,
              totalPercentage,
            };
          })
          .sort((a: any, b: any) => b.totalPercentage - a.totalPercentage);

        // Barangay Stats
        result.barangayStats =
          barangays
            ?.map((b) => {
              const rpcBrgy = rpcData.barangayStats?.find(
                (rb: any) =>
                  rb.muni === b.municipality?.toLowerCase() &&
                  rb.brgy === b.barangay_name?.toLowerCase(),
              );

              const target =
                (b.program1_target || 0) +
                (b.program2_name !== "WASH" ? b.program2_target || 0 : 0) +
                (b.program3_name !== "WASH" ? b.program3_target || 0 : 0) +
                (b.program4_name !== "WASH" ? b.program4_target || 0 : 0);

              const householdsTarget =
                (b.program2_name === "WASH" ? b.program2_target || 0 : 0) +
                (b.program3_name === "WASH" ? b.program3_target || 0 : 0) +
                (b.program4_name === "WASH" ? b.program4_target || 0 : 0);

              const served = rpcBrgy?.served || 0;
              const householdsServed = rpcBrgy?.households_served || 0;

              const priorityProgramStats: any = {};
              programs.forEach((p) => {
                let pTarget = 0;
                if (p.label === "Nutrition") {
                  pTarget = b.program1_target || 0;
                } else {
                  if (b.program2_name === p.label)
                    pTarget += b.program2_target || 0;
                  if (b.program3_name === p.label)
                    pTarget += b.program3_target || 0;
                  if (b.program4_name === p.label)
                    pTarget += b.program4_target || 0;
                }
                const pServed = rpcBrgy ? rpcBrgy[`${p.key}_served`] || 0 : 0;
                priorityProgramStats[p.label] = {
                  target: pTarget,
                  served: pServed,
                  percentage: pTarget > 0 ? (pServed / pTarget) * 100 : 0,
                };
              });

              return {
                municipality: b.municipality,
                barangay: b.barangay_name,
                target,
                served,
                percentage: target > 0 ? (served / target) * 100 : 0,
                householdsTarget,
                householdsServed,
                householdsPercentage:
                  householdsTarget > 0
                    ? (householdsServed / householdsTarget) * 100
                    : 0,
                totalPercentage:
                  target + householdsTarget > 0
                    ? ((served + householdsServed) /
                        (target + householdsTarget)) *
                      100
                    : 0,
                healthPromotion: rpcBrgy?.health_promotion_served || 0,
                fpe: rpcBrgy?.fpe_served || 0,
                philhealth: rpcBrgy?.philhealth_served || 0,
                referral: rpcBrgy?.referral_served || 0,
                pkActivities: rpcBrgy?.pk_activities || 0,
                largeScaleActivities: rpcBrgy?.large_scale_activities || 0,
                ls_nutrition: rpcBrgy?.ls_nutrition || 0,
                ls_cancer: rpcBrgy?.ls_cancer || 0,
                ls_immunization: rpcBrgy?.ls_immunization || 0,
                ls_hpn: rpcBrgy?.ls_hpn || 0,
                ls_dm: rpcBrgy?.ls_dm || 0,
                ls_maternal_health: rpcBrgy?.ls_maternal_health || 0,
                ls_road_safety: rpcBrgy?.ls_road_safety || 0,
                ls_mental_health: rpcBrgy?.ls_mental_health || 0,
                ls_tb: rpcBrgy?.ls_tb || 0,
                ls_hiv: rpcBrgy?.ls_hiv || 0,
                ls_wash: rpcBrgy?.ls_wash || 0,
                ls_health_promotion: rpcBrgy?.ls_health_promotion || 0,
                ls_fpe: rpcBrgy?.ls_fpe || 0,
                ls_philhealth: rpcBrgy?.ls_philhealth || 0,
                ls_referral: rpcBrgy?.ls_referral || 0,
                puroks: b.puroks || 0,
                pkTeams: b.pk_teams || 0,
                pkTeamMembers: b.pk_team_members || 0,
                pkKitsReceived: b.pk_kits_received || 0,
                pkMembersOriented: b.pk_members_oriented || 0,
                totalLargeScaleClientsServed:
                  rpcBrgy?.total_large_scale_clients_served || 0,
                totalPriorityLargeScalePatients:
                  rpcBrgy?.total_priority_large_scale_patients || 0,
                priorityProgramStats,
              };
            })
            .sort((a: any, b: any) => {
              if (a.municipality === b.municipality) {
                return a.barangay.localeCompare(b.barangay);
              }
              return a.municipality.localeCompare(b.municipality);
            }) || [];

        // Monthly Trends
        const months: Record<string, any> = {};
        rpcData.monthlyTrends.forEach((mt: any) => {
          months[mt.month_date] = {
            month_name: mt.month_name,
            month_date: mt.month_date,
            served: mt.served,
          };
        });
        result.monthlyTrends = Object.values(months).sort((a: any, b: any) =>
          a.month_date.localeCompare(b.month_date),
        );

        cache.set(cacheKey, { timestamp: Date.now(), data: result, fetching: false });
        res.setHeader(
          "Cache-Control",
          "s-maxage=300, stale-while-revalidate=59",
        );
        return res.json(result);
      } else {
        const errorMsg = rpcError?.message || JSON.stringify(rpcError) || "";
        console.warn(
          `[Stats API] Fast RPC failed or returned error: ${errorMsg}. Aborting request to prevent database exhaustion.`,
        );
        return handleDatabaseError(
          rpcError,
          "executing fast RPC dashboard stats",
          res,
        );
      }
    } catch (e: any) {
      const errorMsg = e.message || String(e);
      console.warn(
        `[Stats API] Exception during Fast RPC: ${errorMsg}. Aborting request.`,
      );
      return handleDatabaseError(e, "executing fast RPC dashboard stats", res);
    }
  } catch (err: any) {
    console.error("[Stats API] Unhandled error:", err);
    return res
      .status(400)
      .json({ error: "Internal Server Error", message: err.message });
  }
}

export { handler };
