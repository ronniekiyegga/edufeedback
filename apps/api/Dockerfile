FROM node:24-bookworm-slim AS build

WORKDIR /workspace

RUN npm install --global pnpm@12.8.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src

RUN pnpm --filter @attainline/api build
RUN pnpm --filter @attainline/api --prod deploy /output

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=node:node /output ./

USER node

EXPOSE 4100

CMD ["node", "dist/server.js"]
