import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- Flag & Service Distribution Profiler ---");

  // Load 1000 patients and count how many have at least one program flag
  let offset = 0;
  const limit = 2000;
  let totalWithFlags = 0;
  let totalInPage = 0;

  const metrics = [
    'nutrition', 'cancer', 'immunization', 'hpn', 'dm', 'maternal_health', 'road_safety', 
    'mental_health', 'tb', 'hiv'
  ];

  while (offset < 20000) {
    const { data, error } = await supabase.from('patients')
      .select('nutrition, cancer, immunization, hpn, dm, maternal_health, road_safety, mental_health, tb, hiv')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching patients:", error);
      break;
    }
    if (!data || data.length === 0) break;
    
    totalInPage += data.length;
    data.forEach((p: any) => {
      const hasFlag = metrics.some(m => p[m] === true);
      if (hasFlag) {
        totalWithFlags++;
      }
    });

    offset += limit;
  }

  console.log(`Out of ${totalInPage} sampled patients, ${totalWithFlags} have at least one priority program flag (nutrition, HPN, cancer, etc.) set to true.`);
  console.log(`Percentage of patients with at least one priority program flag: ${(totalWithFlags / totalInPage * 100).toFixed(2)}%`);
}

run().catch(console.error);
