import * as winston from 'winston';
import * as path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for console output
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Add colors to winston
winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaString = '';
    if (Object.keys(meta).length > 0) {
      metaString = ` ${JSON.stringify(meta)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: fileFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  })
];

// Add development-specific transport
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'debug.log'),
      level: 'debug',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'repository-ingestion',
    environment: process.env.NODE_ENV || 'development'
  },
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      format: fileFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      format: fileFormat
    })
  ]
});

// Create logs directory if it doesn't exist
import * as fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Enhanced logging methods
interface LoggerContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  repositoryId?: string;
  jobId?: string;
  operation?: string;
  performance?: {
    startTime: number;
    duration?: number;
  };
}

class EnhancedLogger {
  private winston: winston.Logger;
  private context: LoggerContext = {};

  constructor(winstonLogger: winston.Logger) {
    this.winston = winstonLogger;
  }

  // Set context for all subsequent logs
  setContext(context: Partial<LoggerContext>): void {
    this.context = { ...this.context, ...context };
  }

  // Clear context
  clearContext(): void {
    this.context = {};
  }

  // Get current context
  getContext(): LoggerContext {
    return { ...this.context };
  }

  // Enhanced logging methods
  error(message: string, error?: Error | any, additionalContext?: any): void {
    const logData = {
      ...this.context,
      ...additionalContext,
      error: error?.stack || error?.message || error
    };
    this.winston.error(message, logData);
  }

  warn(message: string, additionalContext?: any): void {
    const logData = { ...this.context, ...additionalContext };
    this.winston.warn(message, logData);
  }

  info(message: string, additionalContext?: any): void {
    const logData = { ...this.context, ...additionalContext };
    this.winston.info(message, logData);
  }

  debug(message: string, additionalContext?: any): void {
    const logData = { ...this.context, ...additionalContext };
    this.winston.debug(message, logData);
  }

  http(message: string, additionalContext?: any): void {
    const logData = { ...this.context, ...additionalContext };
    this.winston.http(message, logData);
  }

  // Performance logging
  startTimer(operation: string): () => void {
    const startTime = Date.now();
    this.setContext({ 
      operation, 
      performance: { startTime } 
    });
    
    this.debug(`Started operation: ${operation}`);
    
    return () => {
      const duration = Date.now() - startTime;
      this.setContext({
        performance: { startTime, duration }
      });
      this.info(`Completed operation: ${operation}`, { duration: `${duration}ms` });
    };
  }

  // Request logging
  logRequest(method: string, url: string, statusCode?: number, responseTime?: number): void {
    const level = this.getLogLevelForStatusCode(statusCode);
    const message = `${method} ${url}`;
    const context = {
      method,
      url,
      statusCode,
      responseTime: responseTime ? `${responseTime}ms` : undefined
    };

    this[level](message, context);
  }

  // Database operation logging
  logDatabaseOperation(
    operation: string, 
    collection: string, 
    duration?: number, 
    recordCount?: number
  ): void {
    this.debug(`Database ${operation}`, {
      operation,
      collection,
      duration: duration ? `${duration}ms` : undefined,
      recordCount
    });
  }

  // Job/Task logging
  logJobStart(jobId: string, jobType: string, details?: any): void {
    this.setContext({ jobId, operation: jobType });
    this.info(`Job started: ${jobType}`, { jobId, jobType, ...details });
  }

  logJobProgress(jobId: string, progress: number, currentStep?: string): void {
    this.debug(`Job progress: ${progress}%`, { 
      jobId, 
      progress, 
      currentStep 
    });
  }

  logJobComplete(jobId: string, duration?: number, result?: any): void {
    this.info(`Job completed: ${jobId}`, { 
      jobId, 
      duration: duration ? `${duration}ms` : undefined,
      result 
    });
  }

  logJobError(jobId: string, error: Error | string, context?: any): void {
    this.error(`Job failed: ${jobId}`, error, { jobId, ...context });
  }

  // Repository operation logging
  logRepositoryOperation(
    repositoryId: string,
    operation: string,
    details?: any
  ): void {
    this.setContext({ repositoryId, operation });
    this.info(`Repository ${operation}`, { repositoryId, operation, ...details });
  }

  // File operation logging
  logFileOperation(
    filePath: string,
    operation: string,
    size?: number,
    language?: string
  ): void {
    this.debug(`File ${operation}: ${filePath}`, {
      filePath,
      operation,
      size: size ? `${size} bytes` : undefined,
      language
    });
  }

  // Security logging
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: any
  ): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 
                  severity === 'medium' ? 'warn' : 'info';
    
    this[level](`Security event: ${event}`, {
      securityEvent: event,
      severity,
      ...details
    });
  }

  // Performance metrics logging
  logMetrics(metrics: Record<string, number | string>): void {
    this.info('Performance metrics', { metrics });
  }

  // Structured error logging with additional context
  logStructuredError(
    operation: string,
    error: Error,
    context: {
      input?: any;
      expectedOutput?: any;
      actualOutput?: any;
      systemState?: any;
    }
  ): void {
    this.error(`Operation failed: ${operation}`, error, {
      operation,
      errorType: error.constructor.name,
      ...context
    });
  }

  private getLogLevelForStatusCode(statusCode?: number): 'error' | 'warn' | 'info' | 'debug' {
    if (!statusCode) return 'debug';
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    if (statusCode >= 300) return 'info';
    return 'debug';
  }

  // Utility methods
  child(context: Partial<LoggerContext>): EnhancedLogger {
    const childLogger = new EnhancedLogger(this.winston);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

  // Get logger instance for external use
  getWinstonLogger(): winston.Logger {
    return this.winston;
  }
}

// Create and export the enhanced logger instance
const enhancedLogger = new EnhancedLogger(logger);

// Export both the enhanced logger and winston logger for flexibility
export { enhancedLogger as logger, logger as winstonLogger };

// Export types for use in other modules
export type { LoggerContext };

// Utility function to create child loggers with specific context
export function createLogger(context: LoggerContext): EnhancedLogger {
  return enhancedLogger.child(context);
}

// Middleware-style logger creator for request context
export function createRequestLogger(requestId: string, userId?: string): EnhancedLogger {
  return enhancedLogger.child({ requestId, userId });
}

// Operation-specific logger creator
export function createOperationLogger(operation: string, additionalContext?: Partial<LoggerContext>): EnhancedLogger {
  return enhancedLogger.child({ operation, ...additionalContext });
}
