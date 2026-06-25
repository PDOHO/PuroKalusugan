import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, flushCache, logAudit } from '../_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[ID-Handler] Request received`);
  console.log(`[ID-Handler] Method: ${req.method}`);
  console.log(`[ID-Handler] Query:`, req.query);
  console.log(`[ID-Handler] Body keys:`, Object.keys(req.body || {}));

  res.setHeader('X-Handler', 'ID-Handler');
  const id = req.query.id || (req.body && req.body.id);
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid ID' });

  const method = req.method ? req.method.toUpperCase() : '';
  const action = req.query.action || (req.body && req.body._action);
  const _user = req.body && req.body._user;

  if (method === 'PUT' || (method === 'POST' && action === 'update')) {
    const { data: existing } = await supabase.from('patients')
      .select('id')
      .ilike('full_name', req.body.full_name)
      .eq('birthdate', req.body.birthdate)
      .ilike('municipality', req.body.municipality)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: "A patient with the same name and birthdate already exists in this municipality." });
    }

    const patientFields = ['full_name', 'municipality', 'barangay', 'birthdate', 'sex'];
    const updateData: any = {};
    Object.keys(req.body).forEach(key => {
      if (patientFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });
    
    const { error } = await supabase.from('patients').update(updateData).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    
    await logAudit(_user, 'UPDATE', 'patient', id.toString(), { full_name: req.body.full_name, municipality: req.body.municipality });
    
    flushCache();
    return res.json({ success: true });
  } else if (method === 'DELETE' || (method === 'POST' && action === 'delete')) {
    const { data: patientToDelete } = await supabase.from('patients').select('full_name, municipality').eq('id', id).single();

    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    
    await logAudit(_user, 'DELETE', 'patient', id.toString(), patientToDelete || { id });
    
    flushCache();
    return res.json({ success: true });
  } else if (method === 'OPTIONS') {
    return res.status(200).end();
  } else if (method === 'GET') {
     const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
     if (error) return res.status(500).json({ error: error.message });
     if (!data) return res.status(404).json({ error: 'Patient not found' });
     return res.json(data);
  } else {
    return res.status(405).json({ error: `Method not allowed. Received: ${req.method} (normalized: ${method})` });
  }
}
