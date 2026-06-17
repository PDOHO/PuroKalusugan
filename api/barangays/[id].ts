import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { flushCache } from '../stats';
import { logAudit } from '../_lib.js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id || (req.body && req.body.id);
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid ID' });

  const method = req.method ? req.method.toUpperCase() : '';
  const action = req.query.action || (req.body && req.body._action);
  const _user = req.body && req.body._user;

  // Role check: Only ADMIN can perform write operations on barangays
  if (!_user || _user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized: Only administrators can modify barangay profiles.' });
  }

  if (method === 'PUT' || (method === 'POST' && action === 'update')) {
    const { id: _, _action, _user: __user, ...barangayData } = req.body;
    const { error } = await supabase.from('barangays').update(barangayData).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    
    await logAudit(_user, 'UPDATE', 'barangay', id.toString(), { barangay_name: barangayData.barangay_name, municipality: barangayData.municipality });
    
    flushCache();
    return res.json({ success: true });
  } else if (method === 'DELETE' || (method === 'POST' && action === 'delete')) {
    console.log(`[DELETE] Attempting to delete barangay with ID: ${id}`);
    
    const { data: barangayToDelete } = await supabase.from('barangays').select('barangay_name, municipality').eq('id', id).single();
    
    const { error } = await supabase.from('barangays').delete().eq('id', id);
    if (error) {
      console.error('[DELETE ERROR] Supabase error:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: error.message, details: error });
    }
    
    await logAudit(_user, 'DELETE', 'barangay', id.toString(), barangayToDelete || { id });
    
    flushCache();
    return res.json({ success: true });
  } else {
    return res.status(405).json({ error: `Method not allowed. Received: ${req.method}` });
  }
}
