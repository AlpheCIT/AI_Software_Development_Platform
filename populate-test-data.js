/**
 * Populate ArangoDB Collections with Sample Data
 * Creates test data for frontend graph visualization
 */

const { Database } = require('arangojs');

// Database configuration
const db = new Database({
  url: process.env.ARANGO_URL || 'http://localhost:8529',
  databaseName: process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB',
  auth: {
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || 'openSesame'
  }
});

async function populateTestData() {
  try {
    console.log('🔧 Populating ArangoDB with test data...');
    console.log('🗄️  Database:', process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB');
    
    // Test connection
    await db.version();
    console.log('✅ Connected to ArangoDB');
    
    // Get collection references
    const codeEntities = db.collection('code_entities');
    const relationships = db.collection('relationships');
    const repositories = db.collection('repositories');
    const securityFindings = db.collection('security_findings');
    const codeMetrics = db.collection('code_metrics');
    
    // Sample code entities (nodes for the graph)
    const sampleEntities = [
      {
        _key: 'user-service',
        name: 'User Service',
        type: 'service',
        layer: 'backend',
        repository: 'main-app',
        language: 'typescript',
        lines: 1250,
        complexity: 15,
        coverage: 0.75,
        description: 'User management and authentication service',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'auth-service',
        name: 'Authentication Service',
        type: 'service',
        layer: 'backend',
        repository: 'main-app',
        language: 'typescript',
        lines: 800,
        complexity: 12,
        coverage: 0.85,
        description: 'JWT token authentication and authorization',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'user-api',
        name: 'User API',
        type: 'api',
        layer: 'backend',
        repository: 'main-app',
        language: 'typescript',
        lines: 600,
        complexity: 8,
        coverage: 0.70,
        description: 'REST API endpoints for user operations',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'users-database',
        name: 'Users Database',
        type: 'database',
        layer: 'infra',
        repository: 'main-app',
        language: 'sql',
        lines: 200,
        complexity: 5,
        coverage: 0.90,
        description: 'PostgreSQL database for user data',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'redis-cache',
        name: 'Redis Cache',
        type: 'cache',
        layer: 'infra',
        repository: 'main-app',
        language: 'redis',
        lines: 50,
        complexity: 2,
        coverage: 0.60,
        description: 'Redis caching layer for session management',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'frontend-app',
        name: 'Frontend Application',
        type: 'frontend',
        layer: 'frontend',
        repository: 'main-app',
        language: 'react',
        lines: 2500,
        complexity: 25,
        coverage: 0.65,
        description: 'React frontend application',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'payment-service',
        name: 'Payment Service',
        type: 'service',
        layer: 'backend',
        repository: 'main-app',
        language: 'typescript',
        lines: 950,
        complexity: 18,
        coverage: 0.80,
        description: 'Payment processing and billing service',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'notification-service',
        name: 'Notification Service',
        type: 'service',
        layer: 'backend',
        repository: 'main-app',
        language: 'typescript',
        lines: 400,
        complexity: 6,
        coverage: 0.75,
        description: 'Email and push notification service',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'api-gateway',
        name: 'API Gateway',
        type: 'gateway',
        layer: 'backend',
        repository: 'main-app',
        language: 'typescript',
        lines: 300,
        complexity: 10,
        coverage: 0.85,
        description: 'Main API gateway and load balancer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        _key: 'analytics-service',
        name: 'Analytics Service',
        type: 'service',
        layer: 'backend',
        repository: 'main-app',
        language: 'python',
        lines: 1800,
        complexity: 22,
        coverage: 0.70,
        description: 'Data analytics and reporting service',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Sample relationships (edges for the graph)
    const sampleRelationships = [
      {
        _key: 'rel-001',
        _from: 'code_entities/user-service',
        _to: 'code_entities/auth-service',
        type: 'depends_on',
        label: 'authentication',
        weight: 0.8,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-002',
        _from: 'code_entities/user-service',
        _to: 'code_entities/users-database',
        type: 'queries',
        label: 'user data',
        weight: 0.9,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-003',
        _from: 'code_entities/user-api',
        _to: 'code_entities/user-service',
        type: 'calls',
        label: 'business logic',
        weight: 0.95,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-004',
        _from: 'code_entities/frontend-app',
        _to: 'code_entities/user-api',
        type: 'http_requests',
        label: 'REST API',
        weight: 0.7,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-005',
        _from: 'code_entities/user-service',
        _to: 'code_entities/redis-cache',
        type: 'caches',
        label: 'session data',
        weight: 0.6,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-006',
        _from: 'code_entities/payment-service',
        _to: 'code_entities/user-service',
        type: 'depends_on',
        label: 'user validation',
        weight: 0.75,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-007',
        _from: 'code_entities/notification-service',
        _to: 'code_entities/user-service',
        type: 'notifies',
        label: 'user events',
        weight: 0.5,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-008',
        _from: 'code_entities/api-gateway',
        _to: 'code_entities/user-api',
        type: 'routes',
        label: 'traffic routing',
        weight: 0.85,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-009',
        _from: 'code_entities/api-gateway',
        _to: 'code_entities/payment-service',
        type: 'routes',
        label: 'payment requests',
        weight: 0.8,
        created_at: new Date().toISOString()
      },
      {
        _key: 'rel-010',
        _from: 'code_entities/analytics-service',
        _to: 'code_entities/users-database',
        type: 'analyzes',
        label: 'user behavior',
        weight: 0.6,
        created_at: new Date().toISOString()
      }
    ];

    // Sample security findings
    const sampleSecurityFindings = [
      {
        _key: 'sec-001',
        repository_id: 'repositories/4311',
        entity_id: 'code_entities/user-service',
        severity: 'HIGH',
        type: 'SQL_INJECTION',
        title: 'Potential SQL Injection Vulnerability',
        description: 'User input not properly sanitized in query builder',
        file: 'src/services/user.service.ts',
        line: 142,
        cwe_id: 'CWE-89',
        discovered_at: new Date().toISOString(),
        status: 'open'
      },
      {
        _key: 'sec-002',
        repository_id: 'repositories/4311',
        entity_id: 'code_entities/auth-service',
        severity: 'MEDIUM',
        type: 'WEAK_CRYPTO',
        title: 'Weak Cryptographic Algorithm',
        description: 'Using MD5 for password hashing instead of bcrypt',
        file: 'src/auth/hash.service.ts',
        line: 28,
        cwe_id: 'CWE-327',
        discovered_at: new Date().toISOString(),
        status: 'open'
      },
      {
        _key: 'sec-003',
        repository_id: 'repositories/4311',
        entity_id: 'code_entities/payment-service',
        severity: 'CRITICAL',
        type: 'HARDCODED_SECRET',
        title: 'Hardcoded API Key',
        description: 'Payment gateway API key hardcoded in source code',
        file: 'src/payment/gateway.service.ts',
        line: 15,
        cwe_id: 'CWE-798',
        discovered_at: new Date().toISOString(),
        status: 'open'
      }
    ];

    // Sample code metrics
    const sampleCodeMetrics = [
      {
        _key: 'metric-001',
        entity_id: 'code_entities/user-service',
        metric_type: 'complexity',
        value: 15,
        threshold: 10,
        status: 'warning',
        measured_at: new Date().toISOString()
      },
      {
        _key: 'metric-002',
        entity_id: 'code_entities/user-service',
        metric_type: 'coverage',
        value: 75,
        threshold: 80,
        status: 'warning',
        measured_at: new Date().toISOString()
      },
      {
        _key: 'metric-003',
        entity_id: 'code_entities/payment-service',
        metric_type: 'performance',
        value: 250,
        threshold: 200,
        status: 'warning',
        measured_at: new Date().toISOString()
      }
    ];

    // Insert data into collections
    console.log('📊 Inserting code entities...');
    const entitiesResult = await codeEntities.saveAll(sampleEntities);
    console.log(`✅ Inserted ${entitiesResult.length} code entities`);

    console.log('🔗 Inserting relationships...');
    const relationshipsResult = await relationships.saveAll(sampleRelationships);
    console.log(`✅ Inserted ${relationshipsResult.length} relationships`);

    console.log('🛡️  Inserting security findings...');
    const securityResult = await securityFindings.saveAll(sampleSecurityFindings);
    console.log(`✅ Inserted ${securityResult.length} security findings`);

    console.log('📈 Inserting code metrics...');
    const metricsResult = await codeMetrics.saveAll(sampleCodeMetrics);
    console.log(`✅ Inserted ${metricsResult.length} code metrics`);

    // Summary
    console.log('\n🎉 Sample data population complete!');
    console.log(`📊 Total entities: ${entitiesResult.length}`);
    console.log(`🔗 Total relationships: ${relationshipsResult.length}`);
    console.log(`🛡️  Total security findings: ${securityResult.length}`);
    console.log(`📈 Total metrics: ${metricsResult.length}`);
    console.log('\n🚀 Frontend can now visualize real graph data!');
    
  } catch (error) {
    console.error('❌ Error populating test data:', error);
    throw error;
  }
}

// Run the population script
if (require.main === module) {
  populateTestData()
    .then(() => {
      console.log('✅ Data population completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Data population failed:', error);
      process.exit(1);
    });
}

module.exports = { populateTestData };
