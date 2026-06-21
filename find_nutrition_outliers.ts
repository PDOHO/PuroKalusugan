import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAges() {
    console.log('Fetching patient services with nutrition=true...');
    
    let allData: any[] = [];
    let count = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('patient_services')
            .select(`
                id, 
                date_of_service, 
                patients!inner(id, birthdate, full_name, municipality, barangay)
            `)
            .eq('nutrition', true)
            .range(offset, offset + count - 1);

        if (error) {
            console.error('Error fetching data:', error);
            break;
        }

        allData = allData.concat(data);
        offset += count;
        hasMore = data.length === count;
    }

    let results: any[] = [];

    for (const service of allData) {
        const patient = Array.isArray(service.patients) ? service.patients[0] : service.patients;
        if (!patient || !patient.birthdate || !service.date_of_service) {
            continue;
        }

        const birthdate = new Date(patient.birthdate);
        const serviceDate = new Date(service.date_of_service);

        // Calculate age in months
        const ageInMonths = (serviceDate.getFullYear() - birthdate.getFullYear()) * 12 + (serviceDate.getMonth() - birthdate.getMonth()) + (serviceDate.getDate() >= birthdate.getDate() ? 0 : -1);
        const ageInYears = ageInMonths / 12;

        if (ageInYears > 5 || (ageInYears < 1 && ageInYears >= 0)) {
            results.push({
                patient_id: patient.id,
                full_name: patient.full_name,
                birthdate: patient.birthdate,
                date_of_service: service.date_of_service,
                age_in_years: ageInYears.toFixed(2),
                municipality: patient.municipality,
                barangay: patient.barangay,
                category: ageInYears > 5 ? '> 5 years' : '< 1 year'
            });
        }
    }

    fs.writeFileSync('nutrition_outliers.json', JSON.stringify(results, null, 2));
    
    // Convert to CSV for easy copy-pasting or viewing
    const csvHeader = 'Name,Birthdate,Date of Service,Age,Category,Municipality,Barangay\n';
    const csvRows = results.map(r => `"${r.full_name}","${r.birthdate}","${r.date_of_service}",${r.age_in_years},"${r.category}","${r.municipality}","${r.barangay}"`).join('\n');
    fs.writeFileSync('nutrition_outliers.csv', csvHeader + csvRows);

    console.log(`Saved ${results.length} records to nutrition_outliers.json and nutrition_outliers.csv`);
}

checkAges();
