#!/usr/bin/env node

/**
 * AI Software Development Platform - Setup Script
 * Creates the complete professional directory structure
 */

const fs = require('fs');
const path = require('path');

const baseDir = process.cwd();

console.log('🚀 AI Software Development Platform - Setup Script');
console.log('============================================================');
console.log(`📍 Base Directory: ${baseDir}`);
console.log();

// Define the complete directory structure
const directories = [
  // Apps Layer
  'apps/web-dashboard/src/components',
  'apps/web-dashboard/src/pages', 
  'apps/web-dashboard/src/hooks',
  'apps/web-dashboard/src/services',
  'apps/web-dashboard/src/utils',
  'apps/web-dashboard/src/types',
  'apps/web-dashboard/public',
  'apps/vscode-extension/src',
  'apps/vscode-extension/resources',
  'apps/cli-tool/src/commands',
  'apps/cli-tool/src/utils',
  'apps/jupyter-notebooks/analysis',
  'apps/jupyter-notebooks/demos',
  'apps/jupyter-notebooks/migration',

  // Packages Layer - Core
  'packages/core/src/entities',
  'packages/core/src/repositories', 
  'packages/core/src/services',
  'packages/core/src/types',
  'packages/core/src/interfaces',
  'packages/core/src/use-cases',

  // Packages Layer - Database
  'packages/database/src/arango/collections',
  'packages/database/src/arango/queries',
  'packages/database/src/arango/indexes',
  'packages/database/src/migrations',
  'packages/database/src/seeds',
  'packages/database/src/schemas',

  // Packages Layer - AI Services
  'packages/ai-services/src/pattern-recognition',
  'packages/ai-services/src/security-analysis',
  'packages/ai-services/src/performance-analysis',
  'packages/ai-services/src/compliance-checker',
  'packages/ai-services/src/vector-similarity',
  'packages/ai-services/src/ml-models',

  // Packages Layer - Agents
  'packages/agents/src/orchestrator',
  'packages/agents/src/security-expert',
  'packages/agents/src/performance-expert',
  'packages/agents/src/compliance-expert',
  'packages/agents/src/integration-manager',
  'packages/agents/src/base',

  // Packages Layer - Parsers
  'packages/parsers/src/multi-language/python',
  'packages/parsers/src/multi-language/javascript',
  'packages/parsers/src/multi-language/typescript', 
  'packages/parsers/src/multi-language/java',
  'packages/parsers/src/multi-language/csharp',
  'packages/parsers/src/ast-analysis',
  'packages/parsers/src/metadata-extraction',

  // Packages Layer - Integrations
  'packages/integrations/src/github',
  'packages/integrations/src/jira',
  'packages/integrations/src/refact-ai',
  'packages/integrations/src/sonarqube',
  'packages/integrations/src/slack',
  'packages/integrations/src/webhooks',

  // Packages Layer - Shared
  'packages/shared/src/config',
  'packages/shared/src/logging',
  'packages/shared/src/monitoring',
  'packages/shared/src/security',
  'packages/shared/src/validation',
  'packages/shared/src/utils',
  'packages/shared/src/constants',

  // Services Layer
  'services/api-gateway/src/graphql/resolvers',
  'services/api-gateway/src/graphql/schemas',
  'services/api-gateway/src/middleware',
  'services/api-gateway/src/routes',
  'services/repository-ingestion/src/processors',
  'services/repository-ingestion/src/workers',
  'services/analysis-engine/src/analyzers', 
  'services/analysis-engine/src/workers',
  'services/ai-orchestration/src/agents',
  'services/ai-orchestration/src/orchestrator',
  'services/notification/src/providers',
  'services/notification/src/templates',
  'services/websocket/src/handlers',
  'services/websocket/src/events',

  // Infrastructure
  'infrastructure/docker/services',
  'infrastructure/kubernetes/base',
  'infrastructure/kubernetes/overlays/development',
  'infrastructure/kubernetes/overlays/staging',
  'infrastructure/kubernetes/overlays/production',
  'infrastructure/terraform/modules',
  'infrastructure/terraform/environments/dev',
  'infrastructure/terraform/environments/prod',
  'infrastructure/monitoring/prometheus',
  'infrastructure/monitoring/grafana/dashboards',
  'infrastructure/monitoring/grafana/datasources',
  'infrastructure/ci-cd/github-actions',

  // Documentation
  'docs/api/graphql',
  'docs/api/rest',
  'docs/architecture/diagrams',
  'docs/architecture/decisions',
  'docs/deployment/docker',
  'docs/deployment/kubernetes',
  'docs/development/setup',
  'docs/development/testing',
  'docs/integrations/github',
  'docs/integrations/jira',
  'docs/user-guides/dashboard',
  'docs/user-guides/cli',

  // Testing
  'tests/unit/packages',
  'tests/unit/services',
  'tests/integration/api',
  'tests/integration/database',
  'tests/e2e/dashboard',
  'tests/e2e/cli',
  'tests/performance/load',
  'tests/fixtures/data',

  // Scripts
  'scripts/setup',
  'scripts/migration',
  'scripts/deployment',
  'scripts/maintenance',
  'scripts/database',

  // Config
  'config/environments',
  'config/policies',
  'config/workflows'
];

function createDirectories() {
  let created = 0;
  let failed = 0;

  console.log('📁 Creating directory structure...');
  console.log();

  directories.forEach(dir => {
    try {
      const fullPath = path.join(baseDir, dir);
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ ${dir}`);
      created++;
    } catch (error) {
      console.log(`❌ ${dir} - ${error.message}`);
      failed++;
    }
  });

  console.log();
  console.log('📊 Summary:');
  console.log(`✅ Successfully created: ${created} directories`);
  console.log(`❌ Failed to create: ${failed} directories`);
  console.log(`📁 Total directories: ${directories.length}`);

  if (failed === 0) {
    console.log();
    console.log('🎉 Directory structure created successfully!');
    console.log('🎯 Ready for AI Software Development Platform development!');
    console.log();
    console.log('📋 Next Steps:');
    console.log('1. Copy .env.example to .env and configure');
    console.log('2. Run: npm install');
    console.log('3. Run: npm run docker:up');
    console.log('4. Run: npm run dev');
  }
}

// Run the setup
createDirectories();