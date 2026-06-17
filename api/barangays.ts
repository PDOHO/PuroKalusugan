import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, flushCache, logAudit } from './_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const { page = 1, limit = 50, search = '', municipality = '', program = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = supabase.from('barangays').select('*', { count: 'exact' });

      if (search) {
        const safeSearch = (search as string).replace(/"/g, '""');
        query = query.or(`barangay_name.ilike."%${safeSearch}%",municipality.ilike."%${safeSearch}%"`);
      }
      if (municipality) {
        query = query.ilike('municipality', municipality as string);
      }
      if (program) {
        const p = program as string;
        if (p === 'Nutrition') {
          // Nutrition is mandatory for all, so we don't strictly need to filter, 
          // but for consistency we can just return all or filter by a dummy condition if needed.
          // Since it's mandatory, let's just let it pass.
        } else {
          query = query.or(`program2_name.eq."${p}",program3_name.eq."${p}",program4_name.eq."${p}"`);
        }
      }

      const { data, error, count } = await query
        .order('municipality', { ascending: true })
        .order('barangay_name', { ascending: true })
        .range(offset, offset + Number(limit) - 1);

      if (error) {
        if (error.code === 'PGRST103') {
          return res.json({ data: [], total: count, page: Number(page), limit: Number(limit) });
        }
        return res.status(500).json({ error: error.message });
      }
      
      return res.json({ data, total: count, page: Number(page), limit: Number(limit) });
    } else if (req.method === 'POST') {
      console.log("POST /api/barangays body:", req.body);
      const { _action, id, _user, ...barangayData } = req.body;

      // Role check: Only ADMIN can perform write operations on barangays
      if (!_user || _user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Unauthorized: Only administrators can modify barangay profiles.' });
      }

      if (_action === 'update') {
        if (!id) return res.status(400).json({ error: 'Barangay ID is required for update' });

        // Check for duplicate (excluding current)
        const trimmedBarangayName = barangayData.barangay_name ? barangayData.barangay_name.trim() : '';
        
        const { data: existing, error: dupError } = await supabase.from('barangays')
          .select('id')
          .ilike('barangay_name', trimmedBarangayName)
          .eq('municipality', barangayData.municipality)
          .neq('id', id)
          .limit(1)
          .maybeSingle();

        if (existing || (dupError && dupError.code === 'PGRST116')) {
          return res.status(409).json({ error: "Barangay already exists in this municipality." });
        }

        // Sanitize data to only include valid columns
        const allowedFields = [
          'municipality', 'barangay_name', 'puroks', 'pk_teams', 'pk_team_members', 
          'pk_kits_received', 'pk_members_oriented', 'program1_target', 
          'program2_name', 'program2_target', 'program3_name', 'program3_target', 
          'program4_name', 'program4_target', 'actual_population', 'projected_population'
        ];
        const sanitizedData = Object.keys(barangayData)
          .filter(key => allowedFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = barangayData[key];
            return obj;
          }, {} as any);
          
        sanitizedData.barangay_name = trimmedBarangayName;

        const { error } = await supabase.from('barangays').update(sanitizedData).eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        
        await logAudit(_user, 'UPDATE', 'barangay', id.toString(), { barangay_name: barangayData.barangay_name, municipality: barangayData.municipality });
        
        flushCache();
        return res.json({ success: true });

      } else if (_action === 'delete') {
        if (!id) return res.status(400).json({ error: 'Barangay ID is required for deletion' });

        const { data: barangayToDelete } = await supabase.from('barangays').select('barangay_name, municipality').eq('id', id).single();

        const { error } = await supabase.from('barangays').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        
        await logAudit(_user, 'DELETE', 'barangay', id.toString(), barangayToDelete || { id });
        
        flushCache();
        return res.json({ success: true });

      } else {
        // Create (Default)
        // Check for duplicate
        const trimmedBarangayName = barangayData.barangay_name ? barangayData.barangay_name.trim() : '';
        
        const { data: existing, error: dupError } = await supabase.from('barangays')
          .select('id')
          .ilike('barangay_name', trimmedBarangayName)
          .eq('municipality', barangayData.municipality)
          .limit(1)
          .maybeSingle();
    
        if (existing || (dupError && dupError.code === 'PGRST116')) {
          return res.status(409).json({ error: "Barangay already exists in this municipality." });
        }
    
        // Sanitize data to only include valid columns
        const allowedFields = [
          'municipality', 'barangay_name', 'puroks', 'pk_teams', 'pk_team_members', 
          'pk_kits_received', 'pk_members_oriented', 'program1_target', 
          'program2_name', 'program2_target', 'program3_name', 'program3_target', 
          'program4_name', 'program4_target', 'actual_population', 'projected_population'
        ];
        const sanitizedData = Object.keys(barangayData)
          .filter(key => allowedFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = barangayData[key];
            return obj;
          }, {} as any);
          
        sanitizedData.barangay_name = trimmedBarangayName;
    
        const { data, error } = await supabase.from('barangays').insert([sanitizedData]).select();
        if (error) {
          console.error("POST /api/barangays error message:", error.message);
          return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
        }
        
        await logAudit(_user, 'CREATE', 'barangay', data[0].id.toString(), { barangay_name: barangayData.barangay_name, municipality: barangayData.municipality });
        
        flushCache();
        return res.json({ id: data[0].id });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err: any) {
    console.error("Unhandled API error in barangays:", err);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
