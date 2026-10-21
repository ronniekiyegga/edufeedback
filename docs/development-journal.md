# Development journal

## 2026-10-21: Application foundation and API container

Established a pnpm workspace containing a Next.js frontend and an Express
API. Application setup is separate from the API's network listener.

The API image uses a multi-stage build. TypeScript compilation happens
in the build stage; the runtime receives compiled code and production
dependencies and runs as a non-root user.

### Installation failure

The first container installation failed with ERR_PNPM_IGNORED_BUILDS.
The lockfile was valid, but esbuild's installation script had not been
explicitly permitted.

Added a version-specific build permission for esbuild 0.28.2, retaining
the existing denials for sharp and unrs-resolver. Frozen-lockfile
installation remains enabled.

### Verification

- Docker image built successfully.
- Compose reported the API container healthy.
- GET http://localhost:4101/health returned HTTP 200 and {"status":"ok"}.

These checks establish API HTTP liveness, not database readiness.
Automated application tests and the frontend container are not yet added.
The GitHub Actions workflow has not yet been verified on GitHub.

## Student data foundation

Separated organisation ownership, student identity and annual enrolment.

A composite foreign key prevents enrolments from referencing a student
in another organisation. Student references are unique within their
organisation. Check constraints reject blank required values and
nonpositive year groups.

Local PostgreSQL tests verified cross-organisation enrolment rejection,
duplicate reference rejection, invalid year-group rejection and
restricted organisation deletion.

The deletion test initially expected foreign_key_violation, but PostgreSQL
raised restrict_violation. Corrected the test handler without changing
the database restriction; the rerun passed and rolled back its changes.

These tests establish the exercised database constraints, not API
authorisation or complete tenant isolation.

## Database connectivity and readiness

Added a shared Prisma client using the PostgreSQL adapter, with an
explicit pool limit and connection/query timeouts.

Kept process liveness (`/health`) separate from database readiness
(`/ready`). Readiness returns HTTP 503 when the database check fails,
without exposing connection details.

Manual HTTP checks returned 200 for both endpoints. Readiness executes
`SELECT 1`; it does not verify application tables or tenant isolation.

Added HTTP tests covering readiness success, database failure and
continued liveness during a database outage.

## Encrypted pagination cursors

Finding: cursors were base64url-encoded JSON. Decoding one revealed the
student's surname, ID and organisation ID. The directory UI being
migrated puts cursors in page URLs, so children's surnames would reach
browser history, server logs and shared links.

Decision: encrypt cursors with AES-256-GCM using Node's built-in crypto.
Each token carries a version byte, authenticated as additional data, and
a fresh 12-byte nonce. The decrypted payload is validated again before
use. Altered, malformed or foreign-key tokens all return the same 400.
The key comes from `STUDENT_CURSOR_KEY` and is validated at startup.

Rejected alternatives:

- An ID-only cursor needs a lookup to recover the surname. It also stops
  working when the student it points at is deleted, which the keyset
  design otherwise tolerates.
- A signed but unencrypted cursor prevents tampering but still exposes
  the surname.

Limits:

- Encryption is not authorisation. Queries remain scoped to the server's
  organisation, and a cursor issued for another organisation is
  rejected.
- Rotating the key invalidates issued cursors; there is no key ID yet.
- At first, surname length was unbounded, so a very long surname could
  exceed the cursor length limit. Resolved below.

## Surname bound and database constraint tests

The cursor length limit was a fixed 8,192 characters while surnames were
unbounded, so a long enough surname would produce a page link the API
rejects. Surnames are now `VARCHAR(100)`, and the cursor limit is
calculated from that bound. `JSON.stringify` writes at most 6 bytes per
code point, so a surname of 100 control characters gives the longest
possible token: exactly 991 characters. Unit and integration tests cover
that case and confirm the database rejects 101 characters. PostgreSQL
counts code points, so the cursor payload check counts code points too,
not UTF-16 units.

The database constraint checks lived in a SQL script that was never run
automatically and relied on demo seed rows. They are now an integration
test with its own fixtures, run in CI. Writing it showed that check and
`RESTRICT` violations reach the application as a raw `DriverAdapterError`
with the PostgreSQL code at `cause`, not under `meta`. The error
classifier read only `meta`, so those failures would have been logged
with no code. It now reads both shapes.
