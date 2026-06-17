import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, flushCache, logAudit } from './_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('X-Handler', 'List-Handler');
    if (req.method === 'GET') {
      const { page = 1, limit = 50, search = '', municipality = '', barangay = '', program = '', year = '', month = '', patient_id, duplicates_only, discrepancies_only, large_scale = '', new_only = '' } = req.query;
      
      if (patient_id) {
        // Fetch specific patient with their service history
        const { data: patient, error: pError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patient_id)
          .single();
          
        if (pError) return res.status(404).json({ error: 'Patient not found' });
        
        const { data: history, error: hError } = await supabase
          .from('patient_services')
          .select('*')
          .eq('patient_id', patient_id)
          .order('date_of_service', { ascending: false });
          
        if (hError) return res.status(500).json({ error: hError.message });
        
        return res.json({ ...patient, history });
      }

      if (new_only === 'true') {
        const offset = (Number(page) - 1) * Number(limit);
        
        let filterStart: string | null = null;
        let filterEnd: string | null = null;
        
        if (year) {
          const y = Number(year);
          if (month) {
            const m = Number(month);
            filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
            filterEnd = new Date(y, m, 0).toISOString().split('T')[0];
          } else {
            filterStart = `${y}-01-01`;
            filterEnd = `${y}-12-31`;
          }
        }

        const { data: rpcData, error: rpcError } = await supabase.rpc('get_new_patients', {
          p_municipality: (municipality as string) || null,
          p_barangay: (barangay as string) || null,
          p_search: (search as string) || null,
          p_program: (program as string) || null,
          p_start_date: filterStart,
          p_end_date: filterEnd,
          p_limit: Number(limit),
          p_offset: offset
        });

        if (rpcError) {
          console.error("RPC Error:", rpcError);
          const errorMsg = rpcError.message || '';
          if (errorMsg.includes('<html>') || errorMsg.includes('502 Bad Gateway')) {
            return res.status(400).json({ error: "Upstream database error (502 Bad Gateway). Please try again later." });
          }
          return res.status(500).json({ error: rpcError.message });
        }

        if (!rpcData || rpcData.length === 0) {
          return res.json({ data: [], total: 0, page: Number(page), limit: Number(limit) });
        }

        const totalCount = rpcData[0].total_count;
        const pageIds = rpcData.map((p: any) => p.id);

        const { data: finalData, error: fError } = await supabase
          .from('patients')
          .select(`
            id, full_name, municipality, barangay, birthdate, sex,
            patient_services(
              date_of_service, health_promotion, fpe, philhealth, referral, wash, nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety, mental_health, tb, hiv, large_scale_pk_activity
            )
          `)
          .in('id', pageIds);

        if (fError) {
          return res.status(500).json({ error: fError.message });
        }

        const formattedData = pageIds.map((id: any) => {
          const p = finalData?.find((d: any) => d.id === id);
          if (!p) return null;
          const services = p.patient_services || [];
          const compatService: any = {
            date_of_service: null, health_promotion: false, fpe: false, philhealth: false, referral: false, wash: false, nutrition: false, cancer: false, immunization: false, hpn: false, dm: false, maternal_health: false, road_safety: false, mental_health: false, tb: false, hiv: false, large_scale_pk_activity: false
          };
          if (services.length > 0) {
            const sortedServices = [...services].sort((a: any, b: any) => new Date(b.date_of_service).getTime() - new Date(a.date_of_service).getTime());
            compatService.date_of_service = sortedServices[0].date_of_service;
            services.forEach((s: any) => {
              Object.keys(compatService).forEach(key => {
                if (key !== 'date_of_service' && s[key]) compatService[key] = true;
              });
            });
          }
          const { patient_services, ...rest } = p;
          return { ...rest, ...compatService, history: patient_services };
        }).filter(Boolean);

        return res.json({ data: formattedData, total: totalCount, page: Number(page), limit: Number(limit) });
      }

      if (discrepancies_only === 'true') {
        const offset = (Number(page) - 1) * Number(limit);
        
        let filterStart: string | null = null;
        let filterEnd: string | null = null;
        
        if (year) {
          const y = Number(year);
          if (month) {
            const m = Number(month);
            filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
            filterEnd = new Date(y, m, 0).toISOString().split('T')[0];
          } else {
            filterStart = `${y}-01-01`;
            filterEnd = `${y}-12-31`;
          }
        }

        const { data: rpcData, error: rpcError } = await supabase.rpc('get_patients_with_discrepancies', {
          p_municipality: (municipality as string) || null,
          p_barangay: (barangay as string) || null,
          p_search: (search as string) || null,
          p_program: (program as string) || null,
          p_start_date: filterStart,
          p_end_date: filterEnd,
          p_limit: Number(limit),
          p_offset: offset
        });

        if (rpcError) {
          console.error("RPC Error:", rpcError);
          const errorMsg = rpcError.message || '';
          if (errorMsg.includes('<html>') || errorMsg.includes('502 Bad Gateway')) {
            return res.status(400).json({ error: "Upstream database error (502 Bad Gateway). Please try again later." });
          }
          return res.status(500).json({ error: rpcError.message });
        }

        if (!rpcData || rpcData.length === 0) {
          return res.json({ data: [], total: 0, page: Number(page), limit: Number(limit) });
        }

        const totalCount = rpcData[0].total_count;
        const pageIds = rpcData.map((p: any) => p.id);

        const { data: finalData, error: fError } = await supabase
          .from('patients')
          .select(`
            id, full_name, municipality, barangay, birthdate, sex,
            patient_services(
              date_of_service, health_promotion, fpe, philhealth, referral, wash, nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety, mental_health, tb, hiv, large_scale_pk_activity
            )
          `)
          .in('id', pageIds);

        if (fError) return res.status(500).json({ error: fError.message });

        const formattedData = pageIds.map(id => {
          const p = finalData?.find(d => d.id === id);
          if (!p) return null;
          const services = p.patient_services || [];
          const compatService: any = {
            date_of_service: null, health_promotion: false, fpe: false, philhealth: false, referral: false, wash: false, nutrition: false, cancer: false, immunization: false, hpn: false, dm: false, maternal_health: false, road_safety: false, mental_health: false, tb: false, hiv: false, large_scale_pk_activity: false
          };
          if (services.length > 0) {
            const sortedServices = [...services].sort((a: any, b: any) => new Date(b.date_of_service).getTime() - new Date(a.date_of_service).getTime());
            compatService.date_of_service = sortedServices[0].date_of_service;
            services.forEach((s: any) => {
              Object.keys(compatService).forEach(key => {
                if (key !== 'date_of_service' && s[key]) compatService[key] = true;
              });
            });
          }
          const { patient_services, ...rest } = p;
          return { ...rest, ...compatService, history: patient_services };
        }).filter(Boolean);

        return res.json({ data: formattedData, total: totalCount, page: Number(page), limit: Number(limit) });
      }

      if (duplicates_only === 'true') {
        // Try the optimized RPC first to save egress
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_duplicate_patient_ids');
        
        let duplicatePatients: any[] = [];
        let duplicateIdsArray: number[] = [];

        if (!rpcError && rpcData) {
          // RPC succeeded! We have the IDs directly.
          duplicateIdsArray = rpcData.map((r: any) => r.patient_id);
          
          if (duplicateIdsArray.length === 0) {
            return res.json({ data: [], total: 0, page: 1, limit: Number(limit) });
          }
          
          // The RPC already returned them ordered by full_name ASC.
          // We just paginate the IDs directly.
          const offset = (Number(page) - 1) * Number(limit);
          const pageIds = duplicateIdsArray.slice(offset, offset + Number(limit));
          
          if (pageIds.length === 0) {
            return res.json({ data: [], total: duplicateIdsArray.length, page: Number(page), limit: Number(limit) });
          }
          
          // Fetch the full records for just this page's IDs
          const { data, error } = await supabase
            .from('patients')
            .select(`
              id, full_name, municipality, barangay, birthdate, sex,
              patient_services(
                date_of_service, health_promotion, fpe, philhealth, referral, wash, nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety, mental_health, tb, hiv, large_scale_pk_activity
              )
            `)
            .in('id', pageIds);

          if (error) return res.status(500).json({ error: error.message });

          // Re-sort data to match the pageIds order (which is already sorted by full_name)
          const sortedData = pageIds.map(id => data?.find(d => d.id === id)).filter(Boolean);

          const formattedData = sortedData.map(p => {
            const services = p.patient_services || [];
            const compatService: any = {
              date_of_service: null, health_promotion: false, fpe: false, philhealth: false, referral: false, wash: false, nutrition: false, cancer: false, immunization: false, hpn: false, dm: false, maternal_health: false, road_safety: false, mental_health: false, tb: false, hiv: false, large_scale_pk_activity: false
            };
            if (services.length > 0) {
              const sortedServices = [...services].sort((a: any, b: any) => new Date(b.date_of_service).getTime() - new Date(a.date_of_service).getTime());
              compatService.date_of_service = sortedServices[0].date_of_service;
              services.forEach((s: any) => {
                Object.keys(compatService).forEach(key => {
                  if (key !== 'date_of_service' && s[key]) compatService[key] = true;
                });
              });
            }
            const { patient_services, ...rest } = p;
            return { ...rest, ...compatService, history: patient_services };
          });

          return res.json({ data: formattedData, total: duplicateIdsArray.length, page: Number(page), limit: Number(limit) });

        } else {
          // FALLBACK: The old in-memory method if RPC doesn't exist
          // 1. Fetch all patients to find duplicates (Safeguard limit of 5,000 to protect server resources)
          let allPatients: any[] = [];
          let from = 0;
          const step = 1000;
          let hasMore = true;

          while (hasMore) {
            if (from >= 5000) {
              console.warn(`[Patients API] Duplicates fallback threshold (5,000 records) reached. Aborting scan loops to protect Supabase DB balance.`);
              break;
            }
            const { data: chunk, error: chunkError } = await supabase
              .from('patients')
              .select('id, full_name, birthdate, municipality')
              .order('id', { ascending: true })
              .range(from, from + step - 1);
              
            if (chunkError) return res.status(500).json({ error: chunkError.message });
            if (!chunk || chunk.length === 0) {
              hasMore = false;
            } else {
              allPatients = allPatients.concat(chunk);
              from += step;
              if (chunk.length < step) hasMore = false;
            }
          }

          // 2. Group by name, birthdate, municipality
          const groups = new Map<string, number[]>();
          allPatients.forEach(p => {
            const key = `${p.full_name?.toLowerCase()}|${p.birthdate}|${p.municipality?.toLowerCase()}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(p.id);
          });

          // 3. Extract IDs of duplicates
          let duplicateIds = new Set<number>();
          groups.forEach(ids => {
            if (ids.length > 1) {
              ids.forEach(id => duplicateIds.add(id));
            }
          });

          if (duplicateIds.size === 0) {
            return res.json({ data: [], total: 0, page: 1, limit: Number(limit) });
          }

          // 4. Filter allPatients to only duplicates and sort them
          duplicatePatients = allPatients
            .filter(p => duplicateIds.has(p.id))
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

          // 5. Paginate the duplicate patients
          const offset = (Number(page) - 1) * Number(limit);
          const paginatedDuplicatePatients = duplicatePatients.slice(offset, offset + Number(limit));
          const pageIds = paginatedDuplicatePatients.map(p => p.id);

          if (pageIds.length === 0) {
            return res.json({ data: [], total: duplicatePatients.length, page: Number(page), limit: Number(limit) });
          }

          // 6. Fetch the full records for just this page's IDs
          const { data, error } = await supabase
            .from('patients')
            .select(`
              id, full_name, municipality, barangay, birthdate, sex,
              patient_services(
                date_of_service, health_promotion, fpe, philhealth, referral, wash, nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety, mental_health, tb, hiv, large_scale_pk_activity
              )
            `)
            .in('id', pageIds);

          if (error) return res.status(500).json({ error: error.message });

          // Re-sort data to match the paginatedDuplicatePatients order
          const sortedData = paginatedDuplicatePatients.map(dp => data?.find(d => d.id === dp.id)).filter(Boolean);

          const formattedData = sortedData.map(p => {
            const services = p.patient_services || [];
            const compatService: any = {
              date_of_service: null, health_promotion: false, fpe: false, philhealth: false, referral: false, wash: false, nutrition: false, cancer: false, immunization: false, hpn: false, dm: false, maternal_health: false, road_safety: false, mental_health: false, tb: false, hiv: false, large_scale_pk_activity: false
            };
            if (services.length > 0) {
              const sortedServices = [...services].sort((a: any, b: any) => new Date(b.date_of_service).getTime() - new Date(a.date_of_service).getTime());
              compatService.date_of_service = sortedServices[0].date_of_service;
              services.forEach((s: any) => {
                Object.keys(compatService).forEach(key => {
                  if (key !== 'date_of_service' && s[key]) compatService[key] = true;
                });
              });
            }
            const { patient_services, ...rest } = p;
            return { ...rest, ...compatService, history: patient_services };
          });

          return res.json({ data: formattedData, total: duplicatePatients.length, page: Number(page), limit: Number(limit) });
        }
      }

      const offset = (Number(page) - 1) * Number(limit);

      const hasServiceFilter = !!year;

      const buildFilters = (q: any) => {
        q = q.not('date_of_service', 'is', null);

        if (search) {
          const safeSearch = (search as string).replace(/"/g, '""');
          q = q.or(`full_name.ilike."%${safeSearch}%",barangay.ilike."%${safeSearch}%"`);
        }
        if (municipality) {
          q = q.eq('municipality', municipality as string);
        }
        if (barangay) {
          q = q.eq('barangay', barangay as string);
        }

        if (hasServiceFilter) {
          if (program) {
            q = q.eq(`patient_services.${program}`, true);
          }
          if (large_scale === 'yes') {
            q = q.eq('patient_services.large_scale_pk_activity', true);
          } else if (large_scale === 'no') {
            q = q.eq('patient_services.large_scale_pk_activity', false);
          }

          const y = Number(year);
          if (month) {
            const m = Number(month);
            const filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
            const filterEnd = new Date(y, m, 0).toISOString().split('T')[0];
            q = q.gte('patient_services.date_of_service', filterStart).lte('patient_services.date_of_service', filterEnd);
          } else {
            const filterStart = `${y}-01-01`;
            const filterEnd = `${y}-12-31`;
            q = q.gte('patient_services.date_of_service', filterStart).lte('patient_services.date_of_service', filterEnd);
          }
        } else {
          if (program) {
            q = q.eq(program as string, true);
          }
          if (large_scale === 'yes') {
            q = q.eq('large_scale_pk_activity', true);
          } else if (large_scale === 'no') {
            q = q.eq('large_scale_pk_activity', false);
          }
        }
        return q;
      };

      const getCountQuery = () => {
        let q;
        if (hasServiceFilter) {
          const subfields: string[] = ['date_of_service'];
          if (program) subfields.push(program as string);
          if (large_scale) subfields.push('large_scale_pk_activity');
          q = supabase.from('patients').select(`id, patient_services!inner(${subfields.join(',')})`, { count: 'estimated', head: true });
        } else {
          q = supabase.from('patients').select('id', { count: 'estimated', head: true });
        }
        return buildFilters(q);
      };

      const getDataQuery = () => {
        let q;
        if (hasServiceFilter) {
          const subfields: string[] = ['date_of_service'];
          if (program) subfields.push(program as string);
          if (large_scale) subfields.push('large_scale_pk_activity');
          q = supabase.from('patients').select(`
            id, full_name, municipality, barangay, birthdate, sex,
            date_of_service, health_promotion, fpe, philhealth, referral, wash,
            nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety,
            mental_health, tb, hiv, large_scale_pk_activity,
            patient_services!inner(${subfields.join(',')})
          `);
        } else {
          q = supabase.from('patients').select(`
            id, full_name, municipality, barangay, birthdate, sex,
            date_of_service, health_promotion, fpe, philhealth, referral, wash,
            nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety,
            mental_health, tb, hiv, large_scale_pk_activity
          `);
        }
        return buildFilters(q).order('id', { ascending: false }).range(offset, offset + Number(limit) - 1);
      };

      let patientsList: any[] | null = null;
      let patientsError: any = null;
      let count: number | null = null;

      try {
        const [countRes, dataRes] = await Promise.all([
          getCountQuery(),
          getDataQuery()
        ]);
        
        patientsList = dataRes.data;
        count = countRes.count;
        
        if (dataRes.error) patientsError = dataRes.error;
        if (countRes.error && !patientsError) patientsError = countRes.error;
      } catch (err: any) {
        patientsError = err;
      }

      const isTimeoutError = patientsError && (
        patientsError.code === '57014' || 
        patientsError.code === 'PGRST116' ||
        String(patientsError.message || '').toLowerCase().includes('timeout') ||
        String(patientsError.message || '').toLowerCase().includes('canceling') ||
        String(patientsError.message || '').toLowerCase().includes('statement timeout')
      );

      if (isTimeoutError) {
        console.warn("[Patients API] Statement timeout detected. Retrying without exact count...");
        try {
          const dataRes = await getDataQuery();
          patientsList = dataRes.data;
          patientsError = dataRes.error;
          const receivedCount = patientsList?.length || 0;
          count = offset + receivedCount + (receivedCount === Number(limit) ? 100 : 0);
        } catch (err: any) {
          patientsError = err;
        }
      }

      if (patientsError) {
        console.error("Supabase error:", patientsError);
        return res.status(500).json({ error: patientsError.message || JSON.stringify(patientsError), details: patientsError });
      }

      // Fetch the full service histories ONLY for this current page's active patient IDs (usually 20 IDs)
      const pageIds = (patientsList || []).map(p => p.id);
      const serviceHistoryMap = new Map<number, any[]>();

      if (pageIds.length > 0) {
        const { data: servicesData, error: servicesError } = await supabase
          .from('patient_services')
          .select(`
            id, patient_id, date_of_service, health_promotion, fpe, philhealth, referral, wash,
            nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety,
            mental_health, tb, hiv, large_scale_pk_activity
          `)
          .in('patient_id', pageIds);

        if (servicesError) {
          console.warn("[Patients API] Warning fetching paginated service histories:", servicesError.message);
        } else if (servicesData) {
          servicesData.forEach(s => {
            const pId = Number(s.patient_id);
            if (!serviceHistoryMap.has(pId)) {
              serviceHistoryMap.set(pId, []);
            }
            serviceHistoryMap.get(pId)!.push(s);
          });
        }
      }

      // Calculate exact date filter limits if applying any service date filters
      let filterStart = '';
      let filterEnd = '';
      if (hasServiceFilter) {
        const y = Number(year);
        if (month) {
          const m = Number(month);
          filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
          filterEnd = new Date(y, m, 0).toISOString().split('T')[0];
        } else {
          filterStart = `${y}-01-01`;
          filterEnd = `${y}-12-31`;
        }
      }

      // Format data to match response schema exactly, providing full aggregate + history fields
      const formattedData = (patientsList || []).map(p => {
        const services = serviceHistoryMap.get(Number(p.id)) || [];
        
        // Filter history to current month/year range if active to aggregate correct month indicator flags
        const targetServices = hasServiceFilter
          ? services.filter(s => s.date_of_service >= filterStart && s.date_of_service <= filterEnd)
          : services;

        const compatService: any = {
          date_of_service: null,
          health_promotion: false,
          fpe: false,
          philhealth: false,
          referral: false,
          wash: false,
          nutrition: false,
          cancer: false,
          immunization: false,
          hpn: false,
          dm: false,
          maternal_health: false,
          road_safety: false,
          mental_health: false,
          tb: false,
          hiv: false,
          large_scale_pk_activity: false
        };
        
        if (targetServices.length > 0) {
          const sortedServices = [...targetServices].sort((a: any, b: any) => 
            new Date(b.date_of_service).getTime() - new Date(a.date_of_service).getTime()
          );
          compatService.date_of_service = sortedServices[0].date_of_service;

          targetServices.forEach((s: any) => {
            Object.keys(compatService).forEach(key => {
              if (key !== 'date_of_service' && s[key]) {
                compatService[key] = true;
              }
            });
          });
        } else {
          // Fallback to patient's root values if no matching range service was loaded
          compatService.date_of_service = p.date_of_service;
          Object.keys(compatService).forEach(key => {
            if (key !== 'date_of_service') compatService[key] = p[key] ?? false;
          });
        }

        return {
          id: p.id,
          full_name: p.full_name,
          municipality: p.municipality,
          barangay: p.barangay,
          birthdate: p.birthdate,
          sex: p.sex,
          ...compatService,
          history: services
        };
      });

      return res.json({ data: formattedData, total: count, page: Number(page), limit: Number(limit) });
    } else if (req.method === 'POST') {
      const { _action, id, _user, ...allData } = req.body;

      // Separate patient profile from service data
      const patientFields = [
        'full_name', 'municipality', 'barangay', 'birthdate', 'sex',
        'date_of_service', 'health_promotion', 'fpe', 'philhealth', 'referral',
        'nutrition', 'cancer', 'immunization', 'hpn', 'dm', 'maternal_health',
        'road_safety', 'mental_health', 'tb', 'hiv', 'wash', 'large_scale_pk_activity'
      ];
      const serviceFields = [
        'date_of_service', 'health_promotion', 'fpe', 'philhealth', 'referral',
        'nutrition', 'cancer', 'immunization', 'hpn', 'dm', 'maternal_health',
        'road_safety', 'mental_health', 'tb', 'hiv', 'wash', 'large_scale_pk_activity'
      ];
      const patientData: any = {};
      const serviceData: any = {};
      
      Object.keys(allData).forEach(key => {
        if (patientFields.includes(key)) {
          patientData[key] = allData[key];
        }
        if (serviceFields.includes(key)) {
          serviceData[key] = allData[key];
        }
      });

      if (_action === 'update') {
        if (!id) return res.status(400).json({ error: 'Patient ID is required for update' });
        
        // Check for duplicates (excluding current record)
        const { data: existing } = await supabase.from('patients')
          .select('id')
          .ilike('full_name', patientData.full_name)
          .eq('birthdate', patientData.birthdate)
          .ilike('municipality', patientData.municipality)
          .neq('id', id)
          .maybeSingle();

        if (existing) {
          return res.status(409).json({ error: "A patient with the same name and birthdate already exists in this municipality." });
        }

        const { error } = await supabase.from('patients').update(patientData).eq('id', id);
        
        if (error) return res.status(500).json({ error: error.message });
        
        await logAudit(_user, 'UPDATE', 'patient', id.toString(), { full_name: patientData.full_name, municipality: patientData.municipality });
        
        flushCache();
        return res.json({ success: true });

      } else if (_action === 'delete') {
        // ... (existing delete logic is fine as it cascades)
        if (!id) return res.status(400).json({ error: 'Patient ID is required for deletion' });
        const { data: patientToDelete } = await supabase.from('patients').select('full_name, municipality').eq('id', id).single();
        const { error } = await supabase.from('patients').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        await logAudit(_user, 'DELETE', 'patient', id.toString(), patientToDelete || { id });
        flushCache();
        return res.json({ success: true });

      } else if (_action === 'update_service') {
        if (!id) return res.status(400).json({ error: 'Service ID is required for update' });
        
        const { error } = await supabase.from('patient_services').update(serviceData).eq('id', id);
        
        if (error) return res.status(500).json({ error: error.message });
        
        await logAudit(_user, 'UPDATE', 'service', id.toString(), { date: serviceData.date_of_service });
        
        flushCache();
        return res.json({ success: true });

      } else if (_action === 'delete_service') {
        if (!id) return res.status(400).json({ error: 'Service ID is required for deletion' });
        
        const { data: serviceToDelete } = await supabase.from('patient_services').select('patient_id, date_of_service').eq('id', id).single();
        const { error } = await supabase.from('patient_services').delete().eq('id', id);
        
        if (error) return res.status(500).json({ error: error.message });
        
        await logAudit(_user, 'DELETE', 'service', id.toString(), serviceToDelete || { id });
        
        flushCache();
        return res.json({ success: true });

      } else if (_action === 'add_service') {
        if (!id) return res.status(400).json({ error: 'Patient ID is required' });
        
        // Check if a service record already exists for this patient on this date
        const { data: existingService } = await supabase.from('patient_services')
          .select('*')
          .eq('patient_id', id)
          .eq('date_of_service', serviceData.date_of_service)
          .maybeSingle();

        if (existingService) {
          // Merge boolean flags (if it was true before, keep it true. if it's true now, make it true)
          const mergedData: any = {};
          Object.keys(serviceData).forEach(key => {
            if (typeof serviceData[key] === 'boolean') {
              mergedData[key] = serviceData[key] || existingService[key];
            } else {
              mergedData[key] = serviceData[key];
            }
          });

          const { error } = await supabase.from('patient_services')
            .update(mergedData)
            .eq('id', existingService.id);
          
          if (error) return res.status(500).json({ error: error.message });
          
          await logAudit(_user, 'UPDATE', 'service', existingService.id.toString(), { patient_id: id, date: serviceData.date_of_service, merged: true });
          flushCache();
          return res.json({ success: true, id: existingService.id, merged: true });
        }

        const { data, error } = await supabase.from('patient_services').insert([{
          ...serviceData,
          patient_id: id
        }]).select();
        
        if (error) {
          console.error("Error adding service:", error);
          const isRLS = error.message?.toLowerCase().includes('security policy') || error.code === '42501';
          if (isRLS) {
            return res.status(200).json({ 
              success: true,
              warning: "Service history could not be recorded due to database RLS policies. The latest service info was updated on the patient record, but the history entry was blocked. Please ensure the policies in supabase_schema.sql are applied.",
              partialSuccess: true
            });
          }
          return res.status(500).json({ error: error.message || "Unknown database error", details: error });
        }
        
        await logAudit(_user, 'CREATE', 'service', data[0].id.toString(), { patient_id: id, date: serviceData.date_of_service });
        flushCache();
        return res.json({ success: true, id: data[0].id });

      } else {
        // Create (Default) - Check if patient exists first
        let patientId = id;
        
        const { data: existing } = await supabase.from('patients')
          .select('id')
          .ilike('full_name', patientData.full_name)
          .eq('birthdate', patientData.birthdate)
          .ilike('municipality', patientData.municipality)
          .maybeSingle();

        if (existing) {
          patientId = existing.id;
          // Update profile just in case something changed (like sex or barangay)
          await supabase.from('patients').update(patientData).eq('id', patientId);
        } else {
          const { data: newPatient, error: pError } = await supabase.from('patients').insert([patientData]).select();
          if (pError) return res.status(500).json({ error: pError.message });
          patientId = newPatient[0].id;
          await logAudit(_user, 'CREATE', 'patient', patientId.toString(), { full_name: patientData.full_name, municipality: patientData.municipality });
        }

        // Check if a service record already exists for this patient on this date
        const { data: existingService } = await supabase.from('patient_services')
          .select('*')
          .eq('patient_id', patientId)
          .eq('date_of_service', serviceData.date_of_service)
          .maybeSingle();

        if (existingService) {
          // Merge boolean flags
          const mergedData: any = {};
          Object.keys(serviceData).forEach(key => {
            if (typeof serviceData[key] === 'boolean') {
              mergedData[key] = serviceData[key] || existingService[key];
            } else {
              mergedData[key] = serviceData[key];
            }
          });

          const { error: sError } = await supabase.from('patient_services')
            .update(mergedData)
            .eq('id', existingService.id);
          
          if (sError) return res.status(500).json({ error: sError.message });
          
          await logAudit(_user, 'UPDATE', 'service', existingService.id.toString(), { patient_id: patientId, date: serviceData.date_of_service, merged: true });
          flushCache();
          return res.json({ id: patientId, serviceId: existingService.id, merged: true });
        }

        // Now insert the service record
        const { data: service, error: sError } = await supabase.from('patient_services').insert([{
          ...serviceData,
          patient_id: patientId
        }]).select();
        
        if (sError) {
          console.error("Error inserting service history:", sError);
          const isRLS = sError.message?.toLowerCase().includes('security policy') || sError.code === '42501';
          if (isRLS) {
            // If history fails due to RLS, we still return success because the patient record was saved/updated
            return res.json({ 
              id: patientId, 
              warning: "Patient saved, but service history could not be recorded due to database RLS policies. Please apply the policies in supabase_schema.sql.",
              partialSuccess: true
            });
          }
          return res.status(500).json({ error: sError.message || "Unknown database error", details: sError });
        }
        
        await logAudit(_user, 'CREATE', 'service', service[0].id.toString(), { patient_id: patientId, date: serviceData.date_of_service });
        
        flushCache();
        return res.json({ id: patientId, serviceId: service[0].id });
      }
    } else if (req.method === 'OPTIONS') {
      return res.status(200).end();
    } else {
      return res.status(405).json({ error: `Method not allowed in patients list handler. Received: ${req.method}` });
    }
  } catch (err: any) {
    console.error("Unhandled API error:", err);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
