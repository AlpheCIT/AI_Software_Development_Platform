import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { qaConfig } from './config';
import { DatabaseClient } from '@asdp/database-client';
import { createQARunsRouter } from './routes/qa-runs';
import { createProductIntelligenceRouter } from './routes/product-intelligence';
import { ensureCollections } from './graph/collections';

const app = express();
const httpServer = createServer(app);
const PORT = qaConfig.port;

// Socket.IO for real-time agent events to frontend
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('short'));
app.use(express.json({ limit: '10mb' }));

// Initialize database client
const dbClient = new DatabaseClient({
  url: qaConfig.arango.url,
  database: qaConfig.arango.database,
  username: qaConfig.arango.username,
  password: qaConfig.arango.password,
});

// Event publisher — broadcasts to all connected Socket.IO clients
const eventPublisher = {
  emit: (event: string, data: any) => {
    console.log(`[Event] ${event}:`, JSON.stringify(data).substring(0, 200));
    io.emit(event, data);
  },
};

// QA API Routes
app.use('/qa', createQARunsRouter(dbClient, eventPublisher));
app.use('/qa/product', createProductIntelligenceRouter(dbClient));

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'qa-engine',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    config: {
      anthropicModel: qaConfig.anthropic.model,
      hasApiKey: !!qaConfig.anthropic.apiKey,
      mutationThreshold: qaConfig.qa.mutationScoreThreshold,
      maxTestsPerRun: qaConfig.qa.maxTestsPerRun,
    },
  });
});

// Metrics
app.get('/metrics', async (req, res) => {
  try {
    let totalRuns = 0;
    let avgMutationScore = 0;
    try {
      const stats = await dbClient.query(
        `LET runs = (FOR r IN qa_runs RETURN r)
         RETURN {
           totalRuns: LENGTH(runs),
           avgMutationScore: AVERAGE(runs[* FILTER CURRENT.mutationScore != null].mutationScore)
         }`
      );
      if (stats.length > 0) {
        totalRuns = stats[0].totalRuns;
        avgMutationScore = stats[0].avgMutationScore || 0;
      }
    } catch { /* collections may not exist yet */ }

    res.json({
      service: 'qa-engine',
      totalRuns,
      avgMutationScore,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
async function start() {
  // Ensure ArangoDB collections exist
  try {
    await ensureCollections(dbClient);
  } catch (error) {
    console.warn('[QA] Could not ensure collections (will be created on first use):', error);
  }

  httpServer.listen(PORT, () => {
    console.log(`🧠 QA Intelligence Engine running on port ${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT} (Socket.IO)`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`🚀 Start a QA run: POST http://localhost:${PORT}/qa/run`);
    console.log(`   { "repoUrl": "https://github.com/AlpheCIT/MES", "branch": "dev" }`);

    if (!qaConfig.anthropic.apiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set — agent nodes will fail. Set it in .env');
    }
  });
}

start();

export default app;
