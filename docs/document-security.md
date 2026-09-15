# Document Security

## Upload pipeline

```
Client -> POST /documents/upload-intent (metadata only: filename, declared mime, size)
       <- { uploadUrl (signed PUT, short TTL), documentId (status=PENDING) }
Client -> PUT to storage directly (signed URL)
Client -> POST /documents/:id/complete
Server -> downloads object, validates magic bytes vs declared mime,
          re-checks size, runs filename sanitization,
          moves object from quarantine bucket/prefix to private bucket/prefix,
          marks status=AVAILABLE (or REJECTED + deletes object)
```

Rationale for the two-phase flow: the API process never proxies raw file
bytes through itself for the happy path (keeps memory/CPU off the API for
large files), but nothing is trusted as "available" until the server has
independently validated the object that actually landed in storage — the
client-declared MIME type is never trusted on its own.

## Validation layers

1. **Extension allowlist** — derived from a fixed set per document category
   (e.g. clinical documents: `.pdf,.jpg,.jpeg,.png`; never `.exe,.js,.html,.svg`
   — SVG is excluded specifically because it can carry script content).
2. **Declared MIME type** — checked against the same allowlist at
   upload-intent time (fast rejection before any bytes move).
3. **Magic byte sniffing** — server reads the first bytes of the object
   after upload and verifies the true file signature matches an allowed type
   (via `file-type` package), rejecting mismatches (e.g. a `.pdf`-named file
   whose bytes are actually an executable).
4. **Size limits** — enforced at three points: signed-URL policy (storage
   layer refuses over-limit PUTs), server re-check after upload, and a
   per-clinic aggregate storage quota to prevent abuse.
5. **Filename handling** — original filename is stored as metadata only
   (for display), never used to construct a storage path; the storage key is
   a server-generated UUID, so path traversal / injection via filename is
   structurally impossible.

## Storage

- Private bucket/prefix by default — no object is ever publicly readable.
- Access exclusively via short-TTL signed GET URLs minted per-request after
  the standard auth + tenant + RBAC + policy checks (the policy check
  verifies the requester has a legitimate relationship to the document's
  owning patient/record, not just "same clinic").
- Signed URLs are single-purpose (one document, one action) and expire in
  minutes, not hours.
- Quarantine prefix is not reachable via the signed-URL minting endpoint —
  only `AVAILABLE` documents can ever be linked out.

## Authorization

Document read/download goes through the same `PolicyGuard` as medical
records: a `DOCTOR` can fetch a document only if they're on the owning
patient's care team; `BILLING_MANAGER` can fetch only documents tagged
`category=BILLING`; `PATIENT` can fetch only their own. Tested explicitly in
the IDOR suite (see [test-strategy.md](./test-strategy.md)) by attempting
cross-tenant and cross-role document fetches by guessed/enumerated ID.

## Malware/abuse mitigation

- Hook point (`storage.scanQueue`) is wired for an antivirus scan step
  (ClamAV via a BullMQ job) between "uploaded to quarantine" and "moved to
  private bucket" — the interface is implemented and documented even where a
  specific AV engine isn't bundled in this repo, so wiring one in is a
  config change, not a redesign.
- Rate limiting on the upload-intent endpoint (per-user and per-clinic) to
  bound abuse of storage quota.

## What is never done

- Never execute, render, or transform uploaded content server-side in a way
  that interprets it (no server-side HTML/SVG rendering, no Office macro
  execution, no shelling out to a converter with attacker-controlled input).
- Never trust a client-supplied storage path or key.
- Never return storage credentials to the client — only single-use signed
  URLs.
