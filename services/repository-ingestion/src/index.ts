import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Database } from '@ai-code-management/database';
import { RepositoryIngestionEngine } from './engine';
import { WebSocketService } from './services/websocket-service';
import { logger } from './utils/logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ServiceConfig {
  port: number;
  host: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  services: {
    ollama: {
      url: string;
      model: string;
    };
    websocket: {
      enabled: boolean;
    };
  };
}

export class RepositoryIngestionService {
  private app: FastifyInstance;
  private config: ServiceConfig;
  private database: Database;
  private wsService: WebSocketService;
  private ingestionEngine: RepositoryIngestionEngine;

  constructor(config?: Partial<ServiceConfig>) {
    this.config = this.loadConfiguration(config);
    this.app = fastify({
      logger: false, // We use our own logger
      requestIdHeader: 'x-request-id',
      requestIdLogLabel: 'requestId'
    });
    
    this.setupDatabase();
    this.setupServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private loadConfiguration(overrides?: Partial<ServiceConfig>): ServiceConfig {
    const defaultConfig: ServiceConfig = {
      port: parseInt(process.env.PORT || '8002'),
      host: process.env.HOST || '0.0.0.0',
      database: {
        host: process.env.ARANGO_HOST || 'localhost',
        port: parseInt(process.env.ARANGO_PORT || '8529'),
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || '',
        database: process.env.ARANGO_DATABASE || 'code_management'
      },
      services: {
        ollama: {
          url: process.env.OLLAMA_URL || 'http://localhost:11434',
          model: process.env.OLLAMA_MODEL || 'nomic-embed-text'
        },
        websocket: {
          enabled: process.env.WEBSOCKET_ENABLED !== 'false'
        }
      }
    };

    return { ...defaultConfig, ...overrides };
  }

  private setupDatabase(): void {
    // Initialize database connection
    // This would use the actual database implementation
    this.database = new Database(this.config.database);
  }

  private setupServices(): void {
    // Initialize WebSocket service
    this.wsService = new WebSocketService();
    
    // Initialize ingestion engine
    this.ingestionEngine = new RepositoryIngestionEngine(
      this.app,
      this.database,
      this.wsService
    );
  }

  private async setupMiddleware(): Promise<void> {
    // CORS
    await this.app.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
    });

    // Security headers
    await this.app.register(helmet, {
      contentSecurityPolicy: false
    });

    // Swagger documentation
    await this.app.register(swagger, {
      swagger: {
        info: {
          title: 'Repository Ingestion API',
          description: 'AI Code Management System - Repository Ingestion Service',
          version: '2.0.0'
        },
        host: `${this.config.host}:${this.config.port}`,
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'ingestion', description: 'Repository ingestion endpoints' },
          { name: 'repositories', description: 'Repository management endpoints' },
          { name: 'search', description: 'Search and analysis endpoints' },
          { name: 'system', description: 'System health and monitoring' }
        ]
      }
    });

    await this.app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      }
    });

    // Request logging middleware
    this.app.addHook('onRequest', async (request, reply) => {
      const requestLogger = logger.child({
        requestId: request.id,
        method: request.method,
        url: request.url
      });
      
      request.logger = requestLogger;
      requestLogger.http(`${request.method} ${request.url}`);
    });

    // Response time logging
    this.app.addHook('onResponse', async (request, reply) => {
      const responseTime = reply.getResponseTime();
      request.logger?.http('Request completed', {
        statusCode: reply.statusCode,
        responseTime: `${responseTime}ms`
      });
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', {
      schema: {
        tags: ['system'],
        description: 'Health check endpoint',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string' },
                  websocket: { type: 'string' },
                  ollama: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }, async (request, reply) => {
      try {
        const dbHealth = await this.database.health();
        const wsStats = this.wsService.getStats();
        
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: dbHealth ? 'connected' : 'disconnected',
            websocket: wsStats.connected ? 'connected' : 'disconnected',
            ollama: 'unknown' // Would check Ollama service
          }
        };
      } catch (error) {
        reply.status(500);
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        };
      }
    });

    // System status endpoint
    this.app.get('/status', {
      schema: {
        tags: ['system'],
        description: 'Detailed system status',
        response: {
          200: {
            type: 'object',
            properties: {
              service: { type: 'string' },
              version: { type: 'string' },
              uptime: { type: 'number' },
              memory: { type: 'object' },
              websocket: { type: 'object' },
              database: { type: 'object' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const memoryUsage = process.memoryUsage();
      const wsStats = this.wsService.getStats();
      
      return {
        service: 'repository-ingestion',
        version: '2.0.0',
        uptime: process.uptime(),
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
        },
        websocket: wsStats,
        database: {
          connected: await this.database.health()
        }
      };
    });

    // The ingestion engine routes are already set up in the constructor
    // via the RepositoryIngestionEngine class
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.setErrorHandler(async (error, request, reply) => {
      request.logger?.error('Request error:', error);
      
      // Determine appropriate status code
      let statusCode = 500;
      if (error.validation) {
        statusCode = 400;
      } else if (error.statusCode) {
        statusCode = error.statusCode;
      }

      reply.status(statusCode).send({
        error: {
          message: error.message,
          statusCode,
          timestamp: new Date().toISOString(),
          requestId: request.id
        }
      });
    });

    // Not found handler
    this.app.setNotFoundHandler(async (request, reply) => {
      reply.status(404).send({
        error: {
          message: 'Route not found',
          statusCode: 404,
          path: request.url,
          method: request.method,
          timestamp: new Date().toISOString()
        }
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize database
      await this.database.initialize();
      logger.info('Database initialized');

      // Start the server
      await this.app.listen({
        port: this.config.port,
        host: this.config.host
      });

      logger.info(`Repository Ingestion Service started on ${this.config.host}:${this.config.port}`);
      logger.info(`API Documentation: http://${this.config.host}:${this.config.port}/docs`);
      
      // Log service configuration
      logger.info('Service configuration:', {
        port: this.config.port,
        host: this.config.host,
        database: {
          host: this.config.database.host,
          port: this.config.database.port,
          database: this.config.database.database
        },
        services: this.config.services
      });

    } catch (error) {
      logger.error('Failed to start service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping Repository Ingestion Service...');
      
      // Close WebSocket connections
      await this.wsService.disconnect();
      
      // Close database connection
      await this.database.close();
      
      // Close Fastify server
      await this.app.close();
      
      logger.info('Repository Ingestion Service stopped');
    } catch (error) {
      logger.error('Error stopping service:', error);
      throw error;
    }
  }

  // Utility methods for testing and management
  getApp(): FastifyInstance {
    return this.app;
  }

  getDatabase(): Database {
    return this.database;
  }

  getWebSocketService(): WebSocketService {
    return this.wsService;
  }

  getIngestionEngine(): RepositoryIngestionEngine {
    return this.ingestionEngine;
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, string>;
    timestamp: string;
  }> {
    const services: Record<string, string> = {};
    
    try {
      services.database = await this.database.health() ? 'connected' : 'disconnected';
    } catch (error) {
      services.database = 'error';
    }
    
    services.websocket = this.wsService.isConnected() ? 'connected' : 'disconnected';
    
    const allHealthy = Object.values(services).every(status => status === 'connected');
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      services,
      timestamp: new Date().toISOString()
    };
  }
}

// Factory function for creating service instance
export function createRepositoryIngestionService(config?: Partial<ServiceConfig>): RepositoryIngestionService {
  return new RepositoryIngestionService(config);
}

// Main execution when run directly
if (require.main === module) {
  const service = createRepositoryIngestionService();
  
  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('Received shutdown signal, gracefully shutting down...');
    try {
      await service.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGUSR2', shutdown); // For nodemon

  // Unhandled error handling
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  // Start the service
  service.start().catch((error) => {
    logger.error('Failed to start service:', error);
    process.exit(1);
  });
}

// Export types and service
export * from './engine';
export * from './services/repository-ingestion-service';
export * from './services/websocket-service';
export * from './parsers/language-parser-factory';
export * from './extractors/entity-extractor';
export * from './extractors/relationship-extractor';
export * from './builders/graph-builder';
export * from './utils/git-service';
export * from './utils/embedding-service';
export * from './utils/logger';
