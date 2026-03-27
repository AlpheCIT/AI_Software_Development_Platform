import { config } from 'dotenv';
import { join, resolve } from 'path';

// Support both tsx (src/) and compiled (dist/) execution
const rootDir = resolve(__dirname, '..');

// Load .env — standard (no override so runtime env vars take precedence)
config({ path: resolve(process.cwd(), '.env') });
config({ path: join(rootDir, '.env') });
config({ path: join(rootDir, '../../config/environments/.env') });

// Workaround: Some parent environments set ANTHROPIC_API_KEY="" (empty string).
// dotenv won't overwrite a defined (even empty) env var. Read directly from .env.
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const fs = require('fs');
    const envContent = fs.readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    const match = envContent.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (match && match[1].trim()) {
      process.env.ANTHROPIC_API_KEY = match[1].trim();
    }
  } catch { /* ignore */ }
}

export const qaConfig = {
  port: parseInt(process.env.QA_ENGINE_PORT || '3005', 10),

  arango: {
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    database: process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB',
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || 'openSesame',
  },

  services: {
    websocketUrl: process.env.WEBSOCKET_URL || 'http://localhost:4001',
    eventBusUrl: process.env.EVENT_BUS_URL || 'http://localhost:9092',
    ingestionEngineUrl: process.env.INGESTION_ENGINE_URL || 'http://localhost:3003',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  },

  qa: {
    maxMutationIterations: parseInt(process.env.QA_MAX_MUTATION_ITERATIONS || '3', 10),
    mutationScoreThreshold: parseInt(process.env.QA_MUTATION_SCORE_THRESHOLD || '80', 10),
    maxTestsPerRun: parseInt(process.env.QA_MAX_TESTS_PER_RUN || '50', 10),
    testTimeoutMs: parseInt(process.env.QA_TEST_TIMEOUT_MS || '60000', 10),
  },
};
