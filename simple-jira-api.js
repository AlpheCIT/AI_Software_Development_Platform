require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

// Environment configuration
const jiraAuth = {
  email: process.env.JIRA_USERNAME || process.env.JIRA_EMAIL,
  apiToken: process.env.JIRA_API_TOKEN
};

console.log('🔧 Simple Jira API Test Server');
console.log(`📧 Email: ${jiraAuth.email}`);
console.log(`🔑 Token configured: ${jiraAuth.apiToken ? 'Yes' : 'No'}`);

// Simple route to get real Jira issues
app.get('/api/jira/issues', async (req, res) => {
  console.log('🔍 Fetching real Jira issues...');
  
  const jql = encodeURIComponent('project = SCRUM ORDER BY created DESC');
  const path = `/rest/api/3/search?jql=${jql}&maxResults=100&fields=*all`;
  
  const options = {
    hostname: 'alphavirtusai.atlassian.net',
    port: 443,
    path: path,
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${jiraAuth.email}:${jiraAuth.apiToken}`).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  
  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    
    apiRes.on('data', (chunk) => {
      data += chunk;
    });
    
    apiRes.on('end', () => {
      if (apiRes.statusCode === 200) {
        try {
          const result = JSON.parse(data);
          console.log(`✅ Found ${result.issues.length} real issues from Jira`);
          
          // Format the response
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
          
          res.json({
            success: true,
            issues: formattedIssues,
            total: result.total,
            projectKey: 'SCRUM',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Error parsing Jira response:', error);
          res.status(500).json({ error: 'Failed to parse Jira response' });
        }
      } else {
        console.error(`❌ Jira API error: ${apiRes.statusCode}`);
        res.status(apiRes.statusCode).json({ error: 'Jira API error' });
      }
    });
  });
  
  apiReq.on('error', (error) => {
    console.error('❌ Network error:', error);
    res.status(500).json({ error: 'Network error connecting to Jira' });
  });
  
  apiReq.end();
});

// Start server
const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Simple Jira API Server running on http://localhost:${PORT}`);
  console.log(`✅ Ready to serve REAL Jira data from alphavirtusai.atlassian.net`);
});

module.exports = server;
