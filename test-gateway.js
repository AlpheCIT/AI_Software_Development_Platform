#!/usr/bin/env node

/**
 * Simple API Gateway Test
 * Tests the API Gateway initialization without full system startup
 */

const { APIGateway } = require('./src/api/gateway');

async function testApiGateway() {
  try {
    console.log('🧪 Testing API Gateway...');
    
    const gateway = new APIGateway({
      port: 3002,
      host: '0.0.0.0'
    });
    
    // Just test initialization, not full start
    console.log('✅ API Gateway created successfully');
    console.log('📊 Configuration:', {
      port: gateway.port,
      host: gateway.host,
      environment: gateway.environment
    });
    
    // Test route setup
    gateway.setupMiddleware();
    console.log('✅ Middleware setup successful');
    
    gateway.setupRoutes();
    console.log('✅ Routes setup successful');
    
    gateway.setupWebSocket();
    console.log('✅ WebSocket setup successful');
    
    gateway.setupErrorHandling();
    console.log('✅ Error handling setup successful');
    
    console.log('🎉 API Gateway test completed successfully!');
    console.log('👉 The gateway should now work in the main system');
    
  } catch (error) {
    console.error('❌ API Gateway test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testApiGateway();
