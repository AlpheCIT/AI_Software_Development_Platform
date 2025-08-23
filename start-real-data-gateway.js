#!/usr/bin/env node

/**
 * Real Data API Gateway Startup Script
 * Connects to ArangoDB and serves real data to the frontend
 */

const { RealDataAPIGateway } = require('./src/api/gateway-real-data');

async function startRealDataGateway() {
  try {
    console.log('🚀 Starting Real Data API Gateway...');
    console.log('🗄️  Connecting to ArangoDB: ARANGO_AISDP_DB');
    
    const gateway = new RealDataAPIGateway({
      port: 3001,
      host: '0.0.0.0'
    });
    
    await gateway.start();
    
    console.log('✅ Real Data API Gateway started successfully');
    console.log('📊 Frontend can now access real ArangoDB data');
    
  } catch (error) {
    console.error('❌ Failed to start Real Data API Gateway:', error.message);
    console.error('💡 Make sure ArangoDB is running on localhost:8529');
    console.error('💡 Make sure ARANGO_AISDP_DB database exists');
    process.exit(1);
  }
}

startRealDataGateway();
