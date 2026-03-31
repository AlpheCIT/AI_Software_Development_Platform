/**
 * Enhanced WebSocket Service with Real-time Event Broadcasting
 * SCRUM-79: Implement Real-time WebSocket Integration
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import winston from 'winston';
import IngestionEventBroadcaster, { IngestionEvent } from './events/ingestionEvents';
import GraphAnalyticsEventBroadcaster, { GraphAnalyticsEvent } from './events/graphAnalyticsEvents';

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
    version: '2.1.0',
    features: ['ingestion-events', 'graph-events', 'analytics-events', 'system-monitoring'],
    connectedClients: connectedClients.size
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

// Initialize event broadcasters
const ingestionBroadcaster = new IngestionEventBroadcaster(io);
const graphAnalyticsBroadcaster = new GraphAnalyticsEventBroadcaster(io);

// Socket event handlers
interface ConnectedClient {
  id: string;
  userId?: string;
  rooms: Set<string>;
  connectedAt: Date;
  lastSeen: Date;
  subscriptions: Set<string>;
  preferences: {
    notifications: boolean;
    systemAlerts: boolean;
    analysisUpdates: boolean;
  };
}

const connectedClients = new Map<string, ConnectedClient>();

// Enhanced event types
type RealtimeEvent = IngestionEvent | GraphAnalyticsEvent | {
  type: 'system_status' | 'error' | 'notification';
  data: any;
  timestamp: string;
  userId?: string;
  repositoryId?: string;
};

io.on('connection', (socket) => {
  const clientInfo: ConnectedClient = {
    id: socket.id,
    rooms: new Set(),
    connectedAt: new Date(),
    lastSeen: new Date(),
    subscriptions: new Set(),
    preferences: {
      notifications: true,
      systemAlerts: true,
      analysisUpdates: true
    }
  };
  
  connectedClients.set(socket.id, clientInfo);
  
  logger.info(`🔗 Client connected: ${socket.id}`);

  // Send welcome message with available subscriptions
  socket.emit('connected', {
    socketId: socket.id,
    serverVersion: '2.1.0',
    availableSubscriptions: [
      'repository_analysis',
      'system_updates', 
      'ai_insights',
      'analytics_dashboard',
      'ingestion_jobs',
      'graph_updates'
    ],
    connectedAt: new Date().toISOString()
  });

  // Handle client authentication
  socket.on('authenticate', (data: { userId: string; token?: string; preferences?: any }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.userId = data.userId;
      client.lastSeen = new Date();
      
      // Update preferences if provided
      if (data.preferences) {
        client.preferences = { ...client.preferences, ...data.preferences };
      }
      
      // Join user-specific room
      socket.join(`user_${data.userId}`);
      client.rooms.add(`user_${data.userId}`);
      
      logger.info(`👤 Client ${socket.id} authenticated as user ${data.userId}`);
      
      socket.emit('authenticated', {
        success: true,
        userId: data.userId,
        socketId: socket.id,
        preferences: client.preferences
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
      client.subscriptions.add(`repository:${data.repositoryId}`);
      client.lastSeen = new Date();
      
      logger.info(`📂 Client ${socket.id} subscribed to repository ${data.repositoryId}`);
      
      socket.emit('subscribed', {
        type: 'repository',
        id: data.repositoryId,
        room: room
      });
    }
  });

  // Handle job subscription for ingestion tracking
  socket.on('subscribe_job', (data: { jobId: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      const room = `job_${data.jobId}`;
      socket.join(room);
      client.rooms.add(room);
      client.subscriptions.add(`job:${data.jobId}`);
      client.lastSeen = new Date();
      
      logger.info(`⚙️ Client ${socket.id} subscribed to job ${data.jobId}`);
      
      socket.emit('subscribed', {
        type: 'job',
        id: data.jobId,
        room: room
      });
    }
  });

  // Handle node subscription for graph updates
  socket.on('subscribe_node', (data: { nodeId: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      const room = `node_${data.nodeId}`;
      socket.join(room);
      client.rooms.add(room);
      client.subscriptions.add(`node:${data.nodeId}`);
      client.lastSeen = new Date();
      
      logger.info(`🔗 Client ${socket.id} subscribed to node ${data.nodeId}`);
      
      socket.emit('subscribed', {
        type: 'node',
        id: data.nodeId,
        room: room
      });
    }
  });

  // Handle collection subscription for database updates
  socket.on('subscribe_collection', (data: { collectionName: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      const room = `collection_${data.collectionName}`;
      socket.join(room);
      client.rooms.add(room);
      client.subscriptions.add(`collection:${data.collectionName}`);
      client.lastSeen = new Date();
      
      logger.info(`🗃️ Client ${socket.id} subscribed to collection ${data.collectionName}`);
      
      socket.emit('subscribed', {
        type: 'collection',
        name: data.collectionName,
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
      client.subscriptions.add('system_updates');
      client.lastSeen = new Date();
      
      logger.info(`⚡ Client ${socket.id} subscribed to system updates`);
      
      socket.emit('subscribed', {
        type: 'system',
        room: 'system_updates'
      });
    }
  });

  // Handle AI insights subscription
  socket.on('subscribe_ai_insights', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      socket.join('ai_insights');
      client.rooms.add('ai_insights');
      client.subscriptions.add('ai_insights');
      client.lastSeen = new Date();
      
      logger.info(`🤖 Client ${socket.id} subscribed to AI insights`);
      
      socket.emit('subscribed', {
        type: 'ai_insights',
        room: 'ai_insights'
      });
    }
  });

  // Handle analytics dashboard subscription
  socket.on('subscribe_analytics', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      socket.join('analytics_dashboard');
      client.rooms.add('analytics_dashboard');
      client.subscriptions.add('analytics_dashboard');
      client.lastSeen = new Date();
      
      logger.info(`📊 Client ${socket.id} subscribed to analytics dashboard`);
      
      socket.emit('subscribed', {
        type: 'analytics',
        room: 'analytics_dashboard'
      });
    }
  });

  // Handle unsubscribe
  socket.on('unsubscribe', (data: { room: string; type?: string; id?: string }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      socket.leave(data.room);
      client.rooms.delete(data.room);
      
      // Remove from subscriptions
      if (data.type && data.id) {
        client.subscriptions.delete(`${data.type}:${data.id}`);
      } else if (data.type) {
        client.subscriptions.delete(data.type);
      }
      
      client.lastSeen = new Date();
      
      logger.info(`❌ Client ${socket.id} unsubscribed from ${data.room}`);
      
      socket.emit('unsubscribed', {
        room: data.room,
        type: data.type,
        id: data.id
      });
    }
  });

  // Handle preference updates
  socket.on('update_preferences', (data: { notifications?: boolean; systemAlerts?: boolean; analysisUpdates?: boolean }) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.preferences = { ...client.preferences, ...data };
      client.lastSeen = new Date();
      
      logger.info(`⚙️ Client ${socket.id} updated preferences`);
      
      socket.emit('preferences_updated', {
        preferences: client.preferences
      });
    }
  });

  // Handle ping for connection health
  socket.on('ping', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.lastSeen = new Date();
      socket.emit('pong', { 
        timestamp: new Date().toISOString(),
        serverTime: Date.now()
      });
    }
  });

  // Handle request for current subscriptions
  socket.on('get_subscriptions', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      socket.emit('current_subscriptions', {
        subscriptions: Array.from(client.subscriptions),
        rooms: Array.from(client.rooms),
        preferences: client.preferences
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    connectedClients.delete(socket.id);
    logger.info(`💔 Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

// Enhanced API endpoints for backend integration

// Broadcast ingestion events
app.post('/api/broadcast/ingestion', (req, res) => {
  try {
    const event = req.body as IngestionEvent;
    
    if (!event || !event.type || !event.type.startsWith('ingestion:')) {
      return res.status(400).json({ error: 'Invalid ingestion event format' });
    }

    ingestionBroadcaster.broadcastEvent(event);
    
    return res.json({ 
      success: true, 
      eventType: event.type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Ingestion broadcast error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Broadcast graph/analytics events
app.post('/api/broadcast/analytics', (req, res) => {
  try {
    const event = req.body as GraphAnalyticsEvent;
    
    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid analytics event format' });
    }

    graphAnalyticsBroadcaster.broadcastEvent(event);
    
    return res.json({ 
      success: true, 
      eventType: event.type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Analytics broadcast error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic broadcast endpoint (backwards compatibility)
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
    const eventWithTimestamp = event as any;
    if (!eventWithTimestamp.timestamp) {
      eventWithTimestamp.timestamp = new Date().toISOString();
    }

    // Route to appropriate broadcaster based on event type
    if (event.type.startsWith('ingestion:')) {
      ingestionBroadcaster.broadcastEvent(event as IngestionEvent);
    } else if (event.type.startsWith('graph:') || event.type.startsWith('analytics:') || 
               event.type.startsWith('system:') || event.type.startsWith('collection:') || 
               event.type.startsWith('ai:') || event.type.startsWith('analysis:')) {
      graphAnalyticsBroadcaster.broadcastEvent(event as GraphAnalyticsEvent);
    } else {
      // Generic broadcast for other event types
      if (room) {
        io.to(room).emit('realtime_event', event);
        logger.info(`📡 Generic broadcast to room: ${room}`);
      } else if (userId) {
        io.to(`user_${userId}`).emit('realtime_event', event);
        logger.info(`📡 Generic broadcast to user: ${userId}`);
      } else {
        io.emit('realtime_event', event);
        logger.info(`📡 Generic broadcast to all clients`);
      }
    }

    return res.json({ success: true, eventType: event.type });
  } catch (error) {
    logger.error('Generic broadcast error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed connected clients info
app.get('/api/clients', (req, res) => {
  const clientsInfo = Array.from(connectedClients.values()).map(client => ({
    id: client.id,
    userId: client.userId,
    rooms: Array.from(client.rooms),
    subscriptions: Array.from(client.subscriptions),
    preferences: client.preferences,
    connectedAt: client.connectedAt,
    lastSeen: client.lastSeen,
    online: (Date.now() - client.lastSeen.getTime()) < 60000 // 1 minute
  }));

  res.json({
    totalClients: connectedClients.size,
    onlineClients: clientsInfo.filter(c => c.online).length,
    clients: clientsInfo
  });
});

// Get subscription statistics
app.get('/api/subscriptions', (req, res) => {
  const subscriptionStats = new Map<string, number>();
  const roomStats = new Map<string, number>();

  connectedClients.forEach(client => {
    client.subscriptions.forEach(sub => {
      subscriptionStats.set(sub, (subscriptionStats.get(sub) || 0) + 1);
    });
    
    client.rooms.forEach(room => {
      roomStats.set(room, (roomStats.get(room) || 0) + 1);
    });
  });

  res.json({
    totalSubscriptions: Array.from(subscriptionStats.values()).reduce((a, b) => a + b, 0),
    subscriptionTypes: Object.fromEntries(subscriptionStats),
    roomOccupancy: Object.fromEntries(roomStats),
    timestamp: new Date().toISOString()
  });
});

// Enhanced system metrics endpoint
app.get('/api/metrics', (req, res) => {
  const metrics = {
    connectedClients: connectedClients.size,
    totalRooms: io.sockets.adapter.rooms.size,
    totalSubscriptions: Array.from(connectedClients.values())
      .map(c => c.subscriptions.size)
      .reduce((a, b) => a + b, 0),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    eventTypes: {
      ingestion: ['job-started', 'job-progress', 'phase-completed', 'collection-updated', 'job-completed', 'job-failed'],
      graph: ['node-updated', 'relationship-updated'],
      analytics: ['metrics-updated'],
      system: ['health-updated'],
      ai: ['insight-generated'],
      analysis: ['completed']
    },
    timestamp: new Date().toISOString()
  };

  res.json(metrics);
});

// Test event broadcasting endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.post('/api/test/broadcast', (req, res) => {
    const { eventType, data } = req.body;
    
    const testEvent: any = {
      type: eventType || 'test:event',
      data: data || { message: 'Test event', timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString()
    };

    io.emit('realtime_event', testEvent);
    
    res.json({
      success: true,
      message: 'Test event broadcasted',
      eventType: testEvent.type,
      connectedClients: connectedClients.size
    });
  });
}

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
  logger.info(`🚀 Enhanced WebSocket Service running on port ${PORT}`);
  logger.info(`📡 Real-time events: ws://localhost:${PORT}`);
  logger.info(`🔧 Management API: http://localhost:${PORT}/api`);
  logger.info(`❤️  Health check: http://localhost:${PORT}/health`);
  logger.info(`🌍 CORS origin: ${CORS_ORIGIN}`);
  logger.info(`✨ Features: Ingestion Events, Graph Updates, Analytics, System Monitoring`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  // Notify all connected clients about shutdown
  io.emit('server_shutdown', {
    message: 'Server is shutting down for maintenance',
    timestamp: new Date().toISOString(),
    reconnectIn: 30000 // 30 seconds
  });

  setTimeout(() => {
    server.close(() => {
      logger.info('WebSocket server closed');
      process.exit(0);
    });
  }, 1000); // Give clients 1 second to receive the shutdown message

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Force exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { io, app, server, ingestionBroadcaster, graphAnalyticsBroadcaster };
