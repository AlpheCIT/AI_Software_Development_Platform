/**
 * AI Software Development Platform - API Gateway
 * 
 * GraphQL API Gateway with REST endpoints providing:
 * - Repository analysis and management
 * - AI-powered code intelligence
 * - Real-time collaboration features
 * - Integration with external tools (Jira, GitHub, etc.)
 */

import Fastify from 'fastify';
import mercurius from 'mercurius';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { logger } from './utils/logger';
import { schema } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { context } from './graphql/context';
import { healthRoutes } from './routes/health';
import { repositoryRoutes } from './routes/repositories';
import { aiRoutes } from './routes/ai';
import { integrationRoutes } from './routes/integrations';
import { mcpProxyRoutes } from './routes/mcp-proxy';

async function createServer() {
  const fastify = Fastify({
    logger: logger,
    trustProxy: true,
  });

  // Security middleware
  await fastify.register(helmet);
  
  // CORS
  await fastify.register(cors, {
    origin: config.cors.origins,
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: config.rateLimit.maxRequests,
    timeWindow: config.rateLimit.windowMs,
  });

  // OpenAPI documentation
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'AI Code Management System API',
        description: 'Enterprise-grade API for AI-powered code intelligence and management',
        version: '2.0.0',
      },
      host: `${config.api.host}:${config.api.port}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Repositories', description: 'Repository management' },
        { name: 'AI', description: 'AI-powered analysis and recommendations' },
        { name: 'Integrations', description: 'External tool integrations' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // GraphQL endpoint
  await fastify.register(mercurius, {
    schema,
    resolvers,
    context,
    graphiql: config.env === 'development',
    ide: config.env === 'development',
    path: '/graphql',
    errorHandler: (error, request, reply) => {
      logger.error('GraphQL Error:', error);
      reply.code(200).send({
        data: null,
        errors: [
          {
            message: error.message,
            extensions: {
              code: error.extensions?.code || 'INTERNAL_ERROR',
            },
          },
        ],
      });
    },
  });

  // REST API routes
  await fastify.register(healthRoutes, { prefix: '/api/health' });
  await fastify.register(repositoryRoutes, { prefix: '/api/repositories' });
  await fastify.register(aiRoutes, { prefix: '/api/ai' });
  await fastify.register(integrationRoutes, { prefix: '/api/integrations' });
  await fastify.register(mcpProxyRoutes, { prefix: '/api/v1/mcp' });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('Request Error:', error);
    
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    
    reply.code(statusCode).send({
      success: false,
      error: {
        message,
        code: error.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
    });
  });

  return fastify;
}

async function start() {
  try {
    const server = await createServer();
    
    // Start server
    await server.listen({
      port: config.api.port,
      host: config.api.host,
    });

    logger.info(`🚀 AI Code Management API Gateway started`);
    logger.info(`📍 GraphQL Playground: http://${config.api.host}:${config.api.port}/graphql`);
    logger.info(`📖 API Documentation: http://${config.api.host}:${config.api.port}/docs`);
    logger.info(`💚 Health Check: http://${config.api.host}:${config.api.port}/api/health`);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
start();