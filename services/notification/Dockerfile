# Notification Service
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY services/notification/package.json ./services/notification/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=services/notification

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 notification
COPY --from=builder --chown=notification:nodejs /app/services/notification/dist ./
COPY --from=deps --chown=notification:nodejs /app/node_modules ./node_modules
USER notification
CMD ["node", "index.js"]
