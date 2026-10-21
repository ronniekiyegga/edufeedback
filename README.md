# Attainline

School analytics for understanding student attainment, attendance and
intervention priorities.

This repository contains an incremental rebuild of EduFeedbackPro.
Existing features are being reviewed and migrated individually.

## Current implementation

- Next.js frontend starter.
- Express API with a process-liveness endpoint.
- TypeScript configuration for both applications.
- pnpm workspace with one root lockfile.
- GitHub Actions configuration for type checking and builds.
- Multi-stage Docker build and Compose healthcheck for the Express API.

Student analytics, authentication and database persistence have not been
migrated yet. Docker currently runs the API only.

## Structure

- `apps/web`: Next.js frontend.
- `apps/api`: Express API.

## Local development

Requirements: Node.js 24 and pnpm 12.8.1.

Install dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

Start each application in a separate terminal:

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

- Frontend: http://localhost:3100
- API health: http://localhost:4100/health

The health endpoint returns `{"status":"ok"}`. It checks that the HTTP
application responds; it does not check database connectivity.

## Run the API with Docker

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

## Verification

```bash
pnpm typecheck
pnpm build
```

Automated tests and deployment workflows are not configured yet.
