# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/api-gateway/package.json ./services/api-gateway/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy package files and source
COPY . .

# Install all dependencies for build
RUN npm ci

# Build the application
RUN npm run build --workspace=services/api-gateway

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apigateway

# Copy built application
COPY --from=builder --chown=apigateway:nodejs /app/services/api-gateway/dist ./
COPY --from=deps --chown=apigateway:nodejs /app/node_modules ./node_modules

USER apigateway

EXPOSE 4000

CMD ["node", "index.js"]
