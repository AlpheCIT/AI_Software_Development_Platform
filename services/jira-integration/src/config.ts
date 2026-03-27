/**
 * Configuration for Jira Integration Service
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.JIRA_SERVICE_PORT || '3007'),
  host: process.env.JIRA_SERVICE_HOST || '0.0.0.0',
  
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || ''
  },

  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001']
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  webhook: {
    secret: process.env.JIRA_WEBHOOK_SECRET || 'your-webhook-secret',
    url: process.env.JIRA_WEBHOOK_URL || 'http://localhost:3007/webhook/jira'
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Validate required configuration
const requiredEnvVars = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
