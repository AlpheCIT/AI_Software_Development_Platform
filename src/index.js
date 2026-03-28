#!/usr/bin/env node

/**
 * AI Cod      // Set environment variables from options
      if (options.dbHost && options.dbPort) process.env.ARANGO_URL = `http://${options.dbHost}:${options.dbPort}`;
      if (options.dbUser) process.env.ARANGODB_USE  .option('-  .option('--db-host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--  .option('--host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--username <username>', 'Database username', process.env.ARANGO_USERNAME || 'root')
  .option('--password <password>', 'Database password', process.env.ARANGO_PASSWORD || '')
  .option('--database <database>', 'Database name', process.env.ARANGO_DATABASE)rt <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--db-user <username>', 'Database username', process.env.ARANGO_USERNAME || 'root')
  .option('--db-password <password>', 'Database password', process.env.ARANGO_PASSWORD || '')
  .option('--db-name <database>', 'Database name', process.env.ARANGO_DATABASE)ost   .option('--db-host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--db-port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--db-user <username>', 'Database username', process.env.ARANGO_USERNAME || 'root')
  .option('--db-password <password>', 'Database password', process.env.ARANGO_PASSWORD || '')
  .option('--db-name <database>', 'Database name', process.env.ARANGO_DATABASE)
  .option('--batch-size <size>', 'File processing batch size', '10')
  .option('--file-patterns <patterns>', 'File patterns to analyze (comma-separated)'), 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--db-port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--db-user <username>', 'Database username', process.env.ARANGO_USERNAME || 'root')
  .option('--db-password <password>', 'Database password', process.env.ARANGO_PASSWORD || '')
  .option('--db-name <database>', 'Database name', process.env.ARANGO_DATABASE)
  .option('--api-host <host>', 'API Gateway host', '0.0.0.0')
  .option('--api-port <port>', 'API Gateway port', '3001') options.dbUser;
      if (options.dbPassword) process.env.ARANGODB_PASSWORD = options.dbPas            // Set environment variables
      if (options.host && options.port) process.env.ARANGO_URL = `http://${options.host}:${options.port}`;
      if (options.username) process.env.ARANGO_USERNAME = options.username;
      if (options.password) process.env.ARANGO_PASSWORD = options.password;
      if (options.database) process.env.ARANGO_DATABASE = options.database;;
      if (options.dbName) process.env.ARANGO_DATABASE = options.dbName;
      if (options.apiPort) process.env.PORT = options.apiPort;gement System v2 - Main Entry Point
 * 
 * Orchestrates the complete system startup:
 * - Database connection and initialization
 * - Service initialization and coordination
 * - API Gateway startup
 * - Health monitoring
 * - Graceful shutdown handling
 */

const { Command } = require('commander');
const path = require('path');
const { initializeDatabase } = require('./database/arangodb-schema');
const { initializeDB } = require('./database/connection-manager');
const { CodeIntelligenceService } = require('./services/code-intelligence');
const { APIGateway } = require('./api/gateway');

const program = new Command();

class AICodeManagementSystem {
  constructor() {
    this.dbManager = null;
    this.codeIntelligence = null;
    this.apiGateway = null;
    this.isRunning = false;
  }

  async initialize(options = {}) {
    try {
      console.log('🚀 Initializing AI Software Development Platform...\n');

      // Set environment variables from options
      if (options.dbHost) process.env.ARANGO_URL = `http://${options.dbHost}:${options.dbPort || 8529}`;
      if (options.dbUser) process.env.ARANGO_USERNAME = options.dbUser;
      if (options.dbPassword) process.env.ARANGO_PASSWORD = options.dbPassword;
      if (options.dbName) process.env.ARANGO_DATABASE = options.dbName;
      if (options.apiPort) process.env.PORT = options.apiPort;

      // Initialize database connection
      console.log('📊 Connecting to ArangoDB...');
      this.dbManager = await initializeDB();
      console.log('✅ Database connected');

      // Initialize Code Intelligence Service
      console.log('🧠 Initializing Code Intelligence Service...');
      this.codeIntelligence = new CodeIntelligenceService();
      await this.codeIntelligence.initialize();
      console.log('✅ Code Intelligence Service ready');

      // Initialize API Gateway
      console.log('🌐 Initializing API Gateway...');
      this.apiGateway = new APIGateway({
        port: options.apiPort || 3001,
        host: options.apiHost || '0.0.0.0'
      });
      await this.apiGateway.initialize();
      console.log('✅ API Gateway ready');

      this.isRunning = true;
      console.log('\n🎉 AI Software Development Platform is ready!\n');

      this.printSystemInfo(options);

    } catch (error) {
      console.error('❌ System initialization failed:', error.message);
      throw error;
    }
  }

  async start(options = {}) {
    try {
      if (!this.isRunning) {
        await this.initialize(options);
      }

      // Start API Gateway
      console.log('🚀 Starting API Gateway...');
      await this.apiGateway.start();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ System startup failed:', error.message);
      process.exit(1);
    }
  }

  async shutdown() {
    try {
      console.log('\n🛑 Shutting down AI Software Development Platform...');

      if (this.apiGateway) {
        await this.apiGateway.shutdown();
        console.log('✅ API Gateway stopped');
      }

      if (this.codeIntelligence) {
        await this.codeIntelligence.cleanup();
        console.log('✅ Code Intelligence Service stopped');
      }

      if (this.dbManager) {
        await this.dbManager.disconnect();
        console.log('✅ Database disconnected');
      }

      this.isRunning = false;
      console.log('✅ System shutdown complete');

    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
    }
  }

  setupGracefulShutdown() {
    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Received SIGINT signal...');
      await this.shutdown();
      process.exit(0);
    });

    // Graceful shutdown on SIGTERM
    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Received SIGTERM signal...');
      await this.shutdown();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('❌ Uncaught Exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  printSystemInfo(options) {
    const config = {
      database: {
        host: options.dbHost || process.env.ARANGO_HOST || 'localhost',
        port: options.dbPort || process.env.ARANGO_PORT || 8529,
        name: options.dbName || process.env.ARANGO_DATABASE
      },
      api: {
        host: options.apiHost || '0.0.0.0',
        port: options.apiPort || 3001
      },
      frontend: {
        url: process.env.FRONTEND_URL || 'http://localhost:3000'
      }
    };

    console.log('📋 System Configuration:');
    console.log('─'.repeat(50));
    console.log(`🗄️  Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
    console.log(`🌐 API Gateway: http://${config.api.host}:${config.api.port}`);
    console.log(`📚 API Docs: http://${config.api.host}:${config.api.port}/api/docs`);
    console.log(`❤️  Health Check: http://${config.api.host}:${config.api.port}/health`);
    console.log(`🎨 Frontend: ${config.frontend.url}`);
    console.log('');
    console.log('🔗 Available Endpoints:');
    console.log('   • POST /api/v1/repositories - Create repository');
    console.log('   • GET  /api/v1/repositories - List repositories');
    console.log('   • POST /api/v1/repositories/:id/analyze - Analyze repository');
    console.log('   • GET  /api/v1/search/code - Search code');
    console.log('   • GET  /api/v1/analytics/overview - System metrics');
    console.log('');
  }

  async analyzeRepository(repositoryPath, options = {}) {
    if (!this.codeIntelligence) {
      throw new Error('Code Intelligence Service not initialized');
    }

    console.log(`🔍 Starting analysis of repository: ${repositoryPath}`);
    
    const analysis = await this.codeIntelligence.analyzeRepository(repositoryPath, options);
    
    console.log('\n📊 Analysis Results:');
    console.log(`   Files analyzed: ${analysis.progress.files_scanned}`);
    console.log(`   Dependencies found: ${analysis.progress.dependencies_found}`);
    console.log(`   Security issues: ${analysis.progress.security_issues}`);
    console.log(`   Performance insights: ${analysis.progress.performance_insights}`);
    
    return analysis;
  }

  async getSystemStatus() {
    if (!this.dbManager) {
      throw new Error('System not initialized');
    }

    const stats = await this.dbManager.getDatabaseStats();
    const metrics = await this.codeIntelligence.getAnalyticsMetrics();

    return {
      system: {
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.0.0'
      },
      database: {
        connected: this.dbManager.isConnected,
        collections: Object.keys(stats.collections).length,
        total_documents: stats.total_documents,
        total_edges: stats.total_edges
      },
      services: {
        api_gateway: this.apiGateway ? 'running' : 'stopped',
        code_intelligence: this.codeIntelligence ? 'running' : 'stopped'
      },
      metrics: metrics
    };
  }
}

// CLI Commands
program
  .name('ai-code-management')
  .description('AI Software Development Platform')
  .version('2.0.0');

program
  .command('start')
  .description('Start the complete AI Code Management System')
  .option('--db-host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--db-port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--db-user <username>', 'Database username', process.env.ARANGO_USERNAME || process.env.ARANGO_USER || 'root')
  .option('--db-password <password>', 'Database password', process.env.ARANGO_PASSWORD || process.env.ARANGODB_PASSWORD || '')
  .option('--db-name <database>', 'Database name', process.env.ARANGO_DATABASE || process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB')
  .option('--api-host <host>', 'API Gateway host', '0.0.0.0')
  .option('--api-port <port>', 'API Gateway port', '3001')
  .action(async (options) => {
    const system = new AICodeManagementSystem();
    await system.start(options);
  });

program
  .command('analyze <repository-path>')
  .description('Analyze a repository')
  .option('--db-host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--db-port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--db-user <username>', 'Database username', process.env.ARANGO_USERNAME || process.env.ARANGO_USER || 'root')
  .option('--db-password <password>', 'Database password', process.env.ARANGO_PASSWORD || process.env.ARANGODB_PASSWORD || '')
  .option('--db-name <database>', 'Database name', process.env.ARANGO_DATABASE || process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB')
  .option('--batch-size <size>', 'File processing batch size', '10')
  .option('--file-patterns <patterns>', 'File patterns to analyze (comma-separated)')
  .action(async (repositoryPath, options) => {
    try {
      const system = new AICodeManagementSystem();
      await system.initialize(options);

      const analysisOptions = {
        batchSize: parseInt(options.batchSize),
        filePatterns: options.filePatterns ? options.filePatterns.split(',') : undefined
      };

      const analysis = await system.analyzeRepository(repositoryPath, analysisOptions);
      
      console.log('\n✅ Analysis completed successfully!');
      console.log(`📊 Repository ID: ${analysis.repository_id}`);
      
      await system.shutdown();
      
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check system status')
  .option('--db-host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--db-port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--db-user <username>', 'Database username', process.env.ARANGO_USERNAME || process.env.ARANGO_USER || 'root')
  .option('--db-password <password>', 'Database password', process.env.ARANGO_PASSWORD || process.env.ARANGODB_PASSWORD || '')
  .option('--db-name <database>', 'Database name', process.env.ARANGO_DATABASE || process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB')
  .action(async (options) => {
    try {
      const system = new AICodeManagementSystem();
      await system.initialize(options);

      const status = await system.getSystemStatus();
      
      console.log('\n📊 System Status:');
      console.log('─'.repeat(50));
      console.log(`Status: ${status.system.status}`);
      console.log(`Uptime: ${Math.floor(status.system.uptime)}s`);
      console.log(`Memory: ${Math.round(status.system.memory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Version: ${status.system.version}`);
      
      console.log('\n🗄️  Database:');
      console.log(`Connected: ${status.database.connected}`);
      console.log(`Collections: ${status.database.collections}`);
      console.log(`Documents: ${status.database.total_documents.toLocaleString()}`);
      console.log(`Edges: ${status.database.total_edges.toLocaleString()}`);
      
      console.log('\n🔧 Services:');
      console.log(`API Gateway: ${status.services.api_gateway}`);
      console.log(`Code Intelligence: ${status.services.code_intelligence}`);
      
      if (status.metrics) {
        console.log('\n📈 Metrics:');
        console.log(`Repositories: ${status.metrics.repositories || 0}`);
        console.log(`Files: ${status.metrics.files || 0}`);
        console.log(`Functions: ${status.metrics.functions || 0}`);
        console.log(`Security Findings: ${status.metrics.security_findings || 0}`);
      }
      
      await system.shutdown();
      
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('init-db')
  .description('Initialize database (alias for db-init script)')
  .option('--host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--username <username>', 'Database username', process.env.ARANGO_USERNAME || process.env.ARANGO_USER || 'root')
  .option('--password <password>', 'Database password', process.env.ARANGO_PASSWORD || process.env.ARANGODB_PASSWORD || '')
  .option('--database <database>', 'Database name', process.env.ARANGO_DATABASE || process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB')
  .action(async (options) => {
    try {
      // Set environment variables
      if (options.host) process.env.ARANGO_URL = `http://${options.host}:${options.port || 8529}`;
      if (options.username) process.env.ARANGODB_USER = options.username;
      if (options.password) process.env.ARANGO_PASSWORD = options.password;
      if (options.database) process.env.ARANGODB_NAME = options.database;
      
      await initializeDatabase();
      console.log('✅ Database initialization completed!');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      process.exit(1);
    }
  });

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Export for programmatic use
module.exports = { AICodeManagementSystem };

// Parse CLI arguments
if (require.main === module) {
  program.parse();
}
