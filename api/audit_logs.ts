import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { page = 1, limit = 20, action, entity_type, search, username } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase.from('audit_logs').select('*', { count: 'estimated' });

    if (action) {
      query = query.eq('action', action);
    }
    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }
    if (username) {
      query = query.eq('username', username);
    }
    if (search) {
      const safeSearch = (search as string).replace(/"/g, '""');
      query = query.or(`username.ilike."%${safeSearch}%",details->>full_name.ilike."%${safeSearch}%"`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message.includes('schema cache')) {
        return res.status(404).json({ error: 'Audit logs table has not been created in the database yet.', details: error });
      }
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message, details: error });
    }

    return res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err: any) {
    console.error("Audit logs fetch error:", err);
    return res.status(500).json({ error: err.message });
  }
}
