# Attainline

School analytics for understanding student attainment, attendance and
intervention priorities.

This repository contains an incremental rebuild of EduFeedbackPro.
Existing features are being reviewed and migrated individually.

## Current implementation

- Next.js frontend starter; the student interface is not implemented yet.
- Express API with separate HTTP liveness and database readiness endpoints.
- Prisma schema and migrations for organisations, students and annual enrolments.
- Student directory API with organisation scoping and encrypted keyset cursors.
- API request IDs and structured JSON failure logs.
- API unit tests and PostgreSQL integration tests.
- pnpm workspace with TypeScript and one root lockfile.
- GitHub Actions for web linting, type checking, tests and builds.
- Multi-stage API Docker image and local PostgreSQL through Compose.

Authentication, attainment analytics and intervention workflows have not
been migrated. The student endpoint currently serves synthetic demo data
without authentication.

## Structure

- `apps/web`: Next.js frontend.
- `apps/api`: Express API.

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

- Frontend: http://localhost:3100
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

`GET /students?limit=25` returns directory fields for the organisation
configured by `DEMO_ORGANISATION_ID`.

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

Every response carries an `X-Request-Id` header. An incoming UUID is
kept, so a caller's log lines can share the API's ID. Failure logs
record Prisma and PostgreSQL error codes, never messages, URLs, cursors
or student data.

The endpoint has no authentication and is intended only for synthetic
demo data. Organisation scoping is not user authorisation.

## Verification

```bash
pnpm --filter @attainline/web lint
pnpm --filter @attainline/api test
pnpm typecheck
pnpm build
```

Run PostgreSQL integration tests against a migrated local database named
`attainline_test`:

```bash
DATABASE_URL="postgresql://attainline:local-development-only@127.0.0.1:5433/attainline_test" pnpm --filter @attainline/api test:integration
```

CI runs these checks using an isolated PostgreSQL service. API tests
generate their own throwaway cursor keys, so CI needs no secret.
Deployment workflows are not configured.
