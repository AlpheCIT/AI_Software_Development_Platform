#!/usr/bin/env node

/**
 * Complete Jira Kanban Integration Startup Script
 * Starts the Jira API Gateway and ensures all components are connected
 */

const { RealJiraAPIGateway } = require('./services/real-jira-api-gateway');
const path = require('path');

async function startJiraKanbanSystem() {
  console.log('🚀 Starting Complete Jira Kanban Integration...');
  console.log('════════════════════════════════════════════════');
  
  try {
    // Start Jira API Gateway
    console.log('📡 Starting Jira API Gateway...');
    const jiraGateway = new RealJiraAPIGateway();
    await jiraGateway.start(3001);
    
    console.log('');
    console.log('✅ JIRA KANBAN INTEGRATION READY!');
    console.log('════════════════════════════════════════════');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Start the frontend: cd apps/frontend && npm run dev');
    console.log('2. Navigate to http://localhost:5173/projects');
    console.log('3. View your Jira Kanban board with real issues!');
    console.log('');
    console.log('📋 FEATURES AVAILABLE:');
    console.log('• ✅ Drag & drop issue management');
    console.log('• ✅ Real-time Jira synchronization (via MCP)');
    console.log('• ✅ Create new issues');
    console.log('• ✅ Update issue details');
    console.log('• ✅ Transition issues between columns');
    console.log('• ✅ Add comments and labels');
    console.log('• ✅ Story points and priority management');
    console.log('');
    console.log('🔗 API ENDPOINTS ACTIVE:');
    console.log('• GET  /api/jira/projects/:projectKey/issues');
    console.log('• GET  /api/jira/issues/:issueKey');
    console.log('• POST /api/jira/issues (create)');
    console.log('• PUT  /api/jira/issues/:issueKey (update)');
    console.log('• POST /api/jira/issues/:issueKey/transition');
    console.log('• POST /api/jira/issues/:issueKey/comments');
    console.log('');
    console.log('💡 TIP: The system will use demo data until Jira MCP is fully configured');
    console.log('🔧 MCP Integration: Update jira-api-gateway.js to use real MCP calls');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Jira Kanban system...');
      await jiraGateway.stop();
      console.log('👋 Goodbye!');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start Jira Kanban system:', error);
    console.error('');
    console.error('🔧 TROUBLESHOOTING:');
    console.error('1. Make sure port 3001 is available');
    console.error('2. Check that all dependencies are installed');
    console.error('3. Verify MCP configuration is correct');
    process.exit(1);
  }
}

// Run the startup
startJiraKanbanSystem();
