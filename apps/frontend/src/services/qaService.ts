/**
 * QA Engine Service - API client for the qa-engine backend
 * Connects to the QA Intelligence Engine for AI-driven test generation and mutation testing
 */

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || 'http://localhost:3005';

// ── Types ──────────────────────────────────────────────────────────────────

export type QARunStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';
export type AgentName = 'strategist' | 'generator' | 'critic' | 'executor' | 'mutation' | 'product-manager' | 'research-assistant' | 'code-quality-architect';
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

// ── Code Quality & Product Intelligence Types ─────────────────────────────

export interface CodeSmell {
  file: string;
  line: number;
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export interface DuplicationHotspot {
  files: string[];
  lines: number;
  similarity: number;
  suggestion: string;
}

export interface ComplexityHotspot {
  file: string;
  function: string;
  complexity: number;
  linesOfCode: number;
  suggestion: string;
}

export interface ArchitectureIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFiles: string[];
  recommendation: string;
}

export interface RefactoringItem {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  impact: 'low' | 'medium' | 'high';
  files: string[];
  category: string;
}

export interface ConsolidationOpportunity {
  title: string;
  description: string;
  files: string[];
  estimatedReduction: string;
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
}

export interface DeadCodeItem {
  file: string;
  type: 'function' | 'variable' | 'import' | 'class' | 'export';
  name: string;
  line: number;
  confidence: number;
}

export interface BestPracticeViolation {
  rule: string;
  severity: 'info' | 'warning' | 'error';
  file: string;
  line: number;
  message: string;
  fix?: string;
}

export interface CodeQualityReport {
  codeSmells: CodeSmell[];
  duplicationHotspots: DuplicationHotspot[];
  complexityHotspots: ComplexityHotspot[];
  architectureIssues: ArchitectureIssue[];
  refactoringPlan: RefactoringItem[];
  consolidationOpportunities: ConsolidationOpportunity[];
  deadCode: DeadCodeItem[];
  bestPracticeViolations: BestPracticeViolation[];
  summary: {
    overallScore: number;
    totalIssues: number;
    criticalIssues: number;
    techDebtHours: number;
  };
}

export interface FeatureRecommendation {
  title: string;
  description: string;
  userImpact: 'low' | 'medium' | 'high';
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  revenueSignal: string;
  implementationNotes: string;
  acceptanceCriteria: string[];
}

export interface ProductRoadmap {
  appDomain: string;
  currentStrengths: string[];
  criticalGaps: string[];
  userPersonas: Array<{
    name: string;
    role: string;
    painPoints: string[];
    desiredOutcomes: string[];
  }>;
  roadmap: {
    immediate: FeatureRecommendation[];
    shortTerm: FeatureRecommendation[];
    mediumTerm: FeatureRecommendation[];
    longTerm: FeatureRecommendation[];
  };
}

export interface TrendInsight {
  trend: string;
  description: string;
  category: string;
  relevance: 'game-changer' | 'significant' | 'nice-to-have';
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  implementationPath: string;
  examples: string[];
}

export interface CompetitorIntel {
  competitor: string;
  threatLevel: 'low' | 'medium' | 'high';
  strengths: string[];
  weaknesses: string[];
  recentMoves: string[];
}

export interface MonopolyStrategy {
  strategy: string;
  type: string;
  description: string;
  feasibility: 'low' | 'medium' | 'high';
  implementation: string;
}

export interface CombinedPriority {
  rank: number;
  title: string;
  description: string;
  source: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  monopolyPotential: boolean;
}

export interface ResearchInsights {
  domainAnalysis: {
    industry: string;
    marketSize: string;
    growthDirection: string;
    keyDrivers: string[];
  };
  trendInsights: TrendInsight[];
  competitorIntel: CompetitorIntel[];
  monopolyStrategies: MonopolyStrategy[];
}

export interface ProductIntelligenceData {
  roadmap: ProductRoadmap;
  research: ResearchInsights;
  priorities: CombinedPriority[];
  codeQuality?: CodeQualityReport;
  summary: {
    appDomain: string;
    totalFeatures: number;
    criticalGaps: number;
    gameChangerTrends: number;
    monopolyStrategies: number;
    combinedPriorities: number;
  };
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
    const response = await fetch(`${QA_ENGINE_URL}/qa/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(`QA Engine request failed: ${response.status}`);
    return response.json();
  },

  /**
   * Get the current status of a QA run
   */
  async getRunStatus(runId: string): Promise<QARun> {
    const response = await fetch(`${QA_ENGINE_URL}/qa/runs/${runId}`);
    if (!response.ok) throw new Error(`QA Engine request failed: ${response.status}`);
    const data = await response.json();
    return { ...data, id: data._key || data.runId || runId, runId: data._key || data.runId || runId };
  },

  /**
   * Get test results for a completed run
   */
  async getResults(runId: string): Promise<{ tests: TestResult[]; mutation: MutationResult }> {
    const response = await fetch(`${QA_ENGINE_URL}/qa/results/${runId}`);
    if (!response.ok) throw new Error(`QA Engine request failed: ${response.status}`);
    return response.json();
  },

  /**
   * List recent QA runs
   */
  async listRuns(limit: number = 20): Promise<QARun[]> {
    // Call QA engine directly (not through API gateway)
    const response = await fetch(`${QA_ENGINE_URL}/qa/runs?limit=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    // Map ArangoDB _key to id for frontend consistency
    return (data.runs || []).map((r: any) => ({
      ...r,
      id: r._key || r.runId || r.id,
      runId: r._key || r.runId || r.id,
    }));
  },

  /**
   * Cancel a running QA run
   */
  async cancelRun(runId: string): Promise<void> {
    await fetch(`${QA_ENGINE_URL}/qa/runs/${runId}/cancel`, { method: 'POST' });
  },

  /**
   * Get the WebSocket URL for real-time updates
   */
  getWebSocketUrl(): string {
    return QA_ENGINE_URL.replace('http', 'ws');
  },

  /**
   * Get product intelligence data (roadmap, research, priorities) for a run
   */
  async getProductIntelligence(runId: string): Promise<ProductIntelligenceData> {
    const url = `${QA_ENGINE_URL}/qa/product/${runId}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch product intelligence: ${response.status}`);
    }
    return response.json();
  },

  /**
   * Get the latest completed run (convenience method)
   */
  async getLatestRun(): Promise<QARun | null> {
    const runs = await this.listRuns(1);
    const completed = runs.find(r => r.status === 'completed');
    return completed ?? null;
  },

  /**
   * Get the auto-generated repository wiki for a run
   */
  async getRepoWiki(runId: string): Promise<Record<string, unknown>> {
    const url = `${QA_ENGINE_URL}/qa/wiki/${runId}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch repo wiki: ${response.status}`);
    }
    return response.json();
  },
};

export default qaService;
