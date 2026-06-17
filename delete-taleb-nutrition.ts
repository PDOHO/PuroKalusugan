import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching patients in Bantay, Taleb with nutrition=true...');
  const { data: pData, error: pError } = await supabase.from('patients')
      .select('id')
      .ilike('municipality', 'bantay')
      .ilike('barangay', 'taleb')
      .eq('nutrition', true);

  if (pError) {
      console.error('Error fetching patients:', pError);
      return;
  }
  
  const patientIds = pData.map(p => p.id);
  console.log(`Found ${patientIds.length} patients.`);

  if (patientIds.length > 0) {
      // Update patient_services
      const { error: psUpdateError } = await supabase.from('patient_services')
          .update({ nutrition: false })
          .in('patient_id', patientIds)
          .eq('nutrition', true);

      if (psUpdateError) {
          console.error('Error updating patient_services:', psUpdateError);
      } else {
          console.log('Successfully removed nutrition tags from patient_services.');
      }

      // Update patients
      const { error: pUpdateError } = await supabase.from('patients')
          .update({ nutrition: false })
          .in('id', patientIds)
          .eq('nutrition', true);
          
      if (pUpdateError) {
          console.error('Error updating patients:', pUpdateError);
      } else {
          console.log('Successfully removed nutrition tags from patients.');
      }
      
      // Update dashboard_summary incrementally 
      // (Since we know we removed exactly patientIds.length nutrition tags)
      const { data: dashboardData } = await supabase.from('dashboard_summary')
          .select('*')
          .ilike('municipality', 'bantay')
          .ilike('barangay', 'taleb')
          .single();
          
      if (dashboardData) {
          await supabase.from('dashboard_summary')
              .update({ nutrition: Math.max(0, dashboardData.nutrition - patientIds.length) })
              .eq('id', dashboardData.id);
          console.log('Updated dashboard_summary successfully.');
      }
  }
}
run();
