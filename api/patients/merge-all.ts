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

    return res.status(400).json({
      error: "Automated Bulk Merge Disabled",
      message: "Live automated merging across all 330,000+ records has been disabled to prevent compute IOPS exhaustion and prevent accidental merging of family members/twins. Please use verified batch scripts or merge individual verified records."
    });
  } catch (error: any) {
    console.error("Merge error:", error);
    return res.status(500).json({ error: error.message || "Failed to merge duplicates" });
  }
}
