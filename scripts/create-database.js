#!/usr/bin/env node

/**
 * Create Database Script
 * Creates the database if it doesn't exist
 */

const { Database } = require('arangojs');

async function createDatabase() {
  try {
    const databaseName = process.env.ARANGO_DATABASE;
    console.log(`🔧 Creating database ${databaseName}...`);
    
    // Determine environment and set appropriate defaults
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV;
    const defaultPort = process.env.ARANGO_PORT || (isDev ? '8530' : '8529');
    const defaultPassword = process.env.ARANGO_PASSWORD || (isDev ? 'rootpassword' : 'openSesame');
    
    const config = {
      url: process.env.ARANGO_URL || `http://${process.env.ARANGO_HOST || 'localhost'}:${defaultPort}`,
      username: process.env.ARANGO_USERNAME || 'root',
      password: defaultPassword,
      port: defaultPort
    };
    
    console.log(`🌍 Environment: ${isDev ? 'Development' : 'Production'}`);
    console.log(`🔗 Connecting to: ${config.url}`);
    console.log(`👤 Username: ${config.username}`);
    
    // Connect to _system database first
    const systemDb = new Database({
      url: config.url,
      databaseName: '_system',
      auth: {
        username: config.username,
        password: config.password
      }
    });
    
    // Check if database exists
    const databases = await systemDb.listDatabases();
    if (databases.includes(databaseName)) {
      console.log(`✅ Database ${databaseName} already exists`);
      return;
    }
    
    // Create the database
    await systemDb.createDatabase(databaseName);
    console.log(`✅ Database ${databaseName} created successfully`);
    
  } catch (error) {
    console.error('❌ Failed to create database:', error.message);
    throw error;
  }
}

if (require.main === module) {
  createDatabase().catch(error => {
    console.error('Database creation failed:', error);
    process.exit(1);
  });
}

module.exports = { createDatabase };
