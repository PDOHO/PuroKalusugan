-- 1. DROP RESOURCE-EXHAUSTING ROW-LEVEL TRIGGERS
-- These triggers ran heavy queries on EVERY single insert/delete, locking rows
-- and consuming massive CPU during batch operations. They are now completely
-- obsolete since the dashboard uses the fast Materialized Views (RPCs).

DROP TRIGGER IF EXISTS dashboard_summary_patient_trigger ON patients;
DROP TRIGGER IF EXISTS dashboard_summary_service_trigger ON patient_services;

-- 2. DROP OBSOLETE TRIGGER FUNCTIONS & TABLES
DROP FUNCTION IF EXISTS update_dashboard_summary_func();
DROP TABLE IF EXISTS dashboard_summary;
DROP TABLE IF EXISTS patient_counts; -- If any exists

-- 3. UPDATE CRON JOBS TO EVERY 4 HOURS (WAS EVERY 2 HOURS)
-- This reduces the background CPU load by 50%
DO $$
BEGIN
    -- Unschedule existing jobs
    PERFORM cron.unschedule('refresh_mv_patient_first_services_job');
    PERFORM cron.unschedule('refresh_mv_activity_services_job');

    -- Schedule for every 4 hours
    PERFORM cron.schedule(
      'refresh_mv_patient_first_services_job', 
      '0 */4 * * *', 
      'SELECT refresh_mv_patient_first_services();'
    );

    PERFORM cron.schedule(
      'refresh_mv_activity_services_job', 
      '0 */4 * * *', 
      'SELECT refresh_mv_activity_services();'
    );
END $$;

-- 4. OPTIMIZE DUPLICATE CHECK RPC
-- The current duplicate check RPC groups by three columns and requires massive memory.
-- We can add a specialized index for it if it's missing, though we already have idx_patients_duplicate_check.
-- We will just recreate it to be safe, ensuring it only scans what's necessary.
DROP INDEX IF EXISTS idx_patients_duplicate_check;
CREATE INDEX IF NOT EXISTS idx_patients_duplicate_check_optimized ON patients(full_name, birthdate, municipality);

