/**
 * Jira Metadata Hook
 * Fetches and caches Jira project metadata (issue types, priorities, users, etc.)
 */

import { useState, useEffect } from 'react';

interface IssueType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
}

interface Priority {
  id: string;
  name: string;
  iconUrl: string;
}

interface User {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: {
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
}

interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  lead: User;
  projectTypeKey: string;
}

interface UseJiraMetadataReturn {
  issueTypes: IssueType[];
  priorities: Priority[];
  users: User[];
  project?: Project;
  isLoading: boolean;
  error?: Error;
  refetch: () => Promise<void>;
}

export function useJiraMetadata(projectKey: string): UseJiraMetadataReturn {
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [project, setProject] = useState<Project>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error>();

  const fetchMetadata = async () => {
    if (!projectKey) return;

    setIsLoading(true);
    setError(undefined);

    try {
      // Fetch all metadata in parallel
      const [
        projectResponse,
        issueTypesResponse,
        prioritiesResponse,
        usersResponse
      ] = await Promise.all([
        fetch(`/api/jira/projects/${projectKey}`),
        fetch(`/api/jira/projects/${projectKey}/issue-types`),
        fetch(`/api/jira/priorities`),
        fetch(`/api/jira/projects/${projectKey}/users`)
      ]);

      // Check if all requests were successful
      if (!projectResponse.ok) {
        throw new Error(`Failed to fetch project: ${projectResponse.statusText}`);
      }
      if (!issueTypesResponse.ok) {
        throw new Error(`Failed to fetch issue types: ${issueTypesResponse.statusText}`);
      }
      if (!prioritiesResponse.ok) {
        throw new Error(`Failed to fetch priorities: ${prioritiesResponse.statusText}`);
      }
      if (!usersResponse.ok) {
        throw new Error(`Failed to fetch users: ${usersResponse.statusText}`);
      }

      // Parse responses
      const [
        projectData,
        issueTypesData,
        prioritiesData,
        usersData
      ] = await Promise.all([
        projectResponse.json(),
        issueTypesResponse.json(),
        prioritiesResponse.json(),
        usersResponse.json()
      ]);

      // Update state
      setProject(projectData);
      setIssueTypes(issueTypesData.issueTypes || []);
      setPriorities(prioritiesData.priorities || []);
      setUsers(usersData.users || []);

    } catch (err) {
      console.error('Failed to fetch Jira metadata:', err);
      setError(err as Error);
      
      // Set default values on error
      setIssueTypes([
        { id: '1', name: 'Task', description: 'A task', iconUrl: '', subtask: false },
        { id: '2', name: 'Bug', description: 'A bug', iconUrl: '', subtask: false },
        { id: '3', name: 'Story', description: 'A user story', iconUrl: '', subtask: false }
      ]);
      setPriorities([
        { id: '1', name: 'Highest', iconUrl: '' },
        { id: '2', name: 'High', iconUrl: '' },
        { id: '3', name: 'Medium', iconUrl: '' },
        { id: '4', name: 'Low', iconUrl: '' },
        { id: '5', name: 'Lowest', iconUrl: '' }
      ]);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [projectKey]);

  return {
    issueTypes,
    priorities,
    users,
    project,
    isLoading,
    error,
    refetch: fetchMetadata
  };
}

export default useJiraMetadata;
