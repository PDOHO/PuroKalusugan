import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSantaCruzDates() {
  console.log('Fetching patient_services dates...');
  
  let page = 0;
  let allServices: any[] = [];
  const pageSize = 1000;
  
  while (true) {
      const { data, error } = await supabase
        .from('patient_services')
        .select('id, date_of_service, patients(id, municipality)')
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
  
  const toUpdate = allServices.filter(s => {
      const d = s.date_of_service;
      if (!d) return false;
      const isSantaCruz = s.patients?.municipality?.toLowerCase() === 'santa cruz';
      const isNot2026 = !d.startsWith('2026');
      return isSantaCruz && isNot2026;
  });

  console.log(`Found ${toUpdate.length} records to update for Santa Cruz.`);
  
  let updatedCount = 0;
  for (const s of toUpdate) {
      const parts = s.date_of_service.split('-');
      if (parts.length === 3) {
          parts[0] = '2026';
          const newDate = parts.join('-');
          // console.log(`Updating ID ${s.id}: ${s.date_of_service} -> ${newDate}`);
          
          const { error } = await supabase
            .from('patient_services')
            .update({ date_of_service: newDate })
            .eq('id', s.id);
            
          if (error) {
              console.error(`Failed to update ID ${s.id}:`, error);
          } else {
              updatedCount++;
          }
      }
  }
  
  console.log(`Successfully updated ${updatedCount} records.`);
}

fixSantaCruzDates();
