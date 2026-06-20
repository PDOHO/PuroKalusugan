-- Note: 
-- You can run this in Supabase SQL editor to free up disk space immediately.
-- These indexes are redundant because there are other multi-column indexes or 
-- GIN indexes that cover the same search needs.

DROP INDEX IF EXISTS public.idx_patient_services_date_of_service;
DROP INDEX IF EXISTS public.idx_patient_services_patient_id;
DROP INDEX IF EXISTS public.idx_patients_full_name;
DROP INDEX IF EXISTS public.idx_patients_barangay;
DROP INDEX IF EXISTS public.idx_patients_municipality;
