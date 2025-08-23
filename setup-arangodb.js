#!/usr/bin/env node

/**
 * ArangoDB Database Setup Script
 * Creates the ARANGO_AISDP_DB database for the platform
 */

const axios = require('axios');

const ARANGO_URL = 'http://localhost:8529';
const DATABASE_NAME = 'ARANGO_AISDP_DB';
const USERNAME = 'root';
const PASSWORD = 'password';

async function setupDatabase() {
  console.log('🚀 Setting up ArangoDB database...');
  console.log(`📍 ArangoDB URL: ${ARANGO_URL}`);
  console.log(`🗄️  Database: ${DATABASE_NAME}`);
  console.log();

  try {
    // Create authentication header
    const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };

    // First, check if database already exists
    console.log('🔍 Checking if database exists...');
    try {
      const checkResponse = await axios.get(
        `${ARANGO_URL}/_db/${DATABASE_NAME}/_api/version`,
        { headers }
      );
      console.log('✅ Database already exists!');
      console.log(`📊 ArangoDB Version: ${checkResponse.data.version}`);
      return;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('📝 Database does not exist, creating...');
      } else {
        throw error;
      }
    }

    // Create database
    console.log('🛠️  Creating database...');
    const createResponse = await axios.post(
      `${ARANGO_URL}/_api/database`,
      {
        name: DATABASE_NAME,
        users: [
          {
            username: USERNAME,
            passwd: PASSWORD,
            active: true
          }
        ]
      },
      { headers }
    );

    if (createResponse.data.result) {
      console.log('✅ Database created successfully!');
      
      // Verify database creation
      console.log('🔄 Verifying database creation...');
      const verifyResponse = await axios.get(
        `${ARANGO_URL}/_db/${DATABASE_NAME}/_api/version`,
        { headers }
      );
      console.log(`📊 ArangoDB Version: ${verifyResponse.data.version}`);
      console.log('🎉 Database setup complete!');
    } else {
      console.log('❌ Failed to create database');
    }

  } catch (error) {
    console.error('❌ Error setting up database:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.errorMessage || error.message}`);
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

// Run setup
setupDatabase();
