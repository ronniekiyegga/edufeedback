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
