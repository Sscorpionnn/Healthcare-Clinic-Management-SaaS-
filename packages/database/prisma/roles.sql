-- Database roles for defense-in-depth privilege separation.
-- Run once per environment by an operator with superuser access; not run
-- automatically by the app or CI (credentials are environment-specific).
--
-- clinic_app        — used by the API for all tenant-scoped data access.
--                      Subject to RLS. No DELETE/UPDATE on audit_logs
--                      (append-only trail).
-- clinic_platform    — used only by SUPER_ADMIN platform operations
--                      (creating/suspending clinics). BYPASSRLS. Never used
--                      for patient/clinical/document/billing data access.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clinic_app') THEN
    CREATE ROLE clinic_app LOGIN PASSWORD 'change-me-in-environment-secrets';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clinic_platform') THEN
    CREATE ROLE clinic_platform LOGIN PASSWORD 'change-me-in-environment-secrets' BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO clinic_app, clinic_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clinic_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clinic_platform;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clinic_app, clinic_platform;

-- Append-only audit trail: revoke UPDATE/DELETE from the app role even
-- though it has broad grants above.
REVOKE UPDATE, DELETE ON audit_logs FROM clinic_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO clinic_app, clinic_platform;
