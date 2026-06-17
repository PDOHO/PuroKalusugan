import React, { useState, useEffect } from 'react';
import { Plus, Search, UserPlus, Calendar, Activity, Upload, Download, Filter, MapPin, Edit2, Trash2, Users, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, PatientService, User } from '../types';
import { ALL_PROGRAMS, MUNICIPALITIES, MUNICIPALITIES_DATA, PROGRAM_DESCRIPTIONS, formatMunicipality, formatBarangay } from '../constants';

interface PatientProfileProps {
  currentUser: User;
}

interface PatientFormData {
  full_name: string;
  municipality: string;
  barangay: string;
  birthdate: string;
  sex: 'Male' | 'Female';
  date_of_service: string;
  health_promotion: boolean;
  fpe: boolean;
  philhealth: boolean;
  referral: boolean;
  nutrition: boolean;
  cancer: boolean;
  immunization: boolean;
  hpn: boolean;
  dm: boolean;
  maternal_health: boolean;
  road_safety: boolean;
  mental_health: boolean;
  tb: boolean;
  hiv: boolean;
  wash: boolean;
  large_scale_pk_activity: boolean;
}

export default function PatientProfile({ currentUser }: PatientProfileProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingService, setEditingService] = useState<PatientService | null>(null);
  const [patientHistory, setPatientHistory] = useState<PatientService[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');

  const initialMunicipality = currentUser.role === 'MUNICIPALITY' ? currentUser.municipality! : '';

  const getLocalYMD = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState<PatientFormData>({
    full_name: '',
    municipality: initialMunicipality,
    barangay: '',
    birthdate: '',
    sex: 'Male',
    date_of_service: getLocalYMD(),
    health_promotion: false,
    fpe: false,
    philhealth: false,
    referral: false,
    nutrition: false,
    cancer: false,
    immunization: false,
    hpn: false,
    dm: false,
    maternal_health: false,
    road_safety: false,
    mental_health: false,
    tb: false,
    hiv: false,
    wash: false,
    large_scale_pk_activity: false
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterMunicipality, setFilterMunicipality] = useState(initialMunicipality);
  const [filterBarangay, setFilterBarangay] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterLargeScale, setFilterLargeScale] = useState<string>('');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [barangayPriorities, setBarangayPriorities] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // Fetch all barangays to get priority programs
    fetch('/api/barangays?limit=1000')
      .then(res => res.json())
      .then(res => {
        if (res.data) {
          const map: Record<string, string[]> = {};
          res.data.forEach((b: any) => {
            const key = `${b.municipality}|${b.barangay_name}`.toLowerCase();
            const priorities = ['nutrition']; // Nutrition is always a priority
            if (b.program2_name) priorities.push(b.program2_name.toLowerCase().replace(/ /g, '_'));
            if (b.program3_name) priorities.push(b.program3_name.toLowerCase().replace(/ /g, '_'));
            if (b.program4_name) priorities.push(b.program4_name.toLowerCase().replace(/ /g, '_'));
            map[key] = priorities;
          });
          setBarangayPriorities(map);
        }
      })
      .catch(err => console.error("Failed to fetch barangay priorities:", err));
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPatients();
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, page, limit, filterMunicipality, filterBarangay, filterProgram, filterYear, filterMonth, filterLargeScale, showDuplicatesOnly, showDiscrepanciesOnly, showNewOnly]);

  const formatLocalDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const fetchPatients = () => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search: searchTerm,
      municipality: filterMunicipality,
      barangay: filterBarangay,
      program: filterProgram,
      year: filterYear,
      month: filterMonth,
      large_scale: filterLargeScale,
      duplicates_only: showDuplicatesOnly.toString(),
      discrepancies_only: showDiscrepanciesOnly.toString(),
      new_only: showNewOnly.toString(),
      _t: Date.now().toString()
    });
    fetch(`/api/patients?${query}`)
      .then(async res => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || data.error || `Server error: ${res.status}`);
          return data;
        } else {
          const text = await res.text();
          if (text.includes('Cookie check') || text.includes('Action required to load your app') || text.includes('__SECURE-aistudio')) {
             window.location.reload();
             return null;
          }
          if (text.includes('<!doctype html>')) {
             throw new Error(`Server returned HTML instead of API data. The server might be restarting or taking too long. Please try again later.`);
          }
          if (!res.ok) {
            throw new Error(`Server error: ${res.status} ${res.statusText}\n${text.substring(0, 100)}`);
          }
          throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
        }
      })
      .then(data => {
        if (!data) return;
        setPatients(data.data || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setError(err.message);
        setLoading(false);
      });
  };

  const calculateAge = (birthdate: string) => {
    if (!birthdate) return 0;
    const today = new Date();
    // birthdate is YYYY-MM-DD. Parse as local date to avoid timezone shifts.
    const [y, m, d] = birthdate.split('-').map(Number);
    const birthDate = new Date(y, m - 1, d);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const url = '/api/patients';
      const method = 'POST';

      const payload = { 
        ...formData, 
        id: editingId || undefined,
        _action: editingId ? 'add_service' : undefined,
        _user: {
          id: currentUser.id,
          username: currentUser.username,
          role: currentUser.role
        }
      };

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (!contentType || contentType.indexOf("application/json") === -1) {
          const text = await res.text();
          throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
        }
        const data = await res.json();
        setIsModalOpen(false);
        setEditingId(null);
        fetchPatients();
        resetForm();
        
        if (data.partialSuccess || data.warning) {
          alert(data.warning || "Patient saved, but service history could not be recorded. Please check database permissions.");
        } else {
          alert(editingId ? "Service record added successfully!" : "Patient and initial service saved!");
        }
      } else if (res.status === 409) {
        const errorData = await res.json();
        alert(errorData.error || "A patient with the same name and birthdate already exists.");
      } else {
        const errorText = await res.text();
        const handler = res.headers.get('X-Handler') || 'Unknown';
        const debugServer = res.headers.get('X-Debug-Server') || 'Unknown';
        const debugRoute = res.headers.get('X-Debug-Route') || 'Unknown';
        const debugRaw = res.headers.get('X-Debug-Raw') || 'Unknown';
        const debugTarget = res.headers.get('X-Debug-Target') || 'Unknown';
        
        console.error("Save failed:", res.status, errorText);
        alert(`Error saving patient:
Status: ${res.status} ${res.statusText}
Handler: ${handler}
Server: ${debugServer}
Route: ${debugRoute}
Raw: ${debugRaw}
Target: ${debugTarget}
URL: ${url}
Method: POST
Response: ${errorText}`);
      }
    } catch (error: any) {
      console.error("Error saving patient:", error);
      alert(`Failed to save patient: ${error.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (patient: Patient) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients?patient_id=${patient.id}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (!contentType || contentType.indexOf("application/json") === -1) {
          const text = await res.text();
          throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
        }
        const fullPatient = await res.json();
        setPatientHistory(fullPatient.history || []);
        const matchedMuni = MUNICIPALITIES.find(m => m.toLowerCase() === (fullPatient.municipality || '').toLowerCase());
        const normalizedMuni = matchedMuni || fullPatient.municipality || '';
        
        let normalizedBrgy = fullPatient.barangay || '';
        if (matchedMuni && fullPatient.barangay) {
          const barangays = MUNICIPALITIES_DATA[matchedMuni] || [];
          const matched = barangays.find(b => b.toLowerCase() === fullPatient.barangay.toLowerCase());
          if (matched) normalizedBrgy = matched;
        }

        setFormData({
          full_name: fullPatient.full_name,
          municipality: normalizedMuni,
          barangay: normalizedBrgy,
          birthdate: fullPatient.birthdate,
          sex: fullPatient.sex,
          // Default service fields for "Add Service" action
          date_of_service: getLocalYMD(),
          health_promotion: false,
          fpe: false,
          philhealth: false,
          referral: false,
          nutrition: false,
          cancer: false,
          immunization: false,
          hpn: false,
          dm: false,
          maternal_health: false,
          road_safety: false,
          mental_health: false,
          tb: false,
          hiv: false,
          wash: false,
          large_scale_pk_activity: false
        });
        setEditingId(fullPatient.id);
        setActiveTab('profile');
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error("Error fetching patient details:", err);
      alert("Failed to fetch patient details");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this patient record?')) {
      try {
        // Use consolidated endpoint to bypass proxy restrictions
        const res = await fetch('/api/patients', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id, 
            _action: 'delete',
            _user: {
              id: currentUser.id,
              username: currentUser.username,
              role: currentUser.role
            }
          })
        });
        if (res.ok) {
          fetchPatients();
        } else {
          const errorText = await res.text();
          const handler = res.headers.get('X-Handler') || 'Unknown';
          const debugTarget = res.headers.get('X-Debug-Target') || 'Unknown';
          console.error("Delete failed:", res.status, errorText);
          alert(`Error deleting patient:
Status: ${res.status} ${res.statusText}
Handler: ${handler}
Target: ${debugTarget}
URL: /api/patients
Method: POST
Response: ${errorText}`);
        }
      } catch (error: any) {
        console.error("Error deleting patient:", error);
        alert(`Failed to delete patient: ${error.message || "Unknown error"}`);
      }
    }
  };

  const handleEditService = (service: PatientService) => {
    setEditingService(service);
  };

  const handleDeleteService = async (serviceId: number) => {
    if (confirm('Are you sure you want to delete this service record?')) {
      try {
        const res = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: serviceId,
            _action: 'delete_service',
            _user: {
              id: currentUser.id,
              username: currentUser.username,
              role: currentUser.role
            }
          })
        });
        if (res.ok) {
          if (editingId) {
            const res2 = await fetch(`/api/patients?patient_id=${editingId}`);
            if (res2.ok) {
              const contentType = res2.headers.get("content-type");
              if (!contentType || contentType.indexOf("application/json") === -1) {
                const text = await res2.text();
                throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
              }
              const fullPatient = await res2.json();
              setPatientHistory(fullPatient.history || []);
            }
          }
          fetchPatients();
        } else {
          const errorText = await res.text();
          alert(`Failed to delete service: ${errorText}`);
        }
      } catch (error: any) {
        alert(`Failed to delete service: ${error.message || "Unknown error"}`);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      municipality: initialMunicipality,
      barangay: '',
      birthdate: '',
      sex: 'Male',
      date_of_service: getLocalYMD(),
      health_promotion: false,
      fpe: false,
      philhealth: false,
      referral: false,
      nutrition: false,
      cancer: false,
      immunization: false,
      hpn: false,
      dm: false,
      maternal_health: false,
      road_safety: false,
      mental_health: false,
      tb: false,
      hiv: false,
      wash: false,
      large_scale_pk_activity: false
    });
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'full_name', 'municipality', 'barangay', 'birthdate', 'sex', 'date_of_service',
      'health_promotion', 'fpe', 'philhealth', 'referral', 'nutrition', 'cancer',
      'immunization', 'hpn', 'dm', 'maternal_health', 'road_safety', 'mental_health',
      'tb', 'hiv', 'wash (Head of the Family only)', 'large_scale_pk_activity'
    ];
    const sampleRow = [
      'Juan A. Dela Cruz', 'Bantay', 'Aggay', '1990-01-01', 'Male', '2024-03-20',
      'true', 'false', 'true', 'false', 'true', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'false'
    ];
    
    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'purokalusugan_patient_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const parseCSVLine = (text: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
          if (inQuotes && text[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    };

    const parseDate = (dateStr: string | undefined, formatPreference: 'MM/DD/YYYY' | 'DD/MM/YYYY'): string | null => {
      if (!dateStr) return null;
      let trimmed = dateStr.trim();
      
      // If it's a full ISO string (e.g. 2026-05-23T16:00:00.000Z), grab just the date part.
      // This prevents ANY timezone shifting. It just takes the literal date string written in the file.
      if (trimmed.includes('T') && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        trimmed = trimmed.split('T')[0];
      }

      // Helper to format date as YYYY-MM-DD
      const formatYMD = (y: number, m: number, d: number): string => {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      };

      // 1. Try YYYY-MM-DD or YYYY/MM/DD
      const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (ymdMatch) {
        const y = parseInt(ymdMatch[1]);
        const m = parseInt(ymdMatch[2]);
        const d = parseInt(ymdMatch[3]);
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return formatYMD(y, m, d);
        }
      }

      // 2. Try MM/DD/YYYY or DD/MM/YYYY or MM-DD-YYYY or DD-MM-YYYY
      const otherMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (otherMatch) {
        const p1 = parseInt(otherMatch[1]);
        const p2 = parseInt(otherMatch[2]);
        const y = parseInt(otherMatch[3]);
        
        if (y >= 1900 && y <= 2100) {
          if (p1 > 12) { // Must be DD/MM/YYYY
            if (p1 <= 31 && p2 >= 1 && p2 <= 12) {
              return formatYMD(y, p2, p1);
            }
          } else if (p2 > 12) { // Must be MM/DD/YYYY
            if (p2 <= 31 && p1 >= 1 && p1 <= 12) {
              return formatYMD(y, p1, p2);
            }
          } else {
            // Both <= 12. Ambiguous. Use formatPreference.
            if (formatPreference === 'DD/MM/YYYY') {
              if (p2 >= 1 && p2 <= 12 && p1 >= 1 && p1 <= 31) {
                return formatYMD(y, p2, p1);
              }
            } else {
              if (p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
                return formatYMD(y, p1, p2);
              }
            }
          }
        }
      }

      // 3. Fallback for textual dates (e.g. "May 23, 2026")
      // Without using timezone-sensitive `new Date()` methods directly on the output.
      // We parse the date using Date to extract the local representation,
      // but if the date contains "GMT" or "Z" we ignore it to prevent shifts.
      if (!/GMT|Z/i.test(trimmed)) {
        const dObj = new Date(trimmed);
        if (!isNaN(dObj.getTime())) {
          const year = dObj.getFullYear();
          if (year >= 1900 && year <= 2100) {
            return formatYMD(dObj.getFullYear(), dObj.getMonth() + 1, dObj.getDate());
          }
        }
      }
      
      return null;
    };

    const reader = new FileReader();
    reader.onload = async (event) => {
      let text = event.target?.result as string;
      // Strip BOM if present
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
      const lines = text.split('\n');
      const headers = parseCSVLine(lines[0]);
      
      let inferredFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | null = null;
      let hasAmbiguousDates = false;

      // First pass to infer date format
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const values = parseCSVLine(line);
        headers.forEach((header, j) => {
          const key = header.trim().toLowerCase().replace(/ /g, '_');
          if (key === 'birthdate' || key === 'date_of_service') {
            const val = values[j]?.trim();
            if (val) {
              const match = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
              if (match) {
                const p1 = parseInt(match[1]);
                const p2 = parseInt(match[2]);
                if (p1 > 12 && p2 <= 12) inferredFormat = 'DD/MM/YYYY';
                else if (p2 > 12 && p1 <= 12) inferredFormat = 'MM/DD/YYYY';
                else if (p1 <= 12 && p2 <= 12) hasAmbiguousDates = true;
              }
            }
          }
        });
      }

      if (!inferredFormat && hasAmbiguousDates) {
        const isDDMM = window.confirm("We detected ambiguous dates (e.g., 05/06/2026). Are the dates in your file formatted as DD/MM/YYYY (Day first)?\n\nClick OK for DD/MM/YYYY (e.g., 05 is the day).\nClick Cancel for MM/DD/YYYY (e.g., 05 is the month).");
        inferredFormat = isDDMM ? 'DD/MM/YYYY' : 'MM/DD/YYYY';
      } else if (!inferredFormat) {
        inferredFormat = 'MM/DD/YYYY'; // Default fallback
      }
      
      const batchData: any[] = [];
      const skippedRows: any[] = [];

      lines.slice(1).filter(line => line.trim()).forEach((line, index) => {
        const values = parseCSVLine(line);
        const p: any = {};
        headers.forEach((header, i) => {
          const key = header.trim().toLowerCase().replace(/ /g, '_');
          const val = values[i]?.trim();
          
          // Normalize WASH key
          const normalizedKey = key.startsWith('wash') ? 'wash' : key;

          if (['health_promotion', 'fpe', 'philhealth', 'referral', 'nutrition', 'cancer', 'immunization', 'hpn', 'dm', 'maternal_health', 'road_safety', 'mental_health', 'tb', 'hiv', 'wash', 'large_scale_pk_activity'].includes(normalizedKey)) {
            const lowerVal = val?.toLowerCase();
            p[normalizedKey] = lowerVal === '1' || lowerVal === 'true' || lowerVal === 'yes';
          } else if (normalizedKey === 'birthdate' || normalizedKey === 'date_of_service') {
            p[normalizedKey] = parseDate(val, inferredFormat!);
          } else if (normalizedKey === 'sex') {
            const lowerSex = val?.toLowerCase();
            if (lowerSex === 'm' || lowerSex === 'male') {
              p[normalizedKey] = 'Male';
            } else if (lowerSex === 'f' || lowerSex === 'female') {
              p[normalizedKey] = 'Female';
            } else {
              p[normalizedKey] = val;
            }
          } else if (normalizedKey === 'municipality') {
            const matchedMuni = MUNICIPALITIES.find(m => m.toLowerCase() === val?.toLowerCase());
            p[normalizedKey] = matchedMuni || null;
          } else if (normalizedKey === 'barangay') {
            p[normalizedKey] = val;
          } else {
            p[normalizedKey] = val;
          }
        });
        
        // Second pass to normalize barangay based on the normalized municipality
        let isValidLocation = false;
        if (p.municipality && p.barangay) {
          const barangays = MUNICIPALITIES_DATA[p.municipality] || [];
          const matchedBrgy = barangays.find(b => b.toLowerCase() === p.barangay.toLowerCase());
          if (matchedBrgy) {
            p.barangay = matchedBrgy;
            isValidLocation = true;
          }
        }
        
        if (p.birthdate && p.date_of_service && isValidLocation) {
          batchData.push(p);
        } else {
          const reason = !isValidLocation ? 'Invalid Municipality/Barangay' : 'Invalid Date';
          skippedRows.push({ row: index + 2, data: `${p.full_name || 'Unknown Name'} (${reason})` });
        }
      });

      if (batchData.length === 0) {
        alert("No valid rows found in the CSV file.");
        e.target.value = '';
        return;
      }

      let confirmMessage = `Found ${batchData.length} eligible rows for upload.`;
      if (skippedRows.length > 0) {
        confirmMessage += `\n\n${skippedRows.length} rows were skipped due to invalid dates:\n${skippedRows.map(r => `Row ${r.row}: ${r.data}`).join('\n')}`;
      }
      confirmMessage += "\n\nDo you want to proceed with the valid rows?";

      const confirmUpload = window.confirm(confirmMessage);
      if (!confirmUpload) {
        e.target.value = '';
        return;
      }

      try {
        const res = await fetch('/api/patients/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: batchData,
            _user: {
              id: currentUser.id,
              username: currentUser.username,
              role: currentUser.role
            }
          })
        });
        
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (!contentType || contentType.indexOf("application/json") === -1) {
            const text = await res.text();
            throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
          }
          const result = await res.json();
          fetchPatients();
          alert(`Batch upload complete!\n\nSuccessful uploads: ${result.successfulUploads}\nRecords merged: ${result.recordsMerged}\nDuplicates skipped: ${result.duplicatesNotUploaded}`);
        } else {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await res.json();
            alert(`Failed to process batch upload: ${errorData.error || res.statusText}`);
          } else {
            const text = await res.text();
            alert(`Failed to process batch upload: ${res.statusText}\n${text.substring(0, 100)}`);
          }
        }
      } catch (err) {
        console.error("Batch upload error:", err);
        alert("An error occurred during batch upload.");
      }
      
      // Reset file input
      e.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleMergeDuplicates = async () => {
    if (!window.confirm('Are you sure you want to merge all detected duplicates? This will combine their service records and keep the latest profile information. This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/patients/merge-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _user: currentUser
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to merge duplicates');

      alert(data.message || `Successfully merged ${data.mergedCount} duplicate records.`);
      fetchPatients();
    } catch (err: any) {
      console.error("Merge error:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFiltered = async () => {
    if (!window.confirm('Are you sure you want to delete all filtered patients? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/patients/delete-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _user: currentUser,
          municipality: filterMunicipality,
          barangay: filterBarangay,
          search: searchTerm,
          program: filterProgram,
          year: filterYear,
          month: filterMonth,
          large_scale: filterLargeScale
        })
      });

      if (!response.ok) throw new Error('Failed to delete patients');
      
      alert('Filtered patients deleted successfully');
      fetchPatients();
    } catch (err) {
      console.error(err);
      alert('Error deleting patients');
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      let allExportData: Patient[] = [];
      let currentPage = 1;
      const exportLimit = 1000;
      let hasMore = true;

      while (hasMore) {
        const query = new URLSearchParams({
          page: currentPage.toString(),
          limit: exportLimit.toString(),
          search: searchTerm,
          municipality: filterMunicipality,
          barangay: filterBarangay,
          program: filterProgram,
          year: filterYear,
          month: filterMonth,
          large_scale: filterLargeScale,
          _t: Date.now().toString()
        });
        
        const res = await fetch(`/api/patients?${query}`);
        
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
          const text = await res.text();
          if (text.includes('Cookie check') || text.includes('Action required to load your app') || text.includes('__SECURE-aistudio')) {
             window.location.reload();
             return;
          }
          if (text.includes('<!doctype html>')) {
             throw new Error(`Server returned HTML instead of API data. The server might be restarting or taking too long. Please try again later.`);
          }
        }

        if (!res.ok) {
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const errData = await res.json();
            throw new Error(errData.message || errData.error || 'Failed to fetch export data');
          }
          throw new Error('Failed to fetch export data');
        }
        
        if (!contentType || contentType.indexOf("application/json") === -1) {
          const text = await res.text();
          throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
        }
        const data = await res.json();
        const exportData = data.data;
        
        if (!exportData || exportData.length === 0) {
          hasMore = false;
        } else {
          allExportData = allExportData.concat(exportData);
          if (exportData.length < exportLimit) {
            hasMore = false;
          } else {
            currentPage++;
          }
        }
      }
      
      if (allExportData.length === 0) {
        alert("No data to export based on current filters.");
        return;
      }

      const headers = [
        'Full Name', 'Municipality', 'Barangay', 'Birthdate', 'Age', 'Sex', 'Date of Service',
        'Health Promotion', 'FPE', 'PhilHealth', 'Referral', 'Nutrition', 'Cancer',
        'Immunization', 'HPN', 'DM', 'Maternal Health', 'Road Safety', 'Mental Health',
        'TB', 'HIV', 'WASH', 'Large Scale PK Activity'
      ];

      const csvRows = [headers.join(',')];
      
      allExportData.forEach((p: Patient) => {
        const services = p.history && p.history.length > 0 ? p.history : [p];
        
        services.forEach((s: any) => {
          const row = [
            `"${p.full_name}"`,
            `"${formatMunicipality(p.municipality)}"`,
            `"${formatBarangay(p.municipality, p.barangay)}"`,
            p.birthdate,
            calculateAge(p.birthdate),
            p.sex,
            s.date_of_service,
            s.health_promotion ? 'true' : 'false',
            s.fpe ? 'true' : 'false',
            s.philhealth ? 'true' : 'false',
            s.referral ? 'true' : 'false',
            s.nutrition ? 'true' : 'false',
            s.cancer ? 'true' : 'false',
            s.immunization ? 'true' : 'false',
            s.hpn ? 'true' : 'false',
            s.dm ? 'true' : 'false',
            s.maternal_health ? 'true' : 'false',
            s.road_safety ? 'true' : 'false',
            s.mental_health ? 'true' : 'false',
            s.tb ? 'true' : 'false',
            s.hiv ? 'true' : 'false',
            s.wash ? 'true' : 'false',
            s.large_scale_pk_activity ? 'true' : 'false'
          ];
          csvRows.push(row.join(','));
        });
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `purokalusugan_patients_export_${getLocalYMD()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {/* Top Row: Search and Actions */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="relative w-full xl:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-slate" size={18} />
            <input 
              type="text" 
              placeholder="Search patient name..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-white border border-charcoal-gray/10 text-health-blue px-4 py-2.5 rounded-xl font-medium hover:bg-mint-cream transition-all flex-1 md:flex-none justify-center"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </button>
            {currentUser.role !== 'VIEWER' && (
              <>
                <button 
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 bg-white border border-charcoal-gray/10 text-blue-slate px-4 py-2.5 rounded-xl font-medium hover:bg-mint-cream transition-all flex-1 md:flex-none justify-center"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Template</span>
                  <span className="sm:hidden">Tmpl</span>
                </button>
                  <label className="flex items-center gap-2 bg-white border border-charcoal-gray/10 text-blue-slate px-4 py-2.5 rounded-xl font-medium cursor-pointer hover:bg-mint-cream transition-all flex-1 md:flex-none justify-center">
                    <Upload size={18} />
                    <span className="hidden sm:inline">Batch Upload</span>
                    <span className="sm:hidden">Upload</span>
                    <input type="file" accept=".csv" className="hidden" onChange={handleBatchUpload} />
                  </label>
                <button
                  onClick={() => {
                    setShowNewOnly(!showNewOnly);
                    if (!showNewOnly) {
                      setShowDiscrepanciesOnly(false);
                      setShowDuplicatesOnly(false);
                    }
                    setPage(1);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all flex-1 md:flex-none justify-center ${
                    showNewOnly 
                      ? 'bg-honeydew text-deep-navy border border-frosted-mint hover:bg-frosted-mint' 
                      : 'bg-white border border-charcoal-gray/10 text-blue-slate hover:bg-mint-cream'
                  }`}
                >
                  <Users size={18} />
                  <span className="hidden sm:inline">{showNewOnly ? 'Showing Population Reached' : 'Population Reached'}</span>
                  <span className="sm:hidden">Pop</span>
                </button>
                <button
                  onClick={() => {
                    setShowDiscrepanciesOnly(!showDiscrepanciesOnly);
                    if (!showDiscrepanciesOnly) setShowDuplicatesOnly(false);
                    setPage(1);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all flex-1 md:flex-none justify-center ${
                    showDiscrepanciesOnly 
                      ? 'bg-alert-red/10 text-alert-red border border-alert-red/20 hover:bg-alert-red/20' 
                      : 'bg-white border border-charcoal-gray/10 text-blue-slate hover:bg-mint-cream'
                  }`}
                >
                  <Activity size={18} />
                  <span className="hidden sm:inline">{showDiscrepanciesOnly ? 'Showing Discrepancies' : 'Find Discrepancies'}</span>
                  <span className="sm:hidden">Disc</span>
                </button>
                <button
                  onClick={() => {
                    setShowDuplicatesOnly(!showDuplicatesOnly);
                    if (!showDuplicatesOnly) setShowDiscrepanciesOnly(false);
                    setPage(1);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all flex-1 md:flex-none justify-center ${
                    showDuplicatesOnly 
                      ? 'bg-heritage-yellow/10 text-charcoal-gray border border-heritage-yellow/30 hover:bg-heritage-yellow/20' 
                      : 'bg-white border border-charcoal-gray/10 text-blue-slate hover:bg-mint-cream'
                  }`}
                >
                  <Users size={18} />
                  <span className="hidden sm:inline">{showDuplicatesOnly ? 'Showing Duplicates' : 'Find Duplicates'}</span>
                  <span className="sm:hidden">Dupe</span>
                </button>
                {showDuplicatesOnly && currentUser.role === 'ADMIN' && (
                  <button 
                    onClick={handleMergeDuplicates}
                    className="flex items-center gap-2 bg-health-blue text-white px-4 py-2.5 rounded-xl font-medium hover:bg-soft-navy-blue transition-all flex-1 md:flex-none justify-center shadow-lg shadow-health-blue/20"
                  >
                    <Users size={18} />
                    <span className="hidden sm:inline">Merge All Duplicates</span>
                    <span className="sm:hidden">Merge</span>
                  </button>
                )}
                  <button 
                    onClick={() => {
                      setEditingId(null);
                      resetForm();
                      setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-deep-navy text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-deep-navy/20 hover:bg-soft-navy-blue transition-all shrink-0 flex-1 md:flex-none justify-center"
                  >
                    <UserPlus size={18} />
                    Add Patient
                  </button>
                {currentUser.role === 'ADMIN' && (
                  <button 
                    onClick={handleDeleteFiltered}
                    className="flex items-center gap-2 bg-alert-red text-white px-4 py-2.5 rounded-xl font-bold hover:bg-alert-red/90 transition-all flex-1 md:flex-none justify-center shadow-lg shadow-alert-red/20"
                  >
                    <Trash2 size={18} />
                    <span className="hidden sm:inline">Delete Filtered</span>
                    <span className="sm:hidden">Delete</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom Row: Filters and Notes */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 bg-mint-cream/50 p-3 rounded-2xl border border-charcoal-gray/5 w-full">
            <div className="flex items-center gap-2 px-2 text-blue-slate hidden md:flex">
              <Filter size={18} />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <select
              className="w-full sm:w-48 px-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all"
              value={filterMunicipality}
              onChange={(e) => {
                setFilterMunicipality(e.target.value);
                setFilterBarangay('');
                setPage(1);
              }}
              disabled={currentUser.role === 'MUNICIPALITY'}
            >
              <option value="">All Municipalities</option>
              {MUNICIPALITIES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              className="w-full sm:w-48 px-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all disabled:bg-honeydew disabled:text-blue-slate"
              value={filterBarangay}
              onChange={(e) => {
                setFilterBarangay(e.target.value);
                setPage(1);
              }}
              disabled={!filterMunicipality}
            >
              <option value="">All Barangays</option>
              {filterMunicipality && MUNICIPALITIES_DATA[filterMunicipality as keyof typeof MUNICIPALITIES_DATA]?.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              className="w-full sm:w-48 px-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all"
              value={filterProgram}
              onChange={(e) => {
                setFilterProgram(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Programs</option>
              <optgroup label="Priority Programs">
                {ALL_PROGRAMS.map(prog => (
                  <option key={prog} value={prog.toLowerCase().replace(/ /g, '_')}>{prog}</option>
                ))}
              </optgroup>
              <optgroup label="Primary Health Care">
                {['Health Promotion', 'FPE', 'PhilHealth', 'Referral'].map(prog => (
                  <option key={prog} value={prog.toLowerCase().replace(/ /g, '_')}>{prog}</option>
                ))}
              </optgroup>
            </select>
            <select
              className="w-full sm:w-32 px-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all"
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Years</option>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              className="w-full sm:w-36 px-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all"
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Months</option>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              className="w-full sm:w-40 px-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue transition-all"
              value={filterLargeScale}
              onChange={(e) => {
                setFilterLargeScale(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Activities</option>
              <option value="yes">Large Scale Only</option>
              <option value="no">Non-Large Scale</option>
            </select>
          </div>
          <div className="text-[10px] text-blue-slate font-medium w-full flex flex-wrap gap-x-4 gap-y-1.5 bg-health-blue/5 p-2 rounded-lg border border-health-blue/10">
            <div className="flex items-center gap-1.5">
              <Info size={12} className="text-health-blue" />
              <span><strong>WASH:</strong> Head of Family only. <strong>Nutrition:</strong> 2 doses Vit. A.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-health-blue" />
              <span><strong>Upload Dates:</strong> MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-health-blue" />
              <span><strong>Upload Sex:</strong> Male/Female, M/F</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-charcoal-gray/10 shadow-sm overflow-hidden">
        {error && (
          <div className="p-6 bg-alert-red/10 border-b border-alert-red/20 text-alert-red text-center">
            <p className="font-bold">Failed to load patients</p>
            <p className="text-xs font-mono mt-1">{error}</p>
            <button onClick={fetchPatients} className="mt-2 text-xs underline font-bold">Retry</button>
          </div>
        )}
        <div className="overflow-x-auto">
          {loading && (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-deep-navy mx-auto"></div>
              <p className="text-sm text-blue-slate mt-2">Loading patients...</p>
            </div>
          )}
          {!loading && (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4 p-4">
            {patients.map((p) => (
              <div key={p.id} className="bg-white p-4 rounded-xl border border-charcoal-gray/10 shadow-sm">
                <div className="font-semibold text-charcoal-gray">{p.full_name}</div>
                <div className="text-xs text-blue-slate">{formatBarangay(p.municipality, p.barangay)}, {formatMunicipality(p.municipality)}</div>
                <div className="text-sm text-charcoal-gray mt-2">{calculateAge(p.birthdate)} yrs • {p.sex}</div>
                <div className="text-xs text-blue-slate">{p.birthdate}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.health_promotion && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200 shadow-sm">HP</span>}
                  {p.fpe && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full border border-yellow-200 shadow-sm">FPE</span>}
                  {p.philhealth && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full border border-green-200 shadow-sm">PH</span>}
                  {p.referral && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full border border-red-200 shadow-sm">REF</span>}
                  {p.large_scale_pk_activity && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200 shadow-sm">LARGE SCALE</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {ALL_PROGRAMS.map(prog => {
                    const key = prog.toLowerCase().replace(/ /g, '_') as keyof Patient;
                    if (p[key]) {
                      const brgyKey = `${p.municipality}|${p.barangay}`.toLowerCase();
                      const priorities = barangayPriorities[brgyKey] || ['nutrition'];
                      const isDiscrepancy = !priorities.includes(prog.toLowerCase().replace(/ /g, '_'));
                      
                      return (
                        <span 
                          key={prog} 
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-sm ${
                            isDiscrepancy 
                              ? 'bg-rose-100 text-rose-700 border-rose-200' 
                              : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {prog}
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button 
                      onClick={() => handleEdit(p)}
                      className="p-2 text-blue-slate hover:text-deep-navy hover:bg-deep-navy/10 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    {currentUser.role === 'ADMIN' && (
                      <button 
                        onClick={() => handleDelete(p.id!)}
                        className="p-2 text-blue-slate hover:text-alert-red hover:bg-alert-red/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                </div>
              </div>
            ))}
            {patients.length === 0 && (
              <div className="p-6 text-center text-blue-slate">
                No patients found. Add one or upload a batch.
              </div>
            )}
          </div>

          {/* Table View (Desktop) */}
          <table className="hidden md:table w-full text-left border-collapse">
            <thead>
              <tr className="bg-mint-cream border-b border-charcoal-gray/10">
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Patient Name</th>
                <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Info</th>
                <th className="hidden lg:table-cell px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Service Date</th>
                <th className="hidden xl:table-cell px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Indicators</th>
                <th className="hidden xl:table-cell px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider">Programs Reached</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-slate uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-gray/5">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-mint-cream transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-charcoal-gray">{p.full_name}</div>
                    <div className="text-xs text-blue-slate">{formatBarangay(p.municipality, p.barangay)}, {formatMunicipality(p.municipality)}</div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <div className="text-sm text-charcoal-gray">{calculateAge(p.birthdate)} yrs • {p.sex}</div>
                    <div className="text-xs text-blue-slate">{p.birthdate}</div>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 text-sm text-charcoal-gray">
                    {p.date_of_service ? formatLocalDate(p.date_of_service) : <span className="text-blue-slate/50 italic">No service</span>}
                  </td>
                  <td className="hidden xl:table-cell px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {p.health_promotion && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200 shadow-sm">HP</span>}
                      {p.fpe && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full border border-yellow-200 shadow-sm">FPE</span>}
                      {p.philhealth && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full border border-green-200 shadow-sm">PH</span>}
                      {p.referral && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full border border-red-200 shadow-sm">REF</span>}
                      {p.large_scale_pk_activity && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200 shadow-sm">LARGE SCALE</span>}
                      {!p.health_promotion && !p.fpe && !p.philhealth && !p.referral && !p.large_scale_pk_activity && <span className="text-blue-slate/50 italic">-</span>}
                    </div>
                  </td>
                  <td className="hidden xl:table-cell px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {ALL_PROGRAMS.map(prog => {
                        const key = prog.toLowerCase().replace(/ /g, '_') as keyof Patient;
                        if (p[key]) {
                          const brgyKey = `${p.municipality}|${p.barangay}`.toLowerCase();
                          const priorities = barangayPriorities[brgyKey] || ['nutrition'];
                          const isDiscrepancy = !priorities.includes(prog.toLowerCase().replace(/ /g, '_'));
                          
                          return (
                            <span 
                              key={prog} 
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-sm ${
                                isDiscrepancy 
                                  ? 'bg-rose-100 text-rose-700 border-rose-200' 
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}
                              title={isDiscrepancy ? "This program is NOT a priority for this barangay" : ""}
                            >
                              {prog}
                            </span>
                          );
                        }
                        return null;
                      })}
                      {ALL_PROGRAMS.every(prog => !p[prog.toLowerCase().replace(/ /g, '_') as keyof Patient]) && <span className="text-blue-slate/50 italic">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(p)}
                          className="p-2 text-blue-slate hover:text-deep-navy hover:bg-deep-navy/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        {currentUser.role === 'ADMIN' && (
                          <button 
                            onClick={() => handleDelete(p.id!)}
                            className="p-2 text-blue-slate hover:text-alert-red hover:bg-alert-red/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-blue-slate">
                    No patients found. Add one or upload a batch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-charcoal-gray/10 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-4">
            <div className="text-sm text-blue-slate">
              Showing {total === 0 ? 0 : ((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} entries
            </div>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-3 py-1.5 border border-charcoal-gray/10 text-sm font-medium text-charcoal-gray rounded-lg outline-none focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue"
            >
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={500}>500 per page</option>
              <option value={1000}>1000 per page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border border-charcoal-gray/10 text-sm font-medium text-charcoal-gray rounded-lg disabled:opacity-50 hover:bg-mint-cream transition-colors"
            >
              Previous
            </button>
            <button 
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border border-charcoal-gray/10 text-sm font-medium text-charcoal-gray rounded-lg disabled:opacity-50 hover:bg-mint-cream transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-charcoal-gray/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-charcoal-gray">{editingId ? 'Patient Profile & History' : 'Encode New Patient'}</h2>
                  {editingId && <span className="text-sm text-blue-slate">{formData.full_name}</span>}
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-charcoal-gray/5 rounded-full text-blue-slate">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              {editingId && (
                <div className="flex border-b border-charcoal-gray/5 px-8">
                  <button 
                    onClick={() => setActiveTab('profile')}
                    className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'profile' ? 'border-health-blue text-health-blue' : 'border-transparent text-blue-slate'}`}
                  >
                    Profile & New Service
                  </button>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'history' ? 'border-health-blue text-health-blue' : 'border-transparent text-blue-slate'}`}
                  >
                    Service History ({patientHistory.length})
                  </button>
                </div>
              )}

              <div className="max-h-[80vh] overflow-y-auto">
                {activeTab === 'profile' ? (
                  <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-blue-slate uppercase tracking-wider">Patient Information</h3>
                        {editingId && (
                          <button 
                            type="button"
                            onClick={async () => {
                              if (isSaving) return;
                              setIsSaving(true);
                              try {
                                const res = await fetch('/api/patients', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    _action: 'update',
                                    id: editingId,
                                    full_name: formData.full_name,
                                    municipality: formData.municipality,
                                    barangay: formData.barangay,
                                    birthdate: formData.birthdate,
                                    sex: formData.sex,
                                    _user: currentUser
                                  })
                                });
                                if (res.ok) {
                                  const contentType = res.headers.get("content-type");
                                  if (!contentType || contentType.indexOf("application/json") === -1) {
                                    const text = await res.text();
                                    throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
                                  }
                                  await res.json();
                                  setIsModalOpen(false);
                                  fetchPatients();
                                  alert("Profile updated successfully");
                                } else {
                                  const contentType = res.headers.get("content-type");
                                  if (contentType && contentType.indexOf("application/json") !== -1) {
                                    const errData = await res.json();
                                    alert(`Failed to update profile: ${errData.error || 'Unknown error'}`);
                                  } else {
                                    const text = await res.text();
                                    alert(`Failed to update profile: ${res.statusText}\n${text.substring(0, 100)}`);
                                  }
                                }
                              } catch (err) {
                                alert("Failed to update profile");
                              } finally {
                                setIsSaving(false);
                              }
                            }}
                            disabled={isSaving}
                            className={`text-xs font-bold transition-all ${isSaving ? 'text-blue-slate cursor-not-allowed' : 'text-health-blue hover:underline'}`}
                          >
                            {isSaving ? 'Updating...' : 'Update Profile Only'}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-charcoal-gray">Full Name (Last, First, M.I.)</label>
                          <input 
                            type="text" required
                            placeholder="e.g. Dela Cruz, Juan A."
                            className="w-full px-4 py-2 bg-mint-cream/30 border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                            value={formData.full_name}
                            onChange={e => setFormData({...formData, full_name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-charcoal-gray">Municipality</label>
                          <select 
                            className={`w-full px-4 py-2 border border-charcoal-gray/10 rounded-xl outline-none transition-all ${
                              currentUser.role === 'MUNICIPALITY' 
                                ? 'bg-honeydew text-blue-slate cursor-not-allowed' 
                                : 'bg-mint-cream/30 focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue'
                            }`}
                            value={formData.municipality}
                            onChange={e => {
                              const m = e.target.value;
                              setFormData({
                                ...formData, 
                                municipality: m,
                                barangay: ''
                              });
                            }}
                            disabled={currentUser.role === 'MUNICIPALITY'}
                            required
                          >
                            <option value="" disabled>Please select municipality</option>
                            {MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-charcoal-gray">Barangay</label>
                          <select 
                            className="w-full px-4 py-2 bg-mint-cream/30 border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                            value={formData.barangay}
                            onChange={e => setFormData({...formData, barangay: e.target.value})}
                            required
                            disabled={!formData.municipality}
                          >
                            <option value="" disabled>Please select barangay</option>
                            {formData.municipality && (MUNICIPALITIES_DATA[formData.municipality] || []).map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-charcoal-gray">Birthdate</label>
                          <input 
                            type="date" required
                            className="w-full px-4 py-2 bg-mint-cream/30 border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                            value={formData.birthdate}
                            onChange={e => setFormData({...formData, birthdate: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-charcoal-gray">Age (Auto)</label>
                          <input 
                            type="text" disabled
                            className="w-full px-4 py-2 bg-honeydew border border-charcoal-gray/10 rounded-xl text-blue-slate"
                            value={calculateAge(formData.birthdate)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-charcoal-gray">Sex</label>
                          <select 
                            className="w-full px-4 py-2 bg-mint-cream/30 border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                            value={formData.sex}
                            onChange={e => setFormData({...formData, sex: e.target.value as 'Male' | 'Female'})}
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Service Activity */}
                    <div className="p-6 bg-mint-cream/30 rounded-2xl border border-charcoal-gray/5 space-y-6">
                      <h3 className="text-sm font-bold text-blue-slate uppercase tracking-wider flex items-center gap-2">
                        <Activity size={16} className="text-health-blue" />
                        {editingId ? 'Record New Service Encounter' : 'Initial Service Activity'}
                      </h3>

                      <div className="space-y-4">
                        <div className="w-full md:w-1/3 space-y-1">
                          <label className="text-xs font-semibold text-charcoal-gray">Date of Service</label>
                          <input 
                            type="date" required
                            className="w-full px-4 py-2 bg-white border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none"
                            value={formData.date_of_service}
                            onChange={e => setFormData({...formData, date_of_service: e.target.value})}
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Primary Health Care Indicators</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {['Health Promotion', 'FPE', 'PhilHealth', 'Referral'].map((indicator) => {
                              const key = indicator.toLowerCase().replace(/ /g, '_') as keyof PatientFormData;
                              const description = PROGRAM_DESCRIPTIONS[indicator];
                              return (
                                <label 
                                  key={indicator} 
                                  className="group relative flex items-center gap-2 p-3 bg-white border border-charcoal-gray/10 rounded-xl cursor-pointer hover:border-health-blue transition-all"
                                  title={description}
                                >
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 accent-health-blue"
                                    checked={!!formData[key]}
                                    onChange={e => setFormData({...formData, [key]: e.target.checked})}
                                  />
                                  <span className="text-sm font-medium text-charcoal-gray">{indicator}</span>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-deep-navy text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl text-center">
                                    {description}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-deep-navy"></div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Priority Programs Reached</label>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {ALL_PROGRAMS.map((prog) => {
                              const key = prog.toLowerCase().replace(/ /g, '_') as keyof PatientFormData;
                              const description = PROGRAM_DESCRIPTIONS[prog];
                              return (
                                <label 
                                  key={prog} 
                                  className="group relative flex items-center gap-2 p-3 bg-white border border-charcoal-gray/10 rounded-xl cursor-pointer hover:border-health-blue transition-all"
                                  title={description}
                                >
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 accent-health-blue"
                                    checked={!!formData[key]}
                                    onChange={e => setFormData({...formData, [key]: e.target.checked})}
                                  />
                                  <span className="text-sm font-medium text-charcoal-gray">{prog}</span>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-deep-navy text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl text-center">
                                    {description}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-deep-navy"></div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-blue-slate uppercase tracking-wider">Activity Type</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="group relative flex items-center gap-2 p-3 bg-white border border-charcoal-gray/10 rounded-xl cursor-pointer hover:border-health-blue transition-all">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-health-blue"
                                checked={!!formData.large_scale_pk_activity}
                                onChange={e => setFormData({...formData, large_scale_pk_activity: e.target.checked})}
                              />
                              <span className="text-sm font-medium text-charcoal-gray">Large Scale PK Activity</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-6 py-2.5 text-sm font-bold text-blue-slate hover:text-charcoal-gray transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={isSaving}
                        className={`px-8 py-2.5 bg-health-blue text-white text-sm font-bold rounded-xl shadow-lg shadow-health-blue/20 transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-soft-navy-blue'}`}
                      >
                        {isSaving ? 'Saving...' : (editingId ? 'Add Service Record' : 'Save Patient & Service')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-blue-slate uppercase tracking-wider">Service History</h3>
                        <button 
                          onClick={() => setActiveTab('profile')}
                          className="flex items-center gap-2 text-xs font-bold text-health-blue hover:underline"
                        >
                          <Plus size={14} />
                          Add New Service
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                      {patientHistory.map((service, idx) => (
                        <div key={service.id || idx} className="bg-white p-5 rounded-2xl border border-charcoal-gray/5 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-mint-cream text-health-blue rounded-lg">
                                <Calendar size={18} />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-charcoal-gray">{formatLocalDate(service.date_of_service)}</div>
                                <div className="text-[10px] text-blue-slate uppercase tracking-widest font-bold">Recorded on {new Date(service.created_at!).toLocaleDateString()}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {service.large_scale_pk_activity && (
                                <span className="px-2 py-0.5 bg-steel-blue/10 text-steel-blue text-[10px] font-bold rounded-full border border-steel-blue/20">Large Scale</span>
                              )}
                              <div className="flex items-center gap-2">
                                {service.id && (
                                  <button 
                                    onClick={() => handleEditService(service)}
                                    className="p-1.5 text-blue-slate hover:text-deep-navy hover:bg-deep-navy/10 rounded-lg transition-colors"
                                    title="Edit Service"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {service.id && (
                                  <button 
                                    onClick={() => handleDeleteService(service.id!)}
                                    className="p-1.5 text-blue-slate hover:text-alert-red hover:bg-alert-red/10 rounded-lg transition-colors"
                                    title="Delete Service"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <div className="text-[10px] font-bold text-blue-slate uppercase tracking-wider mb-2">Indicators</div>
                              <div className="flex flex-wrap gap-1">
                                {service.health_promotion && <span className="px-2 py-0.5 bg-soft-navy-blue/10 text-soft-navy-blue text-[10px] font-bold rounded-full border border-soft-navy-blue/20">HP</span>}
                                {service.fpe && <span className="px-2 py-0.5 bg-heritage-yellow/10 text-charcoal-gray text-[10px] font-bold rounded-full border border-heritage-yellow/30">FPE</span>}
                                {service.philhealth && <span className="px-2 py-0.5 bg-health-blue/10 text-health-blue text-[10px] font-bold rounded-full border border-health-blue/20">PH</span>}
                                {service.referral && <span className="px-2 py-0.5 bg-alert-red/10 text-alert-red text-[10px] font-bold rounded-full border border-alert-red/20">REF</span>}
                                {!service.health_promotion && !service.fpe && !service.philhealth && !service.referral && <span className="text-xs text-blue-slate/50 italic">None</span>}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-blue-slate uppercase tracking-wider mb-2">Programs</div>
                              <div className="flex flex-wrap gap-1">
                                {ALL_PROGRAMS.map(prog => {
                                  const key = prog.toLowerCase().replace(/ /g, '_') as keyof PatientService;
                                  if (service[key]) {
                                    return (
                                      <span key={prog} className="px-2 py-0.5 bg-honeydew text-deep-navy text-[10px] font-bold rounded-full border border-frosted-mint">
                                        {prog}
                                      </span>
                                    );
                                  }
                                  return null;
                                })}
                                {ALL_PROGRAMS.every(prog => !service[prog.toLowerCase().replace(/ /g, '_') as keyof PatientService]) && <span className="text-xs text-blue-slate/50 italic">None</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {patientHistory.length === 0 && (
                        <div className="text-center py-12 bg-mint-cream/30 rounded-2xl border border-dashed border-charcoal-gray/10">
                          <p className="text-sm text-blue-slate">No service history found for this patient.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit Service Modal */}
      <AnimatePresence>
        {editingService && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingService(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-charcoal-gray/5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-charcoal-gray">Edit Service Record</h2>
                <button onClick={() => setEditingService(null)} className="p-2 hover:bg-charcoal-gray/5 rounded-full text-blue-slate">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="overflow-y-auto p-8 space-y-8">
                {/* Form fields for editingService */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-blue-slate uppercase tracking-wider">Service Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-charcoal-gray mb-2">Date of Service</label>
                      <input 
                        type="date" 
                        required
                        value={editingService.date_of_service}
                        onChange={(e) => setEditingService({...editingService, date_of_service: e.target.value})}
                        className="w-full px-4 py-3 bg-mint-cream/30 border border-charcoal-gray/10 rounded-xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center mt-8">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={editingService.large_scale_pk_activity}
                            onChange={(e) => setEditingService({...editingService, large_scale_pk_activity: e.target.checked})}
                            className="peer sr-only"
                          />
                          <div className="w-11 h-6 bg-charcoal-gray/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-charcoal-gray/20 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-health-blue"></div>
                        </div>
                        <span className="text-sm font-bold text-charcoal-gray group-hover:text-health-blue transition-colors">Large Scale PK Activity</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Indicators */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-blue-slate uppercase tracking-wider">Indicators</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { key: 'health_promotion', label: 'Health Promotion' },
                      { key: 'fpe', label: 'FPE' },
                      { key: 'philhealth', label: 'PhilHealth' },
                      { key: 'referral', label: 'Referral' }
                    ].map(ind => (
                      <label key={ind.key} className="flex items-center gap-3 p-4 bg-mint-cream/30 border border-charcoal-gray/10 rounded-xl cursor-pointer hover:border-health-blue/30 hover:bg-health-blue/5 transition-all">
                        <input 
                          type="checkbox" 
                          checked={editingService[ind.key as keyof PatientService] as boolean}
                          onChange={(e) => setEditingService({...editingService, [ind.key]: e.target.checked})}
                          className="w-5 h-5 text-health-blue border-charcoal-gray/20 rounded focus:ring-health-blue"
                        />
                        <span className="text-sm font-bold text-charcoal-gray">{ind.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Programs */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-blue-slate uppercase tracking-wider">Programs Reached</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {ALL_PROGRAMS.map(prog => {
                      const key = prog.toLowerCase().replace(/ /g, '_') as keyof PatientService;
                      return (
                        <label key={prog} className="flex items-center gap-3 p-4 bg-mint-cream/30 border border-charcoal-gray/10 rounded-xl cursor-pointer hover:border-health-blue/30 hover:bg-health-blue/5 transition-all">
                          <input 
                            type="checkbox" 
                            checked={editingService[key] as boolean}
                            onChange={(e) => setEditingService({...editingService, [key]: e.target.checked})}
                            className="w-5 h-5 text-health-blue border-charcoal-gray/20 rounded focus:ring-health-blue"
                          />
                          <span className="text-sm font-bold text-charcoal-gray">{prog}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-charcoal-gray/5 bg-mint-cream/30 flex justify-end gap-4">
                <button 
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-6 py-3 text-sm font-bold text-charcoal-gray hover:bg-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/patients', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ...editingService,
                          _action: 'update_service',
                          _user: {
                            id: currentUser.id,
                            username: currentUser.username,
                            role: currentUser.role
                          }
                        })
                      });
                      if (res.ok) {
                        setEditingService(null);
                        if (editingId) {
                          const res2 = await fetch(`/api/patients?patient_id=${editingId}`);
                          if (res2.ok) {
                            const contentType = res2.headers.get("content-type");
                            if (!contentType || contentType.indexOf("application/json") === -1) {
                              const text = await res2.text();
                              throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
                            }
                            const fullPatient = await res2.json();
                            setPatientHistory(fullPatient.history || []);
                          }
                        }
                        fetchPatients();
                        alert("Service updated successfully!");
                      } else {
                        const errorText = await res.text();
                        alert(`Failed to update service: ${errorText}`);
                      }
                    } catch (error: any) {
                      alert(`Failed to update service: ${error.message || "Unknown error"}`);
                    }
                  }}
                  className="px-8 py-3 bg-deep-navy hover:bg-soft-navy-blue text-white text-sm font-bold rounded-xl shadow-lg shadow-deep-navy/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
