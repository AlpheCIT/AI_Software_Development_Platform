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

interface SelectedAgentInfo {
  id: string;
  name: string;
  track: string;
}

interface SkippedAgentInfo {
  id: string;
  name: string;
  reason: string;
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

  // Dynamic pipeline selection metadata
  selectedAgents: SelectedAgentInfo[];
  skippedAgents: SkippedAgentInfo[];

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
  setSelectedAgents: (selected: SelectedAgentInfo[], skipped: SkippedAgentInfo[]) => void;
  loadCompletedRun: (runData: any) => void;
  reset: () => void;
}

export type { CodeHealth, AgentStatus, ActivityLogEntry, SelectedAgentInfo, SkippedAgentInfo };

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
      selectedAgents: [],
      skippedAgents: [],
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
        selectedAgents: [],
        skippedAgents: [],
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

      setSelectedAgents: (selected, skipped) => set({
        selectedAgents: selected,
        skippedAgents: skipped,
        lastUpdated: Date.now(),
      }),

      loadCompletedRun: (runData) => {
        // Hydrate agent statuses from executionLog so they persist after navigation
        const agentStatuses: Record<string, AgentStatus> = {};
        for (const entry of (runData.executionLog || [])) {
          const agentId = entry.agentId || entry.agent;
          if (!agentId) continue;
          agentStatuses[agentId] = {
            status: entry.status === 'success' ? 'completed'
                  : entry.status === 'failure' || entry.status === 'timeout' || entry.status === 'dependency-missing' ? 'error'
                  : entry.status === 'skipped' ? 'error'
                  : entry.status as AgentStatus['status'],
            completedAt: entry.completedAt ? new Date(entry.completedAt).toISOString() : undefined,
            result: entry.error ? { error: entry.error, duration: entry.durationMs } : undefined,
          };
        }

        set({
          currentRunId: runData.runId || runData._key || runData.id,
          runStatus: 'completed',
          repoUrl: runData.repoUrl || '',
          branch: runData.branch || '',
          totalTests: runData.testsGenerated || runData.totalTests || 0,
          passedTests: runData.testsPassed || runData.passedTests || 0,
          failedTests: runData.testsFailed || runData.failedTests || 0,
          syntaxValid: runData.testsExecuted || 0,
          mutationScore: runData.mutationScore || runData.mutation?.score || 0,
          selectedAgents: runData.selectedAgents || [],
          skippedAgents: runData.skippedAgents || [],
          agentStatuses,
          codeHealth: runData.unifiedHealthScore ? {
            score: runData.unifiedHealthScore.score,
            grade: runData.unifiedHealthScore.grade,
            gradeDescription: '',
            breakdown: Object.fromEntries(
              Object.entries(runData.unifiedHealthScore.breakdown || {}).map(
                ([k, v]: [string, any]) => [k, v.score]
              )
            ),
          } : null,
          lastUpdated: Date.now(),
        });
      },

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
        selectedAgents: [],
        skippedAgents: [],
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
