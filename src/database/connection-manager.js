/**
 * ArangoDB Connection Manager for AI Software Development Platform
 * 
 * Provides a robust, production-ready database connection layer with:
 * - Connection pooling
 * - Health monitoring
 * - Automatic reconnection
 * - Query optimization
 * - Transaction support
 */

const { Database } = require('arangojs');
const { EventEmitter } = require('events');

class ArangoDBManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Determine environment and set appropriate defaults
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV;
    const defaultPort = process.env.ARANGO_PORT || (isDev ? '8529' : '8529');
    const defaultPassword = process.env.ARANGO_PASSWORD || '';
    
    this.config = {
      url: config.url || process.env.ARANGO_URL || `http://${process.env.ARANGO_HOST || 'localhost'}:${defaultPort}`,
      databaseName: config.databaseName || process.env.ARANGO_DATABASE,
      username: config.username || process.env.ARANGO_USERNAME || 'root',
      password: config.password || defaultPassword,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      poolSize: config.poolSize || 10,
      timeout: config.timeout || 30000,
      isDev: isDev
    };
    
    this.db = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.healthCheckInterval = null;
    
    this.collections = {};
    this.edgeCollections = {};
    this.graphs = {};
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      console.log('🔌 Connecting to ArangoDB...');
      console.log(`🌍 Environment: ${this.config.isDev ? 'Development' : 'Production'}`);
      console.log(`🔗 URL: ${this.config.url}`);
      console.log(`🗄️  Database: ${this.config.databaseName}`);
      console.log(`👤 Username: ${this.config.username}`);
      
      this.db = new Database({
        url: this.config.url,
        databaseName: this.config.databaseName,
        auth: {
          username: this.config.username,
          password: this.config.password
        },
        agentOptions: {
          maxSockets: this.config.poolSize,
          keepAlive: true,
          keepAliveMsecs: 1000
        }
      });

      // Test connection
      await this.db.version();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Initialize collections
      await this.initializeCollections();
      
      // Start health monitoring
      this.startHealthCheck();
      
      console.log('✅ Connected to ArangoDB successfully');
      this.emit('connected');
      
      return this.db;
      
    } catch (error) {
      console.error('❌ Failed to connect to ArangoDB:', error.message);
      this.isConnected = false;
      this.emit('error', error);
      
      if (this.reconnectAttempts < this.config.maxRetries) {
        this.reconnectAttempts++;
        console.log(`🔄 Retrying connection (${this.reconnectAttempts}/${this.config.maxRetries})...`);
        
        setTimeout(() => this.connect(), this.config.retryDelay);
      } else {
        console.error('💥 Max reconnection attempts reached');
        throw error;
      }
    }
  }

  /**
   * Initialize collection references for easy access
   */
  async initializeCollections() {
    try {
      // Document collections
      const documentCollections = [
        'repositories', 'files', 'functions', 'classes', 'modules', 'packages',
        'security_findings', 'performance_profiles', 'ai_insights',
        'business_processes', 'code_entities', 'embeddings'
      ];
      
      for (const name of documentCollections) {
        this.collections[name] = this.db.collection(name);
      }
      
      // Edge collections
      const edgeCollections = [
        'depends_on', 'imports', 'doc_dependencies', 'function_definitions',
        'doc_security_findings', 'doc_ai_insights', 'doc_performance_profiles'
      ];
      
      for (const name of edgeCollections) {
        this.edgeCollections[name] = this.db.collection(name);
      }
      
      // Named graphs
      this.graphs = {
        codeDependency: this.db.graph('code_dependency_graph'),
        security: this.db.graph('security_graph'),
        aiAnalysis: this.db.graph('ai_analysis_graph')
      };
      
    } catch (error) {
      console.error('❌ Failed to initialize collections:', error);
      throw error;
    }
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.db.version();
        if (!this.isConnected) {
          this.isConnected = true;
          console.log('✅ Database connection restored');
          this.emit('reconnected');
        }
      } catch (error) {
        if (this.isConnected) {
          this.isConnected = false;
          console.error('⚠️  Database connection lost:', error.message);
          this.emit('disconnected', error);
          
          // Attempt to reconnect
          this.connect().catch(err => {
            console.error('Failed to auto-reconnect:', err.message);
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Execute AQL query with error handling and retry logic
   */
  async query(aql, bindVars = {}, options = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    const maxRetries = options.maxRetries || 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const cursor = await this.db.query(aql, bindVars, {
          timeout: this.config.timeout,
          ...options
        });
        
        return await cursor.all();
        
      } catch (error) {
        attempt++;
        
        if (attempt >= maxRetries) {
          console.error(`❌ Query failed after ${maxRetries} attempts:`, error.message);
          throw error;
        }
        
        console.warn(`⚠️  Query attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Execute transaction
   */
  async transaction(collections, action, options = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    try {
      return await this.db.executeTransaction(collections, action, options);
    } catch (error) {
      console.error('❌ Transaction failed:', error.message);
      throw error;
    }
  }

  /**
   * Repository operations
   */
  async createRepository(repoData) {
    try {
      const result = await this.collections.repositories.save({
        ...repoData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      console.log(`✅ Created repository: ${repoData.name}`);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to create repository:', error.message);
      throw error;
    }
  }

  /**
   * Get repository by ID or name
   */
  async getRepository(identifier) {
    try {
      let aql, bindVars;
      
      if (identifier.startsWith('repositories/')) {
        aql = 'FOR repo IN repositories FILTER repo._id == @id RETURN repo';
        bindVars = { id: identifier };
      } else {
        aql = 'FOR repo IN repositories FILTER repo.name == @name RETURN repo';
        bindVars = { name: identifier };
      }
      
      const results = await this.query(aql, bindVars);
      return results[0] || null;
      
    } catch (error) {
      console.error('❌ Failed to get repository:', error.message);
      throw error;
    }
  }

  /**
   * Get all repositories
   */
  async getRepositories(limit = 100, offset = 0) {
    try {
      const aql = `
        FOR repo IN repositories 
        LIMIT @offset, @limit 
        RETURN repo
      `;
      
      const results = await this.query(aql, { limit, offset });
      return results || [];
      
    } catch (error) {
      console.error('❌ Failed to get repositories:', error.message);
      throw error;
    }
  }

  /**
   * Create dependency relationship
   */
  async createDependency(fromId, toId, dependencyType = 'default', metadata = {}) {
    try {
      const result = await this.edgeCollections.depends_on.save({
        _from: fromId,
        _to: toId,
        dependency_type: dependencyType,
        strength: metadata.strength || 1.0,
        created_at: new Date().toISOString(),
        ...metadata
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to create dependency:', error.message);
      throw error;
    }
  }

  /**
   * Get dependencies for a node
   */
  async getDependencies(nodeId, direction = 'outbound', depth = 1) {
    try {
      const aql = `
        FOR vertex, edge IN 1..@depth @direction @nodeId depends_on
        RETURN {
          vertex: vertex,
          edge: edge,
          path: {
            vertices: [vertex],
            edges: [edge]
          }
        }
      `;
      
      const results = await this.query(aql, {
        nodeId,
        depth,
        direction: direction.toUpperCase()
      });
      
      return results;
      
    } catch (error) {
      console.error('❌ Failed to get dependencies:', error.message);
      throw error;
    }
  }

  /**
   * Analyze dependency cycles
   */
  async findDependencyCycles(maxDepth = 10) {
    try {
      const aql = `
        FOR start IN repositories
        FOR vertex, edge, path IN 1..@maxDepth OUTBOUND start depends_on
        FILTER start._id == vertex._id AND LENGTH(path.vertices) > 2
        RETURN {
          cycle: path.vertices,
          edges: path.edges,
          length: LENGTH(path.vertices)
        }
      `;
      
      const results = await this.query(aql, { maxDepth });
      return results;
      
    } catch (error) {
      console.error('❌ Failed to find dependency cycles:', error.message);
      throw error;
    }
  }

  /**
   * Get security findings for a repository
   */
  async getSecurityFindings(repositoryId, severity = null) {
    try {
      let aql = `
        FOR finding IN security_findings
        FILTER finding.repository_id == @repositoryId
      `;
      
      const bindVars = { repositoryId };
      
      if (severity) {
        aql += ' AND finding.severity == @severity';
        bindVars.severity = severity;
      }
      
      aql += ' SORT finding.discovered_at DESC RETURN finding';
      
      const results = await this.query(aql, bindVars);
      return results;
      
    } catch (error) {
      console.error('❌ Failed to get security findings:', error.message);
      throw error;
    }
  }

  /**
   * Create AI insight
   */
  async createAIInsight(entityId, insightType, content, confidence = 1.0) {
    try {
      const insight = await this.collections.ai_insights.save({
        entity_id: entityId,
        insight_type: insightType,
        content: content,
        confidence: confidence,
        generated_at: new Date().toISOString(),
        version: '1.0'
      });
      
      // Create relationship to the analyzed entity
      await this.edgeCollections.doc_ai_insights.save({
        _from: insight._id,
        _to: entityId,
        relationship_type: 'analyzes',
        created_at: new Date().toISOString()
      });
      
      return insight;
      
    } catch (error) {
      console.error('❌ Failed to create AI insight:', error.message);
      throw error;
    }
  }

  /**
   * Get AI insights for an entity
   */
  async getAIInsights(entityId, insightType = null) {
    try {
      let aql = `
        FOR insight IN ai_insights
        FILTER insight.entity_id == @entityId
      `;
      
      const bindVars = { entityId };
      
      if (insightType) {
        aql += ' AND insight.insight_type == @insightType';
        bindVars.insightType = insightType;
      }
      
      aql += ' SORT insight.generated_at DESC RETURN insight';
      
      const results = await this.query(aql, bindVars);
      return results;
      
    } catch (error) {
      console.error('❌ Failed to get AI insights:', error.message);
      throw error;
    }
  }

  /**
   * Complex analysis: Get repository health score
   */
  async getRepositoryHealthScore(repositoryId) {
    try {
      const aql = `
        LET repo = DOCUMENT(@repositoryId)
        LET securityFindings = (
          FOR finding IN security_findings
          FILTER finding.repository_id == @repositoryId
          COLLECT severity = finding.severity WITH COUNT INTO count
          RETURN { severity, count }
        )
        LET performanceMetrics = (
          FOR metric IN performance_profiles
          FILTER metric.repository_id == @repositoryId
          RETURN metric.performance_score
        )
        LET aiInsights = (
          FOR insight IN ai_insights
          FILTER insight.entity_id == @repositoryId
          RETURN insight.confidence
        )
        
        RETURN {
          repository: repo,
          health_score: {
            security: (
              100 - (
                (securityFindings[* FILTER CURRENT.severity == 'critical'][0].count || 0) * 20 +
                (securityFindings[* FILTER CURRENT.severity == 'high'][0].count || 0) * 10 +
                (securityFindings[* FILTER CURRENT.severity == 'medium'][0].count || 0) * 5 +
                (securityFindings[* FILTER CURRENT.severity == 'low'][0].count || 0) * 1
              )
            ),
            performance: AVERAGE(performanceMetrics[*]) || 0,
            ai_confidence: AVERAGE(aiInsights[*]) || 0,
            overall: null
          },
          metrics: {
            security_findings: securityFindings,
            performance_scores: performanceMetrics,
            ai_insights_count: LENGTH(aiInsights)
          }
        }
      `;
      
      const results = await this.query(aql, { repositoryId });
      
      if (results.length > 0) {
        const result = results[0];
        // Calculate overall score
        const weights = { security: 0.4, performance: 0.3, ai_confidence: 0.3 };
        result.health_score.overall = 
          (result.health_score.security * weights.security) +
          (result.health_score.performance * weights.performance) +
          (result.health_score.ai_confidence * weights.ai_confidence);
      }
      
      return results[0] || null;
      
    } catch (error) {
      console.error('❌ Failed to get repository health score:', error.message);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const stats = {
        collections: {},
        edges: {},
        total_documents: 0,
        total_edges: 0
      };
      
      // Document collection stats
      for (const [name, collection] of Object.entries(this.collections)) {
        const count = await collection.count();
        stats.collections[name] = count.count;
        stats.total_documents += count.count;
      }
      
      // Edge collection stats
      for (const [name, collection] of Object.entries(this.edgeCollections)) {
        const count = await collection.count();
        stats.edges[name] = count.count;
        stats.total_edges += count.count;
      }
      
      return stats;
      
    } catch (error) {
      console.error('❌ Failed to get database stats:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect() {
    try {
      this.stopHealthCheck();
      this.isConnected = false;
      
      if (this.db) {
        // ArangoDB driver doesn't have explicit disconnect
        this.db = null;
      }
      
      console.log('✅ Disconnected from ArangoDB');
      this.emit('disconnected');
      
    } catch (error) {
      console.error('❌ Error during disconnect:', error.message);
      throw error;
    }
  }
}

// Singleton instance
let dbManager = null;

/**
 * Get singleton database manager instance
 */
function getDBManager(config = {}) {
  if (!dbManager) {
    dbManager = new ArangoDBManager(config);
  }
  return dbManager;
}

/**
 * Initialize database connection (convenience function)
 */
async function initializeDB(config = {}) {
  const manager = getDBManager(config);
  await manager.connect();
  return manager;
}

module.exports = {
  ArangoDBManager,
  getDBManager,
  initializeDB
};
