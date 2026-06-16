import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_dashboard_service_stats', {
      p_municipality: null,
      p_barangay: null,
      p_start_date: '2026-01-01',
      p_end_date: '2026-12-31'
  });
  console.log(JSON.stringify(data.muniStats.slice(0, 2), null, 2));
}

check();
