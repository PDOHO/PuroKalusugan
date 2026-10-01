import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL="https://vernageujrplrgtowrdo.supabase.co"
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw"
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
async function run() {
    const { data, error } = await supabase.from('dashboard_summary').select('id').limit(1);
    if(error) console.log(error);
    else console.log("dashboard_summary exists and accessible.");
}
run();
