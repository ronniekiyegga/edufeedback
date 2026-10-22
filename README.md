# Attainline

School analytics for understanding student attainment, attendance and
intervention priorities.

This repository contains an incremental rebuild of EduFeedbackPro.
Existing features are being reviewed and migrated individually.

## Current implementation

- Student directory page at `/`, inside a dashboard shell (sidebar,
  header, collapsed icon rail and mobile navigation dialog).
- Synthetic demo identity and school name in the shell; no sign-in or
  memberships.
- Express API with separate HTTP liveness and database readiness endpoints.
- Prisma schema and migrations for organisations, students and annual enrolments.
- Student directory API with organisation scoping, academic-year
  placement (year group and class), server-side search and encrypted keyset
  cursors bound to the year and search.
- Request IDs shared by the web app and API, and structured JSON failure logs.
- API unit tests, PostgreSQL integration tests and Playwright browser tests.
- pnpm workspace with TypeScript and one root lockfile.
- GitHub Actions for linting, type checking, tests, builds and browser tests.
- Multi-stage API Docker image and local PostgreSQL through Compose.

Not migrated: authentication, school memberships, charts, analytics widgets,
the full student data table workflows, attainment analytics or interventions.
The shell and student endpoint use synthetic demo props and data only; they
do not implement sign-in or permissions.

## Structure

- `apps/web`: Next.js frontend.
- `apps/api`: Express API.

The web app bundles Inter 4.001 by The Inter Project Authors under the
SIL Open Font License 1.1; the licence is in
`apps/web/public/fonts/LICENSE.txt`.

## Local development

Requirements: Node.js 24 and pnpm 12.8.1.

Install dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

Copy `apps/api/.env.example` to `apps/api/.env`. Configure `DATABASE_URL`
and `DEMO_ORGANISATION_ID` there, and set `STUDENT_CURSOR_KEY` to the
output of `openssl rand -base64 32`. The API refuses to start without a
valid key.

The web app reads the API location from `ATTAINLINE_API_URL`, for example
`ATTAINLINE_API_URL=http://localhost:4100` in `apps/web/.env.local`.
A path in that URL is kept as a prefix, so `http://host/api` requests
`http://host/api/students`; any query string or fragment is ignored.

For local PostgreSQL:

```bash
docker compose up -d --wait database
```

Apply migrations to the database configured in `apps/api/.env`:

```bash
pnpm --filter @attainline/api exec prisma migrate deploy
```

Migrations create the schema; they do not load data. To fill the local
Docker database with invented demo students (65 across two fictional
organisations, enough for three directory pages):

```bash
SEED_DATABASE_URL="postgresql://attainline:local-development-only@127.0.0.1:5433/attainline" pnpm --filter @attainline/api seed:demo
```

The seed refuses any target except the local `attainline` database. It
only adds missing rows, never updates or deletes existing ones, so it is
safe to rerun. Every name and `DEMO-` reference in it is invented.
Integration tests create their own fixtures and do not use it.

Start each application in a separate terminal:

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

- Student directory: http://localhost:3100/
- API health: http://localhost:4100/health

`/health` returns `{"status":"ok"}` when the HTTP application responds.
`/ready` executes a database query and returns 200 when it succeeds or
503 when it fails. Readiness does not verify application tables.

The API defaults to port 4100. Set `PORT` to override it.

## Run the API and PostgreSQL with Docker

Requires Docker Desktop or Docker Engine with Compose.

From the repository root:

```bash
STUDENT_CURSOR_KEY="$(openssl rand -base64 32)" docker compose up --build -d --wait
curl -i http://localhost:4101/health
```

The container exposes the API at http://localhost:4101.
Local development uses port 4100.

Inspect status and logs:

```bash
docker compose ps
docker compose logs api
```

Stop and remove this project's containers and network:

```bash
docker compose down
```

The image runs compiled JavaScript as a non-root user and includes only
production package dependencies. Its healthcheck verifies HTTP liveness.

## Student directory API

`GET /students/academic-years` returns `academicYearStarts`: the academic
years in which the organisation configured by `DEMO_ORGANISATION_ID` has
enrolments, newest first. An organisation without enrolments returns an
empty list.

`GET /students?academicYearStart=2026&limit=25` returns the students
enrolled in that academic year. `academicYearStart` is required. Each item
contains `id`, `institutionStudentRef`, `firstName`, `surname`, and that
year's `yearGroup` and `classGroup` (null when no class is recorded).

Responses contain `items`, `nextCursor` and `limit`. Request the next
page by passing the returned cursor as the `cursor` query parameter.
A null `nextCursor` means no further page was available when queried.

Page sizes range from 1 to 100. Results are ordered by surname, then ID.
Offset parameters are no longer accepted.

Surnames are limited to 100 characters (`VARCHAR(100)`). The accepted
cursor length is derived from that limit, so every stored student
produces a cursor the API will accept.

Keyset pagination avoids position shifts caused by inserts and deletes
before the cursor. It does not provide a snapshot: surname changes can
move students across the boundary, and new rows before it appear only
after restarting pagination.

Cursors are opaque AES-256-GCM tokens, so the surname and ID they carry
stay out of URLs, browser history and logs, and altered tokens are
rejected. Encryption is not authorisation: every query is still scoped
to the configured organisation, and a valid cursor from another
organisation is rejected. Changing `STUDENT_CURSOR_KEY` invalidates
cursors already issued.

Invalid parameters and cursors return a generic 400. Query failures
return 503.

Search with `GET /students?academicYearStart=2026&q=Velmira&limit=25`.

Search matches a partial first name, surname or student reference,
case-insensitively. The trimmed term is limited to 100 characters.
Changing the year or the term starts a new pagination sequence: a cursor
is only accepted with the academic year and search it was issued for.

The directory page shows the newest academic year by default, with tabs
for the others. The search field submits the term explicitly. Pagination,
refresh and retry keep both the year and the search; choosing another year
keeps the search, and clearing the search keeps the year.

Search terms appear in URLs. This implementation is restricted to
synthetic demo data.

See [the search decision](docs/decisions/student-directory-search.md)
for matching behaviour, pagination constraints and performance limits, and
[the annual placement decision](docs/decisions/student-directory-annual-placement.md)
for how the year is chosen and what placement does not cover.

Every response carries an `X-Request-Id` header. An incoming UUID is
kept, so web and API log lines for one request share an ID. Failure
logs record Prisma and PostgreSQL error codes, never messages, URLs,
cursors or student data.

The endpoint has no authentication and is intended only for synthetic
demo data. Organisation scoping is not user authorisation.

## Verification

```bash
pnpm --filter @attainline/web lint
pnpm --filter @attainline/api test
pnpm typecheck
pnpm build
pnpm --filter @attainline/web test:e2e
```

Run PostgreSQL integration tests against a migrated local database named
`attainline_test`:

```bash
DATABASE_URL="postgresql://attainline:local-development-only@127.0.0.1:5433/attainline_test" pnpm --filter @attainline/api test:integration
```

CI runs API checks against an isolated PostgreSQL service, then builds
the apps and runs the Playwright tests in Chromium. API tests generate
their own throwaway cursor keys, so CI needs no secret.

Next fetches the directory on the server, where browser request
interception cannot reach. The browser tests therefore start a small
stand-in HTTP API (`apps/web/tests/support/student-api-server.mts`) and
switch it between populated, empty, invalid-cursor and unavailable
responses. Both are held to the web app's response schema: the API
integration test parses real responses with it, and a stand-in response
that failed it would show the unavailable state and fail the populated
browser tests.

That contract check imports the web app's response schema and search
limit from the API's integration test only. API source cannot import
outside `apps/api/src` (`rootDir` in its `tsconfig.json`), and the API's
build and Docker image contain no web code.

The stand-in API keeps one global scenario and request log, so Playwright
runs with a single worker. Running tests in parallel would need
per-test isolation in the stand-in first.

For local Playwright Chromium installation:

```bash
pnpm --filter @attainline/web exec playwright install --with-deps chromium
```

Deployment workflows are not configured.
