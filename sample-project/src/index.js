/**
 * Sample Express.js Application
 * 
 * This is a sample application designed to demonstrate the capabilities
 * of the AI Software Development Platform. It includes various code patterns,
 * security issues, and complexity scenarios for analysis.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const _ = require('lodash');
const axios = require('axios');

// SECURITY ISSUE: Hardcoded secrets (will be detected by AI system)
const JWT_SECRET = "super-secret-key-dont-use-this-in-production";
const API_KEY = "api-key-12345-hardcoded";
const DATABASE_PASSWORD = "admin123";

// Import modules
const userService = require('./services/userService');
const authMiddleware = require('./middleware/auth');
const { validateRequest, sanitizeInput } = require('./utils/validation');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * High complexity function for demonstration
 * Cyclomatic complexity: 15+ (will trigger performance warnings)
 */
function processUserData(userData, options = {}) {
  // Multiple nested conditions increase complexity
  if (userData && typeof userData === 'object') {
    if (userData.type === 'premium') {
      if (userData.subscription && userData.subscription.active) {
        if (userData.subscription.plan === 'enterprise') {
          if (userData.permissions && Array.isArray(userData.permissions)) {
            if (userData.permissions.includes('admin')) {
              if (options.fullAccess) {
                return processAdminUser(userData, options);
              } else if (options.limitedAccess) {
                return processLimitedAdmin(userData);
              } else {
                return processRegularAdmin(userData);
              }
            } else if (userData.permissions.includes('moderator')) {
              if (options.moderatorLevel === 'senior') {
                return processSeniorModerator(userData);
              } else {
                return processRegularModerator(userData);
              }
            } else if (userData.permissions.includes('editor')) {
              return processEditor(userData);
            } else {
              return processBasicUser(userData);
            }
          } else {
            throw new Error('Invalid permissions structure');
          }
        } else if (userData.subscription.plan === 'professional') {
          return processProfessionalUser(userData);
        } else {
          return processBasicPremiumUser(userData);
        }
      } else {
        return processExpiredUser(userData);
      }
    } else if (userData.type === 'free') {
      return processFreeUser(userData);
    } else {
      throw new Error('Unknown user type');
    }
  } else {
    throw new Error('Invalid user data');
  }
}

// Helper functions for user processing
function processAdminUser(user, options) {
  logger.info(`Processing admin user: ${user.email}`);
  return {
    ...user,
    accessLevel: 'admin',
    permissions: ['read', 'write', 'delete', 'manage'],
    features: options.fullAccess ? getAllFeatures() : getAdminFeatures()
  };
}

function processLimitedAdmin(user) {
  return { ...user, accessLevel: 'limited-admin', permissions: ['read', 'write'] };
}

function processRegularAdmin(user) {
  return { ...user, accessLevel: 'admin', permissions: ['read', 'write', 'delete'] };
}

function processSeniorModerator(user) {
  return { ...user, accessLevel: 'senior-moderator', permissions: ['read', 'write', 'moderate'] };
}

function processRegularModerator(user) {
  return { ...user, accessLevel: 'moderator', permissions: ['read', 'moderate'] };
}

function processEditor(user) {
  return { ...user, accessLevel: 'editor', permissions: ['read', 'write'] };
}

function processBasicUser(user) {
  return { ...user, accessLevel: 'basic', permissions: ['read'] };
}

function processProfessionalUser(user) {
  return { ...user, accessLevel: 'professional', permissions: ['read', 'write'] };
}

function processBasicPremiumUser(user) {
  return { ...user, accessLevel: 'premium', permissions: ['read', 'write'] };
}

function processExpiredUser(user) {
  return { ...user, accessLevel: 'expired', permissions: [] };
}

function processFreeUser(user) {
  return { ...user, accessLevel: 'free', permissions: ['read'] };
}

function getAllFeatures() {
  return ['analytics', 'reporting', 'export', 'api', 'integrations', 'support'];
}

function getAdminFeatures() {
  return ['analytics', 'reporting', 'export', 'api'];
}

// SECURITY ISSUE: Vulnerable to XSS (will be detected)
app.get('/unsafe-render/:content', (req, res) => {
  const content = req.params.content;
  // This is unsafe - directly inserting user input into HTML
  res.send(`<div>${content}</div>`);
});

// SECURITY ISSUE: SQL Injection potential (simulated)
app.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Simulated vulnerable query (will be detected by security scanner)
    const query = `SELECT * FROM users WHERE id = ${userId}`;
    
    // Proper way would be: SELECT * FROM users WHERE id = ?
    const user = await userService.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authentication endpoint
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = await userService.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: _.omit(user, ['passwordHash'])
    });
    
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Protected route with authentication middleware
app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await userService.findById(req.user.userId);
    const processedUser = processUserData(user, { fullAccess: true });
    
    res.json(processedUser);
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Complex data processing endpoint
app.post('/data/process', authMiddleware, async (req, res) => {
  try {
    const { data, options } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    // Complex processing with potential performance issues
    const processedData = data.map(item => {
      // Nested loops can cause performance issues with large datasets
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].values?.length || 0; j++) {
          // This could be optimized
          if (data[i].values[j].type === item.type) {
            item.relatedCount = (item.relatedCount || 0) + 1;
          }
        }
      }
      return processUserData(item, options);
    });
    
    res.json({
      processed: processedData,
      count: processedData.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Data processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// PERFORMANCE ISSUE: Blocking synchronous operation
app.get('/heavy-computation/:iterations', (req, res) => {
  const iterations = parseInt(req.params.iterations) || 1000000;
  
  let result = 0;
  // This blocks the event loop - bad practice
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i);
  }
  
  res.json({ result, iterations });
});

// External API integration with error handling
app.get('/external-data/:endpoint', async (req, res) => {
  try {
    const endpoint = req.params.endpoint;
    
    // SECURITY ISSUE: Hardcoded API key in headers
    const response = await axios.get(`https://api.example.com/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'X-API-Key': API_KEY
      },
      timeout: 5000
    });
    
    res.json(response.data);
    
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({ 
        error: 'External API error',
        details: error.response.data 
      });
    } else if (error.request) {
      res.status(503).json({ error: 'Service unavailable' });
    } else {
      res.status(500).json({ error: 'Request failed' });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
