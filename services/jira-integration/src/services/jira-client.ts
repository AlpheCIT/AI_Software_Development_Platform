/**
 * Jira Client
 * Handles communication with Jira REST API
 */

import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import logger from '../utils/logger';

// Zod schemas for validation
const IssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  fields: z.object({
    summary: z.string(),
    description: z.string().optional(),
    issuetype: z.object({
      id: z.string(),
      name: z.string(),
      iconUrl: z.string().optional()
    }),
    priority: z.object({
      id: z.string(),
      name: z.string(),
      iconUrl: z.string().optional()
    }),
    status: z.object({
      id: z.string(),
      name: z.string(),
      statusCategory: z.object({
        key: z.string()
      })
    }),
    assignee: z.object({
      accountId: z.string(),
      displayName: z.string(),
      emailAddress: z.string().optional(),
      avatarUrls: z.object({
        '24x24': z.string()
      })
    }).optional(),
    labels: z.array(z.string()).default([]),
    updated: z.string(),
    customfield_10016: z.number().optional() // Story Points
  })
});

interface JiraClientConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description?: string;
  issueType: string;
  priority: string;
  status: string;
  assignee?: {
    accountId: string;
    displayName: string;
    avatarUrls: { '24x24': string };
  };
  labels: string[];
  updated: string;
  storyPoints?: number;
}

export class JiraClient {
  private client: AxiosInstance;

  constructor(config: JiraClientConfig) {
    this.client = axios.create({
      baseURL: `${config.baseUrl}/rest/api/3`,
      auth: {
        username: config.email,
        password: config.apiToken
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Add interceptors for logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Jira API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/myself');
      return true;
    } catch (error) {
      throw new Error('Failed to connect to Jira');
    }
  }

  async getConnectionStatus(): Promise<'connected' | 'error'> {
    try {
      await this.client.get('/myself');
      return 'connected';
    } catch {
      return 'error';
    }
  }

  async getProjectIssues(projectKey: string): Promise<JiraIssue[]> {
    const response = await this.client.get('/search', {
      params: {
        jql: `project = ${projectKey} ORDER BY updated DESC`,
        maxResults: 100,
        fields: 'id,key,summary,description,issuetype,priority,status,assignee,labels,updated,customfield_10016'
      }
    });

    return response.data.issues.map((issue: any) => this.transformIssue(issue));
  }

  async createIssue(projectKey: string, issueData: Partial<JiraIssue>): Promise<JiraIssue> {
    const payload = {
      fields: {
        project: { key: projectKey },
        summary: issueData.summary,
        description: issueData.description,
        issuetype: { name: issueData.issueType || 'Task' },
        priority: { name: issueData.priority || 'Medium' },
        assignee: issueData.assignee ? { accountId: issueData.assignee.accountId } : null,
        labels: issueData.labels || []
      }
    };

    const response = await this.client.post('/issue', payload);
    return await this.getIssue(response.data.key);
  }

  async getIssue(issueIdOrKey: string): Promise<JiraIssue> {
    const response = await this.client.get(`/issue/${issueIdOrKey}`);
    return this.transformIssue(response.data);
  }

  async transitionIssue(issueIdOrKey: string, transitionName: string): Promise<JiraIssue> {
    // Get available transitions
    const transitionsResponse = await this.client.get(`/issue/${issueIdOrKey}/transitions`);
    const transition = transitionsResponse.data.transitions.find((t: any) => 
      t.to.name.toLowerCase() === transitionName.toLowerCase()
    );

    if (!transition) {
      throw new Error(`No transition found for status: ${transitionName}`);
    }

    await this.client.post(`/issue/${issueIdOrKey}/transitions`, {
      transition: { id: transition.id }
    });

    return await this.getIssue(issueIdOrKey);
  }

  private transformIssue(jiraIssue: any): JiraIssue {
    return {
      id: jiraIssue.id,
      key: jiraIssue.key,
      summary: jiraIssue.fields.summary,
      description: jiraIssue.fields.description,
      issueType: jiraIssue.fields.issuetype.name,
      priority: jiraIssue.fields.priority.name,
      status: jiraIssue.fields.status.name,
      assignee: jiraIssue.fields.assignee ? {
        accountId: jiraIssue.fields.assignee.accountId,
        displayName: jiraIssue.fields.assignee.displayName,
        avatarUrls: jiraIssue.fields.assignee.avatarUrls
      } : undefined,
      labels: jiraIssue.fields.labels || [],
      updated: jiraIssue.fields.updated,
      storyPoints: jiraIssue.fields.customfield_10016
    };
  }
}
