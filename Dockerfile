# Multi-stage Dockerfile for AI Software Development Platform

# =============================================================================
# Base Node.js image
# =============================================================================
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./

# =============================================================================
# Dependencies stage
# =============================================================================
FROM base AS dependencies

# Install all dependencies (including dev dependencies)
RUN npm ci --include=dev

# =============================================================================
# Build stage
# =============================================================================
FROM dependencies AS build

# Copy source code
COPY . .

# Build the application
RUN npm run build

# =============================================================================
# Production dependencies stage
# =============================================================================
FROM base AS production-deps

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# Development stage
# =============================================================================
FROM dependencies AS development

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/temp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application in development mode
CMD ["npm", "run", "dev"]

# =============================================================================
# Production stage
# =============================================================================
FROM base AS production

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/temp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "src/index.js", "start"]

# =============================================================================
# CLI stage (for command-line usage)
# =============================================================================
FROM production AS cli

# Install CLI globally
RUN npm install -g .

# Default command
CMD ["ai-code-management", "--help"]
