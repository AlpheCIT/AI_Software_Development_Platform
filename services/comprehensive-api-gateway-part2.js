        type: 'semantic-match',
        collection,
        score: Math.random(),
        properties: {
          query,
          semanticSimilarity: Math.random(),
          embedding: Array(10).fill(0).map(() => Math.random()),
          context: `Semantic match for "${query}" in ${collection}`
        }
      });
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  async start(port = 3001) {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log('🚀 Comprehensive API Gateway Started');
        console.log(`📡 Server running on http://localhost:${port}`);
        console.log(`🔌 WebSocket server ready for real-time updates`);
        console.log(`📊 Database collections: ${this.collectionsStatus.size}`);
        console.log('');
        console.log('🎯 Available API Endpoints:');
        console.log('   Repository Ingestion:');
        console.log('     POST /api/v1/ingestion/repository/progressive');
        console.log('     GET  /api/v1/ingestion/jobs');
        console.log('     GET  /api/v1/ingestion/jobs/:jobId');
        console.log('');
        console.log('   Collections:');
        console.log('     GET  /api/v1/collections/status');
        console.log('     GET  /api/v1/collections/:name');
        console.log('');
        console.log('   MCP Proxy:');
        console.log('     GET  /api/v1/mcp/browse-collections');
        console.log('     GET  /api/v1/mcp/browse-collection/:name');
        console.log('     POST /api/v1/mcp/execute-aql');
        console.log('     GET  /api/v1/mcp/analytics');
        console.log('');
        console.log('   Graph:');
        console.log('     GET  /api/v1/graph/seeds');
        console.log('     GET  /api/v1/graph/node/:nodeId');
        console.log('     GET  /api/v1/graph/node/:nodeId/expand');
        console.log('     GET  /api/v1/graph/search');
        console.log('');
        console.log('   Analytics:');
        console.log('     GET  /api/v1/analytics/overview');
        console.log('');
        console.log('   Search:');
        console.log('     GET  /api/v1/search/semantic');
        console.log('');
        console.log('   Saved Views:');
        console.log('     GET  /api/v1/views');
        console.log('     POST /api/v1/views');
        console.log('');
        console.log('✅ Ready for frontend integration and investor demos!');
        console.log('🎬 Frontend should connect to: http://localhost:5173');
        
        resolve(this.server);
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('🛑 Comprehensive API Gateway stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = { ComprehensiveAPIGateway };

// Start the server if run directly
if (require.main === module) {
  const gateway = new ComprehensiveAPIGateway();
  
  gateway.start().catch(error => {
    console.error('❌ Failed to start Comprehensive API Gateway:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Comprehensive API Gateway...');
    await gateway.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Comprehensive API Gateway...');
    await gateway.stop();
    process.exit(0);
  });
}