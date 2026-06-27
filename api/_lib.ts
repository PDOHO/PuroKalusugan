import { createClient } from '@supabase/supabase-js';
import NodeCache from 'node-cache';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';

console.log(`[Lib] Supabase URL: ${supabaseUrl.substring(0, 20)}...`);
console.log(`[Lib] Supabase Key present: ${!!process.env.SUPABASE_ANON_KEY}`);

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) => {
      // 9 seconds timeout for fast queries to prevent proxy timeout
      return fetch(url, { ...options, signal: AbortSignal.timeout(9000) });
    }
  }
});

export const supabaseLong = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) => {
      // 120 seconds timeout for heavy RPCs
      return fetch(url, { ...options, signal: AbortSignal.timeout(120000) });
    },
    headers: {
      'Statement-Timeout': '119000' // Tell postgres to safely abort slightly before Node fetches aborts
    }
  }
});
export const cache = new NodeCache({ stdTTL: 86400 }); // Cache for 24h, we use SWR in stats API

export const flushCache = () => {
  cache.flushAll();
  console.log("Cache flushed");
};

export const logAudit = async (
  user: { id: string; username: string; role: string } | undefined,
  action: string,
  entity_type: string,
  entity_id: string | null,
  details: any
) => {
  if (!user) return; // Silent fail if no user provided
  
  try {
    const { error } = await supabase.from('audit_logs').insert([{
      user_id: user.id,
      username: user.username,
      role: user.role,
      action,
      entity_type,
      entity_id,
      details
    }]);
    
    if (error) {
      console.error("Failed to write audit log to Supabase:", error.message);
    }
  } catch (err) {
    console.error("Failed to log audit event:", err);
  }
};
