/**
 * Configuration for AI Code Management API Gateway
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  
  api: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(4000),
  }),

  database: z.object({
    arangodb: z.object({
      url: z.string().url(),
      database: z.string(),
      username: z.string(),
      password: z.string().optional(),
    }),
    redis: z.object({
      url: z.string().url().optional(),
      host: z.string().default('localhost'),
      port: z.number().default(6379),
    }),
  }),

  ai: z.object({
    bedrock: z.object({
      region: z.string().default('us-east-1'),
      modelId: z.string().default('anthropic.claude-3-sonnet-20240229-v1:0'),
    }),
    ollama: z.object({
      url: z.string().url().default('http://localhost:11434'),
      model: z.string().default('nomic-embed-text'),
    }),
  }),

  integrations: z.object({
    github: z.object({
      token: z.string().optional(),
    }),
    jira: z.object({
      serverUrl: z.string().url().optional(),
      username: z.string().optional(),
      apiToken: z.string().optional(),
      projectKey: z.string().optional(),
    }),
    slack: z.object({
      botToken: z.string().optional(),
      signingSecret: z.string().optional(),
    }),
  }),

  security: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiresIn: z.string().default('24h'),
  }),

  cors: z.object({
    origins: z.array(z.string()).default(['http://localhost:3000']),
  }),

  rateLimit: z.object({
    maxRequests: z.number().default(100),
    windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
  }),

  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    pretty: z.boolean().default(true),
  }),

  monitoring: z.object({
    prometheus: z.object({
      enabled: z.boolean().default(true),
      port: z.number().default(9090),
    }),
    tracing: z.object({
      enabled: z.boolean().default(false),
      jaegerEndpoint: z.string().url().optional(),
    }),
  }),
});

const rawConfig = {
  env: process.env.NODE_ENV as 'development' | 'staging' | 'production',
  
  api: {
    host: process.env.API_HOST || 'localhost',
    port: parseInt(process.env.API_PORT || '4000', 10),
  },

  database: {
    arangodb: {
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      database: process.env.ARANGO_DATABASE || 'ai_code_management',
      username: process.env.ARANGO_USERNAME || 'root',
      password: process.env.ARANGO_PASSWORD || '',
    },
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  },

  ai: {
    bedrock: {
      region: process.env.AWS_REGION || 'us-east-1',
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
    },
    ollama: {
      url: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'nomic-embed-text',
    },
  },

  integrations: {
    github: {
      token: process.env.GITHUB_TOKEN,
    },
    jira: {
      serverUrl: process.env.JIRA_SERVER_URL,
      username: process.env.JIRA_USERNAME,
      apiToken: process.env.JIRA_API_TOKEN,
      projectKey: process.env.JIRA_PROJECT_KEY,
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    },
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-chars',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  rateLimit: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  },

  logging: {
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    pretty: process.env.NODE_ENV === 'development',
  },

  monitoring: {
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      port: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    },
    tracing: {
      enabled: process.env.TRACING_ENABLED === 'true',
      jaegerEndpoint: process.env.JAEGER_ENDPOINT,
    },
  },
};

export const config = configSchema.parse(rawConfig);

// Validate critical configurations
if (config.env === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  
  if (!config.database.arangodb.password) {
    console.warn('Warning: No ArangoDB password set in production');
  }
}

export type Config = z.infer<typeof configSchema>;