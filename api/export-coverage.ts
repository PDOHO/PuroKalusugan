import { Request, Response } from 'express';
import { supabase, supabaseLong, cache } from './_lib.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { year, quarter, month, week } = req.query;
    
    // Determine date range (same logic as stats.ts)
    let filterStart: string | null = null;
    let filterEnd: string | null = null;
    let y = 2026;

    if (year) y = Number(year);

    if (year) {
      filterStart = `${y}-01-01`;
      filterEnd = `${y}-12-31`;

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
        filterStart = ISOweekStart.toISOString().split('T')[0];
        
        const ISOweekEnd = new Date(ISOweekStart.valueOf());
        ISOweekEnd.setUTCDate(ISOweekEnd.getUTCDate() + 6);
        filterEnd = ISOweekEnd.toISOString().split('T')[0];
      } else if (month) {
        const m = Number(month);
        filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
        filterEnd = new Date(y, m, 0).toISOString().split('T')[0];
      } else if (quarter) {
        const q = Number(quarter);
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = q * 3;
        filterStart = `${y}-${String(startMonth).padStart(2, '0')}-01`;
        filterEnd = new Date(y, endMonth, 0).toISOString().split('T')[0];
      }
    }

    // Get all barangays
    const { data: barangaysData, error: bError } = await supabase.from('barangays').select('municipality, actual_population');
    if (bError) throw bError;

    // Group actual population by municipality
    const actualPops: Record<string, number> = {};
    if (barangaysData) {
      barangaysData.forEach(b => {
        const m = b.municipality.toLowerCase();
        actualPops[m] = (actualPops[m] || 0) + (b.actual_population || 0);
      });
    }

    const munis = Object.keys(actualPops);
    const muniStats = [];

    // 1. Fire a single RPC call with p_municipality: null to fetch statistics for all municipalities at once!
    let bulkRpcData: any = null;
    let bulkRpcError: any = null;
    const cacheKey = `export-bulk-${filterStart || 'null'}-${filterEnd || 'null'}`;
    const cachedBulk = cache.get(cacheKey);

    if (cachedBulk) {
      console.log(`[Export API] Cache hit for bulk RPC: ${cacheKey}`);
      bulkRpcData = cachedBulk;
    } else {
      try {
        console.log(`[Export API] Triggering single bulk RPC stats fetch...`);
        const { data, error } = await supabaseLong.rpc('get_dashboard_service_stats', {
          p_municipality: null,
          p_barangay: null,
          p_start_date: filterStart || null,
          p_end_date: filterEnd || null
        });
        bulkRpcData = data;
        bulkRpcError = error;
        if (bulkRpcError) {
          console.warn(`[Export API] Bulk RPC call returned error:`, bulkRpcError);
          const errMsg = bulkRpcError.message || JSON.stringify(bulkRpcError);
          if (
            bulkRpcError.code === '57014' || 
            errMsg.includes('timeout') || 
            errMsg.includes('502') || 
            errMsg.includes('504') || 
            errMsg.includes('522') ||
            errMsg.includes('<!DOCTYPE html>')
          ) {
            return res.status(503).json({ error: "Database Temporarily Unavailable", message: "Export failed due to database timeout." });
          }
        } else if (bulkRpcData) {
          cache.set(cacheKey, bulkRpcData);
        }
      } catch (e: any) {
        console.warn(`[Export API] Bulk RPC call failed with exception:`, e);
        const errMsg = e.message || String(e);
        if (
          errMsg.includes('timeout') || 
          errMsg.includes('fetch failed') || 
          errMsg.includes('502') || 
          errMsg.includes('504') || 
          errMsg.includes('network')
        ) {
          return res.status(503).json({ error: "Database Temporarily Unavailable", message: "Export failed due to database network timeout." });
        }
      }
    }

    for (const m of munis) {
      const realName = barangaysData?.find(b => b.municipality.toLowerCase() === m)?.municipality || m;
      let reached = 0;

      if (bulkRpcData && bulkRpcData.muniStats) {
        // We successfully pulled bulk stats. If the muni isn't found, it just means 0 reached, not a database failure!
        const rpcMuni = bulkRpcData.muniStats.find((rm: any) => rm.muni === m);
        if (rpcMuni && typeof rpcMuni.population_reached !== 'undefined') {
          reached = rpcMuni.population_reached || 0;
        } else {
          reached = 0; // The municipality has zero records.
        }
      } else {
        // Fallback: If bulk stats was completely null (e.g. stale proc without muniStats), fall back to sequential calls
        console.warn(`[Export API] Missing bulk stats, falling back to sequential query for: ${realName}`);
        const { data, error } = await supabaseLong.rpc('get_dashboard_service_stats', {
          p_municipality: realName,
          p_barangay: null,
          p_start_date: filterStart || null,
          p_end_date: filterEnd || null
        });

        if (!error && data) {
          reached = data.programStats.total_population_reached || 0;
        } else if (error) {
          console.error(`Error fetching sequentially for ${realName}:`, error);
        }
      }

      const actualPop = actualPops[m] || 0;
      const coverage = actualPop > 0 ? (reached / actualPop) * 100 : 0;

      muniStats.push({
        municipality: realName,
        actualPopulation: actualPop,
        populationReached: reached,
        coverage: coverage
      });
    }

    // Sort alphabetically
    muniStats.sort((a, b) => a.municipality.localeCompare(b.municipality));

    // Generate CSV
    let csvContent = 'Municipality,Actual Population,Total Population Reached,Coverage (%)\n';
    muniStats.forEach(stat => {
      csvContent += `"${stat.municipality}",${stat.actualPopulation},${stat.populationReached},${stat.coverage.toFixed(2)}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=municipality_coverage.csv');
    return res.status(200).send(csvContent);

  } catch (error: any) {
    console.error('Export Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
