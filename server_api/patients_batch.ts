import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, flushCache, logAudit } from './_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Handle both old format (array) and new format (object with data and _user)
  let patients = req.body;
  let _user = undefined;
  
  if (!Array.isArray(req.body) && req.body.data) {
    patients = req.body.data;
    _user = req.body._user;
  }

  if (!patients || patients.length === 0) return res.json({ status: "ok", count: 0, skipped: 0 });

  const patientFields = [
    'full_name', 'municipality', 'barangay', 'birthdate', 'sex',
    'date_of_service', 'health_promotion', 'fpe', 'philhealth', 'referral',
    'nutrition', 'cancer', 'immunization', 'hpn', 'dm', 'maternal_health',
    'road_safety', 'mental_health', 'tb', 'hiv', 'wash', 'large_scale_pk_activity'
  ];
  
  // 1. Get all unique patients from the batch
  // We need to keep all unique patient+service_date combinations for services,
  // but only one patient record per unique patient for the patients table.
  const uniquePatientsMap = new Map();
  const allServicesFromBatch: any[] = [];
  
  patients.forEach((p: any) => {
    const key = `${(p.full_name || '').trim().toLowerCase()}|${p.birthdate}|${(p.municipality || '').trim()}`;
    
    // Store service data
    const sData: any = {};
    patientFields.forEach(f => {
      if (p[f] !== undefined) {
        sData[f] = p[f];
      }
    });
    // Add the key so we can link it back to the patient ID later
    sData._patientKey = key;
    allServicesFromBatch.push(sData);

    if (!uniquePatientsMap.has(key)) {
      const pData: any = {};
      patientFields.forEach(f => {
        if (p[f] !== undefined) {
          pData[f] = p[f];
        }
      });
      uniquePatientsMap.set(key, pData);
    } else {
      // If we already have this patient, update their latest service info in the patients map
      const existingPData = uniquePatientsMap.get(key);
      
      // Merge boolean flags
      patientFields.forEach(f => {
        if (f !== 'date_of_service' && f !== 'full_name' && f !== 'birthdate' && f !== 'municipality' && f !== 'barangay' && f !== 'sex') {
          if (p[f] === true && !existingPData[f]) {
            existingPData[f] = true;
          }
        }
      });

      if (p.date_of_service) {
        if (!existingPData.date_of_service || new Date(p.date_of_service) >= new Date(existingPData.date_of_service)) {
          existingPData.date_of_service = p.date_of_service;
          if (p.barangay) {
            existingPData.barangay = p.barangay;
          }
        }
      }
    }
  });

  const municipalities = [...new Set(patients.map((p: any) => p.municipality))];
  
  // 2. Fetch existing patients to avoid duplicates in 'patients' table
  // We fetch by birthdate instead of full_name to allow case-insensitive name matching in JS later
  const uniqueDates = [...new Set(patients.map((p: any) => p.birthdate).filter((b: any) => !!b))];
  let allExistingPatients: any[] = [];
  
  // Fetch in chunks of 50 dates to avoid URL length limits
  for (let i = 0; i < uniqueDates.length; i += 50) {
    const chunk = uniqueDates.slice(i, i + 50);
    const { data } = await supabase.from('patients')
      .select('*')
      .in('birthdate', chunk);
      
    if (data) {
      allExistingPatients = [...allExistingPatients, ...data];
    }
  }
    
  const existingPatientMap = new Map();
  const existingPatientFullDataMap = new Map();
  allExistingPatients.forEach(e => {
    const key = `${(e.full_name || '').trim().toLowerCase()}|${e.birthdate}|${(e.municipality || '').trim().toLowerCase()}`;
    existingPatientMap.set(key, e.id);
    existingPatientFullDataMap.set(key, e);
  });
  
  // Also update the uniquePatientsMap key to use lowercase municipality
  const uniquePatientsMapLowercase = new Map();
  for (const [key, pData] of uniquePatientsMap.entries()) {
    const parts = key.split('|');
    const newKey = `${(parts[0] || '').trim()}|${parts[1]}|${(parts[2] || '').trim().toLowerCase()}`;
    uniquePatientsMapLowercase.set(newKey, pData);
  }
  
  // 3. Insert new patients or update existing ones
  const newPatientsToInsert = [];
  const existingPatientsToUpdate = [];
  
  for (const [key, pData] of uniquePatientsMapLowercase.entries()) {
    if (!existingPatientMap.has(key)) {
      newPatientsToInsert.push(pData);
    } else {
      // Patient exists, check if we need to update their latest service info
      const existing = existingPatientFullDataMap.get(key);
      let needsUpdate = false;
      const mergedData: any = { ...existing };
      
      // Always merge boolean flags to keep a cumulative record
      patientFields.forEach(f => {
        if (f !== 'date_of_service' && f !== 'full_name' && f !== 'birthdate' && f !== 'municipality' && f !== 'barangay' && f !== 'sex') {
          if (pData[f] === true && !existing[f]) {
            needsUpdate = true;
            mergedData[f] = true;
          }
        }
      });

      if (pData.date_of_service) {
        if (!existing.date_of_service || new Date(pData.date_of_service) >= new Date(existing.date_of_service)) {
          // Only mark as needsUpdate if something actually changed to avoid unnecessary DB writes
          if (mergedData.date_of_service !== pData.date_of_service || (pData.barangay && mergedData.barangay !== pData.barangay)) {
            needsUpdate = true;
            mergedData.date_of_service = pData.date_of_service;
            if (pData.barangay) {
              mergedData.barangay = pData.barangay;
            }
          }
        }
      }
      
      if (needsUpdate) {
        existingPatientsToUpdate.push(mergedData);
      }
    }
  }
  
  const newPatientIds = new Set();
  
  // Update existing patients with newer service dates
  if (existingPatientsToUpdate.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < existingPatientsToUpdate.length; i += chunkSize) {
      const chunk = existingPatientsToUpdate.slice(i, i + chunkSize);
      const { error: pError } = await supabase.from('patients').upsert(chunk);
      if (pError) {
        console.error("Batch patient update error:", pError);
      }
    }
  }

  if (newPatientsToInsert.length > 0) {
    // Validate required fields before inserting
    for (const p of newPatientsToInsert) {
      if (!p.full_name) return res.status(400).json({ error: "Missing required field: full_name" });
      if (!p.birthdate) return res.status(400).json({ error: `Missing birthdate for patient: ${p.full_name}` });
      if (!p.sex) return res.status(400).json({ error: `Missing sex for patient: ${p.full_name}` });
      if (!p.date_of_service) return res.status(400).json({ error: `Missing date_of_service for patient: ${p.full_name}. Please ensure all rows have a valid Date of Service.` });
    }

    const chunkSize = 500;
    for (let i = 0; i < newPatientsToInsert.length; i += chunkSize) {
      const chunk = newPatientsToInsert.slice(i, i + chunkSize);
      const { data: insertedPatients, error: pError } = await supabase.from('patients').insert(chunk).select();
      
      if (pError) {
        console.error("Batch patient insert error:", pError);
        return res.status(500).json({ error: "Failed to insert new patients: " + pError.message });
      }
      
      (insertedPatients || []).forEach(p => {
        const key = `${(p.full_name || '').trim().toLowerCase()}|${p.birthdate}|${(p.municipality || '').trim().toLowerCase()}`;
        existingPatientMap.set(key, p.id);
        newPatientIds.add(p.id);
      });
    }
  }
  
  // 4. Prepare service records
  const serviceFields = [
    'date_of_service', 'health_promotion', 'fpe', 'philhealth', 'referral',
    'nutrition', 'cancer', 'immunization', 'hpn', 'dm', 'maternal_health',
    'road_safety', 'mental_health', 'tb', 'hiv', 'wash', 'large_scale_pk_activity'
  ];

  const servicesToProcess = allServicesFromBatch.map((sData: any) => {
    const key = sData._patientKey;
    const parts = key.split('|');
    const lookupKey = `${(parts[0] || '').trim()}|${parts[1]}|${(parts[2] || '').trim().toLowerCase()}`;
    const patient_id = existingPatientMap.get(lookupKey);
    
    if (patient_id !== undefined) {
        const cleanServiceData: any = {
            patient_id: typeof patient_id === 'object' ? patient_id.id : patient_id
        };
        serviceFields.forEach(f => {
            if (sData[f] !== undefined) {
                cleanServiceData[f] = sData[f];
            }
        });
        return cleanServiceData;
    }
    return null;
  }).filter((s: any) => !!s);
  
  // Validate services
  for (const s of servicesToProcess) {
    if (!s.date_of_service) {
      return res.status(400).json({ error: `Missing date_of_service for a patient record. Please ensure all rows have a valid Date of Service.` });
    }
  }
  
  // Fetch existing service records to check for duplicates
  const patientIds = [...new Set(servicesToProcess.map((s: any) => s.patient_id))];
  
  // We need to fetch in chunks if patientIds is too large, but for now assume it's manageable
  let existingServices: any[] = [];
  if (patientIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < patientIds.length; i += chunkSize) {
      const chunk = patientIds.slice(i, i + chunkSize);
      const { data, error } = await supabase.from('patient_services')
        .select('*')
        .in('patient_id', chunk);
      if (error) {
        console.error("Error fetching existing services:", error);
      } else if (data) {
        existingServices = [...existingServices, ...data];
      }
    }
  }

  const existingServiceMap = new Map();
  (existingServices || []).forEach(s => {
    const key = `${s.patient_id}|${s.date_of_service}`;
    existingServiceMap.set(key, s);
  });

  const servicesToInsert: any[] = [];
  const servicesToUpdate: any[] = [];
  let duplicatesNotUploaded = 0;
  let recordsMerged = 0;

  servicesToProcess.forEach((s: any) => {
    const key = `${s.patient_id}|${s.date_of_service}`;
    if (existingServiceMap.has(key)) {
      const existing = existingServiceMap.get(key);
      let needsUpdate = false;
      const mergedData: any = { ...existing };
      
      serviceFields.forEach(f => {
        if (f !== 'date_of_service' && s[f] === true && !existing[f]) {
          needsUpdate = true;
          mergedData[f] = true;
        }
      });

      if (needsUpdate) {
        servicesToUpdate.push(mergedData);
        recordsMerged++;
        existingServiceMap.set(key, mergedData); // Update map for subsequent rows in same batch
      } else {
        duplicatesNotUploaded++;
      }
    } else {
      servicesToInsert.push(s);
      existingServiceMap.set(key, s); // Prevent duplicates within the batch itself
      
      if (!newPatientIds.has(s.patient_id)) {
        recordsMerged++;
      }
    }
  });

  // 5. Insert services in chunks
  if (servicesToInsert.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < servicesToInsert.length; i += chunkSize) {
      const chunk = servicesToInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('patient_services').insert(chunk);
      if (error) {
        console.error("Batch service insert error:", error);
        return res.status(500).json({ error: "Failed to insert patient services: " + error.message });
      }
    }
  }

  // 6. Update merged services in chunks
  if (servicesToUpdate.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < servicesToUpdate.length; i += chunkSize) {
      const chunk = servicesToUpdate.slice(i, i + chunkSize);
      const { error } = await supabase.from('patient_services').upsert(chunk);
      if (error) {
        console.error("Batch service update error:", error);
        return res.status(500).json({ error: "Failed to update patient services: " + error.message });
      }
    }
  }

  if (servicesToInsert.length > 0 || servicesToUpdate.length > 0) {
    await logAudit(_user, 'CREATE', 'service', 'batch', { 
      inserted: servicesToInsert.length, 
      updated: servicesToUpdate.length,
      municipalities: municipalities.join(', ')
    });
  }
  
  flushCache();
  return res.json({ 
    status: "ok", 
    successfulUploads: servicesToInsert.length,
    duplicatesNotUploaded,
    recordsMerged
  });
}
