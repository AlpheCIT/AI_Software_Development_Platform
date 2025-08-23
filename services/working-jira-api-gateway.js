require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');

class WorkingJiraAPIGateway {
  constructor() {
    this.app = express();
    this.cloudId = process.env.JIRA_CLOUD_ID || '1961cbad-828b-4775-b0ec-7769f91b35dc';
    this.jiraBaseUrl = process.env.JIRA_SERVER_URL || process.env.JIRA_BASE_URL || 'https://alphavirtusai.atlassian.net';
    this.jiraApiUrl = `${this.jiraBaseUrl}/rest/api/3`;
    
    this.jiraAuth = {
      email: process.env.JIRA_USERNAME || process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN || ''
    };
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/jira/status', (req, res) => {
      res.json({ 
        status: 'connected', 
        cloudId: this.cloudId,
        project: 'SCRUM',
        timestamp: new Date().toISOString() 
      });
    });

    // Get ALL project issues - REAL DATA
    this.app.get('/api/jira/projects/:projectKey/issues', async (req, res) => {
      try {
        const { projectKey } = req.params;
        console.log(`📋 Fetching REAL Jira issues for project: ${projectKey}`);

        const issues = await this.getRealJiraIssues(projectKey);
        
        res.json({ 
          success: true,
          issues,
          projectKey,
          cloudId: this.cloudId,
          totalIssues: issues.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Error fetching project issues:', error);
        res.status(500).json({ 
          error: 'Failed to fetch project issues',
          message: error.message,
          cloudId: this.cloudId
        });
      }
    });

    // Get specific issue
    this.app.get('/api/jira/issues/:issueKey', async (req, res) => {
      try {
        const { issueKey } = req.params;
        const issues = await this.getRealJiraIssues('SCRUM');
        const issue = issues.find(i => i.key === issueKey);
        
        if (issue) {
          res.json({ success: true, issue });
        } else {
          res.status(404).json({ error: 'Issue not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch issue', message: error.message });
      }
    });
  }

  async getRealJiraIssues(projectKey) {
    console.log(`🔍 Fetching REAL issues from Jira project: ${projectKey}`);
    console.log(`📧 Using email: ${this.jiraAuth.email}`);
    console.log(`🔑 Token configured: ${this.jiraAuth.apiToken ? 'Yes' : 'No'}`);
    
    return new Promise((resolve, reject) => {
      const jql = encodeURIComponent(`project = ${projectKey} ORDER BY created DESC`);
      const path = `/rest/api/3/search?jql=${jql}&maxResults=100&fields=*all`;
      
      console.log(`📞 API call: ${this.jiraBaseUrl}${path}`);
      
      const options = {
        hostname: 'alphavirtusai.atlassian.net',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.jiraAuth.email}:${this.jiraAuth.apiToken}`).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };
      
      const req = https.request(options, (res) => {
        console.log(`📡 Jira Response: ${res.statusCode}`);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data);
              console.log(`✅ SUCCESS! Found ${result.issues.length} REAL issues from Jira`);
              console.log(`📊 Total available: ${result.total}`);
              
              // Format issues for frontend
              const formattedIssues = result.issues.map(issue => ({
                id: issue.id,
                key: issue.key,
                fields: {
                  summary: issue.fields.summary,
                  description: issue.fields.description || '',
                  issuetype: {
                    name: issue.fields.issuetype.name,
                    iconUrl: issue.fields.issuetype.iconUrl || ''
                  },
                  priority: {
                    name: issue.fields.priority?.name || 'Medium',
                    iconUrl: issue.fields.priority?.iconUrl || ''
                  },
                  status: {
                    name: issue.fields.status.name,
                    statusCategory: issue.fields.status.statusCategory
                  },
                  assignee: issue.fields.assignee ? {
                    displayName: issue.fields.assignee.displayName,
                    emailAddress: issue.fields.assignee.emailAddress
                  } : null,
                  labels: issue.fields.labels || [],
                  updated: issue.fields.updated,
                  created: issue.fields.created,
                  customfield_10016: issue.fields.customfield_10016 || 0
                }
              }));
              
              resolve(formattedIssues);
            } catch (error) {
              console.error('❌ Parse error:', error);
              reject(error);
            }
          } else {
            console.error(`❌ API error: ${res.statusCode}`);
            console.log('Error response:', data.substring(0, 300));
            reject(new Error(`Jira API error: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', error => {
        console.error('❌ Request error:', error);
        reject(error);
      });
      
      req.end();
    });
  }

  async start(port = 3001) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log('🚀 Working Jira API Gateway started');
        console.log(`📡 Server running on http://localhost:${port}`);
        console.log(`🏢 Connected to: ${this.jiraBaseUrl}`);
        console.log(`📋 Project: SCRUM`);
        console.log(`✅ Ready to serve REAL Jira data (no more fake data!)`);
        resolve(this.server);
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('🛑 Working Jira API Gateway stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = { WorkingJiraAPIGateway };

// Start the server if run directly
if (require.main === module) {
  const gateway = new WorkingJiraAPIGateway();
  
  gateway.start().catch(error => {
    console.error('❌ Failed to start gateway:', error);
    process.exit(1);
  });
  
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Working Jira API Gateway...');
    await gateway.stop();
    process.exit(0);
  });
}
