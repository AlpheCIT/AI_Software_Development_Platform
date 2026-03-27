/**
 * useQARun - React hook for managing QA Intelligence runs
 * Combines fetch + polling + WebSocket for real-time QA run tracking
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
  reset: () => void;
}

// ── Hook Implementation ────────────────────────────────────────────────────

export function useQARun(): UseQARunReturn {
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

  const isRunning = status === 'running' || status === 'queued';

  // ── Apply run data to state ────────────────────────────────────────────

  const applyRunData = useCallback((run: QARun) => {
    setStatus(run.status);
    setAgents(run.agents?.length ? run.agents : DEFAULT_AGENTS);
    setTestResults(run.testResults || []);
    setMutation(run.mutation || DEFAULT_MUTATION);
    setTotalTests(run.totalTests || 0);
    setPassedTests(run.passedTests || 0);
    setFailedTests(run.failedTests || 0);
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
  }, [applyRunData, stopPolling]);

  const startPolling = useCallback((id: string) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    // Immediate first poll
    pollStatus(id);

    // Then poll every 2 seconds
    pollIntervalRef.current = setInterval(() => {
      pollStatus(id);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start QA run';
      setError(message);
      setStatus('failed');
    }
  }, [startPolling]);

  const cancelRun = useCallback(async () => {
    if (!runId) return;
    try {
      await qaService.cancelRun(runId);
      stopPolling();
      setStatus('failed');
      setError('Run cancelled by user');
    } catch (err) {
      console.error('Failed to cancel QA run:', err);
    }
  }, [runId, stopPolling]);

  const refreshStatus = useCallback(async () => {
    if (!runId) return;
    await pollStatus(runId);
  }, [runId, pollStatus]);

  const loadRecentRuns = useCallback(async () => {
    try {
      const runs = await qaService.listRuns(10);
      setRecentRuns(runs);
    } catch {
      // Silently fail - recent runs are not critical
      setRecentRuns([]);
    }
  }, []);

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
  }, [stopPolling]);

  // ── Socket.IO: Run lifecycle events only ──────────────────────────────
  // Agent-level updates come from useAgentStream (merged in dashboard)
  // This only handles run.completed and run.failed for fast status updates

  useEffect(() => {
    if (!runId || status === 'idle' || status === 'completed' || status === 'failed') return;

    const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || 'http://localhost:3005';
    let socket: Socket | null = null;

    try {
      socket = io(QA_ENGINE_URL, { transports: ['websocket', 'polling'] });

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
      });
    } catch (err) {
      console.warn('Socket.IO not available for run lifecycle events');
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [runId, status, stopPolling, pollStatus]);

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
  useEffect(() => {
    if (runId) return; // Don't override if a run is already active

    const loadLatestRun = async () => {
      try {
        const runs = await qaService.listRuns(1);
        const completedRun = runs.find(r => r.status === 'completed');
        if (completedRun) {
          setRunId(completedRun.id);
          applyRunData(completedRun);
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
    reset,
  };
}

export default useQARun;
