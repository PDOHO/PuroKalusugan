import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, supabaseLong, flushCache, logAudit } from './_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('X-Handler', 'List-Handler');
    if (req.method === 'GET') {
      const { page = 1, limit = 50, search = '', municipality = '', barangay = '', program = '', year = '', month = '', patient_id, duplicates_only, large_scale = '', new_only = '' } = req.query;
      
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
        
        if (year || month) {
          const y = year ? Number(year) : new Date().getFullYear();
          if (month) {
            const m = Number(month);
            filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
            filterEnd = new Date(y, m, 0).toISOString().split('T')[0];
          } else {
            filterStart = `${y}-01-01`;
            filterEnd = `${y}-12-31`;
          }
        }

        const { data: rpcData, error: rpcError } = await supabaseLong.rpc('get_new_patients', {
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

      if (duplicates_only === 'true') {
        if (!municipality) {
          return res.status(400).json({
            error: "Municipality Required",
            message: "Please select a Municipality in the filters to find duplicates. Province-wide scans across all 330,000+ records are restricted to prevent compute IO overload."
          });
        }

        // Fetch records scoped strictly to the selected municipality to eliminate full-table disk scans
        let mQuery = supabase
          .from('patients')
          .select('id, full_name, birthdate, barangay, sex')
          .ilike('municipality', municipality as string);

        if (barangay) {
          mQuery = mQuery.ilike('barangay', barangay as string);
        }
        if (search) {
          mQuery = mQuery.ilike('full_name', `%${search}%`);
        }

        let townPatients: any[] = [];
        let from = 0;
        const step = 1000;
        while (from < 35000) {
          const { data: chunk, error: cErr } = await mQuery.range(from, from + step - 1);
          if (cErr) return res.status(500).json({ error: cErr.message });
          if (!chunk || chunk.length === 0) break;
          townPatients = townPatients.concat(chunk);
          if (chunk.length < step) break;
          from += step;
        }

        // Group by normalized name and birthdate in memory
        const groups = new Map<string, number[]>();
        townPatients.forEach(p => {
          const cleanName = (p.full_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const key = `${cleanName}|${p.birthdate}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(p.id);
        });

        const duplicateIds = new Set<number>();
        groups.forEach(ids => {
          if (ids.length > 1) {
            ids.forEach(id => duplicateIds.add(id));
          }
        });

        const duplicatePatients = townPatients
          .filter(p => duplicateIds.has(p.id))
          .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        const totalCount = duplicatePatients.length;
        const offset = (Number(page) - 1) * Number(limit);
        const pageRecords = duplicatePatients.slice(offset, offset + Number(limit));
        const pageIds = pageRecords.map(p => p.id);

        if (pageIds.length === 0) {
          return res.json({ data: [], total: totalCount, page: Number(page), limit: Number(limit) });
        }

        // Fetch full records and services for just this page's 50 IDs
        const { data: pageFullData, error: fError } = await supabase
          .from('patients')
          .select(`
            id, full_name, municipality, barangay, birthdate, sex,
            patient_services(
              date_of_service, health_promotion, fpe, philhealth, referral, wash, nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety, mental_health, tb, hiv, large_scale_pk_activity
            )
          `)
          .in('id', pageIds);

        if (fError) return res.status(500).json({ error: fError.message });

        const sortedData = pageIds.map(id => pageFullData?.find(d => d.id === id)).filter(Boolean);

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

        return res.json({ data: formattedData, total: totalCount, page: Number(page), limit: Number(limit) });
      }

      const offset = (Number(page) - 1) * Number(limit);
      const isSearchActive = !!(search && (search as string).trim().length >= 2);

      const hasServiceFilter = !!year || !!month || !!program || !!large_scale;

      const buildFilters = (q: any) => {
        // Apply municipality and barangay first to leverage indexes
        if (municipality) {
          q = q.eq('municipality', municipality as string);
        }
        if (barangay) {
          q = q.eq('barangay', barangay as string);
        }
        if (isSearchActive) {
          const safeSearch = (search as string).trim().replace(/"/g, '""');
          q = q.ilike('full_name', `%${safeSearch}%`);
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

          if (year || month) {
            const y = year ? Number(year) : new Date().getFullYear();
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
          q = supabaseLong.from('patients').select(`id, patient_services!inner(${subfields.join(',')})`, { count: 'exact', head: true });
        } else {
          q = supabaseLong.from('patients').select('id', { count: 'estimated', head: true });
        }
        return buildFilters(q);
      };

      const getDataQuery = (fetchExtra: boolean = false) => {
        let q;
        if (hasServiceFilter) {
          const subfields: string[] = ['date_of_service'];
          if (program) subfields.push(program as string);
          if (large_scale) subfields.push('large_scale_pk_activity');
          q = supabaseLong.from('patients').select(`
            id, full_name, municipality, barangay, birthdate, sex,
            patient_services!inner(${subfields.join(',')})
          `);
        } else {
          q = supabaseLong.from('patients').select(`
            id, full_name, municipality, barangay, birthdate, sex
          `);
        }
        const fetchLimit = Number(limit) + (fetchExtra ? 1 : 0);
        return buildFilters(q).order('id', { ascending: false }).range(offset, offset + fetchLimit - 1);
      };

      let patientsList: any[] | null = null;
      let patientsError: any = null;
      let count: number | null = null;

      try {
        if (isSearchActive) {
          // Optimization: Skip heavy full-table count query on text searches to avoid disk IO exhaustion
          const dataRes = await getDataQuery(true);
          if (dataRes.error) {
            patientsError = dataRes.error;
          } else {
            const rawData = dataRes.data || [];
            const hasMore = rawData.length > Number(limit);
            patientsList = hasMore ? rawData.slice(0, Number(limit)) : rawData;
            // Provide a fast dynamic count for pagination without full-table disk scan
            count = offset + patientsList.length + (hasMore ? 50 : 0);
          }
        } else {
          // Standard browsing by municipality/barangay
          const [countRes, dataRes] = await Promise.all([
            getCountQuery(),
            getDataQuery(false)
          ]);
          
          if (dataRes.data) {
            patientsList = dataRes.data;
            if (countRes.count !== null && countRes.count !== undefined) {
              count = countRes.count;
            } else {
              const hasMore = patientsList.length >= Number(limit);
              count = offset + patientsList.length + (hasMore ? 50 : 0);
            }
          } else if (dataRes.error) {
            patientsError = dataRes.error;
          }
        }
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

      if (isTimeoutError || (patientsError && !patientsList)) {
        console.warn("[Patients API] Timeout or error detected. Retrying direct data query...");
        try {
          const dataRes = await getDataQuery();
          if (dataRes.data) {
            patientsList = dataRes.data;
            patientsError = null;
            const receivedCount = patientsList?.length || 0;
            count = offset + receivedCount + (receivedCount >= Number(limit) ? 50 : 0);
          } else if (dataRes.error) {
            patientsError = dataRes.error;
          }
        } catch (err: any) {
          patientsError = err;
        }
      }

      if (patientsError && !patientsList) {
        console.error("Supabase error:", patientsError);
        return res.status(500).json({ error: patientsError.message || JSON.stringify(patientsError), details: patientsError });
      }

      // Fetch the full service histories ONLY for this current page's active patient IDs (usually 20 IDs)
      const pageIds = (patientsList || []).map(p => p.id);
      const serviceHistoryMap = new Map<number, any[]>();

      if (pageIds.length > 0) {
        const { data: servicesData, error: servicesError } = await supabaseLong
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
      const hasDateFilter = !!year || !!month;
      if (hasDateFilter) {
        const y = year ? Number(year) : new Date().getFullYear();
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
        const targetServices = hasDateFilter
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
          // Fallback if no matching range service was loaded
          // We can't rely on p anymore as we removed the columns. Leave compatService to false/null
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
        'full_name', 'municipality', 'barangay', 'birthdate', 'sex'
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
        
        // Use index-friendly exact matching on municipality & birthdate
        let existingQuery = supabase.from('patients').select('id');
        if (patientData.municipality) {
          existingQuery = existingQuery.eq('municipality', patientData.municipality);
        }
        if (patientData.birthdate) {
          existingQuery = existingQuery.eq('birthdate', patientData.birthdate);
        }
        const { data: existing } = await existingQuery
          .ilike('full_name', (patientData.full_name || '').trim())
          .limit(1)
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
