/**
 * qa-run-store.ts - Zustand store for persistent QA state
 * Survives tab navigation via sessionStorage persistence.
 * This store is ADDITIVE to existing hooks — it supplements, not replaces.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AgentStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  result?: any;
  completedAt?: string;
}

interface CodeHealth {
  score: number;
  grade: string;
  gradeDescription: string;
  breakdown: Record<string, number>;
}

interface ActivityLogEntry {
  timestamp: string;
  agent: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

interface QARunStore {
  // Run state
  currentRunId: string | null;
  runStatus: 'idle' | 'running' | 'completed' | 'failed';
  repoUrl: string;
  branch: string;

  // Stats
  totalTests: number;
  passedTests: number;
  failedTests: number;
  syntaxValid: number;
  mutationScore: number;

  // Health
  codeHealth: CodeHealth | null;

  // Agent states
  agentStatuses: Record<string, AgentStatus>;

  // Activity log (keep last 100)
  activityLog: ActivityLogEntry[];

  // Recent runs for selector
  recentRuns: Array<any>;

  // Timestamp of last update (for staleness checks)
  lastUpdated: number;

  // Actions
  startRun: (runId: string, repoUrl: string, branch: string) => void;
  completeRun: (stats: { tests: number; passed: number; failed: number; syntaxValid: number; mutation: number }) => void;
  failRun: (error: string) => void;
  updateAgentStatus: (agentName: string, status: AgentStatus) => void;
  addActivityLog: (entry: Omit<ActivityLogEntry, 'timestamp'>) => void;
  setCodeHealth: (health: CodeHealth) => void;
  setRecentRuns: (runs: any[]) => void;
  loadCompletedRun: (runData: any) => void;
  reset: () => void;
}

export type { CodeHealth, AgentStatus, ActivityLogEntry };

export const useQARunStore = create<QARunStore>()(
  persist(
    (set, get) => ({
      currentRunId: null,
      runStatus: 'idle',
      repoUrl: '',
      branch: '',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      syntaxValid: 0,
      mutationScore: 0,
      codeHealth: null,
      agentStatuses: {},
      activityLog: [],
      recentRuns: [],
      lastUpdated: 0,

      startRun: (runId, repoUrl, branch) => set({
        currentRunId: runId,
        runStatus: 'running',
        repoUrl,
        branch,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        syntaxValid: 0,
        mutationScore: 0,
        agentStatuses: {},
        activityLog: [],
        lastUpdated: Date.now(),
      }),

      completeRun: (stats) => set({
        runStatus: 'completed',
        totalTests: stats.tests,
        passedTests: stats.passed,
        failedTests: stats.failed,
        syntaxValid: stats.syntaxValid,
        mutationScore: stats.mutation,
        lastUpdated: Date.now(),
      }),

      failRun: (error) => set({
        runStatus: 'failed',
        lastUpdated: Date.now(),
      }),

      updateAgentStatus: (agentName, status) => set(state => ({
        agentStatuses: { ...state.agentStatuses, [agentName]: status },
        lastUpdated: Date.now(),
      })),

      addActivityLog: (entry) => set(state => ({
        activityLog: [
          { ...entry, timestamp: new Date().toISOString() },
          ...state.activityLog,
        ].slice(0, 100),
        lastUpdated: Date.now(),
      })),

      setCodeHealth: (health) => set({ codeHealth: health, lastUpdated: Date.now() }),

      setRecentRuns: (runs) => set({ recentRuns: runs }),

      loadCompletedRun: (runData) => set({
        currentRunId: runData.runId || runData._key || runData.id,
        runStatus: 'completed',
        repoUrl: runData.repoUrl || '',
        branch: runData.branch || '',
        totalTests: runData.testsGenerated || runData.totalTests || 0,
        passedTests: runData.testsPassed || runData.passedTests || 0,
        failedTests: runData.testsFailed || runData.failedTests || 0,
        syntaxValid: runData.testsExecuted || 0,
        mutationScore: runData.mutationScore || runData.mutation?.score || 0,
        lastUpdated: Date.now(),
      }),

      reset: () => set({
        currentRunId: null,
        runStatus: 'idle',
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        syntaxValid: 0,
        mutationScore: 0,
        codeHealth: null,
        agentStatuses: {},
        activityLog: [],
        lastUpdated: 0,
      }),
    }),
    {
      name: 'qa-run-store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
