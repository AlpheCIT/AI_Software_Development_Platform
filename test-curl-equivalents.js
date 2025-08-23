#!/usr/bin/env node

/**
 * PowerShell Curl Equivalent Tests
 * Replicates the exact curl commands you provided using Node.js
 */

const http = require('http');

async function execCurlEquivalent(description, method, path, data = null, headers = {}) {
  console.log(`\n🔍 ${description}`);
  console.log(`Command: ${method} ${path}`);
  if (data) {
    console.log(`Data: ${JSON.stringify(data, null, 2)}`);
  }
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        console.log(`📊 Status: ${res.statusCode}`);
        
        if (body) {
          try {
            const jsonBody = JSON.parse(body);
            console.log('📄 Response:');
            console.log(JSON.stringify(jsonBody, null, 2));
          } catch (e) {
            console.log(`📄 Response: ${body}`);
          }
        } else if (res.statusCode === 204) {
          console.log('📄 Response: (No Content - Success)');
        }
        
        console.log('---');
        resolve(res.statusCode);
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Error: ${err.message}`);
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runCurlTests() {
  console.log('🧪 Running Curl Equivalent Tests for Saved Views...');
  
  try {
    // 1. Get all saved views
    await execCurlEquivalent(
      'Test 1: Get all saved views',
      'GET',
      '/api/v1/graph/saved-views'
    );

    // 2. Create a new view
    const createResult = await execCurlEquivalent(
      'Test 2: Create a new view',
      'POST',
      '/api/v1/graph/saved-views',
      {
        "name": "My Custom View",
        "description": "Custom graph layout",
        "repositoryId": "main-repo",
        "viewData": {
          "center": {"x": 100, "y": 50},
          "zoom": 1.5,
          "filters": {"type": "service"},
          "selectedNodes": ["service:user-api"],
          "layout": "hierarchical"
        },
        "isPublic": true
      }
    );

    // 3. Get specific view (using the standard view-001 ID)
    await execCurlEquivalent(
      'Test 3: Get specific view',
      'GET',
      '/api/v1/graph/saved-views/view-001'
    );

    // 4. Update a view
    await execCurlEquivalent(
      'Test 4: Update a view',
      'PUT',
      '/api/v1/graph/saved-views/view-001',
      {
        "name": "Updated View Name"
      }
    );

    // 5. Delete a view
    await execCurlEquivalent(
      'Test 5: Delete a view',
      'DELETE',
      '/api/v1/graph/saved-views/view-001'
    );

    console.log('\n🎉 All curl equivalent tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runCurlTests();
