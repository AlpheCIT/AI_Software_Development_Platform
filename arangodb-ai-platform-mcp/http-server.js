import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Database } from 'arangojs';

const app = express();
const PORT = 3002;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize ArangoDB connection
const db = new Database({
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DB || 'ARANGO_AISDP_DB',
  auth: {
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || ''
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.version();
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Browse collections endpoint
app.get('/browse-collections', async (req, res) => {
  try {
    const collections = await db.listCollections();
    const result = collections.map(col => ({
      name: col.name,
      type: col.type === 2 ? 'document' : col.type === 3 ? 'edge' : 'unknown',
      status: col.status === 3 ? 'loaded' : 'unloaded'
    }));
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error browsing collections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to browse collections',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get analytics endpoint
app.get('/analytics', async (req, res) => {
  try {
    const collections = await db.listCollections();
    const collectionStats = [];
    
    for (const col of collections) {
      try {
        const collection = db.collection(col.name);
        const count = await collection.count();
        collectionStats.push({
          name: col.name,
          type: col.type === 2 ? 'document' : 'edge',
          count: count.count,
          status: col.status === 3 ? 'loaded' : 'unloaded'
        });
      } catch (err) {
        console.warn(`Could not get stats for collection ${col.name}:`, err.message);
      }
    }

    res.json({
      success: true,
      data: {
        collections: collectionStats,
        totalCollections: collections.length,
        totalDocuments: collectionStats.reduce((sum, col) => sum + col.count, 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load analytics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Graph seeds endpoint
app.get('/graph/seeds', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // Try to get some sample documents from available collections
    const collections = await db.listCollections();
    const documentCollections = collections.filter(col => col.type === 2); // Document collections only
    
    if (documentCollections.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No document collections found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get sample documents from the first available collection
    const firstCollection = documentCollections[0];
    const collection = db.collection(firstCollection.name);
    const cursor = await db.query(`
      FOR doc IN ${firstCollection.name}
      LIMIT ${limit}
      RETURN doc
    `);
    
    const documents = await cursor.all();
    
    res.json({
      success: true,
      data: documents.map(doc => ({
        _key: doc._key,
        _id: doc._id,
        collection: firstCollection.name,
        data: doc
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting graph seeds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load graph data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


// Start the HTTP server
app.listen(PORT, () => {
  console.log(`🚀 MCP HTTP Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Database: ${process.env.ARANGO_DB || 'ARANGO_AISDP_DB'} on ${process.env.ARANGO_URL || 'http://localhost:8529'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down MCP HTTP server gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down MCP HTTP server gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions to prevent shutdown
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
});
