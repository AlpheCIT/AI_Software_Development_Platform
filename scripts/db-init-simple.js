#!/usr/bin/env node

/**
 * Simple ArangoDB initialization using HTTP API
 * No external dependencies required
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const config = {
  url: process.env.ARANGO_URL || `http://${process.env.ARANGO_HOST || 'localhost'}:${process.env.ARANGO_PORT || '8529'}`,
  database: process.env.ARANGO_DATABASE,
  username: process.env.ARANGO_USERNAME || 'root',
  password: process.env.ARANGO_PASSWORD || '',
};

function makeRequest(path, method = 'GET', data = null, dbName = '_system') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.url);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: `/_db/${dbName}${url.pathname}${url.search}`,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (config.username || config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      options.headers.Authorization = `Basic ${auth}`;
    }

    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = client.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.errorMessage || responseData}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ raw: responseData });
          } else {
            reject(new Error(`Failed to parse response: ${responseData}`));
          }
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function initializeDatabase() {
  console.log('🚀 AI Software Development Platform - Database Initialization');
  console.log('============================================================');
  console.log(`📍 ArangoDB URL: ${config.url}`);
  console.log(`🗄️  Database: ${config.database}`);
  console.log();

  try {
    // Test connection
    console.log('🔌 Testing connection to ArangoDB...');
    await makeRequest('/_api/version');
    console.log('✅ Connected to ArangoDB successfully');

    // Check if database exists
    console.log(`📚 Checking if database ${config.database} exists...`);
    const databases = await makeRequest('/_api/database');
    
    if (!databases.result.includes(config.database)) {
      console.log(`📚 Creating database: ${config.database}`);
      await makeRequest('/_api/database', 'POST', { name: config.database });
      console.log('✅ Database created successfully');
    } else {
      console.log(`📚 Database ${config.database} already exists`);
    }

    // Define collections to create
    const collections = [
      // Document collections
      { name: 'repositories', type: 2 },
      { name: 'code_files', type: 2 },
      { name: 'code_entities', type: 2 },
      { name: 'ast_nodes', type: 2 },
      { name: 'code_metrics', type: 2 },
      { name: 'security_findings', type: 2 },
      { name: 'embeddings', type: 2 },
      { name: 'stories', type: 2 },
      { name: 'sprints', type: 2 },
      { name: 'system_events', type: 2 },
      
      // Edge collections
      { name: 'relationships', type: 3 },
      { name: 'dependencies', type: 3 },
      { name: 'calls', type: 3 },
      { name: 'imports', type: 3 },
      { name: 'contains', type: 3 },
    ];

    console.log('📋 Creating collections...');
    let created = 0;
    let existed = 0;

    for (const collection of collections) {
      try {
        await makeRequest('/_api/collection', 'POST', collection, config.database);
        console.log(`✅ Created collection: ${collection.name} (${collection.type === 3 ? 'edge' : 'document'})`);
        created++;
      } catch (error) {
        if (error.message.includes('duplicate')) {
          console.log(`⭕ Collection already exists: ${collection.name}`);
          existed++;
        } else {
          console.log(`❌ Failed to create collection ${collection.name}: ${error.message}`);
        }
      }
    }

    // Create some basic indexes
    console.log('🔍 Creating essential indexes...');
    const indexes = [
      { collection: 'repositories', fields: ['url'], unique: true },
      { collection: 'code_files', fields: ['repository_id', 'file_path'], unique: true },
      { collection: 'stories', fields: ['id'], unique: true },
    ];

    let indexesCreated = 0;
    for (const index of indexes) {
      try {
        await makeRequest(`/_api/index?collection=${index.collection}`, 'POST', {
          type: 'hash',
          fields: index.fields,
          unique: index.unique || false,
        }, config.database);
        console.log(`✅ Created index on ${index.collection}: [${index.fields.join(', ')}]`);
        indexesCreated++;
      } catch (error) {
        if (!error.message.includes('duplicate')) {
          console.log(`❌ Failed to create index on ${index.collection}: ${error.message}`);
        }
      }
    }

    console.log();
    console.log('📊 Database Initialization Summary');
    console.log('=====================================');
    console.log(`📋 Collections: ${created} created, ${existed} existed`);
    console.log(`🔍 Indexes: ${indexesCreated} created`);
    console.log();
    console.log('🎉 Database initialization completed successfully!');
    console.log(`🔗 Access ArangoDB Web UI: ${config.url}/_db/${config.database}/_admin/aardvark/index.html`);

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
