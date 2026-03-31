/**
 * Kanban Board Store
 * Zustand store for managing Kanban board state with Jira synchronization
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface Issue {
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
  isLocalChange?: boolean;
  isSyncing?: boolean;
}

interface Column {
  id: string;
  title: string;
  color: string;
  description?: string;
  order: number;
}

interface KanbanState {
  // State
  issues: Issue[];
  columns: Column[];
  currentProjectKey?: string;
  isLoading: boolean;
  error?: Error;
  lastSyncTime?: Date;

  // Actions
  setIssues: (issues: Issue[]) => void;
  addIssue: (issue: Issue) => void;
  updateIssue: (issueId: string, updates: Partial<Issue>) => void;
  removeIssue: (issueId: string) => void;
  moveIssueLocally: (issueId: string, fromStatus: string, toStatus: string) => void;
  markAsLocalChange: (issueId: string) => void;
  markAsSyncing: (issueId: string, isSyncing: boolean) => void;
  
  setColumns: (columns: Column[]) => void;
  addColumn: (column: Column) => void;
  updateColumn: (columnId: string, updates: Partial<Column>) => void;
  removeColumn: (columnId: string) => void;
  reorderColumns: (columnIds: string[]) => void;

  loadBoard: (projectKey: string) => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  setError: (error?: Error) => void;
  updateIssueInStore: (issue: Issue) => void;
  
  // Getters
  getIssuesByStatus: (status: string) => Issue[];
  getIssueById: (issueId: string) => Issue | undefined;
  getColumnById: (columnId: string) => Column | undefined;
}

const defaultColumns: Column[] = [
  {
    id: 'todo',
    title: 'To Do',
    color: 'gray',
    description: 'Issues ready to be worked on',
    order: 0
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    color: 'blue',
    description: 'Issues currently being worked on',
    order: 1
  },
  {
    id: 'in-review',
    title: 'In Review',
    color: 'orange',
    description: 'Issues pending review',
    order: 2
  },
  {
    id: 'done',
    title: 'Done',
    color: 'green',
    description: 'Completed issues',
    order: 3
  }
];

export const useKanbanStore = create<KanbanState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      issues: [],
      columns: defaultColumns,
      currentProjectKey: undefined,
      isLoading: false,
      error: undefined,
      lastSyncTime: undefined,

      // Issue actions
      setIssues: (issues) => 
        set((state) => {
          state.issues = issues;
          state.lastSyncTime = new Date();
        }),

      addIssue: (issue) =>
        set((state) => {
          const existingIndex = state.issues.findIndex(i => i.id === issue.id);
          if (existingIndex >= 0) {
            state.issues[existingIndex] = issue;
          } else {
            state.issues.push(issue);
          }
          state.lastSyncTime = new Date();
        }),

      updateIssue: (issueId, updates) =>
        set((state) => {
          const issueIndex = state.issues.findIndex(i => i.id === issueId);
          if (issueIndex >= 0) {
            Object.assign(state.issues[issueIndex], updates);
            state.lastSyncTime = new Date();
          }
        }),

      removeIssue: (issueId) =>
        set((state) => {
          state.issues = state.issues.filter(i => i.id !== issueId);
          state.lastSyncTime = new Date();
        }),

      moveIssueLocally: (issueId, fromStatus, toStatus) =>
        set((state) => {
          const issueIndex = state.issues.findIndex(i => i.id === issueId);
          if (issueIndex >= 0) {
            state.issues[issueIndex].status = toStatus;
            state.issues[issueIndex].isLocalChange = true;
            state.issues[issueIndex].updated = new Date().toISOString();
          }
        }),

      markAsLocalChange: (issueId) =>
        set((state) => {
          const issueIndex = state.issues.findIndex(i => i.id === issueId);
          if (issueIndex >= 0) {
            state.issues[issueIndex].isLocalChange = true;
          }
        }),

      markAsSyncing: (issueId, isSyncing) =>
        set((state) => {
          const issueIndex = state.issues.findIndex(i => i.id === issueId);
          if (issueIndex >= 0) {
            state.issues[issueIndex].isSyncing = isSyncing;
            if (!isSyncing) {
              state.issues[issueIndex].isLocalChange = false;
            }
          }
        }),

      // Column actions
      setColumns: (columns) =>
        set((state) => {
          state.columns = columns.sort((a, b) => a.order - b.order);
        }),

      addColumn: (column) =>
        set((state) => {
          state.columns.push(column);
          state.columns.sort((a, b) => a.order - b.order);
        }),

      updateColumn: (columnId, updates) =>
        set((state) => {
          const columnIndex = state.columns.findIndex(c => c.id === columnId);
          if (columnIndex >= 0) {
            Object.assign(state.columns[columnIndex], updates);
          }
        }),

      removeColumn: (columnId) =>
        set((state) => {
          state.columns = state.columns.filter(c => c.id !== columnId);
        }),

      reorderColumns: (columnIds) =>
        set((state) => {
          const newColumns = columnIds.map((id, index) => {
            const column = state.columns.find(c => c.id === id);
            return column ? { ...column, order: index } : null;
          }).filter(Boolean) as Column[];
          state.columns = newColumns;
        }),

      // Board management
      loadBoard: async (projectKey) => {
        set((state) => {
          state.isLoading = true;
          state.error = undefined;
          state.currentProjectKey = projectKey;
        });

        try {
          // Fetch issues from API
          const issuesResponse = await fetch(`/api/jira/projects/${projectKey}/issues`);
          if (!issuesResponse.ok) {
            throw new Error(`Failed to load issues: ${issuesResponse.statusText}`);
          }
          const issuesData = await issuesResponse.json();

          // Fetch board configuration
          const boardResponse = await fetch(`/api/jira/projects/${projectKey}/board`);
          let columnsData = defaultColumns;
          if (boardResponse.ok) {
            const boardData = await boardResponse.json();
            columnsData = boardData.columns || defaultColumns;
          }

          set((state) => {
            state.issues = issuesData.issues || [];
            state.columns = columnsData.sort((a, b) => a.order - b.order);
            state.isLoading = false;
            state.lastSyncTime = new Date();
          });

        } catch (error) {
          set((state) => {
            state.error = error as Error;
            state.isLoading = false;
          });
          throw error;
        }
      },

      setLoading: (isLoading) =>
        set((state) => {
          state.isLoading = isLoading;
        }),

      setError: (error) =>
        set((state) => {
          state.error = error;
        }),

      updateIssueInStore: (issue) =>
        set((state) => {
          const issueIndex = state.issues.findIndex(i => i.id === issue.id);
          if (issueIndex >= 0) {
            // Merge the update, but preserve local change flags
            const existingIssue = state.issues[issueIndex];
            state.issues[issueIndex] = {
              ...issue,
              isLocalChange: false, // Clear local change flag when synced
              isSyncing: false
            };
          } else {
            // New issue from Jira
            state.issues.push({
              ...issue,
              isLocalChange: false,
              isSyncing: false
            });
          }
          state.lastSyncTime = new Date();
        }),

      // Getters
      getIssuesByStatus: (status) => {
        const state = get();
        return state.issues.filter(issue => issue.status === status);
      },

      getIssueById: (issueId) => {
        const state = get();
        return state.issues.find(issue => issue.id === issueId);
      },

      getColumnById: (columnId) => {
        const state = get();
        return state.columns.find(column => column.id === columnId);
      }
    })),
    {
      name: 'kanban-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist columns and current project, not issues (they should be fresh)
        columns: state.columns,
        currentProjectKey: state.currentProjectKey
      })
    }
  )
);

export default useKanbanStore;

