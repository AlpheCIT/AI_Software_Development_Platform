# Analysis Engine Service
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY services/analysis-engine/package.json ./services/analysis-engine/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai-services/package.json ./packages/ai-services/
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=services/analysis-engine

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 analysis
COPY --from=builder --chown=analysis:nodejs /app/services/analysis-engine/dist ./
COPY --from=deps --chown=analysis:nodejs /app/node_modules ./node_modules
USER analysis
CMD ["node", "index.js"]
