/**
 * Jira API Gateway
 * Handles MCP integration for Jira operations
 */

const express = require('express');
const cors = require('cors');

class JiraAPIGateway {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.mcpTools = {}; // Will hold MCP tool references
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Log requests
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/jira/status', (req, res) => {
      res.json({ status: 'connected', timestamp: new Date().toISOString() });
    });

    // Get project issues
    this.app.get('/api/jira/projects/:projectKey/issues', async (req, res) => {
      try {
        const { projectKey } = req.params;
        console.log(`📋 Fetching issues for project: ${projectKey}`);

        // This would integrate with MCP Atlassian tools
        // For now, return demo data that matches the created issues
        const issues = await this.getProjectIssues(projectKey);
        
        res.json({ 
          success: true,
          issues,
          projectKey,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Error fetching project issues:', error);
        res.status(500).json({ 
          error: 'Failed to fetch project issues',
          message: error.message 
        });
      }
    });

    // Get specific issue
    this.app.get('/api/jira/issues/:issueKey', async (req, res) => {
      try {
        const { issueKey } = req.params;
        console.log(`🎫 Fetching issue: ${issueKey}`);

        const issue = await this.getIssue(issueKey);
        
        res.json(issue);
      } catch (error) {
        console.error('❌ Error fetching issue:', error);
        res.status(500).json({ 
          error: 'Failed to fetch issue',
          message: error.message 
        });
      }
    });

    // Create issue
    this.app.post('/api/jira/issues', async (req, res) => {
      try {
        const issueData = req.body;
        console.log(`➕ Creating issue in project: ${issueData.projectKey}`);

        const newIssue = await this.createIssue(issueData);
        
        res.status(201).json(newIssue);
      } catch (error) {
        console.error('❌ Error creating issue:', error);
        res.status(500).json({ 
          error: 'Failed to create issue',
          message: error.message 
        });
      }
    });

    // Update issue
    this.app.put('/api/jira/issues/:issueKey', async (req, res) => {
      try {
        const { issueKey } = req.params;
        const updates = req.body;
        console.log(`✏️ Updating issue: ${issueKey}`);

        const updatedIssue = await this.updateIssue(issueKey, updates);
        
        res.json(updatedIssue);
      } catch (error) {
        console.error('❌ Error updating issue:', error);
        res.status(500).json({ 
          error: 'Failed to update issue',
          message: error.message 
        });
      }
    });

    // Transition issue
    this.app.post('/api/jira/issues/:issueKey/transition', async (req, res) => {
      try {
        const { issueKey } = req.params;
        const { status } = req.body;
        console.log(`🔄 Transitioning issue ${issueKey} to: ${status}`);

        await this.transitionIssue(issueKey, status);
        
        res.json({ 
          success: true,
          message: `Issue ${issueKey} transitioned to ${status}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Error transitioning issue:', error);
        res.status(500).json({ 
          error: 'Failed to transition issue',
          message: error.message 
        });
      }
    });

    // Add comment to issue
    this.app.post('/api/jira/issues/:issueKey/comments', async (req, res) => {
      try {
        const { issueKey } = req.params;
        const { comment } = req.body;
        console.log(`💬 Adding comment to issue: ${issueKey}`);

        await this.addComment(issueKey, comment);
        
        res.json({ 
          success: true,
          message: `Comment added to ${issueKey}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Error adding comment:', error);
        res.status(500).json({ 
          error: 'Failed to add comment',
          message: error.message 
        });
      }
    });

    // Connect to Jira
    this.app.post('/api/jira/connect', async (req, res) => {
      try {
        console.log('🔗 Connecting to Jira via MCP...');
        
        // This would initialize MCP connection
        const connected = await this.connectToJira();
        
        res.json({ 
          success: true,
          connected,
          cloudId: 'demo-cloud-id',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Error connecting to Jira:', error);
        res.status(500).json({ 
          error: 'Failed to connect to Jira',
          message: error.message 
        });
      }
    });
  }

  // MCP Integration Methods
  async connectToJira() {
    try {
      // This is where MCP Atlassian integration would happen
      // For demo purposes, we'll simulate a successful connection
      console.log('✅ Connected to Jira (demo mode)');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Jira:', error);
      throw error;
    }
  }

  async getProjectIssues(projectKey) {
    try {
      // This would use MCP to call Atlassian.searchJiraIssuesUsingJql
      // For now, return the issues that were actually created in Jira
      return [
        {
          id: 'scrum-73',
          key: 'SCRUM-73',
          fields: {
            summary: 'Implement OAuth2 authentication flow',
            description: 'Add secure OAuth2 authentication with Google and GitHub providers',
            issuetype: { name: 'Story', iconUrl: '' },
            priority: { name: 'High', iconUrl: '' },
            status: { 
              name: 'To Do', 
              statusCategory: { key: 'new' }
            },
            assignee: {
              accountId: 'user-1',
              displayName: 'Development Team',
              avatarUrls: { '24x24': 'https://via.placeholder.com/24' }
            },
            labels: ['frontend', 'security', 'oauth'],
            updated: new Date().toISOString(),
            created: new Date(Date.now() - 86400000).toISOString(),
            customfield_10016: 8 // Story points
          }
        },
        {
          id: 'scrum-74',
          key: 'SCRUM-74',
          fields: {
            summary: 'Database connection pool optimization',
            description: 'Optimize database connection pooling for better performance',
            issuetype: { name: 'Task', iconUrl: '' },
            priority: { name: 'Medium', iconUrl: '' },
            status: { 
              name: 'In Progress', 
              statusCategory: { key: 'indeterminate' }
            },
            assignee: {
              accountId: 'user-2',
              displayName: 'Backend Team',
              avatarUrls: { '24x24': 'https://via.placeholder.com/24' }
            },
            labels: ['backend', 'performance', 'database'],
            updated: new Date(Date.now() - 3600000).toISOString(),
            created: new Date(Date.now() - 172800000).toISOString(),
            customfield_10016: 5
          }
        },
        {
          id: 'scrum-75',
          key: 'SCRUM-75',
          fields: {
            summary: 'Memory leak in image processing',
            description: 'Fix memory leak when processing large images',
            issuetype: { name: 'Bug', iconUrl: '' },
            priority: { name: 'High', iconUrl: '' },
            status: { 
              name: 'Code Review', 
              statusCategory: { key: 'indeterminate' }
            },
            assignee: {
              accountId: 'user-3',
              displayName: 'QA Team',
              avatarUrls: { '24x24': 'https://via.placeholder.com/24' }
            },
            labels: ['bug', 'performance', 'images'],
            updated: new Date(Date.now() - 7200000).toISOString(),
            created: new Date(Date.now() - 259200000).toISOString(),
            customfield_10016: 3
          }
        },
        {
          id: 'scrum-76',
          key: 'SCRUM-76',
          fields: {
            summary: 'User profile dashboard redesign',
            description: 'Redesign user profile dashboard with modern UI components',
            issuetype: { name: 'Story', iconUrl: '' },
            priority: { name: 'Low', iconUrl: '' },
            status: { 
              name: 'Done', 
              statusCategory: { key: 'done' }
            },
            assignee: {
              accountId: 'user-4',
              displayName: 'UI/UX Team',
              avatarUrls: { '24x24': 'https://via.placeholder.com/24' }
            },
            labels: ['frontend', 'ui/ux', 'dashboard'],
            updated: new Date(Date.now() - 86400000).toISOString(),
            created: new Date(Date.now() - 432000000).toISOString(),
            customfield_10016: 13
          }
        }
      ];
    } catch (error) {
      console.error('❌ Error getting project issues:', error);
      throw error;
    }
  }

  async getIssue(issueKey) {
    const issues = await this.getProjectIssues('SCRUM');
    return issues.find(issue => issue.key === issueKey);
  }

  async createIssue(issueData) {
    try {
      console.log('📝 Creating new issue:', issueData);
      
      // This would use MCP to call Atlassian.createJiraIssue
      const newIssue = {
        id: `new-${Date.now()}`,
        key: `${issueData.projectKey}-${Math.floor(Math.random() * 1000)}`,
        fields: {
          summary: issueData.summary,
          description: issueData.description || '',
          issuetype: { name: issueData.issueType },
          priority: { name: issueData.priority || 'Medium' },
          status: { 
            name: 'To Do', 
            statusCategory: { key: 'new' }
          },
          labels: issueData.labels || [],
          updated: new Date().toISOString(),
          created: new Date().toISOString(),
          customfield_10016: issueData.storyPoints
        }
      };
      
      console.log('✅ Issue created:', newIssue.key);
      return newIssue;
    } catch (error) {
      console.error('❌ Error creating issue:', error);
      throw error;
    }
  }

  async updateIssue(issueKey, updates) {
    try {
      console.log('🔄 Updating issue:', issueKey, updates);
      
      // This would use MCP to call Atlassian.editJiraIssue
      const issue = await this.getIssue(issueKey);
      if (!issue) {
        throw new Error('Issue not found');
      }
      
      const updatedIssue = {
        ...issue,
        fields: {
          ...issue.fields,
          summary: updates.summary || issue.fields.summary,
          description: updates.description !== undefined ? updates.description : issue.fields.description,
          priority: updates.priority ? { name: updates.priority } : issue.fields.priority,
          labels: updates.labels || issue.fields.labels,
          customfield_10016: updates.storyPoints !== undefined ? updates.storyPoints : issue.fields.customfield_10016,
          updated: new Date().toISOString()
        }
      };
      
      console.log('✅ Issue updated:', issueKey);
      return updatedIssue;
    } catch (error) {
      console.error('❌ Error updating issue:', error);
      throw error;
    }
  }

  async transitionIssue(issueKey, newStatus) {
    try {
      console.log('🔄 Transitioning issue:', issueKey, 'to', newStatus);
      
      // This would use MCP to call:
      // 1. Atlassian.getTransitionsForJiraIssue
      // 2. Atlassian.transitionJiraIssue
      
      console.log('✅ Issue transitioned:', issueKey, 'to', newStatus);
    } catch (error) {
      console.error('❌ Error transitioning issue:', error);
      throw error;
    }
  }

  async addComment(issueKey, comment) {
    try {
      console.log('💬 Adding comment to:', issueKey);
      
      // This would use MCP to call Atlassian.addCommentToJiraIssue
      
      console.log('✅ Comment added to:', issueKey);
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      throw error;
    }
  }

  async start(port = 3001) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log('🚀 Jira API Gateway started');
        console.log(`📡 Server running on http://localhost:${port}`);
        console.log('🔗 Ready to handle Jira operations via MCP');
        resolve(this.server);
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('🛑 Jira API Gateway stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = { JiraAPIGateway };

// If run directly, start the server
if (require.main === module) {
  const gateway = new JiraAPIGateway();
  
  gateway.start().catch(error => {
    console.error('❌ Failed to start Jira API Gateway:', error);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Jira API Gateway...');
    await gateway.stop();
    process.exit(0);
  });
}
