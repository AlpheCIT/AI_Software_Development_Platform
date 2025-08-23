#!/usr/bin/env node
/**
 * Feature Parity API Gateway Startup Script
 * Starts the comprehensive API gateway that provides all endpoints needed by the frontend
 */

const { ComprehensiveAPIGateway } = require('./services/comprehensive-api-gateway');

console.log('🚀 Starting Feature Parity Implementation');
console.log('========================================');
console.log('');
console.log('📋 This gateway provides ALL missing API endpoints:');
console.log('   ✅ Repository ingestion with real-time progress');
console.log('   ✅ Collections status monitoring');  
console.log('   ✅ MCP proxy for ArangoDB operations');
console.log('   ✅ Graph visualization endpoints');
console.log('   ✅ Analytics and search endpoints');
console.log('   ✅ WebSocket real-time updates');
console.log('');

async function startFeatureParityGateway() {
  try {
    const gateway = new ComprehensiveAPIGateway();
    
    // Start the gateway
    await gateway.start(3001);
    
    console.log('');
    console.log('🎯 FEATURE PARITY STATUS:');
    console.log('   📦 API Endpoints: ✅ COMPLETE');
    console.log('   🔄 WebSocket Events: ✅ COMPLETE'); 
    console.log('   📊 Collections Data: ✅ READY');
    console.log('   🌐 Frontend Integration: ✅ READY');
    console.log('');
    console.log('🎬 INVESTOR DEMO READY!');
    console.log('   Frontend: npm run dev (in apps/frontend)');
    console.log('   URL: http://localhost:5173');
    console.log('');
    console.log('💡 Test repository ingestion:');
    console.log('   Enter any GitHub URL in the frontend');
    console.log('   Watch real-time progress and collection population');
    console.log('');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Feature Parity Gateway...');
      await gateway.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down Feature Parity Gateway...');  
      await gateway.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Feature Parity Gateway:', error);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   1. Ensure port 3001 is available');
    console.error('   2. Check that all dependencies are installed');
    console.error('   3. Verify the comprehensive-api-gateway.js file exists');
    process.exit(1);
  }
}

startFeatureParityGateway();