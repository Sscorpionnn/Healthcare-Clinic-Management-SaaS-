-- Row-Level Security policies — the second, database-enforced layer of
-- tenant isolation described in docs/multi-tenancy.md.
--
-- Applied after `prisma migrate deploy` via `pnpm --filter @clinic/database run rls:apply`.
-- Idempotent: safe to re-run.
--
-- Model: the application sets `app.current_clinic_id` as a transaction-local
-- setting (`SET LOCAL`, never session-level) immediately after opening each
-- unit of work, using the tenant id resolved from the verified JWT — never
-- from client-supplied input. Every tenant-scoped table then filters through
-- a policy comparing `clinic_id` to that setting. A missing/blank setting
-- resolves no rows, so a bug that forgets to set tenant context fails closed.
--
-- The `clinic_platform` role (used only by SUPER_ADMIN platform operations)
-- has BYPASSRLS and must never be used for any tenant-data module.

-- Ensure the app role cannot bypass RLS even as table owner.
ALTER TABLE IF EXISTS clinics FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'clinics',
    'departments',
    'memberships',
    'doctor_profiles',
    'patient_profiles',
    'availability_slots',
    'appointments',
    'medical_records',
    'treatment_notes',
    'documents',
    'invoices',
    'notifications',
    'audit_logs',
    'data_export_requests',
    'deletion_requests'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);

    IF tbl = 'clinics' THEN
      -- clinics.id *is* the tenant id.
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (id::text = current_setting(''app.current_clinic_id'', true))',
        tbl
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (clinic_id::text = current_setting(''app.current_clinic_id'', true))',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- Invoice line items and payments inherit tenancy transitively through
-- invoices; scope them via a subquery policy rather than duplicating
-- clinic_id, since the FK chain already guarantees consistency.
ALTER TABLE IF EXISTS invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_line_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoice_line_items;
CREATE POLICY tenant_isolation ON invoice_line_items USING (
  invoice_id IN (
    SELECT id FROM invoices WHERE clinic_id::text = current_setting('app.current_clinic_id', true)
  )
);

ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payments;
CREATE POLICY tenant_isolation ON payments USING (
  invoice_id IN (
    SELECT id FROM invoices WHERE clinic_id::text = current_setting('app.current_clinic_id', true)
  )
);

-- Audit log is additionally append-only for the application role: no
-- UPDATE/DELETE grants, enforced at the role level (see
-- prisma/roles.sql), not just RLS.

-- The users table itself is not clinic-scoped (a User can hold memberships
-- across clinics), so it is intentionally excluded from tenant RLS and
-- instead protected purely by application-layer authorization (a user can
-- only ever read/update their own User row, or a SUPER_ADMIN doing platform
-- operations).
