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
      .ilike('municipality', 'sinait')
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
  
  // DO NOT UNTAG YET, just generate the script
  // Uncomment below to actually untag
  /*
  let updatedCount = 0;
  const serviceIds = servicesToUpdate.map(s => s.id);
  for (let i = 0; i < serviceIds.length; i += 100) {
    const chunk = serviceIds.slice(i, i + 100);
    const { error } = await supabase
      .from('patient_services')
      .update({ cancer: false })
      .in('id', chunk);
      
    if (error) {
      console.error("Error updating services:", error);
      return;
    }
    updatedCount += chunk.length;
    console.log(`Updated ${updatedCount} / ${serviceIds.length} services...`);
  }
  console.log(`Successfully untagged cancer from ${updatedCount} services.`);
  
  // Refresh materialized views
  console.log("Refreshing materialized views...");
  await supabase.rpc('refresh_mv_patient_first_services');
  await supabase.rpc('refresh_mv_activity_services');
  console.log("Done.");
  */
}

run();
