# Privacy Model

## Principles

- **Data minimization**: collect only fields a workflow actually needs. No
  freeform "notes" fields on non-clinical models; no collection of national
  ID numbers, insurance numbers, or similar identifiers unless a module
  explicitly requires them for its function (billing reference *token*, not
  raw payment data).
- **Purpose limitation**: patient clinical data is readable only by the
  care-team roles that need it for treatment (see [rbac.md](./rbac.md)); no
  module reads across purpose boundaries (e.g. billing never reads treatment
  notes).
- **Private by default**: every new field defaults to the most restrictive
  visibility; broadening visibility is an explicit, reviewed decision, not a
  default.
- **Storage minimization**: documents and medical record bodies are stored
  once, referenced by ID everywhere else — never duplicated into
  notifications, audit logs, or search indexes.

## Sensitive data classification

| Class | Examples | Handling |
|---|---|---|
| Clinical (highest) | diagnoses, treatment notes, medical record bodies, documents | encrypted at rest (Postgres column-level for structured fields; object storage server-side encryption for documents), access logged, never included in notification payloads (notifications reference a resource ID + generic message, requiring the recipient to authenticate to view content) |
| Identifying | full name, DOB, contact info | encrypted at rest for DOB/contact; access logged for patient records |
| Operational | appointment time, clinic/department, role | normal access controls, not separately encrypted |
| Authentication | password hash, refresh tokens | argon2id hashed / hashed-at-rest tokens, never logged |

## Audit log privacy

The audit log records **who did what to which resource, when, from where**
(actor, action, resource type + id, tenant, timestamp, IP/user-agent hash),
**never the clinical content itself**. A record like "DOCTOR X updated
TreatmentNote #123 for Patient #456" is logged; the note's text is not.
This keeps the audit trail itself from becoming a secondary repository of
sensitive health data with weaker access controls than the primary record.

Audit log entries are append-only (no `UPDATE`/`DELETE` grants on the table
for the application DB role) and readable only by `CLINIC_ADMIN` (own clinic)
and `SUPER_ADMIN` (platform-level metadata, not clinical resource detail).

## Data subject rights

- **Access / portability** (`data-export` module): a patient or a
  `CLINIC_ADMIN` (for clinic-wide data on behalf of a request) can request an
  export. Generated asynchronously (BullMQ job), produces a structured JSON +
  PDF bundle, stored encrypted with a short-lived signed download URL, and the
  export file itself is purged after a fixed window (7 days) regardless of
  whether it was downloaded.
- **Erasure** (`deletion-requests` module): a patient can request deletion.
  Clinical records that are subject to a legal retention requirement are not
  hard-deleted immediately; the request enters a `PENDING_REVIEW` →
  `APPROVED`/`REJECTED` → `SCHEDULED` → `COMPLETED` state machine, with the
  retention hold reason recorded. Non-clinical PII (contact info, documents
  not under retention hold) can be erased immediately on approval;
  clinically-retained data is anonymized (patient identifiers replaced with a
  random token, clinical content kept for legal/statistical purposes) rather
  than deleted outright when law requires retention — this distinction is
  surfaced to the requester, not silently applied.
- **Rectification**: standard authenticated edit endpoints; changes to
  clinical records are versioned (append a new record version) rather than
  overwritten, so the audit trail of what a treatment note said at the time
  of a decision is preserved.

## What this repo deliberately does NOT collect

No real patient data, ever, anywhere in the repo — seed data is synthetic
(`@faker-js/faker`), clearly namespaced (e.g. `demo.clinic`, `+demo@example.test`
addresses), and the README states this explicitly. No analytics/tracking
scripts are wired into the frontend by default. No third-party AI API calls
are made by any part of the product — this is a clinic operations system, not
an AI product, so no LLM integration exists in the codebase.

## Encryption

- **In transit**: TLS terminated at the reverse proxy (out of repo scope for
  cert management); the app assumes it runs behind TLS in any non-local
  environment and sets `Secure`/`HttpOnly`/`SameSite=Strict` cookies
  accordingly.
- **At rest**: Postgres data volume encryption is an infra-level
  responsibility of the deployment target; additionally, DOB/contact/clinical
  free-text fields use application-level column encryption
  (`packages/database` crypto helper, AES-256-GCM, key from environment /
  secret manager, never hardcoded) so a raw DB dump or backup alone isn't
  sufficient to read those fields.
