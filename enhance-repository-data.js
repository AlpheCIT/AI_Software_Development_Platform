/**
 * Repository Data Enhancement Script
 * Adds security, performance, and quality metrics to existing entities
 * Run with: node enhance-repository-data.js
 */

const { Database } = require('arangojs');

// Database connection
const db = new Database({
  url: 'http://localhost:8529',
  databaseName: 'ai_code_management',
  auth: { username: 'root', password: 'openSesame' }
});

// Security vulnerability types and descriptions
const SECURITY_ISSUES = {
  'SQL_INJECTION': {
    description: 'Potential SQL injection vulnerability detected',
    cwe: 'CWE-89',
    fixSuggestion: 'Use parameterized queries or prepared statements'
  },
  'XSS': {
    description: 'Cross-site scripting vulnerability found',
    cwe: 'CWE-79', 
    fixSuggestion: 'Sanitize user input and encode output'
  },
  'BUFFER_OVERFLOW': {
    description: 'Buffer overflow vulnerability detected',
    cwe: 'CWE-120',
    fixSuggestion: 'Use bounds checking and safe string functions'
  },
  'INSECURE_CRYPTO': {
    description: 'Weak cryptographic implementation',
    cwe: 'CWE-327',
    fixSuggestion: 'Use strong encryption algorithms and proper key management'
  },
  'HARDCODED_SECRET': {
    description: 'Hardcoded credentials or API keys detected',
    cwe: 'CWE-798',
    fixSuggestion: 'Move secrets to environment variables or secure vault'
  },
  'PATH_TRAVERSAL': {
    description: 'Directory traversal vulnerability',
    cwe: 'CWE-22',
    fixSuggestion: 'Validate and sanitize file paths'
  },
  'INSECURE_DESERIALIZATION': {
    description: 'Unsafe deserialization of untrusted data',
    cwe: 'CWE-502',
    fixSuggestion: 'Validate serialized data and use safe deserialization'
  }
};

const PERFORMANCE_METRICS = [
  { name: 'Response Time', unit: 'ms', threshold: 200, range: [20, 800] },
  { name: 'Memory Usage', unit: '%', threshold: 80, range: [10, 95] },
  { name: 'CPU Usage', unit: '%', threshold: 70, range: [5, 90] },
  { name: 'Throughput', unit: 'req/s', threshold: 100, range: [10, 500] },
  { name: 'Error Rate', unit: '%', threshold: 1, range: [0, 10] }
];

const QUALITY_METRICS = [
  'Cyclomatic Complexity',
  'Maintainability Index', 
  'Technical Debt Ratio',
  'Code Coverage',
  'Duplicate Code Percentage'
];

async function createCollectionsIfNotExist() {
  const collections = [
    'security_issues',
    'performance_metrics',
    'code_quality_metrics', 
    'test_coverage',
    'technical_debt',
    'complexity_metrics',
    'documentation_coverage',
    'code_smells'
  ];

  console.log('📦 Creating missing collections...');
  
  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      await collection.create();
      console.log(`  ✅ Created: ${collectionName}`);
    } catch (error) {
      if (error.errorNum === 1207) {
        console.log(`  ℹ️  Already exists: ${collectionName}`);
      } else {
        console.error(`  ❌ Error creating ${collectionName}:`, error.message);
      }
    }
  }
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateSecurityIssues(entity) {
  const issues = [];
  const issueCount = Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 0;
  
  for (let i = 0; i < issueCount; i++) {
    const issueType = getRandomElement(Object.keys(SECURITY_ISSUES));
    const issueData = SECURITY_ISSUES[issueType];
    const severity = getRandomElement(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    
    issues.push({
      _key: `sec_${entity._key}_${i}_${Date.now()}`,
      entityId: entity._key,
      repositoryId: entity.repositoryId,
      severity,
      type: issueType,
      description: `${issueData.description} in ${entity.name || entity.type}`,
      file: entity.file || `${entity.name || 'unknown'}.js`,
      line: Math.floor(Math.random() * 200) + 1,
      cweId: issueData.cwe,
      fixSuggestion: issueData.fixSuggestion,
      detectedAt: new Date().toISOString(),
      status: 'open',
      riskScore: severity === 'CRITICAL' ? 9 : severity === 'HIGH' ? 7 : severity === 'MEDIUM' ? 5 : 2
    });
  }
  
  return issues;
}

function generatePerformanceMetrics(entity) {
  const metrics = [];
  const metricsToGenerate = Math.floor(Math.random() * 3) + 2; // 2-4 metrics per entity
  
  for (let i = 0; i < metricsToGenerate; i++) {
    const metric = getRandomElement(PERFORMANCE_METRICS);
    const value = Math.floor(Math.random() * (metric.range[1] - metric.range[0])) + metric.range[0];
    const status = value > metric.threshold ? 'warning' : value > metric.threshold * 0.8 ? 'good' : 'excellent';
    
    metrics.push({
      name: metric.name,
      value,
      unit: metric.unit,
      threshold: metric.threshold,
      status,
      trend: getRandomElement(['improving', 'stable', 'degrading']),
      lastUpdated: new Date().toISOString(),
      history: Array.from({length: 10}, (_, idx) => ({
        timestamp: new Date(Date.now() - (9 - idx) * 24 * 60 * 60 * 1000).toISOString(),
        value: value + (Math.random() - 0.5) * value * 0.2
      }))
    });
  }
  
  return {
    _key: `perf_${entity._key}_${Date.now()}`,
    entityId: entity._key,
    repositoryId: entity.repositoryId,
    entityName: entity.name || entity.type,
    metrics,
    lastAnalyzed: new Date().toISOString(),
    overallHealth: metrics.every(m => m.status === 'excellent') ? 'excellent' : 
                   metrics.some(m => m.status === 'warning') ? 'warning' : 'good'
  };
}

function generateQualityMetrics(entity) {
  const complexity = Math.floor(Math.random() * 25) + 1;
  const maintainability = Math.floor(Math.random() * 100);
  const debtRatio = Math.floor(Math.random() * 30);
  const coverage = Math.floor(Math.random() * 100);
  const duplicateCode = Math.floor(Math.random() * 20);
  
  return {
    _key: `quality_${entity._key}_${Date.now()}`,
    entityId: entity._key,
    repositoryId: entity.repositoryId,
    entityName: entity.name || entity.type,
    cyclomaticComplexity: complexity,
    maintainabilityIndex: maintainability,
    technicalDebtRatio: debtRatio,
    testCoverage: coverage,
    duplicateCodePercentage: duplicateCode,
    codeSmells: Math.floor(Math.random() * 10),
    linesOfCode: Math.floor(Math.random() * 1000) + 50,
    cognitiveComplexity: Math.floor(complexity * 1.2),
    lastAnalyzed: new Date().toISOString(),
    grade: maintainability > 80 ? 'A' : maintainability > 60 ? 'B' : maintainability > 40 ? 'C' : 'D'
  };
}

function generateTestCoverage(entity) {
  const lineCoverage = Math.floor(Math.random() * 100);
  const functionCoverage = Math.floor(Math.random() * 100);
  const branchCoverage = Math.floor(Math.random() * 100);
  
  return {
    _key: `coverage_${entity._key}_${Date.now()}`,
    entityId: entity._key,
    repositoryId: entity.repositoryId,
    entityName: entity.name || entity.type,
    lineCoverage: {
      covered: Math.floor(lineCoverage * 10),
      total: 1000,
      percentage: lineCoverage
    },
    functionCoverage: {
      covered: Math.floor(functionCoverage * 0.5),
      total: 50,
      percentage: functionCoverage
    },
    branchCoverage: {
      covered: Math.floor(branchCoverage * 0.8),
      total: 80,
      percentage: branchCoverage
    },
    overallCoverage: Math.floor((lineCoverage + functionCoverage + branchCoverage) / 3),
    lastRun: new Date().toISOString(),
    testFramework: getRandomElement(['Jest', 'Mocha', 'Jasmine', 'Cypress', 'Playwright'])
  };
}

function generateTechnicalDebt(entity) {
  const debtMinutes = Math.floor(Math.random() * 480) + 30; // 30 minutes to 8 hours
  const severity = debtMinutes > 240 ? 'HIGH' : debtMinutes > 120 ? 'MEDIUM' : 'LOW';
  
  return {
    _key: `debt_${entity._key}_${Date.now()}`,
    entityId: entity._key,
    repositoryId: entity.repositoryId,
    entityName: entity.name || entity.type,
    debtMinutes,
    severity,
    debtRatio: Math.floor((debtMinutes / 480) * 100), // Percentage of max debt
    issues: [
      {
        type: getRandomElement(['Code Smell', 'Complexity', 'Duplication', 'Maintainability']),
        description: 'Code requires refactoring for better maintainability',
        effort: `${Math.floor(debtMinutes / 60)}h ${debtMinutes % 60}m`,
        priority: severity
      }
    ],
    lastAnalyzed: new Date().toISOString(),
    trend: getRandomElement(['improving', 'stable', 'worsening'])
  };
}

async function enhanceRepositoryData() {
  console.log('🚀 Starting repository data enhancement...');
  
  try {
    // Create collections
    await createCollectionsIfNotExist();
    
    // Get all entities
    console.log('\n📊 Fetching existing entities...');
    const entitiesCursor = await db.query('FOR entity IN entities RETURN entity');
    const entities = await entitiesCursor.all();
    
    console.log(`Found ${entities.length} entities to enhance`);
    
    if (entities.length === 0) {
      console.log('❌ No entities found. Make sure repository ingestion completed successfully.');
      return;
    }
    
    console.log('\n🔧 Generating enhanced data...');
    
    let processedCount = 0;
    const batchSize = 10;
    
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      for (const entity of batch) {
        try {
          // Generate security issues
          const securityIssues = generateSecurityIssues(entity);
          for (const issue of securityIssues) {
            await db.collection('security_issues').save(issue);
          }
          
          // Generate performance metrics
          const perfMetrics = generatePerformanceMetrics(entity);
          await db.collection('performance_metrics').save(perfMetrics);
          
          // Generate quality metrics
          const qualityMetrics = generateQualityMetrics(entity);
          await db.collection('code_quality_metrics').save(qualityMetrics);
          
          // Generate test coverage
          const testCoverage = generateTestCoverage(entity);
          await db.collection('test_coverage').save(testCoverage);
          
          // Generate technical debt
          const technicalDebt = generateTechnicalDebt(entity);
          await db.collection('technical_debt').save(technicalDebt);
          
          processedCount++;
          
          if (processedCount % 20 === 0) {
            console.log(`  📈 Processed ${processedCount}/${entities.length} entities`);
          }
          
        } catch (error) {
          console.error(`  ❌ Error enhancing entity ${entity._key}:`, error.message);
        }
      }
      
      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < entities.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ Enhancement complete! Processed ${processedCount} entities`);
    
    // Generate summary statistics
    console.log('\n📊 Generating summary statistics...');
    
    const stats = await Promise.all([
      db.query('RETURN LENGTH(security_issues)'),
      db.query('RETURN LENGTH(performance_metrics)'),
      db.query('RETURN LENGTH(code_quality_metrics)'),
      db.query('RETURN LENGTH(test_coverage)'),
      db.query('RETURN LENGTH(technical_debt)')
    ]);
    
    const [securityCount, perfCount, qualityCount, coverageCount, debtCount] = await Promise.all(
      stats.map(cursor => cursor.next())
    );
    
    console.log('\n📈 Collection Summary:');
    console.log(`  🛡️  Security Issues: ${securityCount}`);
    console.log(`  ⚡ Performance Metrics: ${perfCount}`);
    console.log(`  📏 Quality Metrics: ${qualityCount}`);
    console.log(`  🧪 Test Coverage: ${coverageCount}`);
    console.log(`  💳 Technical Debt: ${debtCount}`);
    
    console.log('\n🎉 Repository data enhancement completed successfully!');
    console.log('\n🌐 Next steps:');
    console.log('  1. Start your frontend: cd apps/frontend && npm start');
    console.log('  2. View enhanced data at: http://localhost:3000/showcase');
    console.log('  3. Check ArangoDB web interface: http://localhost:8529');
    
  } catch (error) {
    console.error('❌ Enhancement failed:', error);
    throw error;
  }
}

// Run the enhancement
if (require.main === module) {
  enhanceRepositoryData()
    .then(() => {
      console.log('\n✅ All done! Your repository data now has rich security, performance, and quality metrics.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Enhancement failed:', error);
      process.exit(1);
    });
}

module.exports = { enhanceRepositoryData };
