# Attainline

School analytics for understanding student attainment, attendance and
intervention priorities.

This repository contains an incremental rebuild of EduFeedbackPro.
Existing features are being reviewed and migrated individually.

## Current implementation

- Next.js frontend starter; the student interface is not implemented yet.
- Express API with separate HTTP liveness and database readiness endpoints.
- Prisma schema and migrations for organisations, students and annual enrolments.
- Student directory API with organisation scoping and bounded pagination.
- API behaviour tests and PostgreSQL integration tests.
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
and `DEMO_ORGANISATION_ID` there.

For local PostgreSQL:

```bash
docker compose up -d --wait database
```

Apply migrations to the database configured in `apps/api/.env`:

```bash
pnpm --filter @attainline/api exec prisma migrate deploy
```

Migrations create the schema; they do not load synthetic fixtures.

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
docker compose up --build -d --wait
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

Keyset pagination avoids position shifts caused by inserts and deletes
before the cursor. It does not provide a snapshot: surname changes can
move students across the boundary, and new rows before it appear only
after restarting pagination.

Cursors are encoded, not encrypted, and contain a surname and ID.
Treat them as potentially sensitive; do not log query strings.

Invalid parameters return 400. Query failures return 503.

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

CI runs these checks using an isolated PostgreSQL service.
Deployment workflows are not configured.
