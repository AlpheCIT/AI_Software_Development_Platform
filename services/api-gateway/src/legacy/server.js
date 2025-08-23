// backend/api-gateway/server.js
// backend/api-gateway/server.js
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Enable CORS
app.use(cors());
app.use(express.json());

// Store connected clients
const clients = new Set();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  // Send initial test data
  const initialAgents = [
    {
      type: 'agent.status',
      payload: {
        agentId: 'agent-1',
        status: 'active',
        task: 'Processing data',
        timestamp: new Date().toISOString()
      }
    },
    {
      type: 'agent.status',
      payload: {
        agentId: 'agent-2',
        status: 'idle',
        timestamp: new Date().toISOString()
      }
    }
  ];

  initialAgents.forEach(data => {
    ws.send(JSON.stringify(data));
  });

  // Simulate periodic updates
  const simulateUpdates = setInterval(() => {
    const updates = [
      {
        type: 'agent.status',
        payload: {
          agentId: 'agent-1',
          status: Math.random() > 0.5 ? 'active' : 'idle',
          task: Math.random() > 0.5 ? 'Processing data' : 'Waiting for input',
          timestamp: new Date().toISOString()
        }
      },
      {
        type: 'agent.status',
        payload: {
          agentId: 'agent-2',
          status: Math.random() > 0.5 ? 'active' : 'idle',
          task: Math.random() > 0.5 ? 'Analyzing results' : undefined,
          timestamp: new Date().toISOString()
        }
      }
    ];

    // Randomly send updates
    if (Math.random() > 0.3) {
      const update = updates[Math.floor(Math.random() * updates.length)];
      ws.send(JSON.stringify(update));
    }

    // Occasionally simulate an escalation
    if (Math.random() > 0.9) {
      ws.send(JSON.stringify({
        type: 'agent.escalation',
        payload: {
          agentId: Math.random() > 0.5 ? 'agent-1' : 'agent-2',
          reason: 'Resource threshold exceeded',
          timestamp: new Date().toISOString()
        }
      }));
    }
  }, 3000);

  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      // Echo back the message to all clients
      clients.forEach(client => {
        if (client.readyState === ws.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
    clearInterval(simulateUpdates);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(simulateUpdates);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Gateway is running' });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});