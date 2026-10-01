import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL="https://vernageujrplrgtowrdo.supabase.co"
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data: cols } = await supabase
        .from('patients')
        .select('*')
        .limit(1);
    
    const hasUpdatedAt = cols && cols.length > 0 && 'updated_at' in cols[0];
    const dateCol = hasUpdatedAt ? 'updated_at' : 'created_at';
    console.log(`Using date column: ${dateCol}`);

    const { data: munis } = await supabase
        .from('barangays')
        .select('municipality');
        
    const uniqueMunis = [...new Set(munis?.map(m => m.municipality))];
    console.log(`Found ${uniqueMunis.length} municipalities.`);
    
    const report = [];
    
    for (const muni of uniqueMunis) {
        if (!muni) continue;
        
        const { data: latestPatient } = await supabase
            .from('patients')
            .select(`id, full_name, municipality, barangay, ${dateCol}`)
            .ilike('municipality', muni)
            .order(dateCol, { ascending: false })
            .limit(1);
            
        if (latestPatient && latestPatient.length > 0) {
            report.push(latestPatient[0]);
        }
    }
    
    report.sort((a, b) => new Date(b[dateCol]) - new Date(a[dateCol]));
    
    const csvHeader = `id,full_name,municipality,barangay,last_updated`;
    const csvLines = report.map(r => `"${r.id}","${r.full_name}","${r.municipality}","${r.barangay}","${r[dateCol]}"`);
    
    fs.writeFileSync('latest_patients_per_municipality.csv', [csvHeader, ...csvLines].join('\n'));
    console.log("CSV file written to latest_patients_per_municipality.csv");
}

run();
