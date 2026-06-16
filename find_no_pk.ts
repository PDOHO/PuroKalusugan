import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findNoPkKits() {
  const { data, error } = await supabase
    .from('barangays')
    .select('municipality, pk_kits_received');

  if (error) {
    console.error(error);
    return;
  }

  const muniStats = {};
  for (const b of data) {
    const m = b.municipality;
    if (!muniStats[m]) {
      muniStats[m] = { total_kits: 0 };
    }
    muniStats[m].total_kits += (b.pk_kits_received || 0);
  }

  const noKits = Object.keys(muniStats).filter(m => muniStats[m].total_kits === 0);
  
  console.log("Municipalities with NO PK Kits across any barangay:");
  console.log(noKits);
}

findNoPkKits();
