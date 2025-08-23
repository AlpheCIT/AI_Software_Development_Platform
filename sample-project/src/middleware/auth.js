/**
 * Authentication Middleware
 * 
 * JWT-based authentication middleware with various security patterns
 * for AI analysis demonstration.
 */

const jwt = require('jsonwebtoken');
const userService = require('../services/userService');

// SECURITY ISSUE: Hardcoded secret (will be detected)
const JWT_SECRET = "super-secret-key-dont-use-this-in-production";

/**
 * Authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'No token provided' 
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user data
    const user = await userService.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Invalid token - user not found' 
      });
    }
    
    // Add user to request object
    req.user = {
      userId: user.id,
      email: user.email,
      type: user.type,
      permissions: user.permissions || []
    };
    
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Token expired' 
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Invalid token' 
      });
    } else {
      console.error('Authentication error:', error);
      return res.status(500).json({ 
        error: 'Authentication failed',
        message: 'Internal server error' 
      });
    }
  }
}

/**
 * Authorization middleware factory
 * @param {Array} requiredPermissions - Required permissions
 * @returns {Function} Middleware function
 */
function requirePermissions(requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }
    
    const userPermissions = req.user.permissions || [];
    
    // Complex permission checking logic (increases complexity)
    const hasRequiredPermissions = requiredPermissions.every(permission => {
      if (permission === 'admin') {
        return userPermissions.includes('admin') || req.user.type === 'premium';
      } else if (permission === 'write') {
        return userPermissions.includes('write') || 
               userPermissions.includes('admin') ||
               (req.user.type === 'premium' && userPermissions.includes('read'));
      } else if (permission === 'read') {
        return userPermissions.includes('read') || 
               userPermissions.includes('write') ||
               userPermissions.includes('admin');
      } else {
        return userPermissions.includes(permission);
      }
    });
    
    if (!hasRequiredPermissions) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredPermissions,
        userPermissions: userPermissions
      });
    }
    
    next();
  };
}

/**
 * Role-based access control middleware
 * @param {Array} allowedRoles - Allowed user types/roles
 * @returns {Function} Middleware function
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }
    
    if (!allowedRoles.includes(req.user.type)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `Required role: ${allowedRoles.join(' or ')}`,
        userRole: req.user.type
      });
    }
    
    next();
  };
}

/**
 * Rate limiting middleware (simplified implementation)
 * @param {Object} options - Rate limiting options
 * @returns {Function} Middleware function
 */
function rateLimit(options = {}) {
  const { maxRequests = 100, windowMs = 900000 } = options; // 15 minutes default
  const requests = new Map();
  
  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean old entries
    for (const [key, data] of requests.entries()) {
      if (now - data.resetTime > windowMs) {
        requests.delete(key);
      }
    }
    
    // Get or create client data
    let clientData = requests.get(clientId);
    if (!clientData) {
      clientData = {
        count: 0,
        resetTime: now
      };
      requests.set(clientId, clientData);
    }
    
    // Reset if window expired
    if (now - clientData.resetTime > windowMs) {
      clientData.count = 0;
      clientData.resetTime = now;
    }
    
    // Check limit
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((windowMs - (now - clientData.resetTime)) / 1000)
      });
    }
    
    // Increment counter
    clientData.count++;
    
    next();
  };
}

module.exports = {
  authenticateToken,
  requirePermissions,
  requireRole,
  rateLimit
};

// Default export for easier importing
module.exports.default = authenticateToken;
