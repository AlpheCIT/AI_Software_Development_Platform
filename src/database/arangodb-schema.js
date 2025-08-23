/**
 * ArangoDB Schema Definition for AI Software Development Platform
 * 
 * This file defines the complete database schema including:
 * - Document collections (nodes)
 * - Edge collections (relationships)
 * - Indexes for performance optimization
 * - Constraints and validation rules
 */

const { Database } = require('arangojs');

// Database configuration with environment-based defaults
function getDBConfig() {
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV;
  const defaultPort = isDev ? '8529' : '8529';
  const defaultPassword = isDev ? 'rootpassword' : 'openSesame';
  
  return {
    url: process.env.ARANGO_URL || `http://localhost:${defaultPort}`,
    databaseName: process.env.ARANGO_DATABASE || 'ai_code_management',
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || defaultPassword,
    isDev: isDev
  };
}

// Document Collections (Vertices/Nodes)
const DOCUMENT_COLLECTIONS = [
  // Core entities
  'repositories',
  'files',
  'functions',
  'classes',
  'modules',
  'packages',
  'variables',
  'constants',
  
  // Business logic entities
  'business_processes',
  'business_rules',
  'business_logic',
  
  // AI-generated insights
  'ai_insights',
  'ai_descriptions',
  'ai_interactions',
  'ai_function_analysis',
  
  // Security entities
  'security_findings',
  'vulnerabilities',
  'secrets_detected',
  'compliance_requirements',
  'compliance_findings',
  
  // Performance entities
  'performance_profiles',
  'performance_predictions',
  'resource_usage',
  'memory_patterns',
  'io_operations',
  
  // Architecture entities
  'architecture_insights',
  'architecture_layers',
  'service_boundaries',
  'entry_points',
  'scaling_analysis',
  
  // Quality and metrics
  'code_entities',
  'code_metrics',
  'code_smells',
  'code_ownership',
  'quality_trends',
  
  // Analysis results
  'complexity_analysis',
  'hotspot_analysis',
  'trend_analysis',
  'risk_assessment',
  'critical_paths',
  'impact_analysis',
  'coupling_analysis',
  'bottleneck_prediction',
  
  // Development and maintenance
  'development_velocity',
  'maintenance_forecasting',
  'optimization_recommendations',
  'migration_analysis',
  'test_coverage',
  'error_patterns',
  
  // Learning and context
  'learning_analytics',
  'domain_expertise',
  'agent_contexts',
  'agent_decisions',
  'context_retrieval',
  'confidence_scoring',
  'recommendation_engine',
  
  // Dimensional entities
  'dim_users',
  'dim_tenants',
  'dim_repos',
  'dim_modules',
  'dim_layers',
  'dim_branches',
  
  // Documentation and embeddings
  'embeddings',
  'documentation',
  'api_contracts',
  'traversal_paths',
  'event_flows',
  'layer_violations',
  'design_patterns',
  'database_operations'
];

// Edge Collections (Relationships)
const EDGE_COLLECTIONS = [
  // Core dependency relationships
  'depends_on',           // 69510 - Primary dependency relationships
  'imports',              // 40209 - Import/include relationships
  'doc_dependencies',     // 36573 - Documentation dependencies
  'function_definitions', // 18653 - Function definition relationships
  'dependencies',         // 7671 - General dependencies
  
  // Documentation and AI relationships
  'doc_embeddings',       // 4320 - Document embedding relationships
  'doc_business_logic',   // 2160 - Business logic documentation
  'doc_complexity_analysis', // 2160 - Complexity analysis docs
  'code_entities',        // 2160 - Code entity relationships
  'doc_ai_descriptions',  // 2160 - AI-generated descriptions
  'doc_performance_prediction', // 2160 - Performance predictions
  'doc_performance_profiles',   // 2160 - Performance profiles
  
  // Security and quality relationships
  'doc_security_findings',      // 1434 - Security findings
  'doc_resource_usage',         // 1145 - Resource usage patterns
  'doc_business_processes',     // 469 - Business process docs
  'doc_database_operations',    // 204 - Database operation docs
  
  // AI and analysis relationships
  'doc_agent_contexts',         // 57 - Agent context relationships
  'doc_risk_assessment',        // 50 - Risk assessment docs
  'doc_critical_paths',         // 50 - Critical path analysis
  'doc_hotspot_analysis',       // 50 - Code hotspot analysis
  'doc_trend_analysis',         // 50 - Trend analysis docs
  'doc_io_operations',          // 39 - I/O operation docs
  'doc_event_flows',            // 29 - Event flow documentation
  'doc_ai_insights',            // 18 - AI-generated insights
  'doc_ai_function_analysis',   // 10 - AI function analysis
  'doc_service_boundaries',     // 9 - Service boundary docs
  'doc_architecture_insights',  // 7 - Architecture insights
  'doc_entry_points',           // 3 - Entry point documentation
  'doc_scaling_analysis',       // 2 - Scaling analysis docs
  
  // Extended relationship types (currently unused but defined for future use)
  'edge_loops',
  'edge_refactored_from',
  'edge_references',
  'edge_security_affects',
  'edge_similar_to',
  'edge_tested_by',
  'edge_reads',
  'edge_precedes',
  'edge_owned_by',
  'edge_modifies_over_time',
  'edge_modifies',
  'generated_by',
  'edge_imports',
  'edge_implements',
  'edge_generated_by',
  'edge_extends',
  'edge_duplicates',
  'edge_data_flows',
  'edge_controls',
  'edge_contains',
  'edge_catches',
  'subscribes_to',
  'reads',
  'reads_from',
  'refactored_from',
  'references',
  'replaces',
  'routes_to',
  'security_affects',
  'similar_to',
  'publishes_to',
  'tested_by',
  'throws',
  'transforms',
  'triggers',
  'uses',
  'uses_package',
  'validates',
  'edge_throws',
  'precedes',
  'persists_to',
  'packages',
  'package_depends',
  'owned_by',
  'modifies_over_time',
  'modifies',
  'loops',
  'invokes',
  'inherits',
  'implements',
  'flows_to',
  'extends',
  'edge_triggers',
  'dim_repos',
  'data_flows',
  'controls',
  'contains',
  'competes_with',
  'code_relationships',
  'catches',
  'calls',
  'branches',
  'authorizes',
  'authenticates_with',
  'edge_branches',
  'duplicates',
  'affects',
  'edge_calls',
  
  // Additional documentation relationships
  'doc_quality_trends',
  'doc_compliance_findings',
  'doc_code_smells',
  'doc_code_ownership',
  'doc_code_metrics',
  'doc_code_entities',
  'doc_business_rules',
  'doc_bottleneck_prediction',
  'doc_architecture_layers',
  'doc_api_contracts',
  'doc_ai_interactions',
  'doc_agent_decisions',
  'doc_compliance_requirements',
  'doc_layer_violations',
  'doc_traversal_paths',
  'doc_test_coverage',
  'doc_security_prediction',
  'doc_secrets_detected',
  'doc_recommendation_engine',
  'doc_optimization_recommendations',
  'doc_migration_analysis',
  'doc_memory_patterns',
  'doc_maintenance_forecasting',
  'doc_learning_analytics',
  'doc_imports',
  'doc_impact_analysis',
  'doc_function_calls',
  'doc_files',
  'doc_error_patterns',
  'doc_domain_expertise',
  'doc_development_velocity',
  'doc_design_patterns',
  'doc_dependency_packages',
  'doc_data_flows',
  'doc_coupling_analysis',
  'doc_context_retrieval',
  'doc_confidence_scoring'
];

// Index definitions for performance optimization
const INDEX_DEFINITIONS = [
  // Document collection indexes
  {
    collection: 'repositories',
    indexes: [
      { fields: ['name'], type: 'hash' },
      { fields: ['url'], type: 'hash' },
      { fields: ['language'], type: 'hash' },
      { fields: ['created_at'], type: 'skiplist' },
      { fields: ['updated_at'], type: 'skiplist' }
    ]
  },
  {
    collection: 'files',
    indexes: [
      { fields: ['path'], type: 'hash' },
      { fields: ['repository_id'], type: 'hash' },
      { fields: ['file_type'], type: 'hash' },
      { fields: ['size'], type: 'skiplist' },
      { fields: ['last_modified'], type: 'skiplist' }
    ]
  },
  {
    collection: 'functions',
    indexes: [
      { fields: ['name'], type: 'hash' },
      { fields: ['file_id'], type: 'hash' },
      { fields: ['complexity_score'], type: 'skiplist' },
      { fields: ['line_count'], type: 'skiplist' }
    ]
  },
  {
    collection: 'security_findings',
    indexes: [
      { fields: ['severity'], type: 'hash' },
      { fields: ['type'], type: 'hash' },
      { fields: ['repository_id'], type: 'hash' },
      { fields: ['discovered_at'], type: 'skiplist' }
    ]
  },
  {
    collection: 'performance_profiles',
    indexes: [
      { fields: ['entity_type'], type: 'hash' },
      { fields: ['performance_score'], type: 'skiplist' },
      { fields: ['measured_at'], type: 'skiplist' }
    ]
  },
  
  // Edge collection indexes
  {
    collection: 'depends_on',
    indexes: [
      { fields: ['_from'], type: 'hash' },
      { fields: ['_to'], type: 'hash' },
      { fields: ['dependency_type'], type: 'hash' },
      { fields: ['strength'], type: 'skiplist' }
    ]
  },
  {
    collection: 'imports',
    indexes: [
      { fields: ['_from'], type: 'hash' },
      { fields: ['_to'], type: 'hash' },
      { fields: ['import_type'], type: 'hash' }
    ]
  }
];

// Validation schemas using ArangoDB Foxx
const VALIDATION_SCHEMAS = {
  repositories: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      url: { type: 'string', format: 'uri' },
      language: { type: 'string' },
      description: { type: 'string' },
      stars: { type: 'integer', minimum: 0 },
      forks: { type: 'integer', minimum: 0 },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' }
    },
    required: ['name', 'url']
  },
  
  security_findings: {
    type: 'object',
    properties: {
      severity: { 
        type: 'string', 
        enum: ['critical', 'high', 'medium', 'low', 'info'] 
      },
      type: { type: 'string' },
      description: { type: 'string' },
      file_path: { type: 'string' },
      line_number: { type: 'integer', minimum: 1 },
      discovered_at: { type: 'string', format: 'date-time' },
      resolved: { type: 'boolean', default: false }
    },
    required: ['severity', 'type', 'description']
  }
};

/**
 * Initialize the ArangoDB database with complete schema
 */
async function initializeDatabase() {
  const config = getDBConfig();
  
  try {
    console.log(`🌍 Environment: ${config.isDev ? 'Development' : 'Production'}`);
    console.log(`🔗 Connecting to: ${config.url}`);
    console.log(`🗄️  Target database: ${config.databaseName}`);
    
    // First connect to _system database to create target database
    const systemDb = new Database({
      url: config.url,
      databaseName: '_system',
      auth: {
        username: config.username,
        password: config.password
      }
    });
    
    // Create database if it doesn't exist
    const databases = await systemDb.listDatabases();
    if (!databases.includes(config.databaseName)) {
      await systemDb.createDatabase(config.databaseName);
      console.log(`✅ Created database: ${config.databaseName}`);
    } else {
      console.log(`✅ Database ${config.databaseName} already exists`);
    }
    
    // Now connect to the target database for schema operations
    const db = new Database({
      url: config.url,
      databaseName: config.databaseName,
      auth: {
        username: config.username,
        password: config.password
      }
    });
    
    // Create document collections
    console.log('📁 Creating document collections...');
    for (const collectionName of DOCUMENT_COLLECTIONS) {
      const collection = db.collection(collectionName);
      if (!(await collection.exists())) {
        await collection.create();
        console.log(`  ✅ Created collection: ${collectionName}`);
      } else {
        console.log(`  ✓ Collection exists: ${collectionName}`);
      }
    }
    
    // Create edge collections
    console.log('🔗 Creating edge collections...');
    for (const collectionName of EDGE_COLLECTIONS) {
      const collection = db.collection(collectionName);
      if (!(await collection.exists())) {
        await collection.create({ type: 3 }); // type: 3 indicates edge collection
        console.log(`  ✅ Created edge collection: ${collectionName}`);
      } else {
        console.log(`  ✓ Edge collection exists: ${collectionName}`);
      }
    }
    
    // Create indexes
    console.log('📊 Creating indexes...');
    for (const indexDef of INDEX_DEFINITIONS) {
      const collection = db.collection(indexDef.collection);
      for (const index of indexDef.indexes) {
        try {
          await collection.ensureIndex(index);
          console.log(`  ✅ Created index on ${indexDef.collection}.${index.fields.join(',')}`);
        } catch (error) {
          console.warn(`  ⚠️  Index already exists: ${indexDef.collection}.${index.fields.join(',')}`);
        }
      }
    }
    
    // Create graphs for efficient traversal
    console.log('🕸️  Creating named graphs...');
    const graphs = [
      {
        name: 'code_dependency_graph',
        edgeDefinitions: [
          {
            collection: 'depends_on',
            from: ['files', 'functions', 'classes', 'modules'],
            to: ['files', 'functions', 'classes', 'modules']
          },
          {
            collection: 'imports',
            from: ['files', 'modules'],
            to: ['files', 'modules', 'packages']
          }
        ]
      },
      {
        name: 'security_graph',
        edgeDefinitions: [
          {
            collection: 'doc_security_findings',
            from: ['security_findings'],
            to: ['files', 'functions', 'classes']
          },
          {
            collection: 'edge_security_affects',
            from: ['security_findings'],
            to: ['files', 'functions', 'repositories']
          }
        ]
      },
      {
        name: 'ai_analysis_graph',
        edgeDefinitions: [
          {
            collection: 'doc_ai_insights',
            from: ['ai_insights'],
            to: ['files', 'functions', 'classes', 'repositories']
          },
          {
            collection: 'doc_ai_function_analysis',
            from: ['ai_function_analysis'],
            to: ['functions', 'classes']
          }
        ]
      }
    ];
    
    for (const graphDef of graphs) {
      try {
        const graph = db.graph(graphDef.name);
        if (!(await graph.exists())) {
          await graph.create(graphDef.edgeDefinitions);
          console.log(`  ✅ Created graph: ${graphDef.name}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Graph already exists: ${graphDef.name}`);
      }
    }
    
    console.log('🎉 Database initialization completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Create initial data for testing (no mock data - real structure only)
 */
async function seedDatabase() {
  const config = getDBConfig();
  const db = new Database({
    url: config.url,
    databaseName: config.databaseName,
    auth: {
      username: config.username,
      password: config.password
    }
  });
  
  try {
    console.log('🌱 Seeding database with initial structure...');
    
    // Create system configuration document
    const configCollection = db.collection('system_config');
    if (!(await configCollection.exists())) {
      await configCollection.create();
    }
    
    await configCollection.save({
      _key: 'main',
      version: '2.0.0',
      initialized_at: new Date().toISOString(),
      schema_version: '1.0.0',
      features: {
        ai_analysis: true,
        security_scanning: true,
        performance_monitoring: true,
        dependency_tracking: true,
        real_time_updates: true
      }
    });
    
    console.log('✅ Database seeding completed!');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

/**
 * Drop and recreate the entire database (use with caution!)
 */
async function resetDatabase() {
  const config = getDBConfig();
  const systemDb = new Database({
    url: config.url,
    databaseName: '_system',
    auth: {
      username: config.username,
      password: config.password
    }
  });
  
  try {
    const databases = await systemDb.listDatabases();
    if (databases.includes(config.databaseName)) {
      await systemDb.dropDatabase(config.databaseName);
      console.log(`🗑️  Dropped database: ${config.databaseName}`);
    }
    
    await initializeDatabase();
    await seedDatabase();
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

module.exports = {
  getDBConfig,
  DOCUMENT_COLLECTIONS,
  EDGE_COLLECTIONS,
  INDEX_DEFINITIONS,
  VALIDATION_SCHEMAS,
  initializeDatabase,
  seedDatabase,
  resetDatabase
};
