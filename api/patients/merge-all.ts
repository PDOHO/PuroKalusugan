import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, flushCache, logAudit } from '../_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const _user = req.body._user;
    if (!_user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 1. Find all duplicates
    // We can fetch all patients and group them
    let allPatients: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: chunk, error: chunkError } = await supabase
        .from('patients')
        .select('id, full_name, birthdate, municipality, barangay, sex, date_of_service')
        .range(from, from + step - 1);

      if (chunkError) {
        throw chunkError;
      }

      if (chunk && chunk.length > 0) {
        allPatients = allPatients.concat(chunk);
        from += step;
        if (chunk.length < step) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    // Group by full_name, birthdate, municipality
    const groups = new Map<string, any[]>();
    allPatients.forEach(p => {
      const key = `${p.full_name.toLowerCase()}|${p.birthdate}|${p.municipality.toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(p);
    });

    const duplicateGroups = Array.from(groups.values()).filter(g => g.length > 1);

    if (duplicateGroups.length === 0) {
      return res.json({ status: 'ok', message: 'No duplicates found to merge.', mergedCount: 0 });
    }

    let totalMerged = 0;

    // 2. For each group, merge
    for (const group of duplicateGroups) {
      // Sort by date_of_service descending to get the latest as primary
      group.sort((a, b) => new Date(b.date_of_service).getTime() - new Date(a.date_of_service).getTime());
      
      const primary = group[0];
      const secondaries = group.slice(1);
      const secondaryIds = secondaries.map(s => s.id);

      // Fetch all services for this group
      const allIds = group.map(g => g.id);
      const { data: services, error: servicesError } = await supabase
        .from('patient_services')
        .select('*')
        .in('patient_id', allIds);

      if (servicesError) {
        console.error("Error fetching services for group", servicesError);
        continue;
      }

      // Merge boolean flags and date_of_service into primary patient
      let primaryUpdated = false;
      const primaryUpdateData: any = {};
      
      for (const s of secondaries) {
        if (s.date_of_service && (!primary.date_of_service || new Date(s.date_of_service) > new Date(primary.date_of_service))) {
          primary.date_of_service = s.date_of_service;
          primaryUpdateData.date_of_service = s.date_of_service;
          primaryUpdated = true;
        }
        
        Object.keys(s).forEach(key => {
          if (typeof s[key] === 'boolean' && s[key] === true && !primary[key]) {
            primary[key] = true;
            primaryUpdateData[key] = true;
            primaryUpdated = true;
          }
        });
      }

      if (primaryUpdated) {
        await supabase.from('patients').update(primaryUpdateData).eq('id', primary.id);
      }

      // Reassign all services to primary patient_id
      const servicesToUpdate = (services || []).filter(s => s.patient_id !== primary.id);
      if (servicesToUpdate.length > 0) {
        const updates = servicesToUpdate.map(s => ({
          ...s,
          patient_id: primary.id
        }));
        
        // Upsert the updated services
        const { error: updateError } = await supabase
          .from('patient_services')
          .upsert(updates);
          
        if (updateError) {
          console.error("Error updating services", updateError);
          continue;
        }
      }

      // Now we need to deduplicate services for the primary patient (same date_of_service)
      // Fetch all services for primary now
      const { data: primaryServices, error: psError } = await supabase
        .from('patient_services')
        .select('*')
        .eq('patient_id', primary.id);
        
      if (!psError && primaryServices && primaryServices.length > 0) {
        const servicesByDate = new Map<string, any[]>();
        primaryServices.forEach(s => {
          if (!servicesByDate.has(s.date_of_service)) {
            servicesByDate.set(s.date_of_service, []);
          }
          servicesByDate.get(s.date_of_service)!.push(s);
        });
        
        for (const [date, dateServices] of servicesByDate.entries()) {
          if (dateServices.length > 1) {
            // Merge them
            const mergedService = { ...dateServices[0] };
            const idsToDelete = [];
            
            for (let i = 1; i < dateServices.length; i++) {
              const s = dateServices[i];
              idsToDelete.push(s.id);
              // Merge boolean flags
              Object.keys(s).forEach(key => {
                if (typeof s[key] === 'boolean' && s[key] === true) {
                  mergedService[key] = true;
                }
              });
            }
            
            // Update the merged one
            await supabase.from('patient_services').upsert(mergedService);
            
            // Delete the redundant ones
            if (idsToDelete.length > 0) {
              await supabase.from('patient_services').delete().in('id', idsToDelete);
            }
          }
        }
      }

      // Delete secondary patients
      const { error: deleteError } = await supabase
        .from('patients')
        .delete()
        .in('id', secondaryIds);

      if (deleteError) {
        console.error("Error deleting secondary patients", deleteError);
        continue;
      }

      totalMerged += secondaryIds.length;
    }

    await logAudit(_user, 'UPDATE', 'patient', 'merge_duplicates', { 
      merged_count: totalMerged,
      groups_processed: duplicateGroups.length
    });
    
    flushCache();
    return res.json({ 
      status: 'ok', 
      message: `Successfully merged ${totalMerged} duplicate patient records across ${duplicateGroups.length} groups.`,
      mergedCount: totalMerged
    });

  } catch (error: any) {
    console.error("Merge error:", error);
    return res.status(500).json({ error: error.message || "Failed to merge duplicates" });
  }
}
