import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error, count } = await supabase.from('audit_logs').select('id, details', { count: 'exact' });
  if (error) {
     console.error('Error:', error);
  } else {
     console.log('audit_logs count:', count);
     // Estimate size
     const bytes = JSON.stringify(data).length;
     console.log('Approximate size in MB (JSON payload size):', (bytes / 1024 / 1024).toFixed(3), 'MB');
  }

  // We can try calling standard REST rpc for size if they have one, but we don't.
  // Also we can get patient_services size
  const pData = await supabase.from('patient_services').select('id', { count: 'exact', head: true });
  console.log('patient_services count:', pData.count);
}
run();
