#!/usr/bin/env node

/**
   .option('--      // Set environment variables if provided
      if (options.host && options.port) process.env.ARANGO_URL = `http://${options.host}:${options.port}`  .option('-      // Determine environme      console.log('📝 Configuration:');
      console.log(`   Environment: ${isDev ? 'Development' : 'Production'}`);
      console.log(`   Host: ${options.host || process.env.ARANGO_HOST || 'localhost'}:${port}`);
      console.log(`   Database: ${options.database || process.env.ARANGO_DATABASE}`);
      console.log(`   Username: ${options.username || process.env.ARANGO_USERNAME || 'root'}`);
      console.log(''); set appropriate defaults
      const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV;
      const defaultPort = isDev ? process.env.ARANGO_PORT || '8530' : process.env.ARANGO_PORT || '8529';
      const defaultPassword = process.env.ARANGO_PASSWORD || '';
      
      // Use provided options or environment-based defaults
      const port = options.port || defaultPort;
      const password = options.password || defaultPassword;
      
      // Set environment variables if provided
      if (options.host) process.env.ARANGO_URL = `http://${options.host}:${port}`;
      if (options.username) process.env.ARANGO_USERNAME = options.username;
      if (password) process.env.ARANGO_PASSWORD = password;
      if (options.database) process.env.ARANGO_DATABASE = options.database; 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--port <port>', 'ArangoDB port', process.env.ARANGO_PORT)
  .option('--username <username>', 'Database username', process.env.ARANGO_USERNAME || 'root')
  .option('--password <password>', 'Database password', process.env.ARANGO_PASSWORD)
  .option('--database <database>', 'Database name', process.env.ARANGO_DATABASE)   if (options.username) process.env.ARANGO_USERNAME = options.username;
      if (options.password) process.env.ARANGO_PASSWORD = options.password;
      if (options.database) process.env.ARANGO_DATABASE = options.database;<host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--username <username>', 'Database username', process.env.ARANGO_USERNAME || 'root')
  .option('--password <password>', 'Database password', process.env.ARANGO_PASSWORD)
  .option('--database <database>', 'Database name', process.env.ARANGO_DATABASE)abase Initialization Script
 * 
 * Sets up the ArangoDB database for AI Software Development Platform:
 * - Creates database and collections
 * - Sets up indexes and constraints
 * - Initializes system configuration
 * - Provides CLI options for management
 */

const { Command } = require('commander');
const { initializeDatabase, seedDatabase, resetDatabase } = require('../src/database/arangodb-schema');
const { initializeDB } = require('../src/database/connection-manager');

const program = new Command();

program
  .name('db-init')
  .description('AI Software Development Platform - Database Initialization')
  .version('2.0.0');

program
  .command('init')
  .description('Initialize database with schema and indexes')
  .option('--host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--port <port>', 'ArangoDB port', process.env.ARANGO_PORT || '8529')
  .option('--username <username>', 'Database username', process.env.ARANGO_USER || process.env.ARANGO_USER || 'root')
  .option('--password <password>', 'Database password', process.env.ARANGO_PASSWORD || process.env.ARANGO_PASSWORD)
  .option('--database <database>', 'Database name', process.env.ARANGO_DATABASE || process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB')
  .action(async (options) => {
    try {
      console.log('🚀 Initializing AI Software Development Platform Database...\n');
      
      // Set environment variables if provided
      if (options.host && options.port) process.env.ARANGO_URL = `http://${options.host}:${options.port}`;
      if (options.username) process.env.ARANGODB_USERNAME = options.username;
      if (options.password) process.env.ARANGO_PASSWORD = options.password;
      if (options.database) process.env.ARANGO_DATABASE = options.database;
      
      await initializeDatabase();
      console.log('\n✅ Database initialization completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Database initialization failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('seed')
  .description('Seed database with initial configuration data')
  .action(async () => {
    try {
      console.log('🌱 Seeding database with initial data...\n');
      
      await seedDatabase();
      console.log('\n✅ Database seeding completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Database seeding failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset database (WARNING: This will delete all data!)')
  .option('--confirm', 'Confirm the reset operation')
  .action(async (options) => {
    if (!options.confirm) {
      console.error('❌ Reset operation requires --confirm flag');
      console.log('This operation will DELETE ALL DATA in the database!');
      console.log('Use: npm run db:reset -- --confirm');
      process.exit(1);
    }
    
    try {
      console.log('🗑️  Resetting database (this will delete all data)...\n');
      
      await resetDatabase();
      console.log('\n✅ Database reset completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Database reset failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check database connection and status')
  .action(async () => {
    try {
      console.log('🔍 Checking database status...\n');
      
      const dbManager = await initializeDB();
      const stats = await dbManager.getDatabaseStats();
      
      console.log('✅ Database connection successful!');
      console.log('\n📊 Database Statistics:');
      console.log('─'.repeat(50));
      
      console.log('\n📁 Document Collections:');
      Object.entries(stats.collections).forEach(([name, count]) => {
        console.log(`  ${name.padEnd(30)} ${count.toLocaleString().padStart(10)}`);
      });
      
      console.log('\n🔗 Edge Collections:');
      Object.entries(stats.edges).forEach(([name, count]) => {
        console.log(`  ${name.padEnd(30)} ${count.toLocaleString().padStart(10)}`);
      });
      
      console.log('\n📈 Summary:');
      console.log(`  Total Documents: ${stats.total_documents.toLocaleString()}`);
      console.log(`  Total Edges: ${stats.total_edges.toLocaleString()}`);
      
      await dbManager.disconnect();
      
    } catch (error) {
      console.error('\n❌ Database status check failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('migrate')
  .description('Run database migrations')
  .action(async () => {
    try {
      console.log('🔄 Running database migrations...\n');
      
      // TODO: Implement migration system
      console.log('ℹ️  No migrations to run at this time.');
      
    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('backup')
  .description('Create database backup')
  .option('--output <path>', 'Backup output path', './backup')
  .action(async (options) => {
    try {
      console.log(`💾 Creating database backup to ${options.output}...\n`);
      
      // TODO: Implement backup functionality
      console.log('ℹ️  Backup functionality not implemented yet.');
      console.log('💡 Use ArangoDB\'s arangodump tool for now:');
      console.log(`   arangodump --server.database ${process.env.ARANGO_DATABASE} --output-directory ${options.output}`);
      
    } catch (error) {
      console.error('\n❌ Backup failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('restore')
  .description('Restore database from backup')
  .option('--input <path>', 'Backup input path', './backup')
  .action(async (options) => {
    try {
      console.log(`📥 Restoring database from ${options.input}...\n`);
      
      // TODO: Implement restore functionality
      console.log('ℹ️  Restore functionality not implemented yet.');
      console.log('💡 Use ArangoDB\'s arangorestore tool for now:');
      console.log(`   arangorestore --server.database ${process.env.ARANGO_DATABASE} --input-directory ${options.input}`);
      
    } catch (error) {
      console.error('\n❌ Restore failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Complete setup: init + seed')
  .option('--host <host>', 'ArangoDB host', process.env.ARANGO_HOST || 'localhost')
  .option('--port <port>', 'ArangoDB port', process.env.ARANGO_PORT)
  .option('--username <username>', 'Database username', process.env.ARANGO_USER || process.env.ARANGO_USER || 'root')
  .option('--password <password>', 'Database password', process.env.ARANGO_PASSWORD || process.env.ARANGO_PASSWORD)
  .option('--database <database>', 'Database name', process.env.ARANGO_DATABASE || process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB')
  .action(async (options) => {
    try {
      console.log('🚀 Setting up AI Software Development Platform Database...\n');
      
      // Determine environment and set appropriate defaults
      const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV;
      const defaultPort = isDev ? process.env.ARANGO_PORT || '8530' : process.env.ARANGO_PORT || '8529';
      const defaultPassword = process.env.ARANGO_PASSWORD || '';
      
      // Use provided options or environment-based defaults
      const port = options.port || defaultPort;
      const password = options.password || defaultPassword;
      
      // Set environment variables if provided
      if (options.host) process.env.ARANGO_URL = `http://${options.host}:${port}`;
      if (options.username) process.env.ARANGODB_USERNAME = options.username;
      if (password) process.env.ARANGO_PASSWORD = password;
      if (options.database) process.env.ARANGO_DATABASE = options.database;
      
      console.log('📝 Configuration:');
      console.log(`   Environment: ${isDev ? 'Development' : 'Production'}`);
      console.log(`   Host: ${options.host || process.env.ARANGO_HOST || 'localhost'}:${port}`);
      console.log(`   Database: ${options.database || process.env.ARANGO_DATABASE || process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB'}`);
      console.log(`   Username: ${options.username || process.env.ARANGO_USER || process.env.ARANGO_USER || 'root'}`);
      console.log('');
      
      // Initialize database
      await initializeDatabase();
      console.log('✅ Database initialized');
      
      // Seed with initial data
      await seedDatabase();
      console.log('✅ Database seeded');
      
      console.log('\n🎉 Setup completed successfully!');
      console.log('\n📚 Next steps:');
      console.log('   1. Start the API Gateway: npm run dev:api');
      console.log('   2. Start the Dashboard: npm run dev:dashboard');
      console.log('   3. Open http://localhost:3000 in your browser');
      
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Ensure ArangoDB is running on the specified host/port');
      console.log('   2. Check username/password credentials');
      console.log('   3. Verify network connectivity');
      process.exit(1);
    }
  });

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Parse command line arguments
program.parse();
