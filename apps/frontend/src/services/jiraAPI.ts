/**
 * Jira API Integration Service
 * Handles communication with Jira via MCP and backend services
 */

class JiraAPIService {
  private cloudId: string = '';
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // For now, we'll use the backend API gateway that handles MCP integration
      // The gateway will manage the MCP connection to Atlassian services
      const response = await fetch('/api/jira/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.cloudId = data.cloudId;
        this.isInitialized = true;
        console.log('✅ Jira API Service initialized with Cloud ID:', this.cloudId);
      } else {
        throw new Error('Failed to connect to Jira service');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Jira API Service:', error);
      throw error;
    }
  }

  async getProjectIssues(projectKey: string): Promise<any[]> {
    await this.initialize();

    try {
      const response = await fetch(`/api/jira/projects/${projectKey}/issues`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch issues: ${response.statusText}`);
      }

      const data = await response.json();
      return data.issues?.map((issue: any) => this.transformIssue(issue)) || [];
    } catch (error) {
      console.error(`❌ Failed to fetch issues for project ${projectKey}:`, error);
      throw error;
    }
  }

  async getIssue(issueKey: string): Promise<any> {
    await this.initialize();

    try {
      const response = await fetch(`/api/jira/issues/${issueKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch issue: ${response.statusText}`);
      }

      const issue = await response.json();
      return this.transformIssue(issue);
    } catch (error) {
      console.error(`❌ Failed to fetch issue ${issueKey}:`, error);
      throw error;
    }
  }

  async createIssue(issueData: {
    projectKey: string;
    summary: string;
    description?: string;
    issueType: string;
    priority?: string;
    assigneeAccountId?: string;
    labels?: string[];
    storyPoints?: number;
  }): Promise<any> {
    await this.initialize();

    try {
      const response = await fetch('/api/jira/issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(issueData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create issue: ${response.statusText}`);
      }

      const newIssue = await response.json();
      return this.transformIssue(newIssue);
    } catch (error) {
      console.error('❌ Failed to create issue:', error);
      throw error;
    }
  }

  async updateIssue(issueKey: string, updates: {
    summary?: string;
    description?: string;
    priority?: string;
    labels?: string[];
    storyPoints?: number;
  }): Promise<any> {
    await this.initialize();

    try {
      const response = await fetch(`/api/jira/issues/${issueKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update issue: ${response.statusText}`);
      }

      const updatedIssue = await response.json();
      return this.transformIssue(updatedIssue);
    } catch (error) {
      console.error(`❌ Failed to update issue ${issueKey}:`, error);
      throw error;
    }
  }

  async transitionIssue(issueKey: string, newStatus: string): Promise<void> {
    await this.initialize();

    try {
      const response = await fetch(`/api/jira/issues/${issueKey}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error(`Failed to transition issue: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Failed to transition issue ${issueKey} to ${newStatus}:`, error);
      throw error;
    }
  }

  async deleteIssue(issueKey: string): Promise<void> {
    await this.initialize();

    try {
      // Note: Jira typically doesn't allow issue deletion via API
      throw new Error('Issue deletion is not supported via API. Use Jira web interface.');
    } catch (error) {
      console.error(`❌ Failed to delete issue ${issueKey}:`, error);
      throw error;
    }
  }

  async addComment(issueKey: string, comment: string): Promise<void> {
    await this.initialize();

    try {
      const response = await fetch(`/api/jira/issues/${issueKey}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment })
      });

      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Failed to add comment to issue ${issueKey}:`, error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<any> {
    await this.initialize();

    try {
      const response = await fetch('/api/jira/user/current', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get current user: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get current user:', error);
      throw error;
    }
  }

  async lookupUser(searchString: string): Promise<any[]> {
    await this.initialize();

    try {
      const response = await fetch(`/api/jira/users/search?q=${encodeURIComponent(searchString)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to lookup users: ${response.statusText}`);
      }

      const users = await response.json();
      return users || [];
    } catch (error) {
      console.error(`❌ Failed to lookup user with search string ${searchString}:`, error);
      throw error;
    }
  }

  // Utility method to check if service is connected
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/jira/status');
      return response.ok;
    } catch {
      return false;
    }
  }

  // Transform Jira API response to frontend format
  transformIssue(jiraIssue: any): any {
    return {
      id: jiraIssue.id,
      key: jiraIssue.key,
      summary: jiraIssue.fields?.summary || jiraIssue.summary || '',
      description: jiraIssue.fields?.description || jiraIssue.description || '',
      issueType: {
        name: jiraIssue.fields?.issuetype?.name || jiraIssue.issueType?.name || 'Unknown',
        iconUrl: jiraIssue.fields?.issuetype?.iconUrl || jiraIssue.issueType?.iconUrl
      },
      priority: {
        name: jiraIssue.fields?.priority?.name || jiraIssue.priority?.name || 'Medium',
        iconUrl: jiraIssue.fields?.priority?.iconUrl || jiraIssue.priority?.iconUrl
      },
      status: {
        name: jiraIssue.fields?.status?.name || jiraIssue.status?.name || 'To Do',
        categoryKey: jiraIssue.fields?.status?.statusCategory?.key || jiraIssue.status?.categoryKey || 'new'
      },
      assignee: jiraIssue.fields?.assignee || jiraIssue.assignee ? {
        accountId: jiraIssue.fields?.assignee?.accountId || jiraIssue.assignee?.accountId,
        displayName: jiraIssue.fields?.assignee?.displayName || jiraIssue.assignee?.displayName,
        avatarUrls: jiraIssue.fields?.assignee?.avatarUrls || jiraIssue.assignee?.avatarUrls || { '24x24': '' }
      } : undefined,
      labels: jiraIssue.fields?.labels || jiraIssue.labels || [],
      updated: jiraIssue.fields?.updated || jiraIssue.updated || new Date().toISOString(),
      created: jiraIssue.fields?.created || jiraIssue.created || new Date().toISOString(),
      storyPoints: jiraIssue.fields?.customfield_10016 || jiraIssue.storyPoints
    };
  }
}

// Export singleton instance
export const jiraAPI = new JiraAPIService();
export default jiraAPI;

