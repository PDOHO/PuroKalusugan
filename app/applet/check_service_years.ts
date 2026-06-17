import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkServiceYears() {
  console.log('Fetching patient_services dates...');
  
  let page = 0;
  let allServices: any[] = [];
  const pageSize = 1000;
  
  while (true) {
      const { data, error } = await supabase
        .from('patient_services')
        .select('id, date_of_service, patients(full_name)')
        .range(page * pageSize, (page + 1) * pageSize - 1);
    
      if (error) {
        console.error('Error fetching services:', error);
        break;
      }
      
      if (!data || data.length === 0) break;
      
      allServices = allServices.concat(data);
      if (data.length < pageSize) break;
      page++;
  }
  
  const not2026 = allServices.filter(s => {
      const d = s.date_of_service;
      if (!d) return false;
      return !d.startsWith('2026');
  });

  if (not2026.length > 0) {
      console.log(`Found ${not2026.length} services not in 2026.`);
      not2026.forEach((s: any) => console.log(` - Full Name: ${s.patients?.full_name}, ID: ${s.id}, Date: ${s.date_of_service}`));
  } else {
      console.log('All services are in 2026.');
  }
}

checkServiceYears();
