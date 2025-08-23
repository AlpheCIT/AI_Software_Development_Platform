/**
 * Jira Integration Hook - LIVE DATA ONLY
 * Connects to real Jira instance via API service for live issue management
 * NO DEMO DATA - All data comes from live Jira instance
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';
import { jiraAPI } from '../services/jiraAPI';

interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description?: string;
  issueType: {
    name: string;
    iconUrl?: string;
  };
  priority: {
    name: string;
    iconUrl?: string;
  };
  status: {
    name: string;
    categoryKey: string;
  };
  assignee?: {
    accountId: string;
    displayName: string;
    avatarUrls: { '24x24': string };
  };
  labels: string[];
  updated: string;
  created: string;
  storyPoints?: number;
}

interface UseJiraIntegrationReturn {
  issues: JiraIssue[];
  isConnected: boolean;
  isLoading: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  error: Error | null;
  moveIssue: (issueKey: string, newStatus: string) => Promise<void>;
  createIssue: (issueData: Partial<JiraIssue> & { projectKey: string }) => Promise<JiraIssue>;
  updateIssue: (issueKey: string, updates: Partial<JiraIssue>) => Promise<JiraIssue>;
  deleteIssue: (issueKey: string) => Promise<void>;
  refreshIssues: () => Promise<void>;
}

export function useJiraIntegration(projectKey: string): UseJiraIntegrationReturn {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);
  const toast = useToast();

  // Load issues from live Jira only
  useEffect(() => {
    loadLiveIssues();
  }, [projectKey]);

  const loadLiveIssues = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Loading LIVE issues from Jira project: ${projectKey}`);
      
      // Always try to connect to live Jira first
      const connected = await jiraAPI.checkConnection();
      setIsConnected(connected);
      
      if (connected) {
        console.log('✅ Connected to live Jira, fetching real issues...');
        const jiraIssues = await jiraAPI.getProjectIssues(projectKey);
        
        if (jiraIssues && jiraIssues.length > 0) {
          console.log(`📋 Loaded ${jiraIssues.length} real issues from Jira`);
          setIssues(jiraIssues);
          
          toast({
            title: 'Live Jira Connection',
            description: `Loaded ${jiraIssues.length} real issues from ${projectKey}`,
            status: 'success',
            duration: 3000,
          });
        } else {
          console.log('⚠️ No issues found in Jira project');
          setIssues([]);
          
          toast({
            title: 'No Issues Found',
            description: `No issues found in Jira project ${projectKey}`,
            status: 'info',
            duration: 5000,
          });
        }
      } else {
        console.log('❌ Failed to connect to live Jira');
        setIssues([]);
        setError(new Error('Unable to connect to Jira. Please check your connection.'));
        
        toast({
          title: 'Jira Connection Failed',
          description: 'Unable to connect to live Jira instance. Please check your configuration.',
          status: 'error',
          duration: 8000,
        });
      }
      
    } catch (err) {
      console.error('❌ Failed to load live Jira issues:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsConnected(false);
      setIssues([]);
      
      toast({
        title: 'Error Loading Issues',
        description: 'Failed to load issues from Jira. Please try again.',
        status: 'error',
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const moveIssue = useCallback(async (issueKey: string, newStatus: string): Promise<void> => {
    setSyncStatus('syncing');
    setError(null);

    try {
      console.log(`🔄 Moving issue ${issueKey} to ${newStatus} in live Jira`);
      
      if (isConnected) {
        await jiraAPI.transitionIssue(issueKey, newStatus);
        console.log(`✅ Issue ${issueKey} moved to ${newStatus} in live Jira`);
      } else {
        throw new Error('Not connected to Jira');
      }
      
      // Update local state immediately for responsive UI
      setIssues(prev => prev.map(issue => 
        issue.key === issueKey 
          ? { ...issue, status: { ...issue.status, name: newStatus }, updated: new Date().toISOString() }
          : issue
      ));

      toast({
        title: 'Issue Moved',
        description: `${issueKey} moved to ${newStatus}`,
        status: 'success',
        duration: 3000,
      });

    } catch (err) {
      console.error(`❌ Failed to move issue ${issueKey}:`, err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setSyncStatus('error');
      
      toast({
        title: 'Move Failed',
        description: err instanceof Error ? err.message : 'Failed to move issue',
        status: 'error',
        duration: 5000,
      });
      
      throw err;
    } finally {
      setSyncStatus('idle');
    }
  }, [projectKey, isConnected, toast]);

  const createIssue = useCallback(async (issueData: Partial<JiraIssue> & { projectKey: string }): Promise<JiraIssue> => {
    setSyncStatus('syncing');
    setError(null);

    try {
      console.log(`➕ Creating new issue in live Jira project: ${issueData.projectKey}`);
      
      if (!isConnected) {
        throw new Error('Not connected to Jira');
      }
      
      const newIssue = await jiraAPI.createIssue({
        projectKey: issueData.projectKey,
        summary: issueData.summary!,
        description: issueData.description,
        issueType: issueData.issueType?.name || 'Story',
        priority: issueData.priority?.name,
        labels: issueData.labels,
        storyPoints: issueData.storyPoints
      });
      
      console.log(`✅ Created new issue: ${newIssue.key}`);
      
      // Add to local state
      setIssues(prev => [...prev, newIssue]);
      
      toast({
        title: 'Issue Created',
        description: `Created new issue: ${newIssue.key}`,
        status: 'success',
        duration: 3000,
      });
      
      return newIssue;

    } catch (err) {
      console.error('❌ Failed to create issue:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setSyncStatus('error');
      
      toast({
        title: 'Creation Failed',
        description: err instanceof Error ? err.message : 'Failed to create issue',
        status: 'error',
        duration: 5000,
      });
      
      throw err;
    } finally {
      setSyncStatus('idle');
    }
  }, [isConnected, toast]);

  const updateIssue = useCallback(async (issueKey: string, updates: Partial<JiraIssue>): Promise<JiraIssue> => {
    setSyncStatus('syncing');
    setError(null);

    try {
      console.log(`✏️ Updating issue ${issueKey} in live Jira`);
      
      if (!isConnected) {
        throw new Error('Not connected to Jira');
      }
      
      const updatedIssue = await jiraAPI.updateIssue(issueKey, {
        summary: updates.summary,
        description: updates.description,
        priority: updates.priority?.name,
        labels: updates.labels,
        storyPoints: updates.storyPoints
      });
      
      console.log(`✅ Updated issue: ${issueKey}`);
      
      // Update local state
      setIssues(prev => prev.map(issue => 
        issue.key === issueKey ? updatedIssue : issue
      ));
      
      toast({
        title: 'Issue Updated',
        description: `Updated issue: ${issueKey}`,
        status: 'success',
        duration: 3000,
      });
      
      return updatedIssue;

    } catch (err) {
      console.error(`❌ Failed to update issue ${issueKey}:`, err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setSyncStatus('error');
      
      toast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Failed to update issue',
        status: 'error',
        duration: 5000,
      });
      
      throw err;
    } finally {
      setSyncStatus('idle');
    }
  }, [projectKey, isConnected, toast]);

  const deleteIssue = useCallback(async (issueKey: string): Promise<void> => {
    setSyncStatus('syncing');
    setError(null);

    try {
      console.log(`🗑️ Attempting to delete issue ${issueKey} in live Jira`);
      
      if (!isConnected) {
        throw new Error('Not connected to Jira');
      }
      
      await jiraAPI.deleteIssue(issueKey);
      console.log(`✅ Issue ${issueKey} deletion requested`);
      
      // Remove from local state
      setIssues(prev => prev.filter(issue => issue.key !== issueKey));
      
      toast({
        title: 'Issue Delete Requested',
        description: `Delete request sent for issue: ${issueKey}`,
        status: 'info',
        duration: 3000,
      });

    } catch (err) {
      console.error(`❌ Failed to delete issue ${issueKey}:`, err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setSyncStatus('error');
      
      toast({
        title: 'Delete Failed', 
        description: err instanceof Error ? err.message : 'Failed to delete issue',
        status: 'error',
        duration: 5000,
      });
      
      throw err;
    } finally {
      setSyncStatus('idle');
    }
  }, [projectKey, isConnected, toast]);

  const refreshIssues = useCallback(async (): Promise<void> => {
    console.log('🔄 Refreshing issues from live Jira...');
    await loadLiveIssues();
  }, [projectKey]);

  return {
    issues,
    isConnected,
    isLoading,
    syncStatus,
    error,
    moveIssue,
    createIssue,
    updateIssue,
    deleteIssue,
    refreshIssues
  };
}

export default useJiraIntegration;
