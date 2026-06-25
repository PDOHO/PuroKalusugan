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
      patient_id,
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

  console.log(`Found ${data?.length || 0} services to update.`);
  
  if (data && data.length > 0) {
    for (const s of data) {
      console.log(`Updating Service ID: ${s.id} and Patient ID: ${s.patient_id}...`);
      
      const { error: srvError } = await supabase
        .from('patient_services')
        .update({ date_of_service: '2026-06-24' })
        .eq('id', s.id);
        
      if (srvError) {
        console.error(`Error updating service ${s.id}:`, srvError);
      }
      
      const { error: patError } = await supabase
        .from('patients')
        .update({ date_of_service: '2026-06-24' })
        .eq('id', s.patient_id)
        .eq('date_of_service', '2024-06-23'); // only update if it was 2024-06-23 just to be safe
        
      if (patError) {
        console.error(`Error updating patient ${s.patient_id}:`, patError);
      }
    }
    console.log("Update completed. Triggering materialized views refresh by invoking the patient fetch to warm cache if necessary, or manually doing it later.");
  }
}

main();
