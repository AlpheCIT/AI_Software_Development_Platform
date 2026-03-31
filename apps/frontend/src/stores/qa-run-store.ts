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

  // Product intelligence data (centralized for all components)
  productData: any | null;

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
  setProductData: (data: any) => void;
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
      productData: null,
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
        productData: null,
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

      setProductData: (data) => set({ productData: data, lastUpdated: Date.now() }),

      loadCompletedRun: (runData) => {
        // Hydrate agent statuses from executionLog so they persist after navigation
        const agentStatuses: Record<string, AgentStatus> = {};
        for (const entry of (runData.executionLog || [])) {
          const agentId = entry.agentId || entry.agent;
          if (!agentId) continue;
          const parsed: AgentStatus = {
            status: entry.status === 'success' ? 'completed'
                  : entry.status === 'failure' || entry.status === 'timeout' || entry.status === 'dependency-missing' ? 'error'
                  : entry.status === 'skipped' ? 'error'
                  : entry.status as AgentStatus['status'],
            completedAt: entry.completedAt ? new Date(entry.completedAt).toISOString() : undefined,
            result: entry.error ? { error: entry.error, duration: entry.durationMs } : undefined,
          };
          agentStatuses[agentId] = parsed;
          // Backend uses 'code-quality' but frontend uses 'code-quality-architect' — sync both
          if (agentId === 'code-quality') agentStatuses['code-quality-architect'] = parsed;
          if (agentId === 'code-quality-architect') agentStatuses['code-quality'] = parsed;
        }

        // Infer Track 2 agent statuses from data presence (fill gaps not covered by executionLog)
        if (runData.selfHealing && !agentStatuses['self-healer']) agentStatuses['self-healer'] = { status: 'completed' };
        if (runData.apiValidation && !agentStatuses['api-validator']) agentStatuses['api-validator'] = { status: 'completed' };
        if (runData.coverageAudit && !agentStatuses['coverage-auditor']) agentStatuses['coverage-auditor'] = { status: 'completed' };
        if (runData.uiAudit && !agentStatuses['ui-ux-analyst']) agentStatuses['ui-ux-analyst'] = { status: 'completed' };
        if (runData.codeQuality && !agentStatuses['code-quality-architect'] && !agentStatuses['code-quality']) {
          agentStatuses['code-quality-architect'] = { status: 'completed' };
          agentStatuses['code-quality'] = { status: 'completed' };
        }

        // Infer Track 1 (QA pipeline) agent statuses from test data or completed run status
        const hasTests = runData.testsGenerated > 0 || runData.totalTests > 0;
        const hasMutation = runData.mutationScore > 0 || runData.mutation?.score > 0;
        const isCompleted = runData.status === 'completed';
        if (hasTests || (isCompleted && hasMutation)) {
          const track1 = ['repo-ingester', 'strategist', 'generator', 'critic', 'executor'];
          for (const id of track1) {
            if (!agentStatuses[id] || agentStatuses[id].status === 'idle') {
              agentStatuses[id] = { status: 'completed' };
            }
          }
        }
        if (hasMutation) {
          if (!agentStatuses['mutation'] || agentStatuses['mutation'].status === 'idle') {
            agentStatuses['mutation'] = { status: 'completed' };
          }
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
        productData: null,
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
