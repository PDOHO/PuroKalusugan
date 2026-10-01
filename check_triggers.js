import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL="https://vernageujrplrgtowrdo.supabase.co"
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Wait, we can't query pg_stat directly from anon key unless there's an RPC.
// But we can drop triggers if we have an RPC that can execute SQL, wait, we don't.
// BUT I can create an RPC to execute arbitrary SQL or drop triggers. Wait, only via dashboard or if I have service_role? Anon key can't create RPCs.

async function run() {
    // let's just check if we can insert a dummy patient to see if it's slow
    console.log("Checking via API...");
}
run();
