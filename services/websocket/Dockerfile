# WebSocket Service Dockerfile
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/websocket/package.json ./services/websocket/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies with npm ci for faster, reliable builds
RUN npm ci --only=production --frozen-lockfile

FROM base AS builder
WORKDIR /app

# Copy all source files
COPY . .

# Install all dependencies and build
RUN npm ci --frozen-lockfile
RUN npm run build --workspace=services/websocket

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4001
ENV WS_PORT=4001

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 websocket

# Copy built application and dependencies
COPY --from=builder --chown=websocket:nodejs /app/services/websocket/dist ./
COPY --from=deps --chown=websocket:nodejs /app/node_modules ./node_modules

# Health check for container monitoring
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({hostname: 'localhost', port: process.env.PORT, path: '/health', timeout: 2000}, (res) => { console.log('Health check passed'); process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => { console.log('Health check failed'); process.exit(1); }); req.end();"

# Switch to non-root user
USER websocket

# Expose WebSocket port
EXPOSE 4001

# Use dumb-init for proper signal handling in containers
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
