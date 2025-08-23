#!/usr/bin/env node

/**
 * Simple Repository Ingestion Script
 * Adds repository information to the database
 */

const path = require('path');
const fs = require('fs');

// Import our database connection manager
const { initializeDB } = require('./src/database/connection-manager');

async function ingestRepositories() {
  console.log('🚀 Starting repository ingestion...');
  
  try {
    // Set the correct database name
    process.env.ARANGO_DATABASE = 'ai_code_management';
    
    // Initialize database connection
    console.log('📊 Connecting to database...');
    const dbManager = await initializeDB();
    console.log('✅ Database connected');

    // Repository 1: AI Software Development Platform (self-analysis)
    const aiPlatformRepo = {
      name: 'AI_Software_Development_Platform',
      type: 'local',
      path: 'C:/Users/richa/OneDrive/Documents/Github_Richard_Helms/AI_Software_Development_Platform',
      owner: 'AlpheCIT',
      description: 'AI-powered Code Management System - Enterprise-grade code intelligence platform',
      language: 'JavaScript/TypeScript',
      technologies: ['Node.js', 'React', 'ArangoDB', 'Express', 'Vite'],
      status: 'active',
      metadata: {
        self_analysis: true,
        local_project: true,
        ingested_at: new Date().toISOString()
      }
    };

    // Repository 2: React.js (external sample)
    const reactRepo = {
      name: 'react',
      type: 'external',
      url: 'https://github.com/facebook/react',
      owner: 'facebook',
      description: 'The library for web and native user interfaces',
      language: 'JavaScript',
      technologies: ['React', 'JavaScript', 'Flow'],
      status: 'sample',
      metadata: {
        sample_data: true,
        external_project: true,
        ingested_at: new Date().toISOString()
      }
    };

    console.log('📝 Adding AI Software Development Platform...');
    const aiPlatformResult = await dbManager.createRepository(aiPlatformRepo);
    
    console.log('📝 Adding React.js repository...');
    const reactResult = await dbManager.createRepository(reactRepo);

    console.log('\n🎉 Repository ingestion completed successfully!');
    console.log('\n📋 Added repositories:');
    console.log(`   • ${aiPlatformRepo.name} (Self-analysis)`);
    console.log(`   • ${reactRepo.name} (Sample data)`);
    
    console.log('\n🔍 You can now view repositories at:');
    console.log('   • API: http://localhost:3002/api/v1/repositories');
    console.log('   • Frontend: http://localhost:3000/showcase');
    
    // Test the repositories endpoint
    console.log('\n✅ Testing repositories endpoint...');
    const repos = await dbManager.getRepositories();
    console.log(`   Found ${repos.length} repositories in database`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the ingestion
if (require.main === module) {
  ingestRepositories();
}

module.exports = { ingestRepositories };
