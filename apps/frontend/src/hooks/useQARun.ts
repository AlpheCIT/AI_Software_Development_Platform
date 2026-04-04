/**
 * useQARun - React hook for managing QA Intelligence runs
 * Combines fetch + polling + WebSocket for real-time QA run tracking
 * Now backed by Zustand store for persistence across navigation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  qaService,
  type QARun,
  type QARunConfig,
  type QARunStatus,
  type TestResult,
  type MutationResult,
  type AgentState,
} from '../services/qaService';
import { useQARunStore, type CodeHealth } from '../stores/qa-run-store';

// ── Default States ─────────────────────────────────────────────────────────

const DEFAULT_AGENTS: AgentState[] = [
  { name: 'repo-ingester', status: 'idle', progress: 0, message: 'Clones repository and extracts code files' },
  { name: 'strategist', status: 'idle', progress: 0, message: 'Analyzes codebase and plans test strategy' },
  { name: 'generator', status: 'idle', progress: 0, message: 'Generates test cases from strategy' },
  { name: 'critic', status: 'idle', progress: 0, message: 'Reviews and critiques test quality' },
  { name: 'executor', status: 'idle', progress: 0, message: 'Runs tests and collects results' },
  { name: 'mutation', status: 'idle', progress: 0, message: 'Applies mutations to verify test strength' },
  { name: 'product-manager', status: 'idle', progress: 0, message: 'Analyzes features and builds product roadmap' },
  { name: 'research-assistant', status: 'idle', progress: 0, message: 'Researches trends and competitive landscape' },
  { name: 'code-quality-architect', status: 'idle', progress: 0, message: 'Audits code quality and refactoring opportunities' },
  { name: 'self-healer', status: 'idle', progress: 0, message: 'Detects cross-file type mismatches and broken imports' },
  { name: 'api-validator', status: 'idle', progress: 0, message: 'Validates API endpoints for security and completeness' },
  { name: 'coverage-auditor', status: 'idle', progress: 0, message: 'Cross-references backend APIs with frontend consumers' },
  { name: 'ui-ux-analyst', status: 'idle', progress: 0, message: 'Audits accessibility, UX patterns, and user flows' },
];

const DEFAULT_MUTATION: MutationResult = {
  totalMutants: 0,
  killed: 0,
  survived: 0,
  timeout: 0,
  score: 0,
};

// ── Code Health Computation ───────────────────────────────────────────────

function computeUnifiedCodeHealth(agentScores: Record<string, number>): CodeHealth {
  const weights: Record<string, number> = {
    selfHealer: 0.15,
    apiValidator: 0.25,
    coverage: 0.15,
    codeQuality: 0.20,
    accessibility: 0.10,
    ux: 0.15,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const score = agentScores[key];
    if (score != null && score >= 0 && !isNaN(score)) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

  let grade = 'N/A', gradeDescription = 'Insufficient data';
  if (score !== null) {
    if (score >= 90) { grade = 'A'; gradeDescription = 'Production-ready'; }
    else if (score >= 75) { grade = 'B'; gradeDescription = 'Good quality'; }
    else if (score >= 60) { grade = 'C'; gradeDescription = 'Acceptable'; }
    else if (score >= 40) { grade = 'D'; gradeDescription = 'Below average'; }
    else { grade = 'F'; gradeDescription = 'Critical issues'; }
  }

  return { score, grade, gradeDescription, breakdown: agentScores };
}

async function fetchAndComputeCodeHealth(runId: string, store: ReturnType<typeof useQARunStore.getState>) {
  try {
    const data = await qaService.getProductIntelligence(runId);

    // Prefer the backend-computed unified score (stored in DB) over frontend recalculation
    if (data.summary?.unifiedHealthScore?.score != null) {
      const uhs = data.summary.unifiedHealthScore;
      store.setCodeHealth({
        score: uhs.score,
        grade: uhs.grade || 'N/A',
        gradeDescription: '',
        breakdown: Object.fromEntries(
          Object.entries(uhs.breakdown || {}).map(([k, v]: [string, any]) => [k, v.score])
        ),
      });
      return;
    }

    // Fallback: compute from individual agent scores if no unified score stored
    const scores: Record<string, number> = {};
    if (data.selfHealing?.healthScore != null) scores.selfHealer = data.selfHealing.healthScore;
    if (data.apiValidation?.apiHealthScore != null) scores.apiValidator = data.apiValidation.apiHealthScore;
    if (data.coverageAudit?.coverageScore != null) scores.coverage = data.coverageAudit.coverageScore;
    if (data.codeQuality?.overallHealth?.score != null) scores.codeQuality = data.codeQuality.overallHealth.score;
    else if (data.codeQuality?.summary?.overallScore != null) scores.codeQuality = data.codeQuality.summary.overallScore;
    if (data.uiAudit?.accessibilityScore != null) scores.accessibility = data.uiAudit.accessibilityScore;
    if (data.uiAudit?.uxScore != null) scores.ux = data.uiAudit.uxScore;
    if (!scores.codeQuality && data.summary?.codeHealthScore != null) scores.codeQuality = data.summary.codeHealthScore;
    if (!scores.selfHealer && data.summary?.selfHealingScore != null) scores.selfHealer = data.summary.selfHealingScore;
    if (!scores.apiValidator && data.summary?.apiHealthScore != null) scores.apiValidator = data.summary.apiHealthScore;

    const health = computeUnifiedCodeHealth(scores);
    store.setCodeHealth(health);
  } catch {
    // Non-fatal — product intelligence may not be available yet
  }
}

// ── Hook Interface ─────────────────────────────────────────────────────────

export interface UseQARunReturn {
  // State
  runId: string | null;
  status: QARunStatus;
  agents: AgentState[];
  testResults: TestResult[];
  mutation: MutationResult;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  isRunning: boolean;
  recentRuns: QARun[];

  // Actions
  startRun: (config: QARunConfig) => Promise<void>;
  cancelRun: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  loadRecentRuns: () => Promise<void>;
  loadRun: (runId: string) => Promise<void>;
  reset: () => void;
}

// ── Hook Implementation ────────────────────────────────────────────────────

export function useQARun(): UseQARunReturn {
  const store = useQARunStore();

  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<QARunStatus>('idle');
  const [agents, setAgents] = useState<AgentState[]>(DEFAULT_AGENTS);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [mutation, setMutation] = useState<MutationResult>(DEFAULT_MUTATION);
  const [totalTests, setTotalTests] = useState(0);
  const [passedTests, setPassedTests] = useState(0);
  const [failedTests, setFailedTests] = useState(0);
  const [skippedTests, setSkippedTests] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<QARun[]>([]);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  const restoredFromStoreRef = useRef(false);

  const isRunning = status === 'running' || status === 'queued';

  // ── Restore from store on mount ────────────────────────────────────────
  // If the store has persisted data, restore it so dashboard shows previous state

  useEffect(() => {
    if (restoredFromStoreRef.current) return;
    restoredFromStoreRef.current = true;

    if (store.lastUpdated > 0 && store.currentRunId) {
      setRunId(store.currentRunId);
      setStatus(store.runStatus === 'running' ? 'running' : store.runStatus === 'completed' ? 'completed' : store.runStatus === 'failed' ? 'failed' : 'idle');
      setTotalTests(store.totalTests);
      setPassedTests(store.passedTests);
      setFailedTests(store.failedTests);
      if (store.mutationScore > 0) {
        setMutation(prev => ({ ...prev, score: store.mutationScore }));
      }
      // Re-fetch completed run to populate activity log from executionLog
      if (store.runStatus === 'completed') {
        qaService.getRunStatus(store.currentRunId).then((run: any) => {
          if (run?.executionLog?.length) {
            store.loadCompletedRun(run);
          }
        }).catch(() => { /* silently fail — cached data is still shown */ });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-resume: restart polling if store says a run is still running ──
  useEffect(() => {
    if (
      store.currentRunId &&
      store.runStatus === 'running' &&
      !isPollingRef.current &&
      restoredFromStoreRef.current
    ) {
      setRunId(store.currentRunId);
      setStatus('running');
      startPolling(store.currentRunId);
    }
  }, [store.currentRunId, store.runStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply run data to state ────────────────────────────────────────────

  const applyRunData = useCallback((run: QARun) => {
    setStatus(run.status);
    setAgents(run.agents?.length ? run.agents : DEFAULT_AGENTS);
    setTestResults(run.testResults || []);
    const runMutation = run.mutation || DEFAULT_MUTATION;
    // Handle mutationScore at top level (historical runs) vs nested mutation.score
    if (runMutation.score === 0 && (run as any).mutationScore) {
      runMutation.score = (run as any).mutationScore;
    }
    setMutation(runMutation);
    setTotalTests((run as any).testsGenerated || run.totalTests || 0);
    setPassedTests((run as any).testsPassed || run.passedTests || 0);
    setFailedTests((run as any).testsFailed || run.failedTests || 0);
    setSkippedTests(run.skippedTests || 0);
    setStartedAt(run.startedAt || null);
    setCompletedAt(run.completedAt || null);
  }, []);

  // ── Polling ────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const run = await qaService.getRunStatus(id);
      applyRunData(run);

      // Stop polling when run completes
      if (run.status === 'completed' || run.status === 'failed') {
        stopPolling();

        // Sync to store on completion
        if (run.status === 'completed') {
          store.completeRun({
            tests: run.totalTests || 0,
            passed: run.passedTests || 0,
            failed: run.failedTests || 0,
            syntaxValid: run.passedTests || 0,
            mutation: run.mutation?.score || 0,
          });
          // Fetch code health after run completes
          fetchAndComputeCodeHealth(id, useQARunStore.getState());
        } else {
          store.failRun('Run failed');
        }

        // Fetch final results
        try {
          const results = await qaService.getResults(id);
          setTestResults(results.tests || []);
          setMutation(results.mutation || DEFAULT_MUTATION);
        } catch {
          // Results endpoint might not exist yet; status already has the data
        }
      }
    } catch (err) {
      console.warn('Failed to poll QA run status:', err);
    }
  }, [applyRunData, stopPolling, store]);

  const startPolling = useCallback((id: string) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    // Immediate first poll
    pollStatus(id);

    // Fast polling (2s) for first 30s, then slow (8s) to reduce load
    const startTime = Date.now();
    pollIntervalRef.current = setInterval(() => {
      pollStatus(id);
      if (Date.now() - startTime > 30000 && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(() => pollStatus(id), 8000);
      }
    }, 2000);
  }, [pollStatus]);

  // ── Actions ────────────────────────────────────────────────────────────

  const startRun = useCallback(async (config: QARunConfig) => {
    try {
      setError(null);
      setStatus('queued');
      setAgents(DEFAULT_AGENTS);
      setTestResults([]);
      setMutation(DEFAULT_MUTATION);
      setTotalTests(0);
      setPassedTests(0);
      setFailedTests(0);
      setSkippedTests(0);
      setCompletedAt(null);
      setStartedAt(new Date().toISOString());

      const { runId: newRunId } = await qaService.startRun(config);
      setRunId(newRunId);
      setStatus('running');
      startPolling(newRunId);

      // Sync to store
      store.startRun(newRunId, config.repoUrl || '', config.branch || '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start QA run';
      setError(message);
      setStatus('failed');
      store.failRun(message);
    }
  }, [startPolling, store]);

  const cancelRun = useCallback(async () => {
    if (!runId) return;
    try {
      await qaService.cancelRun(runId);
      stopPolling();
      setStatus('failed');
      setError('Run cancelled by user');
      store.failRun('Run cancelled by user');
    } catch (err) {
      console.error('Failed to cancel QA run:', err);
    }
  }, [runId, stopPolling, store]);

  const refreshStatus = useCallback(async () => {
    if (!runId) return;
    await pollStatus(runId);
  }, [runId, pollStatus]);

  const loadRecentRuns = useCallback(async () => {
    try {
      const runs = await qaService.listRuns(10);
      setRecentRuns(runs);
      store.setRecentRuns(runs);
    } catch {
      // Silently fail - recent runs are not critical
      setRecentRuns([]);
    }
  }, [store]);

  const loadRun = useCallback(async (id: string) => {
    try {
      stopPolling();
      setError(null);
      // Clear stale data immediately so UI shows loading state
      setTotalTests(0);
      setFailedTests(0);
      const run = await qaService.getRunStatus(id);
      setRunId(run.id || id);
      applyRunData(run);

      // If the run is still active, start polling to track it
      if (run.status === 'running' || run.status === 'queued') {
        setStatus('running');
        store.startRun(run.id || id, run.repoUrl || '', run.branch || '');
        startPolling(run.id || id);
        return;
      }

      // Also try to fetch full results for completed runs
      if (run.status === 'completed') {
        try {
          const results = await qaService.getResults(id);
          if (results.tests?.length) setTestResults(results.tests);
          if (results.mutation) setMutation(results.mutation);
        } catch {
          // Results endpoint might not exist; status already has the data
        }

        // Fetch product intelligence and push to store
        try {
          const product = await qaService.getProductIntelligence(id);
          store.setProductData(product);
          // Load completed run with merged data for agent status inference
          store.loadCompletedRun({
            ...run,
            ...product,
            mutationScore: run.mutationScore ?? (run as any).mutation?.score ?? 0,
          });
        } catch {
          // Product data may not be available yet
          store.loadCompletedRun(run);
        }

        // Fetch code health for loaded run
        fetchAndComputeCodeHealth(run.id || id, useQARunStore.getState());
      } else {
        // Sync to store for non-completed runs
        store.loadCompletedRun(run);
      }
    } catch (err) {
      // API offline — fall back to persisted store data if available
      const storeState = useQARunStore.getState();
      if (storeState.currentRunId === id || storeState.totalTests > 0 || storeState.mutationScore > 0) {
        setRunId(id);
        setStatus(storeState.runStatus || 'completed');
        setTotalTests(storeState.totalTests);
        setPassedTests(storeState.passedTests);
        setFailedTests(storeState.failedTests);
        setMutation({ score: storeState.mutationScore, killed: 0, survived: 0, total: 0, timeout: 0, noCoverage: 0 });
        // Re-trigger loadCompletedRun to infer agent statuses from stored data
        const recentRun = storeState.recentRuns?.find((r: any) => (r.id || r._key || r.runId) === id);
        if (recentRun) {
          applyRunData(recentRun as any);
          store.loadCompletedRun(recentRun);
        }
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load run';
        setError(message);
      }
    }
  }, [stopPolling, applyRunData, store]);

  const reset = useCallback(() => {
    stopPolling();
    setRunId(null);
    setStatus('idle');
    setAgents(DEFAULT_AGENTS);
    setTestResults([]);
    setMutation(DEFAULT_MUTATION);
    setTotalTests(0);
    setPassedTests(0);
    setFailedTests(0);
    setSkippedTests(0);
    setStartedAt(null);
    setCompletedAt(null);
    setError(null);
    store.reset();
  }, [stopPolling, store]);

  // ── Socket.IO: Run lifecycle events only ──────────────────────────────
  // Agent-level updates come from useAgentStream (merged in dashboard)
  // This only handles run.completed and run.failed for fast status updates

  useEffect(() => {
    if (!runId || status === 'idle' || status === 'completed' || status === 'failed') return;

    let socket: Socket | null = null;

    try {
      socket = io(window.location.origin, { transports: ['websocket', 'polling'] });

      socket.on('qa:run.completed', (data: any) => {
        setStatus('completed');
        setCompletedAt(new Date().toISOString());
        stopPolling();
        // Refresh final data
        if (runId) pollStatus(runId);
      });

      socket.on('qa:run.failed', (data: any) => {
        setStatus('failed');
        setError(data.error || 'Run failed');
        stopPolling();
        store.failRun(data.error || 'Run failed');
      });
    } catch (err) {
      console.warn('Socket.IO not available for run lifecycle events');
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [runId, status, stopPolling, pollStatus, store]);

  // ── Cleanup ────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Load recent runs on mount
  useEffect(() => {
    loadRecentRuns();
  }, [loadRecentRuns]);

  // Auto-load the latest completed run so the dashboard shows data immediately
  // But skip if store already has data (restored from sessionStorage)
  useEffect(() => {
    if (runId) return; // Don't override if a run is already active

    // If store has a completed run, skip re-fetching
    if (store.lastUpdated > 0 && store.currentRunId && store.runStatus === 'completed') {
      // Already restored from store above
      return;
    }

    const loadLatestRun = async () => {
      try {
        const runs = await qaService.listRuns(1);
        const completedRun = runs.find(r => r.status === 'completed');
        if (completedRun) {
          setRunId(completedRun.id);
          applyRunData(completedRun);

          // Fetch product intelligence for auto-loaded run
          try {
            const product = await qaService.getProductIntelligence(completedRun.id);
            store.setProductData(product);
            store.loadCompletedRun({
              ...completedRun,
              ...product,
              mutationScore: completedRun.mutationScore ?? completedRun.mutation?.score ?? 0,
            });
          } catch {
            store.loadCompletedRun(completedRun);
          }

          // Fetch code health for auto-loaded run
          fetchAndComputeCodeHealth(completedRun.id, useQARunStore.getState());
        }
      } catch {
        // Silently fail - auto-load is best-effort
      }
    };

    loadLatestRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    runId,
    status,
    agents,
    testResults,
    mutation,
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    startedAt,
    completedAt,
    error,
    isRunning,
    recentRuns,
    startRun,
    cancelRun,
    refreshStatus,
    loadRecentRuns,
    loadRun,
    reset,
  };
}

export default useQARun;
