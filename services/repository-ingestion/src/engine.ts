import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from '@ai-code-management/database';
import { logger } from './utils/logger';
import { RepositoryIngestionService } from './services/repository-ingestion-service';
import { WebSocketService } from './services/websocket-service';

interface IngestRepositoryRequest {
  url: string;
  branch?: string;
  options?: {
    shallow?: boolean;
    depth?: number;
    includeTests?: boolean;
    includeDocs?: boolean;
    languages?: string[];
  };
}

interface IngestDirectoryRequest {
  path: string;
  options?: {
    includeTests?: boolean;
    includeDocs?: boolean;
    languages?: string[];
    recursive?: boolean;
  };
}

export class RepositoryIngestionEngine {
  private ingestionService: RepositoryIngestionService;
  private wsService: WebSocketService;
  private db: Database;

  constructor(
    private app: FastifyInstance,
    database: Database,
    wsService: WebSocketService
  ) {
    this.db = database;
    this.wsService = wsService;
    this.ingestionService = new RepositoryIngestionService(database, wsService);
    this.setupRoutes();
  }

  private setupRoutes() {
    // Health check
    this.app.get('/api/ingestion/health', this.healthCheck);
    
    // Repository ingestion endpoints
    this.app.post('/api/ingestion/repository', this.ingestRepository);
    this.app.post('/api/ingestion/directory', this.ingestDirectory);
    this.app.get('/api/ingestion/status/:jobId', this.getIngestionStatus);
    this.app.get('/api/ingestion/jobs', this.getIngestionJobs);
    
    // Repository management
    this.app.get('/api/repositories', this.getRepositories);
    this.app.get('/api/repositories/:id', this.getRepository);
    this.app.delete('/api/repositories/:id', this.deleteRepository);
    
    // Analysis endpoints
    this.app.get('/api/repositories/:id/entities', this.getRepositoryEntities);
    this.app.get('/api/repositories/:id/relationships', this.getRepositoryRelationships);
    this.app.get('/api/repositories/:id/metrics', this.getRepositoryMetrics);
    
    // Search endpoints
    this.app.post('/api/search/semantic', this.semanticSearch);
    this.app.post('/api/search/entities', this.searchEntities);
    this.app.post('/api/search/code', this.searchCode);
  }

  private healthCheck = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dbHealth = await this.db.health();
      return reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth ? 'connected' : 'disconnected',
          websocket: this.wsService.isConnected() ? 'connected' : 'disconnected',
          ingestion: 'ready'
        }
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      return reply.status(500).send({
        status: 'unhealthy',
        error: error.message
      });
    }
  };

  private ingestRepository = async (
    request: FastifyRequest<{ Body: IngestRepositoryRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const { url, branch = 'main', options = {} } = request.body;

      // Validate repository URL
      if (!url || !this.isValidRepositoryUrl(url)) {
        return reply.status(400).send({
          error: 'Invalid repository URL',
          message: 'Please provide a valid Git repository URL'
        });
      }

      // Start ingestion job
      const jobId = await this.ingestionService.ingestRepository(url, branch, options);

      return reply.send({
        success: true,
        jobId,
        message: 'Repository ingestion started',
        status_url: `/api/ingestion/status/${jobId}`
      });
    } catch (error) {
      logger.error('Repository ingestion failed:', error);
      return reply.status(500).send({
        error: 'Ingestion failed',
        message: error.message
      });
    }
  };

  private ingestDirectory = async (
    request: FastifyRequest<{ Body: IngestDirectoryRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const { path, options = {} } = request.body;

      // Validate directory path
      if (!path) {
        return reply.status(400).send({
          error: 'Invalid directory path',
          message: 'Please provide a valid directory path'
        });
      }

      // Start ingestion job
      const jobId = await this.ingestionService.ingestDirectory(path, options);

      return reply.send({
        success: true,
        jobId,
        message: 'Directory ingestion started',
        status_url: `/api/ingestion/status/${jobId}`
      });
    } catch (error) {
      logger.error('Directory ingestion failed:', error);
      return reply.status(500).send({
        error: 'Ingestion failed',
        message: error.message
      });
    }
  };

  private getIngestionStatus = async (
    request: FastifyRequest<{ Params: { jobId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { jobId } = request.params;
      const status = await this.ingestionService.getJobStatus(jobId);

      if (!status) {
        return reply.status(404).send({
          error: 'Job not found',
          message: `Ingestion job ${jobId} not found`
        });
      }

      return reply.send(status);
    } catch (error) {
      logger.error('Failed to get ingestion status:', error);
      return reply.status(500).send({
        error: 'Status check failed',
        message: error.message
      });
    }
  };

  private getIngestionJobs = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const jobs = await this.ingestionService.getAllJobs();
      return reply.send({
        jobs,
        total: jobs.length
      });
    } catch (error) {
      logger.error('Failed to get ingestion jobs:', error);
      return reply.status(500).send({
        error: 'Failed to retrieve jobs',
        message: error.message
      });
    }
  };

  private getRepositories = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const repositories = await this.db.collection('repositories').all();
      return reply.send({
        repositories: repositories.map(doc => doc._key ? doc : { ...doc, id: doc._key }),
        total: repositories.length
      });
    } catch (error) {
      logger.error('Failed to get repositories:', error);
      return reply.status(500).send({
        error: 'Failed to retrieve repositories',
        message: error.message
      });
    }
  };

  private getRepository = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const repository = await this.db.collection('repositories').document(id);
      
      if (!repository) {
        return reply.status(404).send({
          error: 'Repository not found',
          message: `Repository ${id} not found`
        });
      }

      return reply.send(repository);
    } catch (error) {
      logger.error('Failed to get repository:', error);
      return reply.status(500).send({
        error: 'Failed to retrieve repository',
        message: error.message
      });
    }
  };

  private deleteRepository = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      await this.ingestionService.deleteRepository(id);
      
      return reply.send({
        success: true,
        message: `Repository ${id} deleted successfully`
      });
    } catch (error) {
      logger.error('Failed to delete repository:', error);
      return reply.status(500).send({
        error: 'Failed to delete repository',
        message: error.message
      });
    }
  };

  private getRepositoryEntities = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const entities = await this.ingestionService.getRepositoryEntities(id);
      
      return reply.send({
        entities,
        total: entities.length,
        repository_id: id
      });
    } catch (error) {
      logger.error('Failed to get repository entities:', error);
      return reply.status(500).send({
        error: 'Failed to retrieve entities',
        message: error.message
      });
    }
  };

  private getRepositoryRelationships = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const relationships = await this.ingestionService.getRepositoryRelationships(id);
      
      return reply.send({
        relationships,
        total: relationships.length,
        repository_id: id
      });
    } catch (error) {
      logger.error('Failed to get repository relationships:', error);
      return reply.status(500).send({
        error: 'Failed to retrieve relationships',
        message: error.message
      });
    }
  };

  private getRepositoryMetrics = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const metrics = await this.ingestionService.getRepositoryMetrics(id);
      
      return reply.send({
        metrics,
        repository_id: id,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get repository metrics:', error);
      return reply.status(500).send({
        error: 'Failed to retrieve metrics',
        message: error.message
      });
    }
  };

  private semanticSearch = async (
    request: FastifyRequest<{ Body: { query: string; repository_id?: string; limit?: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const { query, repository_id, limit = 20 } = request.body;
      
      if (!query) {
        return reply.status(400).send({
          error: 'Missing query',
          message: 'Please provide a search query'
        });
      }

      const results = await this.ingestionService.semanticSearch(query, repository_id, limit);
      
      return reply.send({
        results,
        query,
        repository_id,
        total: results.length
      });
    } catch (error) {
      logger.error('Semantic search failed:', error);
      return reply.status(500).send({
        error: 'Search failed',
        message: error.message
      });
    }
  };

  private searchEntities = async (
    request: FastifyRequest<{ Body: { query: string; type?: string; repository_id?: string; limit?: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const { query, type, repository_id, limit = 20 } = request.body;
      
      if (!query) {
        return reply.status(400).send({
          error: 'Missing query',
          message: 'Please provide a search query'
        });
      }

      const results = await this.ingestionService.searchEntities(query, type, repository_id, limit);
      
      return reply.send({
        results,
        query,
        type,
        repository_id,
        total: results.length
      });
    } catch (error) {
      logger.error('Entity search failed:', error);
      return reply.status(500).send({
        error: 'Search failed',
        message: error.message
      });
    }
  };

  private searchCode = async (
    request: FastifyRequest<{ Body: { query: string; language?: string; repository_id?: string; limit?: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const { query, language, repository_id, limit = 20 } = request.body;
      
      if (!query) {
        return reply.status(400).send({
          error: 'Missing query',
          message: 'Please provide a search query'
        });
      }

      const results = await this.ingestionService.searchCode(query, language, repository_id, limit);
      
      return reply.send({
        results,
        query,
        language,
        repository_id,
        total: results.length
      });
    } catch (error) {
      logger.error('Code search failed:', error);
      return reply.status(500).send({
        error: 'Search failed',
        message: error.message
      });
    }
  };

  private isValidRepositoryUrl(url: string): boolean {
    const gitUrlPattern = /^(https?:\/\/)?([\w\.-]+@)?([\w\.-]+)(:[0-9]+)?(\/[\w\.-]+)*(\.git)?$/;
    const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w\.-]+\/[\w\.-]+$/;
    const gitlabPattern = /^https?:\/\/(www\.)?gitlab\.com\/[\w\.-]+\/[\w\.-]+$/;
    
    return gitUrlPattern.test(url) || githubPattern.test(url) || gitlabPattern.test(url);
  }
}
