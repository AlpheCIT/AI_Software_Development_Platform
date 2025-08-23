#!/usr/bin/env node

/**
 * Simple API Gateway Startup Script
 * Starts just the API Gateway for testing the frontend
 */

const { APIGateway } = require('./src/api/gateway');

async function startAPIGateway() {
  try {
    console.log('🚀 Starting API Gateway...');
    
    const gateway = new APIGateway({
      port: 3001,
      host: '0.0.0.0'
    });
    
    await gateway.start();
    
  } catch (error) {
    console.error('❌ Failed to start API Gateway:', error.message);
    process.exit(1);
  }
}

startAPIGateway();
