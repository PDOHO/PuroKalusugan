-- Drop the action index to save some space
DROP INDEX IF EXISTS idx_audit_logs_action;

-- Delete audit logs older than 30 days (Adjust the '30 days' if you want to keep more/less)
DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '30 days';

-- Optional: Run a VACUUM to reclaim the physical disk space immediately
-- VACUUM FULL public.audit_logs;
