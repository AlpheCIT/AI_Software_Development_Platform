/**
 * QA Engine Service - API client for the qa-engine backend
 * Connects to the QA Intelligence Engine for AI-driven test generation and mutation testing
 */

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || 'http://localhost:3005';

// ── Types ──────────────────────────────────────────────────────────────────

export type QARunStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';
export type AgentName = 'strategist' | 'generator' | 'critic' | 'executor' | 'mutation' | 'product-manager' | 'research-assistant';
export type AgentStatus = 'idle' | 'active' | 'completed' | 'failed' | 'looping';
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending' | 'error';

export interface QARunConfig {
  repoUrl: string;
  branch?: string;
  testTypes?: ('unit' | 'e2e' | 'api')[];
  maxTests?: number;
  config?: Record<string, unknown>;
}

export interface AgentState {
  name: AgentName;
  status: AgentStatus;
  progress: number;
  message: string;
  iterationCount?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface TestResult {
  id: string;
  name: string;
  filePath: string;
  status: TestStatus;
  duration: number;
  error?: string;
  stackTrace?: string;
  generatedBy: AgentName;
  mutationSurvivors?: number;
}

export interface MutationResult {
  totalMutants: number;
  killed: number;
  survived: number;
  timeout: number;
  score: number;
}

export interface QARun {
  id: string;
  repoUrl: string;
  branch: string;
  status: QARunStatus;
  startedAt: string;
  completedAt?: string;
  agents: AgentState[];
  testResults: TestResult[];
  mutation: MutationResult;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  config: QARunConfig;
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  agent: AgentName;
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  data?: Record<string, unknown>;
}

// ── API Client ─────────────────────────────────────────────────────────────

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${QA_ENGINE_URL}${path}`;
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `QA Engine request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data ?? result;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('QA Engine is not reachable at', QA_ENGINE_URL);
      throw new Error('QA Engine is offline. Start the service on port 3005.');
    }
    throw error;
  }
}

export const qaService = {
  /**
   * Start a new QA run against a repository
   */
  async startRun(config: QARunConfig): Promise<{ runId: string }> {
    return apiRequest<{ runId: string }>('/api/v1/qa/runs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /**
   * Get the current status of a QA run
   */
  async getRunStatus(runId: string): Promise<QARun> {
    return apiRequest<QARun>(`/api/v1/qa/runs/${runId}`);
  },

  /**
   * Get test results for a completed run
   */
  async getResults(runId: string): Promise<{ tests: TestResult[]; mutation: MutationResult }> {
    return apiRequest<{ tests: TestResult[]; mutation: MutationResult }>(
      `/api/v1/qa/runs/${runId}/results`
    );
  },

  /**
   * List recent QA runs
   */
  async listRuns(limit: number = 20): Promise<QARun[]> {
    return apiRequest<QARun[]>(`/api/v1/qa/runs?limit=${limit}`);
  },

  /**
   * Cancel a running QA run
   */
  async cancelRun(runId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/qa/runs/${runId}/cancel`, { method: 'POST' });
  },

  /**
   * Get the WebSocket URL for real-time updates
   */
  getWebSocketUrl(): string {
    return QA_ENGINE_URL.replace('http', 'ws');
  },
};

export default qaService;
