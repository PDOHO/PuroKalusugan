import { VercelRequest, VercelResponse } from '@vercel/node';
import { logAudit } from './_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { _user, action, entity_type, entity_id, details } = req.body;
    
    if (!_user || !action || !entity_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await logAudit(_user, action, entity_type, entity_id, details);
    
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Audit log error:", err);
    return res.status(500).json({ error: err.message });
  }
}
