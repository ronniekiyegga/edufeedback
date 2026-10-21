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
