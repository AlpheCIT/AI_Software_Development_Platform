// backend/agent-manager/server.js
const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Redis client setup
const redisClient = createClient({
  url: 'redis://pubsub:6379'
});

redisClient.on('error', err => console.error('Redis Client Error', err));

// Connect to Redis when the server starts
(async () => {
  await redisClient.connect();
})();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Agent Manager is running' });
});

// Basic error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Agent Manager running on port ${PORT}`);
});