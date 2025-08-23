#!/usr/bin/env node

/**
 * API Endpoint Tests
 * Tests the API Gateway endpoints with actual HTTP requests
 */

const http = require('http');

async function testEndpoint(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing API Gateway Endpoints...');
  
  const tests = [
    { name: 'Health Check', path: '/health' },
    { name: 'API Root', path: '/' },
    { name: 'Repositories', path: '/api/v1/repositories' },
    { name: 'Graph Seeds', path: '/api/v1/graph/seeds' },
    { name: 'Saved Views', path: '/api/v1/graph/saved-views' },
    { name: 'Analytics Overview', path: '/api/v1/analytics/overview' }
  ];
  
  for (const test of tests) {
    try {
      console.log(`🔍 Testing ${test.name}...`);
      const result = await testEndpoint(test.path);
      
      if (result.statusCode === 200) {
        console.log(`✅ ${test.name}: ${result.statusCode} - OK`);
        
        // Try to parse JSON response
        try {
          const jsonBody = JSON.parse(result.body);
          console.log(`   📊 Response keys: ${Object.keys(jsonBody).join(', ')}`);
        } catch (e) {
          console.log(`   📄 Response: ${result.body.substring(0, 100)}...`);
        }
      } else {
        console.log(`⚠️  ${test.name}: ${result.statusCode} - ${result.body}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🎉 API Endpoint Tests Complete!');
}

// Check if gateway is running first
console.log('🔍 Checking if API Gateway is running...');
testEndpoint('/health')
  .then(() => {
    console.log('✅ API Gateway detected, running tests...\n');
    return runTests();
  })
  .catch(() => {
    console.log('❌ API Gateway not running. Please start it first with:');
    console.log('   node start-gateway.js');
    process.exit(1);
  });
