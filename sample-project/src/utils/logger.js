/**
 * Logger Utility
 * 
 * Simple logging utility with different levels and formatting.
 * Contains various patterns for analysis.
 */

const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// SECURITY ISSUE: Potential path traversal vulnerability
const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_FILE = path.join(LOG_DIR, 'app.log');

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'INFO';
    this.enableFile = options.enableFile !== false;
    this.enableConsole = options.enableConsole !== false;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    
    // Ensure log directory exists
    if (this.enableFile && !fs.existsSync(LOG_DIR)) {
      try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error);
        this.enableFile = false;
      }
    }
  }
  
  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {string} Formatted message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    
    let formattedMessage = `${timestamp} [${pid}] ${level.toUpperCase()}: ${message}`;
    
    // Add metadata if provided
    if (Object.keys(meta).length > 0) {
      formattedMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return formattedMessage;
  }
  
  /**
   * Write to log file
   * @param {string} message - Formatted message
   */
  writeToFile(message) {
    if (!this.enableFile) return;
    
    try {
      // Check file size and rotate if necessary
      if (fs.existsSync(LOG_FILE)) {
        const stats = fs.statSync(LOG_FILE);
        if (stats.size > this.maxFileSize) {
          this.rotateLogFile();
        }
      }
      
      fs.appendFileSync(LOG_FILE, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
  
  /**
   * Rotate log file when it gets too large
   */
  rotateLogFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = LOG_FILE.replace('.log', `_${timestamp}.log`);
      fs.renameSync(LOG_FILE, rotatedFile);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }
  
  /**
   * Check if message should be logged based on level
   * @param {string} messageLevel - Message log level
   * @returns {boolean} Should log
   */
  shouldLog(messageLevel) {
    const currentLevel = LOG_LEVELS[this.level.toUpperCase()] || LOG_LEVELS.INFO;
    const msgLevel = LOG_LEVELS[messageLevel.toUpperCase()] || LOG_LEVELS.INFO;
    return msgLevel <= currentLevel;
  }
  
  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta = {}) {
    if (!this.shouldLog('ERROR')) return;
    
    const formattedMessage = this.formatMessage('ERROR', message, meta);
    
    if (this.enableConsole) {
      console.error(formattedMessage);
    }
    
    this.writeToFile(formattedMessage);
  }
  
  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    if (!this.shouldLog('WARN')) return;
    
    const formattedMessage = this.formatMessage('WARN', message, meta);
    
    if (this.enableConsole) {
      console.warn(formattedMessage);
    }
    
    this.writeToFile(formattedMessage);
  }
  
  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    if (!this.shouldLog('INFO')) return;
    
    const formattedMessage = this.formatMessage('INFO', message, meta);
    
    if (this.enableConsole) {
      console.log(formattedMessage);
    }
    
    this.writeToFile(formattedMessage);
  }
  
  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    if (!this.shouldLog('DEBUG')) return;
    
    const formattedMessage = this.formatMessage('DEBUG', message, meta);
    
    if (this.enableConsole) {
      console.debug(formattedMessage);
    }
    
    this.writeToFile(formattedMessage);
  }
  
  /**
   * Log HTTP request (for middleware)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  logRequest(req, res, duration) {
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };
    
    if (res.statusCode >= 400) {
      this.warn(message, meta);
    } else {
      this.info(message, meta);
    }
  }
}

// Create default logger instance
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'INFO',
  enableFile: process.env.LOG_TO_FILE !== 'false',
  enableConsole: process.env.LOG_TO_CONSOLE !== 'false'
});

// Express middleware for request logging
function requestLogger() {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      logger.logRequest(req, res, duration);
      originalEnd.apply(this, args);
    };
    
    next();
  };
}

module.exports = {
  Logger,
  logger,
  requestLogger,
  LOG_LEVELS
};

// Default export
module.exports.default = logger;
