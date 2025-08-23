import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import winston from 'winston';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Configuration
const PORT = process.env.PORT || 4001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

// Create Express app
const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: [CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-socket-id']
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'websocket-service',
    version: '2.0.0'
  });
});

// Socket.IO server
const io = new Server(server, {
  cors: {
    origin: [CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket event handlers
interface ConnectedClient {
  id: string;
  userId?: string;
  rooms: Set<string>;
  connectedAt: Date;
  lastSeen: Date;
}

const connectedClients = new Map<string, ConnectedClient>();

// Real-time event types that integrate with your frontend
interface RealtimeEvent {
  type: 'system_status' | 'repository_analysis' | 'ai_enhancement' | 'documentation_progress' | 'error';
  data: any;
  timestamp: string;
  userId?: string;
  repositoryId?: string;
}

io.on('connection', (socket) => {
  const clientInfo: ConnectedClient = {
    id: socket.id,
    rooms: new Set(),
    connectedAt: new Date(),
    lastSeen: new Date()
  };
  
  connectedClients.set(socket.id, clientInfo);
  
  logger.info(`Client connected: ${socket.id}`);

  // Handle client authentication
  socket.on('authenticate', (data: { userId: string; token?: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.userId = data.userId;
      client.lastSeen = new Date();
      
      // Join user-specific room
      socket.join(`user_${data.userId}`);
      client.rooms.add(`user_${data.userId}`);
      
      logger.info(`Client ${socket.id} authenticated as user ${data.userId}`);
      
      socket.emit('authenticated', {
        success: true,
        userId: data.userId,
        socketId: socket.id
      });
    }
  });

  // Handle repository subscription (for real-time analysis updates)
  socket.on('subscribe_repository', (data: { repositoryId: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      const room = `repository_${data.repositoryId}`;
      socket.join(room);
      client.rooms.add(room);
      client.lastSeen = new Date();
      
      logger.info(`Client ${socket.id} subscribed to repository ${data.repositoryId}`);
      
      socket.emit('subscribed', {
        type: 'repository',
        id: data.repositoryId,
        room: room
      });
    }
  });

  // Handle system monitoring subscription
  socket.on('subscribe_system', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      socket.join('system_updates');
      client.rooms.add('system_updates');
      client.lastSeen = new Date();
      
      logger.info(`Client ${socket.id} subscribed to system updates`);
      
      socket.emit('subscribed', {
        type: 'system',
        room: 'system_updates'
      });
    }
  });

  // Handle analysis job subscription
  socket.on('subscribe_analysis', (data: { jobId: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      const room = `analysis_${data.jobId}`;
      socket.join(room);
      client.rooms.add(room);
      client.lastSeen = new Date();
      
      logger.info(`Client ${socket.id} subscribed to analysis job ${data.jobId}`);
      
      socket.emit('subscribed', {
        type: 'analysis',
        id: data.jobId,
        room: room
      });
    }
  });

  // Handle unsubscribe
  socket.on('unsubscribe', (data: { room: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      socket.leave(data.room);
      client.rooms.delete(data.room);
      client.lastSeen = new Date();
      
      logger.info(`Client ${socket.id} unsubscribed from ${data.room}`);
    }
  });

  // Handle ping for connection health
  socket.on('ping', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.lastSeen = new Date();
      socket.emit('pong', { timestamp: new Date().toISOString() });
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    connectedClients.delete(socket.id);
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error);
  });
});

// API endpoints for backend integration
app.post('/api/broadcast', (req, res) => {
  try {
    const { event, room, userId } = req.body as {
      event: RealtimeEvent;
      room?: string;
      userId?: string;
    };

    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid event format' });
    }

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Broadcast to specific room or user
    if (room) {
      io.to(room).emit('realtime_event', event);
      logger.info(`Broadcasted ${event.type} to room: ${room}`);
    } else if (userId) {
      io.to(`user_${userId}`).emit('realtime_event', event);
      logger.info(`Broadcasted ${event.type} to user: ${userId}`);
    } else {
      // Broadcast to all connected clients
      io.emit('realtime_event', event);
      logger.info(`Broadcasted ${event.type} to all clients`);
    }

    return res.json({ success: true, eventType: event.type });
  } catch (error) {
    logger.error('Broadcast error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get connected clients info
app.get('/api/clients', (req, res) => {
  const clientsInfo = Array.from(connectedClients.values()).map(client => ({
    id: client.id,
    userId: client.userId,
    rooms: Array.from(client.rooms),
    connectedAt: client.connectedAt,
    lastSeen: client.lastSeen,
    online: (Date.now() - client.lastSeen.getTime()) < 60000 // 1 minute
  }));

  res.json({
    totalClients: connectedClients.size,
    clients: clientsInfo
  });
});

// System metrics endpoint
app.get('/api/metrics', (req, res) => {
  const metrics = {
    connectedClients: connectedClients.size,
    totalRooms: io.sockets.adapter.rooms.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };

  res.json(metrics);
});

// Error handling
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 WebSocket Service running on port ${PORT}`);
  logger.info(`📡 Real-time events: ws://localhost:${PORT}`);
  logger.info(`🔧 Management API: http://localhost:${PORT}/api`);
  logger.info(`❤️  Health check: http://localhost:${PORT}/health`);
  logger.info(`🌍 CORS origin: ${CORS_ORIGIN}`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  server.close(() => {
    logger.info('WebSocket server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Force exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { io, app, server };
