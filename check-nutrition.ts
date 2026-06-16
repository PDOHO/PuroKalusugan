import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: pData, error: pError } = await supabase.from('patients')
      .select('id, full_name, municipality, barangay, nutrition')
      .ilike('municipality', 'bantay')
      .ilike('barangay', 'taleb')
      .eq('nutrition', true);

  if (pError) {
      console.error(pError);
      return;
  }

  console.log(`Found ${pData.length} patients with nutrition=true in taleb, bantay.`);

  const patientIds = pData.map(p => p.id);

  if (patientIds.length > 0) {
      const { data: psData, error: psError } = await supabase.from('patient_services')
          .select('id, patient_id, nutrition')
          .in('patient_id', patientIds)
          .eq('nutrition', true);

      console.log(`For these ${pData.length} patients, there are ${psData?.length || 0} patient_services with nutrition=true.`);
  }

  // What about patient_services where nutrition=true but patient doesn't have nutrition=true?
  const { data: pData2 } = await supabase.from('patients')
      .select('id')
      .ilike('municipality', 'bantay')
      .ilike('barangay', 'taleb');

  const { data: psData2 } = await supabase.from('patient_services')
      .select('id, patient_id')
      .in('patient_id', pData2.map(p => p.id))
      .eq('nutrition', true);
  
  console.log(`Total patient_services with nutrition=true in taleb, bantay: ${psData2?.length || 0}`);
}
run();
