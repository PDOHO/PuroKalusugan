import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, logAudit } from '../_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { _user, municipality, barangay, search, program, year, month, large_scale } = req.body;

  if (!_user || _user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Build query to identify patients to delete
    const hasServiceFilter = !!year || !!program || !!large_scale;
    let query;

    if (hasServiceFilter) {
      const subfields: string[] = [];
      if (program) subfields.push(program as string);
      if (large_scale) subfields.push('large_scale_pk_activity');

      query = supabase.from('patients').select('id, patient_services!inner(id)');
    } else {
      query = supabase.from('patients').select('id');
    }

    if (search) {
      const safeSearch = (search as string).replace(/"/g, '""');
      query = query.or(`full_name.ilike."%${safeSearch}%",municipality.ilike."%${safeSearch}%",barangay.ilike."%${safeSearch}%"`);
    }
    if (municipality) query = query.ilike('municipality', municipality as string);
    if (barangay) query = query.ilike('barangay', barangay as string);
    
    if (hasServiceFilter) {
      if (program) {
        query = query.eq(`patient_services.${program}`, true);
      }
      if (large_scale === 'yes') {
        query = query.eq('patient_services.large_scale_pk_activity', true);
      } else if (large_scale === 'no') {
        query = query.eq('patient_services.large_scale_pk_activity', false);
      }

      if (year) {
        const y = Number(year);
        if (month) {
          const m = Number(month);
          const filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
          const filterEnd = new Date(y, m, 0).toISOString().split('T')[0];
          query = query.gte('patient_services.date_of_service', filterStart).lte('patient_services.date_of_service', filterEnd);
        } else {
          const filterStart = `${y}-01-01`;
          const filterEnd = `${y}-12-31`;
          query = query.gte('patient_services.date_of_service', filterStart).lte('patient_services.date_of_service', filterEnd);
        }
      }
    }

    const { data: patientsToDelete, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const patients = patientsToDelete as any[];
    if (!patients || patients.length === 0) {
      return res.json({ message: 'No patients found to delete' });
    }

    const patientIds = patients.map(p => p.id);

    // 2. Delete patients in batches of 500 to prevent statement timeouts and database lock escalation
    const CHUNK_SIZE = 500;
    for (let i = 0; i < patientIds.length; i += CHUNK_SIZE) {
      const chunk = patientIds.slice(i, i + CHUNK_SIZE);
      const { error: deleteError } = await supabase
        .from('patients')
        .delete()
        .in('id', chunk);

      if (deleteError) {
        console.error(`[Delete Filtered API] Batch delete failed at index ${i}:`, deleteError);
        throw deleteError;
      }
    }

    await logAudit(_user, 'DELETE', 'patients_filtered', JSON.stringify({ patientIds }), { count: patientIds.length });

    return res.json({ message: `Successfully deleted ${patientIds.length} patients` });
  } catch (err: any) {
    console.error("[Delete Filtered API] Error:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
}
