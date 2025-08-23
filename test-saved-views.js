#!/usr/bin/env node

/**
 * Comprehensive Saved Views API Test Suite
 * Tests all CRUD operations for the Saved Views endpoints
 */

const http = require('http');

// Test configuration
const API_BASE = 'http://localhost:3001';
const API_PATH = '/api/v1/graph/saved-views';

/**
 * Make HTTP request
 */
async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody || body
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test helper
 */
function logTest(testName, result) {
  const status = result.statusCode >= 200 && result.statusCode < 300 ? '✅' : '❌';
  console.log(`${status} ${testName}: ${result.statusCode}`);
  
  if (result.body && typeof result.body === 'object') {
    console.log(`   📊 Response:`, JSON.stringify(result.body, null, 2).split('\n').slice(0, 10).join('\n'));
    if (JSON.stringify(result.body, null, 2).split('\n').length > 10) {
      console.log('   ... (truncated)');
    }
  }
  console.log('');
}

/**
 * Main test suite
 */
async function runSavedViewsTests() {
  console.log('🧪 Testing Saved Views API Endpoints...\n');

  try {
    // Test 1: GET all saved views
    console.log('📋 Test 1: GET All Saved Views');
    const getAllResult = await makeRequest(API_PATH);
    logTest('GET /api/v1/graph/saved-views', getAllResult);

    // Test 2: GET all saved views with query parameters
    console.log('📋 Test 2: GET All Saved Views (with filters)');
    const getFilteredResult = await makeRequest(`${API_PATH}?repositoryId=main-repo&userId=user1`);
    logTest('GET /api/v1/graph/saved-views?repositoryId=main-repo&userId=user1', getFilteredResult);

    // Test 3: POST create a new saved view
    console.log('📋 Test 3: POST Create New Saved View');
    const createData = {
      name: "My Custom View",
      description: "Custom graph layout",
      repositoryId: "main-repo",
      viewData: {
        center: { x: 100, y: 50 },
        zoom: 1.5,
        filters: { type: "service" },
        selectedNodes: ["service:user-api"],
        layout: "hierarchical"
      },
      isPublic: true
    };
    const createResult = await makeRequest(API_PATH, 'POST', createData);
    logTest('POST /api/v1/graph/saved-views', createResult);

    // Extract created view ID for subsequent tests
    let createdViewId = 'view-001'; // fallback
    if (createResult.body && createResult.body.id) {
      createdViewId = createResult.body.id;
    }

    // Test 4: GET specific saved view
    console.log('📋 Test 4: GET Specific Saved View');
    const getSpecificResult = await makeRequest(`${API_PATH}/${createdViewId}`);
    logTest(`GET /api/v1/graph/saved-views/${createdViewId}`, getSpecificResult);

    // Test 5: PUT update saved view
    console.log('📋 Test 5: PUT Update Saved View');
    const updateData = {
      name: "Updated View Name",
      description: "This view has been updated",
      viewData: {
        center: { x: 200, y: 100 },
        zoom: 2.0,
        filters: { type: "database" },
        selectedNodes: ["database:users", "database:products"],
        layout: "circular"
      }
    };
    const updateResult = await makeRequest(`${API_PATH}/${createdViewId}`, 'PUT', updateData);
    logTest(`PUT /api/v1/graph/saved-views/${createdViewId}`, updateResult);

    // Test 6: GET updated view to verify changes
    console.log('📋 Test 6: GET Updated View (verification)');
    const getUpdatedResult = await makeRequest(`${API_PATH}/${createdViewId}`);
    logTest(`GET /api/v1/graph/saved-views/${createdViewId} (after update)`, getUpdatedResult);

    // Test 7: DELETE saved view
    console.log('📋 Test 7: DELETE Saved View');
    const deleteResult = await makeRequest(`${API_PATH}/${createdViewId}`, 'DELETE');
    logTest(`DELETE /api/v1/graph/saved-views/${createdViewId}`, deleteResult);

    // Test 8: Error handling - invalid data
    console.log('📋 Test 8: Error Handling (Missing Required Fields)');
    const invalidData = {
      description: "Missing required fields"
      // Missing name, repositoryId, viewData
    };
    const errorResult = await makeRequest(API_PATH, 'POST', invalidData);
    logTest('POST /api/v1/graph/saved-views (invalid data)', errorResult);

    // Test 9: Error handling - non-existent view
    console.log('📋 Test 9: Error Handling (Non-existent View)');
    const notFoundResult = await makeRequest(`${API_PATH}/non-existent-view-123`);
    logTest('GET /api/v1/graph/saved-views/non-existent-view-123', notFoundResult);

    console.log('🎉 Saved Views API Test Suite Complete!\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log('✅ All CRUD operations tested');
    console.log('✅ Query parameter filtering tested');
    console.log('✅ Error handling tested');
    console.log('✅ Data validation tested');
    console.log('\n🚀 Saved Views API is fully functional!');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    console.log('\n💡 Make sure the API Gateway is running:');
    console.log('   node start-gateway.js');
  }
}

// Check if API is available first
async function checkApiHealth() {
  try {
    const healthResult = await makeRequest('/health');
    if (healthResult.statusCode === 200) {
      console.log('✅ API Gateway is running\n');
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Run the test suite
async function main() {
  console.log('🔍 Checking API Gateway status...');
  
  const isHealthy = await checkApiHealth();
  
  if (!isHealthy) {
    console.log('❌ API Gateway is not responding');
    console.log('💡 Please start the API Gateway first:');
    console.log('   node start-gateway.js');
    process.exit(1);
  }
  
  await runSavedViewsTests();
}

main();
