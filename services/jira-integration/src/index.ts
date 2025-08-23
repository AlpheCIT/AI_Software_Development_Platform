/**
 * Jira Integration Service
 * Handles bidirectional synchronization between frontend Kanban and Jira
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import { config } from './config';
import { JiraClient } from './services/jira-client';
import { WebhookHandler } from './services/webhook-handler';
import { SyncEngine } from './services/sync-engine';
import { ConflictResolver } from './services/conflict-resolver';
import { setupRoutes } from './routes';
import { setupWebSocket } from './websocket';
import logger from './utils/logger';

async function bootstrap() {
  const app = fastify({
    logger,
    trustProxy: true
  });

  try {
    // Register plugins
    await app.register(helmet, {
      contentSecurityPolicy: false
    });

    await app.register(cors, {
      origin: config.cors.origins,
      credentials: true
    });

    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    });

    await app.register(swagger, {
      swagger: {
        info: {
          title: 'Jira Integration API',
          description: 'Bidirectional Jira synchronization service',
          version: '1.0.0'
        },
        host: `localhost:${config.port}`,
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json']
      }
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      }
    });

    await app.register(websocket);

    // Initialize services
    const jiraClient = new JiraClient({
      baseUrl: config.jira.baseUrl,
      email: config.jira.email,
      apiToken: config.jira.apiToken
    });

    const webhookHandler = new WebhookHandler();
    const conflictResolver = new ConflictResolver();
    const syncEngine = new SyncEngine(jiraClient, conflictResolver);

    // Test Jira connection
    await jiraClient.testConnection();
    logger.info('✅ Jira connection successful');

    // Set up routes and WebSocket
    setupRoutes(app, { jiraClient, syncEngine, webhookHandler });
    setupWebSocket(app, { syncEngine });

    // Health check endpoint
    app.get('/health', async (request, reply) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          jira: await jiraClient.getConnectionStatus(),
          sync: syncEngine.getStatus(),
          webhook: webhookHandler.getStatus()
        }
      };
      
      return health;
    });

    // Start server
    const address = await app.listen({
      port: config.port,
      host: config.host
    });

    logger.info(`🚀 Jira Integration Service running at ${address}`);
    logger.info(`📚 API Documentation available at ${address}/docs`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`📴 Received ${signal}, shutting down gracefully...`);
      
      try {
        await syncEngine.stop();
        await app.close();
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start Jira Integration Service:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the service
bootstrap().catch((error) => {
  logger.error('Bootstrap failed:', error);
  process.exit(1);
});
