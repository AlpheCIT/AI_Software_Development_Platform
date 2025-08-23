# Repository Ingestion Service
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY services/repository-ingestion/package.json ./services/repository-ingestion/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=services/repository-ingestion

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 ingestion
COPY --from=builder --chown=ingestion:nodejs /app/services/repository-ingestion/dist ./
COPY --from=deps --chown=ingestion:nodejs /app/node_modules ./node_modules
USER ingestion
CMD ["node", "index.js"]
