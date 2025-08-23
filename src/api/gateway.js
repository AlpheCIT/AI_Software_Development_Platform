/**
 * API Gateway for AI Software Development Platform
 * 
 * Provides a unified REST API interface for:
 * - Repository management
 * - Graph data and visualization
 * - Search and analytics
 * - Real-time WebSocket updates
 * - What-if simulation
 * - AI insights and recommendations
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// Services
const { getDBManager } = require('../database/connection-manager');
const { CodeIntelligenceService } = require('../services/code-intelligence');

class APIGateway {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 3001;
    this.host = options.host || process.env.HOST || '0.0.0.0';
    this.environment = process.env.NODE_ENV || 'development';
    
    // Express app
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Socket.IO for real-time updates
    this.io = socketIo(this.server, {
      cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    // Services
    this.dbManager = null;
    this.codeIntelligence = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the API Gateway
   */
  async initialize() {
    try {
      console.log('🔧 Initializing API Gateway...');
      
      // Initialize database connection
      try {
        this.dbManager = getDBManager();
        if (!this.dbManager.isConnected) {
          await this.dbManager.connect();
        }
      } catch (error) {
        console.warn('⚠️  Database not available, using mock data');
        this.dbManager = {
          isConnected: false,
          createRepository: async () => ({ _id: 'mock', name: 'Mock Repository' }),
          getRepository: async () => null,
          getRepositoryHealthScore: async () => ({ health_score: { overall: 85 } }),
          getAIInsights: async () => [],
          createAIInsight: async () => ({ _id: 'mock-insight' }),
          disconnect: async () => {}
        };
      }
      
      // Initialize Code Intelligence Service
      try {
        this.codeIntelligence = new CodeIntelligenceService();
        await this.codeIntelligence.initialize();
      } catch (error) {
        console.warn('⚠️  Code Intelligence Service not available, using mock data');
        this.codeIntelligence = {
          initialize: async () => {},
          cleanup: async () => {}
        };
      }
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup WebSocket handlers
      this.setupWebSocket();
      
      // Setup error handling
      this.setupErrorHandling();
      
      this.isInitialized = true;
      console.log('✅ API Gateway initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize API Gateway:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false // Allow for development
    }));
    
    // CORS
    this.app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true
    }));
    
    // Compression
    this.app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.environment === 'production' ? 100 : 1000, // requests per window
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    if (this.environment === 'development') {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
      });
    }
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        services: {
          database: this.dbManager?.isConnected || false,
          codeIntelligence: !!this.codeIntelligence
        }
      });
    });

    // API Documentation
    try {
      const swaggerPath = path.join(__dirname, '../docs/api-docs.yaml');
      if (require('fs').existsSync(swaggerPath)) {
        const swaggerDocument = YAML.load(swaggerPath);
        this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
      }
    } catch (error) {
      console.warn('⚠️  Could not load Swagger documentation');
    }

    // API v1 routes
    const v1Router = express.Router();

    // Repository routes
    v1Router.get('/repositories', this.getRepositories.bind(this));
    v1Router.post('/repositories', this.createRepository.bind(this));
    v1Router.get('/repositories/:id', this.getRepository.bind(this));
    v1Router.post('/repositories/:id/analyze', this.analyzeRepository.bind(this));
    v1Router.get('/repositories/:id/health-score', this.getRepositoryHealthScore.bind(this));

    // Graph routes (for frontend integration)
    v1Router.get('/graph/seeds', this.getGraphSeeds.bind(this));
    v1Router.get('/graph/node/:nodeId', this.getNodeDetails.bind(this));
    v1Router.get('/graph/search', this.searchGraph.bind(this));
    v1Router.get('/graph/neighborhood/:nodeId', this.getNodeNeighborhood.bind(this));

    // Saved Views routes
    v1Router.get('/graph/saved-views', this.getSavedViews.bind(this));
    v1Router.post('/graph/saved-views', this.createSavedView.bind(this));
    v1Router.get('/graph/saved-views/:id', this.getSavedView.bind(this));
    v1Router.put('/graph/saved-views/:id', this.updateSavedView.bind(this));
    v1Router.delete('/graph/saved-views/:id', this.deleteSavedView.bind(this));

    // Search routes
    v1Router.get('/search/code', this.searchCode.bind(this));
    v1Router.get('/search/functions', this.searchFunctions.bind(this));
    v1Router.get('/search/files', this.searchFiles.bind(this));

    // AI and insights routes
    v1Router.get('/repositories/:id/ai-insights', this.getAIInsights.bind(this));
    v1Router.post('/repositories/:id/ai-insights', this.generateAIInsights.bind(this));
    v1Router.get('/repositories/:id/recommendations', this.getRecommendations.bind(this));

    // Analytics routes
    v1Router.get('/analytics/overview', this.getAnalyticsOverview.bind(this));
    v1Router.get('/analytics/trends', this.getAnalyticsTrends.bind(this));
    v1Router.get('/repositories/:id/quality-trends', this.getQualityTrends.bind(this));

    // Simulation routes
    v1Router.post('/simulation/run', this.runSimulation.bind(this));

    // Graph visualization routes
    v1Router.get('/repositories/:id/dependency-graph', this.getDependencyGraph.bind(this));
    v1Router.get('/repositories/:id/architecture-graph', this.getArchitectureGraph.bind(this));

    this.app.use('/api/v1', v1Router);

    // Root redirect
    this.app.get('/', (req, res) => {
      res.json({
        name: 'AI Software Development Platform API',
        version: '2.0.0',
        documentation: '/api/docs',
        health: '/health'
      });
    });
  }

  /**
   * Setup WebSocket handlers
   */
  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Join repository-specific rooms
      socket.on('join-repository', (repositoryId) => {
        socket.join(`repo-${repositoryId}`);
        console.log(`📡 Client ${socket.id} joined repo-${repositoryId}`);
      });

      // Handle user presence for collaboration
      socket.on('user-presence', (data) => {
        socket.to(`repo-${data.repositoryId}`).emit('user-presence-update', {
          userId: socket.id,
          ...data
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('🚨 API Error:', error);

      const statusCode = error.statusCode || error.status || 500;
      const message = error.message || 'Internal Server Error';

      res.status(statusCode).json({
        error: error.name || 'Error',
        message,
        ...(this.environment === 'development' && { stack: error.stack })
      });
    });
  }

  // ============================================================================
  // ROUTE HANDLERS
  // ============================================================================

  /**
   * Repository endpoints
   */
  async getRepositories(req, res, next) {
    try {
      const repositories = await this.dbManager.getRepositories();
      
      res.json({
        repositories,
        total: repositories.length
      });
    } catch (error) {
      next(error);
    }
  }

  async createRepository(req, res, next) {
    try {
      const { name, url, description, language } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ error: 'Name and URL are required' });
      }
      
      const repository = await this.dbManager.createRepository({
        name,
        url,
        description,
        language
      });
      
      res.status(201).json(repository);
    } catch (error) {
      next(error);
    }
  }

  async getRepository(req, res, next) {
    try {
      const { id } = req.params;
      const repository = await this.dbManager.getRepository(id);
      
      if (!repository) {
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      res.json(repository);
    } catch (error) {
      next(error);
    }
  }

  async analyzeRepository(req, res, next) {
    try {
      const { id } = req.params;
      const { repositoryPath, options } = req.body;
      
      if (!repositoryPath) {
        return res.status(400).json({ error: 'Repository path is required' });
      }
      
      // Mock analysis for now
      res.json({
        message: 'Analysis started',
        repository_id: id,
        status: 'analyzing'
      });
      
    } catch (error) {
      next(error);
    }
  }

  async getRepositoryHealthScore(req, res, next) {
    try {
      const { id } = req.params;
      const healthScore = await this.dbManager.getRepositoryHealthScore(id);
      
      res.json(healthScore);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Graph endpoints (for frontend integration)
   */
  async getGraphSeeds(req, res, next) {
    try {
      const { mode = 'architecture', limit = 200, repositoryId } = req.query;
      
      // Mock data for now - replace with real implementation
      const mockGraphData = {
        nodes: [
          {
            id: 'service:user-api',
            name: 'User API',
            type: 'service',
            layer: 'backend',
            security: [],
            performance: [],
            quality: [],
            ownership: {
              team: 'Platform Team',
              owner: 'John Doe',
              contact: 'john.doe@company.com'
            },
            coverage: 0.75,
            metadata: {
              lastUpdated: new Date().toISOString(),
              codeLines: 1250,
              dependencies: ['auth-service', 'users-db']
            }
          }
        ],
        edges: [
          {
            id: 'edge-001',
            source: 'service:user-api',
            target: 'database:users',
            kind: 'depends_on',
            label: 'queries',
            weight: 0.8
          }
        ],
        metadata: {
          totalNodes: 1,
          totalEdges: 1,
          timestamp: new Date().toISOString(),
          repositoryId: repositoryId || 'default',
          mode
        }
      };
      
      res.json(mockGraphData);
    } catch (error) {
      next(error);
    }
  }

  async getNodeDetails(req, res, next) {
    try {
      const { nodeId } = req.params;
      
      // Mock detailed node data
      const nodeDetails = {
        id: nodeId,
        name: nodeId.split(':')[1] || nodeId,
        type: nodeId.split(':')[0] || 'unknown',
        layer: 'backend',
        security: [
          {
            id: 'sec-001',
            severity: 'HIGH',
            type: 'SQL_INJECTION',
            description: 'Potential SQL injection vulnerability',
            file: 'user.controller.ts',
            line: 42
          }
        ],
        performance: [
          {
            name: 'Response Time',
            value: 250,
            unit: 'ms',
            threshold: 200,
            status: 'warning'
          }
        ],
        quality: [
          {
            name: 'Code Coverage',
            value: 75,
            maxValue: 100,
            threshold: 80,
            status: 'warning'
          }
        ],
        ownership: {
          team: 'Platform Team',
          owner: 'John Doe',
          contact: 'john.doe@company.com'
        },
        coverage: 0.75,
        metadata: {
          lastUpdated: new Date().toISOString(),
          codeLines: 1250
        }
      };
      
      res.json(nodeDetails);
    } catch (error) {
      next(error);
    }
  }

  async searchGraph(req, res, next) {
    try {
      const { q: query, types, layers, limit = 20 } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // Mock search results
      const results = [
        {
          id: 'service:user-api',
          name: 'User API',
          type: 'service',
          layer: 'backend',
          score: 0.95,
          matchedFields: ['name'],
          snippet: 'User API service for authentication and profile management'
        }
      ];
      
      res.json({
        query,
        results,
        metadata: {
          totalResults: results.length,
          executionTime: 25
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getNodeNeighborhood(req, res, next) {
    try {
      const { nodeId } = req.params;
      const { depth = 1, limit = 50 } = req.query;
      
      // Mock neighborhood data
      const neighborhoodData = {
        centerNode: nodeId,
        nodes: [
          {
            id: 'database:users',
            name: 'Users Database',
            type: 'database',
            layer: 'infra'
          }
        ],
        edges: [
          {
            id: 'edge-neighbor-001',
            source: nodeId,
            target: 'database:users',
            kind: 'depends_on',
            label: 'queries'
          }
        ],
        metadata: {
          depth: parseInt(depth),
          totalNewNodes: 1,
          totalNewEdges: 1
        }
      };
      
      res.json(neighborhoodData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Simulation endpoint
   */
  async runSimulation(req, res, next) {
    try {
      const scenario = req.body;
      
      // Mock simulation result
      const simulationResult = {
        simulationId: `sim_${Date.now()}`,
        scenarioId: scenario.scenarioId,
        type: scenario.type || 'architectural',
        predictions: {
          immediate: {
            performanceChange: -0.05,
            resourceUsage: 1.1,
            stability: 0.95
          },
          shortTerm: {
            maintainabilityImprovement: 0.15,
            developmentVelocity: 1.2,
            bugReduction: 0.1
          },
          longTerm: {
            scalabilityGain: 0.3,
            technicalDebtReduction: 0.25,
            teamProductivity: 1.15
          }
        },
        confidenceScores: {
          overall: 0.75,
          factors: {
            dataQuality: 0.8,
            modelAccuracy: 0.75,
            historicalRelevance: 0.7
          }
        },
        recommendations: [
          {
            type: 'implementation',
            priority: 'high',
            content: 'Implement changes gradually with monitoring',
            reasoning: 'Reduces risk and allows for adjustment'
          }
        ],
        metadata: {
          modelVersion: '1.0',
          executionTime: 245,
          assumptions: ['Historical patterns will continue']
        },
        timestamp: new Date().toISOString()
      };
      
      res.json(simulationResult);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search endpoints
   */
  async searchCode(req, res, next) {
    try {
      const { q: query, type = 'all', limit = 50 } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // Mock search results
      const results = [];
      
      res.json({
        query,
        type,
        results,
        total: results.length
      });
      
    } catch (error) {
      next(error);
    }
  }

  async searchFunctions(req, res, next) {
    try {
      const { q: query, limit = 50 } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // Mock search results
      const results = [];
      
      res.json({
        query,
        functions: results,
        total: results.length
      });
      
    } catch (error) {
      next(error);
    }
  }

  async searchFiles(req, res, next) {
    try {
      const { q: query, limit = 50 } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // Mock search results
      const results = [];
      
      res.json({
        query,
        files: results,
        total: results.length
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * AI and insights endpoints
   */
  async getAIInsights(req, res, next) {
    try {
      const { id } = req.params;
      const { type, limit = 20 } = req.query;
      
      const insights = await this.dbManager.getAIInsights(id, type);
      
      res.json({
        repository_id: id,
        ai_insights: insights.slice(0, limit),
        total: insights.length
      });
      
    } catch (error) {
      next(error);
    }
  }

  async generateAIInsights(req, res, next) {
    try {
      const { id } = req.params;
      const { type, content, confidence = 1.0 } = req.body;
      
      if (!type || !content) {
        return res.status(400).json({ error: 'Type and content are required' });
      }
      
      const insight = await this.dbManager.createAIInsight(id, type, content, confidence);
      
      res.status(201).json(insight);
      
    } catch (error) {
      next(error);
    }
  }

  async getRecommendations(req, res, next) {
    try {
      const { id } = req.params;
      
      // Mock recommendations
      const recommendations = [];
      
      res.json({
        repository_id: id,
        recommendations,
        total: recommendations.length
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Analytics and metrics endpoints
   */
  async getAnalyticsOverview(req, res, next) {
    try {
      // Mock metrics
      const metrics = {};
      
      res.json({
        overview: metrics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      next(error);
    }
  }

  async getAnalyticsTrends(req, res, next) {
    try {
      const { timeframe = '30d' } = req.query;
      
      // Mock trends
      const trends = { security: [], performance: [], timeframe };
      
      res.json(trends);
      
    } catch (error) {
      next(error);
    }
  }

  async getQualityTrends(req, res, next) {
    try {
      const { id } = req.params;
      const { timeframe = '30d' } = req.query;
      
      // Mock trends
      const trends = {};
      
      res.json({
        repository_id: id,
        quality_trends: trends
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Graph and visualization endpoints
   */
  async getDependencyGraph(req, res, next) {
    try {
      const { id } = req.params;
      const { maxDepth = 3, nodeTypes } = req.query;
      
      // Mock graph
      const graph = { nodes: [], edges: [] };
      
      res.json({
        repository_id: id,
        dependency_graph: graph
      });
      
    } catch (error) {
      next(error);
    }
  }

  async getArchitectureGraph(req, res, next) {
    try {
      const { id } = req.params;
      
      // Mock architecture graph
      const graph = { nodes: [], edges: [], repository: null };
      
      res.json({
        repository_id: id,
        architecture_graph: graph
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Saved Views endpoints
   */
  async getSavedViews(req, res, next) {
    try {
      const { repositoryId, userId } = req.query;
      
      // Mock saved views
      const savedViews = [
        {
          id: 'view-001',
          name: 'Architecture Overview',
          description: 'High-level system architecture',
          repositoryId: repositoryId || 'default',
          userId: userId || 'user1',
          viewData: {
            center: { x: 0, y: 0 },
            zoom: 1,
            filters: {},
            selectedNodes: [],
            layout: 'force'
          },
          isPublic: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      res.json({
        savedViews,
        total: savedViews.length
      });
      
    } catch (error) {
      next(error);
    }
  }

  async createSavedView(req, res, next) {
    try {
      const { name, description, repositoryId, viewData, isPublic = false } = req.body;
      
      if (!name || !repositoryId || !viewData) {
        return res.status(400).json({ 
          error: 'Name, repositoryId, and viewData are required' 
        });
      }
      
      const savedView = {
        id: `view-${Date.now()}`,
        name,
        description,
        repositoryId,
        userId: 'user1', // Mock user
        viewData,
        isPublic,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.status(201).json(savedView);
      
    } catch (error) {
      next(error);
    }
  }

  async getSavedView(req, res, next) {
    try {
      const { id } = req.params;
      
      // Mock saved view
      const savedView = {
        id,
        name: 'Architecture Overview',
        description: 'High-level system architecture',
        repositoryId: 'default',
        userId: 'user1',
        viewData: {
          center: { x: 0, y: 0 },
          zoom: 1,
          filters: {},
          selectedNodes: [],
          layout: 'force'
        },
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.json(savedView);
      
    } catch (error) {
      next(error);
    }
  }

  async updateSavedView(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Mock update
      const updatedView = {
        id,
        name: 'Updated View',
        description: 'Updated description',
        repositoryId: 'default',
        userId: 'user1',
        viewData: updates.viewData || {},
        isPublic: updates.isPublic || false,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates
      };
      
      res.json(updatedView);
      
    } catch (error) {
      next(error);
    }
  }

  async deleteSavedView(req, res, next) {
    try {
      const { id } = req.params;
      
      res.status(204).send();
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Start the API server
   */
  async start() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      this.server.listen(this.port, this.host, () => {
        console.log(`🚀 API Gateway running on http://${this.host}:${this.port}`);
        console.log(`📚 API Documentation: http://${this.host}:${this.port}/api/docs`);
        console.log(`❤️  Health Check: http://${this.host}:${this.port}/health`);
      });
      
      // Graceful shutdown handling
      process.on('SIGINT', this.shutdown.bind(this));
      process.on('SIGTERM', this.shutdown.bind(this));
      
    } catch (error) {
      console.error('❌ Failed to start API Gateway:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('\n🛑 Shutting down API Gateway...');
    
    try {
      // Close WebSocket connections
      this.io.close();
      
      // Close HTTP server
      this.server.close(() => {
        console.log('✅ HTTP server closed');
      });
      
      // Cleanup services
      if (this.codeIntelligence) {
        await this.codeIntelligence.cleanup();
      }
      
      // Disconnect from database
      if (this.dbManager) {
        await this.dbManager.disconnect();
      }
      
      console.log('✅ API Gateway shutdown complete');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Broadcast message to repository-specific room
   */
  broadcastToRepository(repositoryId, event, data) {
    this.io.to(`repo-${repositoryId}`).emit(event, data);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

module.exports = { APIGateway };

// If this file is run directly, start the server
if (require.main === module) {
  const apiGateway = new APIGateway();
  apiGateway.start().catch(error => {
    console.error('❌ Failed to start API Gateway:', error);
    process.exit(1);
  });
}
