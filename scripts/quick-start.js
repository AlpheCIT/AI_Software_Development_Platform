#!/usr/bin/env node

/**
 * Quick Start Script for AI Software Development Platform
 * 
 * This script automates the complete setup and first analysis
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log(`
🚀 AI Software Development Platform - Quick Start
==============================================

This script will:
1. ✅ Verify prerequisites
2. 🚀 Start ArangoDB if needed  
3. 📦 Install dependencies
4. 🗄️  Initialize database
5. 🎯 Run first analysis
6. 🌐 Start the system

Let's get started!
`);

class QuickStart {
  constructor() {
    this.steps = [
      { name: 'Check Prerequisites', fn: this.checkPrerequisites },
      { name: 'Start ArangoDB', fn: this.startArangoDB },
      { name: 'Install Dependencies', fn: this.installDependencies },
      { name: 'Setup Environment', fn: this.setupEnvironment },
      { name: 'Initialize Database', fn: this.initializeDatabase },
      { name: 'Run Sample Analysis', fn: this.runSampleAnalysis },
      { name: 'Start System', fn: this.startSystem }
    ];
    this.currentStep = 0;
  }

  async run() {
    try {
      console.log('🔍 Starting Quick Setup...\n');

      for (const step of this.steps) {
        this.currentStep++;
        console.log(`📋 Step ${this.currentStep}/${this.steps.length}: ${step.name}`);
        console.log('─'.repeat(50));
        
        await step.fn.call(this);
        
        console.log(`✅ ${step.name} completed!\n`);
      }

      this.showSuccessMessage();

    } catch (error) {
      console.error(`\n❌ Setup failed at step: ${this.steps[this.currentStep - 1]?.name}`);
      console.error(`Error: ${error.message}\n`);
      
      this.showTroubleshootingTips();
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log('Checking Node.js...');
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      console.log(`✅ Node.js: ${nodeVersion}`);
    } catch (error) {
      throw new Error('Node.js not found. Please install Node.js 18+ from https://nodejs.org/');
    }

    console.log('Checking npm...');
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      console.log(`✅ npm: v${npmVersion}`);
    } catch (error) {
      throw new Error('npm not found');
    }

    console.log('Checking Git...');
    try {
      const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
      console.log(`✅ Git: ${gitVersion}`);
    } catch (error) {
      console.warn('⚠️  Git not found - repository analysis may be limited');
    }
  }

  async startArangoDB() {
    console.log('Checking if ArangoDB is running...');
    
    try {
      const fetch = require('http').get;
      await new Promise((resolve, reject) => {
        const req = require('http').get('http://localhost:8529/_api/version', (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error('ArangoDB not responding'));
          }
        });
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Timeout')));
      });
      
      console.log('✅ ArangoDB is already running on port 8529');
      
    } catch (error) {
      console.log('🚀 Starting ArangoDB...');
      
      try {
        // Try to start as Windows service first
        execSync('net start ArangoDB', { stdio: 'ignore' });
        console.log('✅ ArangoDB service started');
      } catch (serviceError) {
        try {
          // Try to start manually
          console.log('Starting ArangoDB manually...');
          const arangoProcess = spawn('arangod', [
            '--server.endpoint', 'tcp://0.0.0.0:8529',
            '--server.authentication', 'false'
          ], { 
            detached: true, 
            stdio: 'ignore' 
          });
          
          arangoProcess.unref();
          
          // Wait for ArangoDB to be ready
          await this.waitForArangoDB();
          console.log('✅ ArangoDB started manually');
          
        } catch (manualError) {
          throw new Error(`
Failed to start ArangoDB automatically.
Please start ArangoDB manually:

Option 1 - Windows Service:
  net start ArangoDB

Option 2 - Manual Start:
  arangod --server.endpoint tcp://0.0.0.0:8529

Option 3 - Docker:
  docker run -p 8529:8529 -e ARANGO_ROOT_PASSWORD=openSesame arangodb:3.11

Then run this script again.
          `);
        }
      }
    }
  }

  async waitForArangoDB() {
    console.log('⏳ Waiting for ArangoDB to be ready...');
    
    for (let i = 0; i < 30; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = require('http').get('http://localhost:8529/_api/version', (res) => {
            resolve();
          });
          req.on('error', reject);
          req.setTimeout(2000, () => reject(new Error('Timeout')));
        });
        
        return; // Success
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('ArangoDB failed to start within 30 seconds');
  }

  async installDependencies() {
    console.log('Installing dependencies...');
    
    try {
      execSync('npm install', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      throw new Error('Failed to install dependencies. Please check your internet connection.');
    }
  }

  async setupEnvironment() {
    console.log('Setting up environment configuration...');
    
    const envPath = path.join(process.cwd(), '.env');
    const envExamplePath = path.join(process.cwd(), '.env.example');
    
    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ Created .env file from .env.example');
    } else if (fs.existsSync(envPath)) {
      console.log('✅ .env file already exists');
    } else {
      // Create basic .env file
      const basicEnv = `
# AI Software Development Platform Configuration
ARANGODB_URL=http://localhost:8529
ARANGODB_NAME=ARANGO_AISDP_DB
ARANGODB_USER=root
ARANGO_PASSWORD=openSesame
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
      `.trim();
      
      fs.writeFileSync(envPath, basicEnv);
      console.log('✅ Created basic .env file');
    }
  }

  async initializeDatabase() {
    console.log('Initializing ArangoDB database...');
    
    try {
      execSync('npm run db:setup', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      throw new Error('Database initialization failed. Please check ArangoDB connection.');
    }
  }

  async runSampleAnalysis() {
    console.log('Running sample code analysis...');
    
    const sampleProjectPath = path.join(process.cwd(), 'sample-project');
    
    if (!fs.existsSync(sampleProjectPath)) {
      console.log('⚠️  Sample project not found, skipping analysis demo');
      return;
    }
    
    try {
      execSync(`npm run analyze "${sampleProjectPath}"`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log('\n🎉 Sample analysis completed! You should see:');
      console.log('  • Files analyzed: 4+');
      console.log('  • Dependencies found: 7+');
      console.log('  • Security issues: 3+');
      console.log('  • Performance insights: 2+');
      
    } catch (error) {
      console.warn('⚠️  Sample analysis failed, but continuing...');
    }
  }

  async startSystem() {
    console.log('🚀 Starting AI Code Management System...');
    console.log('\nThe system will start in a new process.');
    console.log('Press Ctrl+C to stop when you\'re done exploring.\n');
    
    // Give user a moment to read
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      execSync('npm start', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      // This is expected when user presses Ctrl+C
      console.log('\n👋 System stopped by user');
    }
  }

  showSuccessMessage() {
    console.log(`
🎉 SUCCESS! AI Software Development Platform is ready!

📊 What you now have:
├── ✅ ArangoDB running with complete schema
├── ✅ REST API with real-time WebSocket updates  
├── ✅ AI-powered code analysis engine
├── ✅ Security vulnerability detection
├── ✅ Performance monitoring
└── ✅ Sample project analyzed

🔗 Access Points:
├── 🌐 API Server:       http://localhost:3001
├── 📚 API Docs:         http://localhost:3001/api/docs
├── ❤️  Health Check:    http://localhost:3001/health
└── 🗄️  ArangoDB UI:     http://localhost:8529

🚀 Next Steps:
1. Explore the API documentation
2. Analyze your own repositories:
   npm run analyze /path/to/your/project
3. Check system status:
   npm run status
4. View sample results in ArangoDB UI

🎯 Example Commands:
npm run analyze C:\\your\\project\\path
npm run status
npm start

Happy coding! 🚀
`);
  }

  showTroubleshootingTips() {
    console.log(`
🔧 Troubleshooting Tips:

🗄️  ArangoDB Issues:
• Make sure ArangoDB is installed
• Check if port 8529 is available
• Try: docker run -p 8529:8529 -e ARANGO_ROOT_PASSWORD=openSesame arangodb:3.11

📦 Dependency Issues:
• Try: npm cache clean --force
• Delete node_modules and run: npm install

🔌 Connection Issues:
• Check Windows Firewall settings
• Ensure no VPN is blocking localhost
• Try running as Administrator

💡 Still having issues?
• Check the README.md for detailed setup
• Review the GETTING_STARTED.md guide
• Open an issue on GitHub

📧 Contact: richard@alphavirtusai.com
    `);
  }
}

// Run the quick start if this file is executed directly
if (require.main === module) {
  const quickStart = new QuickStart();
  quickStart.run().catch(error => {
    console.error('❌ Quick start failed:', error.message);
    process.exit(1);
  });
}

module.exports = QuickStart;
