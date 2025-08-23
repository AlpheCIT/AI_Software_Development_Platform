// 🚀 Vector Search Service - Main Entry Point
// FastAPI-compatible service for vector search and GraphRAG capabilities

import express, { Request, Response } from 'express';
import cors from 'cors';
import { Database } from 'arangojs';
import { VectorizedCodeIntelligenceService } from './services/vectorized-intelligence-service.js';
import { VectorSearchSetup } from './utils/vector-search-setup.js';
import { 
  VectorSearchConfig, 
  GraphRAGQuery, 
  EnhancedCodeEntity 
} from './types/enhanced-vector-types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class VectorSearchAPI {
  private app: express.Application;
  private db: Database;
  private vectorService: VectorizedCodeIntelligenceService;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.VECTOR_SEARCH_PORT || '8005');
    
    // Initialize database connection
    this.db = new Database({
      url: process.env.ARANGO_URL || 'http://192.168.1.82:8529',
      databaseName: process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB',
      auth: {
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || 'password'
      }
    });

    // Initialize vector service
    this.vectorService = new VectorizedCodeIntelligenceService(this.db);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: 'vector-search',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Service info
    this.app.get('/info', (req: Request, res: Response) => {
      res.json({
        service: 'AI Code Intelligence - Vector Search Service',
        version: '1.0.0',
        capabilities: [
          'Semantic Code Search',
          'Business Pattern Discovery',
          'GraphRAG Queries',
          'Hybrid Search (Vector + Graph + Text)',
          'AI-Powered Code Intelligence'
        ],
        endpoints: {
          'POST /search/semantic': 'Natural language code search',
          'POST /search/similar': 'Find similar code patterns',
          'POST /discovery/patterns': 'Discover business patterns',
          'POST /query/graphrag': 'Complex GraphRAG queries',
          'POST /enhance/descriptions': 'Enhance entity descriptions',
          'GET /analytics/performance': 'Performance metrics'
        }
      });
    });

    // ===== SEMANTIC SEARCH ENDPOINTS =====

    // Natural language code search
    this.app.post('/search/semantic', async (req: Request, res: Response) => {
      try {
        const { query, options = {} } = req.body;
        
        if (!query) {
          return res.status(400).json({ error: 'Query parameter is required' });
        }

        console.log(`🔍 Semantic search request: "${query}"`);
        
        const results = await this.vectorService.performSemanticSearch(query, options);
        
        res.json({
          success: true,
          query: query,
          results: results,
          metadata: {
            total_results: results.length,
            search_type: options.search_type || 'all',
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('❌ Semantic search error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Find similar code by description
    this.app.post('/search/similar', async (req: Request, res: Response) => {
      try {
        const { description, options = {} } = req.body;
        
        if (!description) {
          return res.status(400).json({ error: 'Description parameter is required' });
        }

        console.log(`🔍 Similar code search: "${description}"`);
        
        const results = await this.vectorService.findSimilarCodeByDescription(description, options);
        
        res.json({
          success: true,
          description: description,
          results: results,
          metadata: {
            total_results: results.length,
            similarity_threshold: options.similarity_threshold || 0.7,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('❌ Similar code search error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // ===== PATTERN DISCOVERY ENDPOINTS =====

    // Discover business patterns
    this.app.post('/discovery/patterns', async (req: Request, res: Response) => {
      try {
        const { repository_id, options = {} } = req.body;
        
        if (!repository_id) {
          return res.status(400).json({ error: 'Repository ID is required' });
        }

        console.log(`🔍 Pattern discovery for repository: ${repository_id}`);
        
        const patterns = await this.vectorService.discoverBusinessPatterns(repository_id, options);
        
        res.json({
          success: true,
          repository_id: repository_id,
          patterns: patterns,
          metadata: {
            business_patterns: patterns.business_clusters.length,
            technical_patterns: patterns.technical_clusters.length,
            cross_domain_patterns: patterns.cross_domain_patterns.length,
            outliers: patterns.outliers.length,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('❌ Pattern discovery error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // ===== GRAPHRAG ENDPOINTS =====

    // Complex GraphRAG queries
    this.app.post('/query/graphrag', async (req: Request, res: Response) => {
      try {
        const { query } = req.body;
        
        if (!query || !query.natural_language_query) {
          return res.status(400).json({ error: 'GraphRAG query with natural_language_query is required' });
        }

        console.log(`🧠 GraphRAG query: "${query.natural_language_query}"`);
        
        const result = await this.vectorService.performGraphRAGQuery(query);
        
        res.json({
          success: true,
          query: query,
          result: result,
          metadata: {
            processing_time_ms: result.query_analysis.processing_time_ms,
            complexity: result.query_analysis.query_complexity,
            confidence: result.query_analysis.confidence_score,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('❌ GraphRAG query error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // ===== ENHANCEMENT ENDPOINTS =====

    // Enhance entity descriptions
    this.app.post('/enhance/descriptions', async (req: Request, res: Response) => {
      try {
        const { entity_ids, options = {} } = req.body;
        
        if (!entity_ids || !Array.isArray(entity_ids)) {
          return res.status(400).json({ error: 'entity_ids array is required' });
        }

        console.log(`🔧 Enhancing descriptions for ${entity_ids.length} entities`);
        
        await this.vectorService.enhanceEntityDescriptions(entity_ids, options);
        
        res.json({
          success: true,
          enhanced_entities: entity_ids.length,
          options: options,
          metadata: {
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('❌ Description enhancement error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // ===== ANALYTICS ENDPOINTS =====

    // Performance metrics
    this.app.get('/analytics/performance', async (req: Request, res: Response) => {
      try {
        // Get performance metrics from database
        const metricsQuery = `
          FOR metric IN doc_search_analytics
            FILTER metric.report_type == "vector_enhancement_setup"
            SORT metric.created_at DESC
            LIMIT 1
            RETURN metric
        `;
        
        const result = await this.db.query(metricsQuery);
        const latestMetrics = await result.next();
        
        if (latestMetrics) {
          res.json({
            success: true,
            performance_metrics: latestMetrics,
            metadata: {
              data_source: 'database',
              timestamp: new Date().toISOString()
            }
          });
        } else {
          res.json({
            success: true,
            performance_metrics: {
              message: 'No performance metrics available yet. Run vector search setup first.'
            },
            metadata: {
              data_source: 'default',
              timestamp: new Date().toISOString()
            }
          });
        }

      } catch (error) {
        console.error('❌ Analytics error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // ===== SETUP ENDPOINTS =====

    // Initialize vector search capabilities
    this.app.post('/setup/initialize', async (req: Request, res: Response) => {
      try {
        console.log('🚀 Initializing vector search capabilities...');
        
        const setup = new VectorSearchSetup();
        await setup.setupVectorSearchEnhancements();
        
        res.json({
          success: true,
          message: 'Vector search capabilities initialized successfully',
          metadata: {
            initialization_complete: true,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('❌ Setup initialization error:', error);
        res.status(500).json({
          success: false,
          error: 'Setup initialization failed',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // ===== ERROR HANDLING =====

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
          'GET /health',
          'GET /info',
          'POST /search/semantic',
          'POST /search/similar',
          'POST /discovery/patterns',
          'POST /query/graphrag',
          'POST /enhance/descriptions',
          'GET /analytics/performance',
          'POST /setup/initialize'
        ]
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error('💥 Unhandled error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Test database connection
      await this.testDatabaseConnection();
      
      // Start server
      this.app.listen(this.port, () => {
        console.log('🚀 VECTOR SEARCH SERVICE STARTED');
        console.log('=' .repeat(60));
        console.log(`🌐 Server running on port ${this.port}`);
        console.log(`🔗 Health check: http://localhost:${this.port}/health`);
        console.log(`📚 Service info: http://localhost:${this.port}/info`);
        console.log('=' .repeat(60));
        console.log('✨ Available capabilities:');
        console.log('   🔍 Semantic code search');
        console.log('   🧠 Business pattern discovery');
        console.log('   🚀 GraphRAG queries');
        console.log('   📊 Hybrid search (Vector + Graph + Text)');
        console.log('   🎯 AI-powered code intelligence');
        console.log('=' .repeat(60));
      });
      
    } catch (error) {
      console.error('❌ Failed to start vector search service:', error);
      process.exit(1);
    }
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      const info = await this.db.get();
      console.log(`✅ Connected to ArangoDB: ${info.name} (version ${info.version})`);
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }
}

// ===== STARTUP =====

async function startVectorSearchService(): Promise<void> {
  const api = new VectorSearchAPI();
  await api.start();
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start service if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startVectorSearchService().catch(error => {
    console.error('💥 Failed to start service:', error);
    process.exit(1);
  });
}

export { VectorSearchAPI, startVectorSearchService };
