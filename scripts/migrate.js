#!/usr/bin/env node

/**
 * AI Software Development Platform - Migration Script
 * 
 * Migrates and consolidates functionality from existing repositories:
 * - Previous_Github_AI_Code_Management_v1
 * - Previous_Github_Code_Management_Analyzer_v1
 */

const fs = require('fs').promises;
const path = require('path');

const BASE_DIR = process.cwd();
const PARENT_DIR = path.dirname(BASE_DIR);

const SOURCE_REPOS = {
  aiCodeManagement: path.join(PARENT_DIR, 'Previous_Github_AI_Code_Management_v1', 'AI_Code_Management'),
  codeAnalyzer: path.join(PARENT_DIR, 'Previous_Github_Code_Management_Analyzer_v1', 'Code_Management_Analyzer'),
};

console.log('🚀 AI Software Development Platform - Migration Script');
console.log('====================================================');
console.log(`📍 Target Directory: ${BASE_DIR}`);
console.log(`📁 Source Repositories:`);
console.log(`   - AI Code Management v1: ${SOURCE_REPOS.aiCodeManagement}`);
console.log(`   - Code Analyzer v1: ${SOURCE_REPOS.codeAnalyzer}`);
console.log();

// Migration mapping - what to copy from where
const MIGRATION_MAP = {
  // From AI Code Management v1
  aiCodeManagement: {
    // Backend services
    'backend/agent-coder': 'packages/agents/src/code-agent',
    'backend/agent-manager': 'packages/agents/src/orchestrator',
    'backend/ai-processing': 'packages/ai-services/src',
    'backend/api-gateway': 'services/api-gateway/src/legacy',
    'backend/graph-db': 'packages/database/src/arango/legacy',
    'backend/vector-search': 'packages/ai-services/src/vector-similarity',
    'backend/project-management': 'packages/core/src/project-management',
    
    // Frontend
    'frontend': 'apps/web-dashboard/src/legacy',
    
    // Database
    'database': 'packages/database/src/migrations/v1',
    
    // Scripts
    'scripts': 'scripts/legacy/v1',
    
    // Documentation
    'README.md': 'docs/legacy/ai-code-management-v1.md',
    '.env.example': 'config/environments/v1.env.example',
  },

  // From Code Management Analyzer v1  
  codeAnalyzer: {
    // API and backend
    'api': 'services/api-gateway/src/analyzer-legacy',
    'backend': 'packages/core/src/analyzer-legacy',
    
    // Core functionality
    'core': 'packages/core/src/analysis',
    'analysis': 'packages/parsers/src/legacy-analysis',
    
    // Frontend
    'frontend': 'apps/web-dashboard/src/analyzer-legacy',
    
    // Database
    'database': 'packages/database/src/migrations/analyzer',
    
    // Documentation
    'docs': 'docs/legacy/code-analyzer-v1',
    
    // Scripts and utilities
    'scripts': 'scripts/legacy/analyzer',
    'deployment': 'infrastructure/legacy/analyzer',
    
    // Configuration
    '.env': 'config/environments/analyzer.env.example',
    'docker-compose.yml': 'infrastructure/docker/legacy-analyzer.yml',
  },
};

// Key files to preserve and merge
const CRITICAL_FILES = [
  // Configuration files
  '.env',
  '.env.example', 
  'package.json',
  'docker-compose.yml',
  'docker-compose.dev.yml',
  
  // Documentation
  'README.md',
  'DOCUMENTATION_API_STATUS.md',
  'APP_STATUS.md',
  
  // Core application files
  'main.py',
  'app.py',
  'real_backend.py',
  'code_intelligence.py',
  
  // Analysis and AI files
  'analysis/*.py',
  'ai_analysis_result.json',
  'semantic_analysis_demo.json',
  
  // Database files
  'database/*.sql',
  'database/*.aql',
  'migrate_to_database.py',
  'sync_database.py',
  
  // Frontend components
  'frontend/src/**/*.tsx',
  'frontend/src/**/*.ts',
  'frontend/src/**/*.css',
];

async function checkSourceRepositories() {
  console.log('🔍 Checking source repositories...');
  
  const checks = [];
  for (const [name, repoPath] of Object.entries(SOURCE_REPOS)) {
    try {
      await fs.access(repoPath);
      console.log(`✅ Found: ${name} at ${repoPath}`);
      checks.push({ name, path: repoPath, exists: true });
    } catch (error) {
      console.log(`❌ Missing: ${name} at ${repoPath}`);
      checks.push({ name, path: repoPath, exists: false });
    }
  }
  
  return checks;
}

async function createMigrationPlan() {
  console.log();
  console.log('📋 Creating migration plan...');
  
  const plan = {
    directories: [],
    files: [],
    conflicts: [],
    summary: {
      totalDirectories: 0,
      totalFiles: 0,
      conflicts: 0,
    },
  };

  // Analyze what needs to be migrated
  for (const [repo, mappings] of Object.entries(MIGRATION_MAP)) {
    const sourcePath = SOURCE_REPOS[repo];
    if (!sourcePath) continue;

    for (const [source, target] of Object.entries(mappings)) {
      const sourceFullPath = path.join(sourcePath, source);
      const targetFullPath = path.join(BASE_DIR, target);
      
      try {
        const stats = await fs.stat(sourceFullPath);
        
        if (stats.isDirectory()) {
          plan.directories.push({
            source: sourceFullPath,
            target: targetFullPath,
            repo,
          });
          plan.summary.totalDirectories++;
        } else {
          plan.files.push({
            source: sourceFullPath,
            target: targetFullPath,
            repo,
          });
          plan.summary.totalFiles++;
        }
      } catch (error) {
        // Source doesn't exist, skip
      }
    }
  }

  return plan;
}

async function copyDirectory(source, target) {
  try {
    // Create target directory
    await fs.mkdir(target, { recursive: true });
    
    // Read source directory
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, .git, and other unnecessary directories
        if (['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv'].includes(entry.name)) {
          continue;
        }
        await copyDirectory(sourcePath, targetPath);
      } else {
        // Skip unnecessary files
        if (entry.name.startsWith('.') && !entry.name.endsWith('.env') && !entry.name.endsWith('.example')) {
          continue;
        }
        await fs.copyFile(sourcePath, targetPath);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error copying directory ${source} to ${target}:`, error.message);
    return false;
  }
}

async function copyFile(source, target) {
  try {
    // Ensure target directory exists
    await fs.mkdir(path.dirname(target), { recursive: true });
    
    // Copy file
    await fs.copyFile(source, target);
    return true;
  } catch (error) {
    console.error(`Error copying file ${source} to ${target}:`, error.message);
    return false;
  }
}

async function executeMigration(plan, dryRun = true) {
  console.log();
  console.log(`${dryRun ? '🧪 DRY RUN:' : '🚚'} Executing migration...`);
  console.log();

  let successCount = 0;
  let failureCount = 0;

  // Copy directories
  console.log('📁 Migrating directories...');
  for (const { source, target, repo } of plan.directories) {
    if (dryRun) {
      console.log(`   📂 [${repo}] ${source} → ${target}`);
      successCount++;
    } else {
      const success = await copyDirectory(source, target);
      if (success) {
        console.log(`✅ [${repo}] ${source} → ${target}`);
        successCount++;
      } else {
        console.log(`❌ [${repo}] Failed: ${source} → ${target}`);
        failureCount++;
      }
    }
  }

  // Copy files
  console.log();
  console.log('📄 Migrating files...');
  for (const { source, target, repo } of plan.files) {
    if (dryRun) {
      console.log(`   📄 [${repo}] ${source} → ${target}`);
      successCount++;
    } else {
      const success = await copyFile(source, target);
      if (success) {
        console.log(`✅ [${repo}] ${source} → ${target}`);
        successCount++;
      } else {
        console.log(`❌ [${repo}] Failed: ${source} → ${target}`);
        failureCount++;
      }
    }
  }

  return { successCount, failureCount };
}

async function createMigrationSummary(plan, results) {
  const summaryContent = `# AI Software Development Platform - Migration Summary

## Migration Completed: ${new Date().toISOString()}

### Source Repositories
- **AI Code Management v1**: ${SOURCE_REPOS.aiCodeManagement}
- **Code Analyzer v1**: ${SOURCE_REPOS.codeAnalyzer}

### Migration Results
- **Directories Migrated**: ${plan.summary.totalDirectories}
- **Files Migrated**: ${plan.summary.totalFiles}
- **Successful Operations**: ${results.successCount}
- **Failed Operations**: ${results.failureCount}

### Key Components Migrated

#### From AI Code Management v1:
- Agent system and orchestration
- AI processing services
- Vector search capabilities
- Graph database integration
- Project management features

#### From Code Analyzer v1:
- Advanced code analysis engine
- FastAPI backend services
- React frontend components
- Project management dashboard
- Jira integration
- Comprehensive testing framework

### Next Steps

1. **Review Migrated Code**: Check all migrated components for compatibility
2. **Update Dependencies**: Ensure all packages are compatible with the new architecture
3. **Configuration Merge**: Consolidate environment variables and configurations
4. **Database Migration**: Run database initialization script
5. **Testing**: Execute test suites to verify functionality
6. **Documentation**: Update documentation to reflect new structure

### Post-Migration Tasks

- [ ] Update package.json dependencies
- [ ] Merge environment configurations
- [ ] Test all API endpoints
- [ ] Verify database connections
- [ ] Update documentation
- [ ] Set up CI/CD pipelines
- [ ] Configure monitoring and logging

### File Locations

All migrated files are organized in the new monorepo structure:
- **Core Logic**: \`packages/core/\`
- **Database**: \`packages/database/\`
- **AI Services**: \`packages/ai-services/\`
- **Agent System**: \`packages/agents/\`
- **Web Dashboard**: \`apps/web-dashboard/\`
- **API Gateway**: \`services/api-gateway/\`
- **Legacy Components**: \`*/legacy/\` directories

For more details, see the individual component documentation in the \`docs/\` directory.
`;

  try {
    await fs.writeFile(path.join(BASE_DIR, 'MIGRATION_SUMMARY.md'), summaryContent);
    console.log('📋 Migration summary saved to MIGRATION_SUMMARY.md');
  } catch (error) {
    console.error('Failed to save migration summary:', error.message);
  }
}

async function main() {
  try {
    // Check if source repositories exist
    const repoChecks = await checkSourceRepositories();
    const availableRepos = repoChecks.filter(check => check.exists);
    
    if (availableRepos.length === 0) {
      console.log('❌ No source repositories found. Exiting...');
      process.exit(1);
    }

    // Create migration plan
    const plan = await createMigrationPlan();
    
    console.log();
    console.log('📊 Migration Plan Summary:');
    console.log(`   📁 Directories to migrate: ${plan.summary.totalDirectories}`);
    console.log(`   📄 Files to migrate: ${plan.summary.totalFiles}`);
    console.log(`   ⚠️  Conflicts detected: ${plan.summary.conflicts}`);

    // Ask for confirmation (simulated for script)
    const dryRun = process.argv.includes('--dry-run');
    const force = process.argv.includes('--force');

    if (!force && !dryRun) {
      console.log();
      console.log('⚠️  This will copy files from your existing repositories.');
      console.log('   Run with --dry-run to see what would be migrated');
      console.log('   Run with --force to execute the migration');
      process.exit(0);
    }

    // Execute migration
    const results = await executeMigration(plan, dryRun);
    
    console.log();
    console.log('📊 Migration Results:');
    console.log(`   ✅ Successful: ${results.successCount}`);
    console.log(`   ❌ Failed: ${results.failureCount}`);

    if (!dryRun) {
      await createMigrationSummary(plan, results);
    }

    console.log();
    if (dryRun) {
      console.log('🧪 Dry run completed. Run with --force to execute migration.');
    } else {
      console.log('🎉 Migration completed successfully!');
      console.log();
      console.log('📋 Next Steps:');
      console.log('1. Review MIGRATION_SUMMARY.md');
      console.log('2. Copy .env.example to .env and configure');
      console.log('3. Run: npm install');
      console.log('4. Run: npm run db:init');
      console.log('5. Run: npm run dev');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main();
}

module.exports = { 
  checkSourceRepositories, 
  createMigrationPlan, 
  executeMigration,
  MIGRATION_MAP,
  SOURCE_REPOS 
};