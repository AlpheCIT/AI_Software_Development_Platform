require('dotenv').config();
const https = require('https');

console.log('🔧 Testing Jira API Connection...');
console.log(`📧 Email: ${process.env.JIRA_USERNAME || process.env.JIRA_EMAIL}`);
console.log(`🔑 API Token: ${(process.env.JIRA_API_TOKEN || '').substring(0, 10)}...`);
console.log(`🌐 Server URL: ${process.env.JIRA_SERVER_URL}`);

const email = process.env.JIRA_USERNAME || process.env.JIRA_EMAIL;
const apiToken = process.env.JIRA_API_TOKEN;
const baseUrl = process.env.JIRA_SERVER_URL || 'https://alphavirtusai.atlassian.net';

if (!email || !apiToken) {
  console.error('❌ Missing JIRA_USERNAME/JIRA_EMAIL or JIRA_API_TOKEN');
  process.exit(1);
}

const jql = encodeURIComponent('project = SCRUM ORDER BY created DESC');
const path = `/rest/api/3/search?jql=${jql}&maxResults=100&fields=*all`;

const options = {
  hostname: 'alphavirtusai.atlassian.net',
  port: 443,
  path: path,
  method: 'GET',
  headers: {
    'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

console.log(`📞 Making request to: https://alphavirtusai.atlassian.net${path}`);

const req = https.request(options, (res) => {
  console.log(`📡 Response Status: ${res.statusCode}`);
  console.log(`📋 Response Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`📦 Response Length: ${data.length} bytes`);
    
    if (res.statusCode === 200) {
      try {
        const result = JSON.parse(data);
        console.log(`✅ SUCCESS! Found ${result.issues.length} issues`);
        console.log(`📊 Total issues in project: ${result.total}`);
        console.log('📝 First 3 issue keys:');
        result.issues.slice(0, 3).forEach(issue => {
          console.log(`   - ${issue.key}: ${issue.fields.summary}`);
        });
      } catch (error) {
        console.error('❌ Error parsing response:', error);
        console.log('Raw response (first 200 chars):', data.substring(0, 200));
      }
    } else {
      console.error(`❌ API Error: ${res.statusCode}`);
      console.log('Error response:', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request Error:', error);
});

req.end();
