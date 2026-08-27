# Build context is the repo root (see docker-compose.yml: context: ., dockerfile:
# services/api/Dockerfile) — needed so npm workspaces can resolve @indus/* siblings.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY services/api/package.json services/api/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared-types packages/shared-types
COPY packages/config packages/config
COPY packages/auth packages/auth
COPY packages/db packages/db
COPY services/api services/api

RUN npm run build \
  -w packages/shared-types \
  -w packages/config \
  -w packages/auth \
  -w packages/db \
  -w services/api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY services/api/package.json services/api/package.json

RUN npm ci --omit=dev \
  --workspace=@indus/shared-types \
  --workspace=@indus/config \
  --workspace=@indus/auth \
  --workspace=@indus/db \
  --workspace=@indus/api

COPY --from=builder /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=builder /app/packages/config/dist packages/config/dist
COPY --from=builder /app/packages/auth/dist packages/auth/dist
COPY --from=builder /app/packages/db/dist packages/db/dist
COPY --from=builder /app/packages/db/migrations packages/db/migrations
COPY --from=builder /app/services/api/dist services/api/dist

EXPOSE 3000
CMD ["node", "services/api/dist/index.js"]
