/**
 * Database Verification Script
 * Checks what data exists in your ArangoDB collections
 * Run with: node verify-database-data.js
 */

const { Database } = require('arangojs');

// Database connection
const db = new Database({
  url: 'http://localhost:8529',
  databaseName: 'ai_code_management',
  auth: { username: 'root', password: 'openSesame' }
});

async function checkCollectionExists(name) {
  try {
    const collection = db.collection(name);
    const info = await collection.get();
    const count = await collection.count();
    return { exists: true, count: count.count, status: info.status };
  } catch (error) {
    return { exists: false, count: 0, error: error.message };
  }
}

async function getSampleData(collectionName, limit = 3) {
  try {
    const cursor = await db.query(`
      FOR doc IN ${collectionName}
      LIMIT ${limit}
      RETURN doc
    `);
    return await cursor.all();
  } catch (error) {
    return [];
  }
}

async function verifyDatabaseData() {
  console.log('🔍 AI Code Management Database Verification\n');
  
  try {
    // Check database connection
    console.log('📡 Testing database connection...');
    const version = await db.version();
    console.log(`✅ Connected to ArangoDB ${version.version}\n`);
    
    // Core collections from repository ingestion
    console.log('📊 CORE COLLECTIONS (from repository ingestion):');
    console.log('=' .repeat(60));
    
    const coreCollections = [
      'repositories',
      'files', 
      'entities',
      'relationships'
    ];
    
    for (const collectionName of coreCollections) {
      const info = await checkCollectionExists(collectionName);
      if (info.exists) {
        console.log(`✅ ${collectionName.padEnd(20)} | ${info.count.toString().padStart(6)} documents`);
        
        if (info.count > 0) {
          const samples = await getSampleData(collectionName, 1);
          if (samples.length > 0) {
            const sample = samples[0];
            if (collectionName === 'entities') {
              console.log(`   Sample: ${sample.type || 'unknown'} "${sample.name || 'unnamed'}" in ${sample.file || 'unknown file'}`);
            } else if (collectionName === 'repositories') {
              console.log(`   Sample: "${sample.name}" (${sample.type || 'unknown type'})`);
            } else if (collectionName === 'files') {
              console.log(`   Sample: ${sample.path} (${sample.language || 'unknown language'})`);
            } else if (collectionName === 'relationships') {
              console.log(`   Sample: ${sample.type || 'unknown'} relationship`);
            }
          }
        }
      } else {
        console.log(`❌ ${collectionName.padEnd(20)} | Missing`);
      }
    }
    
    // Enhanced collections for rich visualization
    console.log('\n🚀 ENHANCED COLLECTIONS (for rich graph visualization):');
    console.log('=' .repeat(60));
    
    const enhancedCollections = [
      'security_issues',
      'performance_metrics',
      'code_quality_metrics',
      'test_coverage', 
      'technical_debt',
      'complexity_metrics',
      'documentation_coverage',
      'code_smells'
    ];
    
    let enhancedDataExists = false;
    
    for (const collectionName of enhancedCollections) {
      const info = await checkCollectionExists(collectionName);
      if (info.exists && info.count > 0) {
        enhancedDataExists = true;
        console.log(`✅ ${collectionName.padEnd(25)} | ${info.count.toString().padStart(6)} documents`);
        
        const samples = await getSampleData(collectionName, 1);
        if (samples.length > 0) {
          const sample = samples[0];
          if (collectionName === 'security_issues') {
            console.log(`   Sample: ${sample.severity} ${sample.type} in ${sample.file}`);
          } else if (collectionName === 'performance_metrics') {
            console.log(`   Sample: ${sample.metrics?.length || 0} metrics for ${sample.entityName}`);
          } else if (collectionName === 'code_quality_metrics') {
            console.log(`   Sample: Complexity ${sample.cyclomaticComplexity}, Quality ${sample.grade}`);
          }
        }
      } else if (info.exists) {
        console.log(`⚠️  ${collectionName.padEnd(25)} | ${info.count.toString().padStart(6)} documents (empty)`);
      } else {
        console.log(`❌ ${collectionName.padEnd(25)} | Missing`);
      }
    }
    
    // Repository summary
    console.log('\n📋 REPOSITORY SUMMARY:');
    console.log('=' .repeat(60));
    
    try {
      const repositoriesCursor = await db.query(`
        FOR repo IN repositories
        RETURN {
          name: repo.name,
          type: repo.type,
          status: repo.status,
          filesCount: LENGTH(FOR file IN files FILTER file.repositoryId == repo._key RETURN 1),
          entitiesCount: LENGTH(FOR entity IN entities FILTER entity.repositoryId == repo._key RETURN 1)
        }
      `);
      
      const repositories = await repositoriesCursor.all();
      
      if (repositories.length > 0) {
        repositories.forEach(repo => {
          console.log(`📁 ${repo.name}`);
          console.log(`   Type: ${repo.type || 'unknown'}`);
          console.log(`   Status: ${repo.status || 'unknown'}`);
          console.log(`   Files: ${repo.filesCount}`);
          console.log(`   Entities: ${repo.entitiesCount}`);
          console.log('');
        });
      } else {
        console.log('❌ No repositories found');
      }
    } catch (error) {
      console.log('❌ Error getting repository summary:', error.message);
    }
    
    // Frontend readiness assessment
    console.log('🎨 FRONTEND READINESS ASSESSMENT:');
    console.log('=' .repeat(60));
    
    const entitiesInfo = await checkCollectionExists('entities');
    const securityInfo = await checkCollectionExists('security_issues');
    const performanceInfo = await checkCollectionExists('performance_metrics');
    
    if (entitiesInfo.count === 0) {
      console.log('❌ CRITICAL: No entities found');
      console.log('   ➤ Run repository ingestion first: INGEST_REPOSITORIES.bat');
      console.log('   ➤ Your frontend will have no graph data to display');
    } else {
      console.log(`✅ GOOD: ${entitiesInfo.count} entities ready for graph visualization`);
    }
    
    if (!enhancedDataExists) {
      console.log('⚠️  WARNING: No enhanced data (security, performance, quality)');
      console.log('   ➤ Run data enhancement: ENHANCE_DATA.bat');
      console.log('   ➤ Frontend will show basic structure only');
    } else {
      console.log('✅ EXCELLENT: Enhanced data available for rich visualization');
      console.log('   ➤ Security overlays, performance metrics, quality analysis ready');
    }
    
    // API endpoint suggestions
    console.log('\n🔗 SUGGESTED API ENDPOINTS TO TEST:');
    console.log('=' .repeat(60));
    
    if (entitiesInfo.count > 0) {
      console.log('📊 Graph Data:');
      console.log('   GET http://localhost:8002/api/repositories');
      console.log('   GET http://localhost:8002/api/repositories/{id}/entities');
      console.log('   GET http://localhost:8002/api/repositories/{id}/relationships');
      
      if (enhancedDataExists) {
        console.log('\n🔍 Enhanced Search:');
        console.log('   POST http://localhost:8002/api/search/semantic');
        console.log('   POST http://localhost:8002/api/search/entities');
        
        console.log('\n📈 Metrics:');
        console.log('   GET http://localhost:8002/api/repositories/{id}/metrics');
      }
    }
    
    console.log('\n🌐 WEB INTERFACES:');
    console.log('   📊 ArangoDB: http://localhost:8529');
    console.log('   📡 API Docs: http://localhost:8002/docs'); 
    console.log('   🎨 Frontend: http://localhost:3000/showcase');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 SOLUTION:');
      console.log('   ArangoDB is not running. Start it with:');
      console.log('   net start ArangoDB');
      console.log('   or');
      console.log('   Start ArangoDB service manually');
    }
  }
}

// Run verification
if (require.main === module) {
  verifyDatabaseData()
    .then(() => {
      console.log('\n✅ Database verification complete!\n');
    })
    .catch(error => {
      console.error('\n❌ Verification error:', error.message);
      process.exit(1);
    });
}

module.exports = { verifyDatabaseData };
