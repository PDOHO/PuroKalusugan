import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching Sinait patients with cancer services...");
  let patients = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, municipality')
      .eq('municipality', 'Sinait')
      .range(page * 1000, (page + 1) * 1000 - 1);
      
    if (error) {
      console.error("Error fetching patients:", error);
      return;
    }
    
    if (data.length === 0) {
      hasMore = false;
    } else {
      patients = patients.concat(data);
      page++;
    }
  }
  
  console.log(`Found ${patients.length} patients in Sinait.`);

  if (patients.length === 0) return;

  const patientIds = patients.map(p => p.id);

  let servicesToUpdate = [];
  
  // Chunk patientIds
  for (let i = 0; i < patientIds.length; i += 100) {
    const chunk = patientIds.slice(i, i + 100);
    let hasMoreServices = true;
    let servicePage = 0;
    while(hasMoreServices) {
      const { data: services, error: sError } = await supabase
        .from('patient_services')
        .select('id, patient_id')
        .in('patient_id', chunk)
        .eq('cancer', true)
        .range(servicePage * 1000, (servicePage + 1) * 1000 - 1);
      
      if (sError) {
        console.error("Error fetching services:", sError);
        return;
      }
      
      if(services.length === 0) {
        hasMoreServices = false;
      } else {
        servicesToUpdate = servicesToUpdate.concat(services);
        servicePage++;
      }
    }
  }

  console.log(`Found ${servicesToUpdate.length} cancer services for these patients.`);
}

run();
