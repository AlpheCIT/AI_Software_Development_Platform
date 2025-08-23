# AI Orchestration Service
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY services/ai-orchestration/package.json ./services/ai-orchestration/
COPY packages/agents/package.json ./packages/agents/
COPY packages/ai-services/package.json ./packages/ai-services/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=services/ai-orchestration

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 orchestration
COPY --from=builder --chown=orchestration:nodejs /app/services/ai-orchestration/dist ./
COPY --from=deps --chown=orchestration:nodejs /app/node_modules ./node_modules
USER orchestration
CMD ["node", "index.js"]
