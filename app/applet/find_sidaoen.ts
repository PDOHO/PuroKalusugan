import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('patient_services')
    .select(`
      id,
      date_of_service,
      patients!inner(
        id,
        full_name,
        municipality,
        barangay,
        date_of_service
      )
    `)
    .eq('date_of_service', '2024-06-23')
    .ilike('patients.municipality', '%santa cruz%')
    .ilike('patients.barangay', '%sidaoen%');

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} services in Sidaoen, Santa Cruz with service date 2024-06-23.`);
  
  if (data && data.length > 0) {
    data.forEach((s: any) => {
      console.log(`- Patient ID: ${s.patients.id}, Name: ${s.patients.full_name}, PatDate: ${s.patients.date_of_service}, SrvDate: ${s.date_of_service}, SrvID: ${s.id}`);
    });
  }
}

main();
