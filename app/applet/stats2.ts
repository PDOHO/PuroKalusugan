import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getStats() {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_service_stats', {
      p_municipality: null,
      p_barangay: null,
      p_start_date: '2026-01-01',
      p_end_date: '2026-05-05' // using current date
  });
  
  if (rpcError) {
      console.error(rpcError);
      return;
  }
  
  console.log("Total Population Reached (YTD up to May 5):", rpcData.programStats.total_population_reached);
  
  const { data: bData } = await supabase.from('barangays').select('*');
  let tPop = 0;
  for (const b of bData || []) {
      tPop += (b.total_population || 0);
  }
  console.log('Total Actual Population (Province):', tPop);
  
  // To get the full year target, just see how much we reached by May 5.
  // There are ~125 days in the year up to May 5.
  // End of year is 365.
  // We can do a simple projection.
}
getStats();
