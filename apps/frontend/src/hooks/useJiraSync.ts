/**
 * Jira Synchronization Hook
 * Manages bidirectional sync between frontend Kanban and Jira
 */

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { useKanbanStore } from '../stores/kanban-store';

interface JiraIssue {
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

interface UseJiraSyncReturn {
  isConnected: boolean;
  syncStatus: 'idle' | 'syncing' | 'error' | 'conflict';
  lastSyncTime?: Date;
  pendingChanges: number;
  moveIssue: (issueId: string, newStatus: string) => Promise<void>;
  createIssue: (issueData: Partial<JiraIssue>) => Promise<JiraIssue>;
  updateIssue: (issueId: string, updates: Partial<JiraIssue>) => Promise<JiraIssue>;
  deleteIssue: (issueId: string) => Promise<void>;
  forceSync: () => Promise<void>;
  error?: Error;
}

export function useJiraSync(projectKey: string): UseJiraSyncReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'conflict'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date>();
  const [pendingChanges, setPendingChanges] = useState(0);
  const [error, setError] = useState<Error>();
  
  const { addIssue, updateIssueInStore, removeIssue, markAsLocalChange } = useKanbanStore();
  
  // WebSocket connection for real-time updates
  const { 
    isConnected: wsConnected, 
    subscribe, 
    unsubscribe,
    emit 
  } = useWebSocket('jira-sync');

  // Check Jira connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/jira/status');
        setIsConnected(response.ok && wsConnected);
      } catch (error) {
        setIsConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [wsConnected]);

  // WebSocket event handlers
  useEffect(() => {
    if (!wsConnected) return;

    const handleIssueUpdated = (data: { issue: JiraIssue; source: 'jira' | 'frontend' }) => {
      if (data.source === 'jira') {
        // Update came from Jira, update local state
        updateIssueInStore(data.issue);
        setLastSyncTime(new Date());
      }
    };

    const handleIssueCreated = (data: { issue: JiraIssue; source: 'jira' | 'frontend' }) => {
      if (data.source === 'jira') {
        addIssue(data.issue);
        setLastSyncTime(new Date());
      }
    };

    const handleIssueDeleted = (data: { issueId: string; source: 'jira' | 'frontend' }) => {
      if (data.source === 'jira') {
        removeIssue(data.issueId);
        setLastSyncTime(new Date());
      }
    };

    const handleSyncStatus = (data: { status: string; pendingChanges: number }) => {
      setSyncStatus(data.status as any);
      setPendingChanges(data.pendingChanges);
    };

    const handleSyncError = (data: { error: string }) => {
      setSyncStatus('error');
      setError(new Error(data.error));
    };

    // Subscribe to WebSocket events
    subscribe('jira:issue-updated', handleIssueUpdated);
    subscribe('jira:issue-created', handleIssueCreated);
    subscribe('jira:issue-deleted', handleIssueDeleted);
    subscribe('jira:sync-status', handleSyncStatus);
    subscribe('jira:sync-error', handleSyncError);

    return () => {
      unsubscribe('jira:issue-updated', handleIssueUpdated);
      unsubscribe('jira:issue-created', handleIssueCreated);
      unsubscribe('jira:issue-deleted', handleIssueDeleted);
      unsubscribe('jira:sync-status', handleSyncStatus);
      unsubscribe('jira:sync-error', handleSyncError);
    };
  }, [wsConnected, subscribe, unsubscribe, updateIssueInStore, addIssue, removeIssue]);

  const moveIssue = useCallback(async (issueId: string, newStatus: string): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Jira');
    }

    setSyncStatus('syncing');
    setError(undefined);

    try {
      const response = await fetch(`/api/jira/issues/${issueId}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: newStatus,
          projectKey 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to move issue');
      }

      const updatedIssue = await response.json();
      
      // Emit WebSocket event for real-time sync
      emit('kanban:issue-moved', {
        issueId,
        newStatus,
        projectKey,
        source: 'frontend'
      });

      setSyncStatus('idle');
      setLastSyncTime(new Date());
      
    } catch (error) {
      setSyncStatus('error');
      setError(error as Error);
      throw error;
    }
  }, [isConnected, projectKey, emit]);

  const createIssue = useCallback(async (issueData: Partial<JiraIssue>): Promise<JiraIssue> => {
    if (!isConnected) {
      throw new Error('Not connected to Jira');
    }

    setSyncStatus('syncing');
    setError(undefined);

    try {
      const response = await fetch('/api/jira/issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...issueData,
          projectKey
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create issue');
      }

      const newIssue = await response.json();

      // Add to local store
      addIssue(newIssue);

      // Emit WebSocket event
      emit('kanban:issue-created', {
        issue: newIssue,
        projectKey,
        source: 'frontend'
      });

      setSyncStatus('idle');
      setLastSyncTime(new Date());

      return newIssue;
      
    } catch (error) {
      setSyncStatus('error');
      setError(error as Error);
      throw error;
    }
  }, [isConnected, projectKey, addIssue, emit]);

  const updateIssue = useCallback(async (issueId: string, updates: Partial<JiraIssue>): Promise<JiraIssue> => {
    if (!isConnected) {
      throw new Error('Not connected to Jira');
    }

    setSyncStatus('syncing');
    setError(undefined);

    try {
      const response = await fetch(`/api/jira/issues/${issueId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updates,
          projectKey
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update issue');
      }

      const updatedIssue = await response.json();

      // Update local store
      updateIssueInStore(updatedIssue);

      // Emit WebSocket event
      emit('kanban:issue-updated', {
        issue: updatedIssue,
        projectKey,
        source: 'frontend'
      });

      setSyncStatus('idle');
      setLastSyncTime(new Date());

      return updatedIssue;
      
    } catch (error) {
      setSyncStatus('error');
      setError(error as Error);
      throw error;
    }
  }, [isConnected, projectKey, updateIssueInStore, emit]);

  const deleteIssue = useCallback(async (issueId: string): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Jira');
    }

    setSyncStatus('syncing');
    setError(undefined);

    try {
      const response = await fetch(`/api/jira/issues/${issueId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete issue');
      }

      // Remove from local store
      removeIssue(issueId);

      // Emit WebSocket event
      emit('kanban:issue-deleted', {
        issueId,
        projectKey,
        source: 'frontend'
      });

      setSyncStatus('idle');
      setLastSyncTime(new Date());
      
    } catch (error) {
      setSyncStatus('error');
      setError(error as Error);
      throw error;
    }
  }, [isConnected, projectKey, removeIssue, emit]);

  const forceSync = useCallback(async (): Promise<void> => {
    setSyncStatus('syncing');
    setError(undefined);

    try {
      const response = await fetch(`/api/jira/projects/${projectKey}/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to sync with Jira');
      }

      // Emit WebSocket event to trigger sync
      emit('kanban:force-sync', {
        projectKey,
        source: 'frontend'
      });

      setSyncStatus('idle');
      setLastSyncTime(new Date());
      setPendingChanges(0);
      
    } catch (error) {
      setSyncStatus('error');
      setError(error as Error);
      throw error;
    }
  }, [projectKey, emit]);

  return {
    isConnected,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    moveIssue,
    createIssue,
    updateIssue,
    deleteIssue,
    forceSync,
    error
  };
}

export default useJiraSync;
