const express = require('express');  
const axios = require('axios');  
const bodyParser = require('body-parser');  
require('dotenv').config(); // Load environment variables from .env file  
  
const app = express();  
const PORT = process.env.PORT || 4000;  
  
app.use(bodyParser.json());  
  
const JIRA_URL = process.env.JIRA_URL;  
const API_TOKEN = process.env.JIRA_API_TOKEN;  
const EMAIL = process.env.JIRA_EMAIL;  
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY;  
  
// Base64 encode the email and API token for authorization  
const AUTH_HEADER = Buffer.from(`${EMAIL}:${API_TOKEN}`).toString('base64');  
  
const headers = {  
  "Content-Type": "application/json",  
  "Authorization": `Basic ${AUTH_HEADER}`  
};  
  
// Create Jira Issue  
app.post('/api/jira/create', async (req, res) => {  
  const { issueType, summary, description, parentKey, epicKey } = req.body;  
  
  const data = {  
    fields: {  
      project: {  
        key: PROJECT_KEY  
      },  
      summary: summary,  
      description: description,  
      issuetype: {  
        name: issueType  
      }  
    }  
  };  
  
  if (issueType === "Epic") {  
    data.fields.customfield_10011 = summary; // Epic Name field  
  }  
  
  if (parentKey) {  
    data.fields.parent = { key: parentKey };  
  }  
  
  if (epicKey) {  
    data.fields.customfield_10014 = epicKey; // Epic Link field  
  }  
  
  try {  
    const response = await axios.post(`${JIRA_URL}/rest/api/2/issue`, data, { headers });  
    res.status(201).send(response.data);  
  } catch (error) {  
    res.status(500).send(error.response.data);  
  }  
});  
  
// Read Jira Issue  
app.get('/api/jira/read/:issueKey', async (req, res) => {  
  const { issueKey } = req.params;  
  
  try {  
    const response = await axios.get(`${JIRA_URL}/rest/api/2/issue/${issueKey}`, { headers });  
    res.status(200).send(response.data);  
  } catch (error) {  
    res.status(500).send(error.response.data);  
  }  
});  
  
// Update Jira Issue  
app.post('/api/jira/update', async (req, res) => {  
  const { issueKey, fields } = req.body;  
  
  try {  
    const response = await axios.put(`${JIRA_URL}/rest/api/2/issue/${issueKey}`, { fields }, { headers });  
    res.status(200).send(response.data);  
  } catch (error) {  
    res.status(500).send(error.response.data);  
  }  
});  
  
// Delete Jira Issue  
app.delete('/api/jira/delete/:issueKey', async (req, res) => {  
  const { issueKey } = req.params;  
  
  try {  
    await axios.delete(`${JIRA_URL}/rest/api/2/issue/${issueKey}`, { headers });  
    res.status(204).send();  
  } catch (error) {  
    res.status(500).send(error.response.data);  
  }  
});  
  
app.listen(PORT, () => {  
  console.log(`Server is running on port ${PORT}`);  
});  