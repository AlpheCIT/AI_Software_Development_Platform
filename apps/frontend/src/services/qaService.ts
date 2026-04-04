/**
 * QA Engine Service - API client for the qa-engine backend
 * Connects to the QA Intelligence Engine for AI-driven test generation and mutation testing
 */



// ── Types ──────────────────────────────────────────────────────────────────

export type QARunStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';
export type AgentName = 'strategist' | 'generator' | 'critic' | 'executor' | 'mutation' | 'product-manager' | 'research-assistant' | 'code-quality-architect' | 'self-healer' | 'api-validator' | 'coverage-auditor' | 'ui-ux-analyst';
export type AgentStatus = 'idle' | 'active' | 'completed' | 'failed' | 'looping';
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending' | 'error';

export interface AgentConversation {
  runId: string;
  agent: string;
  systemPrompt: string;
  userMessage: string;
  response: string;
  tokensUsed?: { input?: number; output?: number };
  durationMs: number;
  timestamp: string;
}

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

// ── New Agent Report Types ────────────────────────────────────────────────

export interface SelfHealingReport {
  typeMismatches: Array<{ file: string; line: string; expected: string; actual: string; severity: string; fix: string }>;
  brokenImports: Array<{ file: string; importStatement: string; issue: string; severity: string; fix: string }>;
  missingDeps: Array<{ package: string; usedIn: string[]; inPackageJson: boolean; fix: string }>;
  configIssues: Array<{ type: string; description: string; files: string[]; severity: string; fix: string }>;
  autoFixes: Array<{ title: string; description: string; files: string[]; changes: string; confidence: string; breakingRisk: string }>;
  healthScore: number;
  summary: string;
}

export interface APIValidationReport {
  endpoints: Array<{ method: string; path: string; file: string; handler: string; hasErrorHandling: boolean; hasInputValidation: boolean; hasAuth: boolean; hasRateLimiting: boolean; issues: string[] }>;
  missingErrorHandling: Array<{ endpoint: string; file: string; severity: string; fix: string }>;
  schemaIssues: Array<{ endpoint: string; issue: string; severity: string; fix: string }>;
  securityGaps: Array<{ type: string; endpoint: string; description: string; severity: string; fix: string }>;
  apiHealthScore: number;
  summary: string;
}

export interface CoverageAuditReport {
  unexposedBackendFeatures: Array<{ endpoint: string; file: string; description: string; suggestedUILocation: string; priority: string }>;
  brokenFrontendCalls: Array<{ file: string; call: string; expectedEndpoint: string; issue: string; fix: string }>;
  orphanedRoutes: Array<{ endpoint: string; file: string; reason: string; recommendation: string }>;
  dataShapeMismatches: Array<{ endpoint: string; backendShape: string; frontendExpects: string; files: string[]; fix: string }>;
  missingCrudOperations: Array<{ resource: string; hasCreate: boolean; hasRead: boolean; hasUpdate: boolean; hasDelete: boolean; missingOperations: string[]; priority: string }>;
  coverageScore: number;
  summary: string;
}

export interface UIAuditReport {
  accessibilityIssues: Array<{ file: string; type: string; element: string; severity: string; wcagCriteria: string; fix: string }>;
  uxAntiPatterns: Array<{ file: string; pattern: string; description: string; userImpact: string; fix: string }>;
  componentIssues: Array<{ file: string; component: string; issue: string; severity: string; fix: string }>;
  userFlowIssues: Array<{ flow: string; issue: string; affectedFiles: string[]; fix: string }>;
  suggestions: Array<{ title: string; description: string; category: string; effort: string; impact: string }>;
  accessibilityScore: number;
  uxScore: number;
  summary: string;
}

export interface HealthScores {
  codeQuality: number | null;
  selfHealing: number | null;
  apiHealth: number | null;
  coverage: number | null;
  accessibility: number | null;
  ux: number | null;
  mutation: number | null;
}

export interface HealthHistoryEntry {
  runId: string;
  date: string;
  scores: HealthScores;
}

export interface ProductIntelligenceData {
  roadmap: ProductRoadmap;
  research: ResearchInsights;
  priorities: CombinedPriority[];
  codeQuality?: CodeQualityReport;
  selfHealing?: SelfHealingReport;
  apiValidation?: APIValidationReport;
  coverageAudit?: CoverageAuditReport;
  uiAudit?: UIAuditReport;
  summary: {
    appDomain: string;
    totalFeatures: number;
    criticalGaps: number;
    gameChangerTrends: number;
    monopolyStrategies: number;
    combinedPriorities: number;
    codeHealthScore: number | null;
    codeHealthGrade: string | null;
    totalFindings: number;
    selfHealingScore: number | null;
    apiHealthScore: number | null;
    coverageScore: number | null;
    accessibilityScore: number | null;
    uxScore: number | null;
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
  const url = `${path}`;
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
      console.warn('QA Engine is not reachable');
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
    const response = await fetch(`/qa/run`, {
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
    const response = await fetch(`/qa/runs/${runId}`);
    if (!response.ok) throw new Error(`QA Engine request failed: ${response.status}`);
    const data = await response.json();
    // API returns { run: {...}, summary: {...}, testCases, executions, ... }
    // Normalize: flatten run + summary into top-level fields matching QARun interface
    const runDoc = data.run || data;
    const summary = data.summary || {};
    const id = runDoc._key || runDoc.runId || data._key || data.runId || runId;
    return {
      ...runDoc,
      ...data,
      id,
      runId: id,
      // Normalize test stats: try summary first, then run doc fields, then interface fields
      totalTests: summary.totalTests ?? runDoc.testsGenerated ?? runDoc.totalTests ?? 0,
      passedTests: summary.passed ?? runDoc.testsPassed ?? runDoc.passedTests ?? 0,
      failedTests: summary.failed ?? runDoc.testsFailed ?? runDoc.failedTests ?? 0,
      skippedTests: summary.skipped ?? runDoc.skippedTests ?? 0,
      mutationScore: summary.mutationScore ?? runDoc.mutationScore ?? runDoc.mutation?.score ?? 0,
      // Preserve nested data for downstream consumers
      testsGenerated: runDoc.testsGenerated ?? summary.totalTests ?? 0,
      testsPassed: runDoc.testsPassed ?? summary.passed ?? 0,
      testsFailed: runDoc.testsFailed ?? summary.failed ?? 0,
      // Preserve executionLog from run doc for Agent Spawning Tree
      executionLog: runDoc.executionLog || data.executionLog,
    };
  },

  /**
   * Get test results for a completed run
   */
  async getResults(runId: string): Promise<{ tests: TestResult[]; mutation: MutationResult }> {
    const response = await fetch(`/qa/results/${runId}`);
    if (!response.ok) throw new Error(`QA Engine request failed: ${response.status}`);
    return response.json();
  },

  /**
   * List recent QA runs
   */
  async listRuns(limit: number = 20): Promise<QARun[]> {
    // Call QA engine directly (not through API gateway)
    const response = await fetch(`/qa/runs?limit=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    // Map ArangoDB fields to frontend QARun interface
    return (data.runs || []).map((r: any) => ({
      ...r,
      id: r._key || r.runId || r.id,
      runId: r._key || r.runId || r.id,
      totalTests: r.testsGenerated || r.totalTests || 0,
      passedTests: r.testsPassed || r.passedTests || 0,
      failedTests: r.testsFailed || r.failedTests || 0,
      skippedTests: r.testsExecuted ? (r.testsExecuted - (r.testsPassed || 0) - (r.testsFailed || 0)) : 0,
      mutation: r.mutationScore != null ? { score: r.mutationScore, killed: 0, survived: 0, total: 0 } : undefined,
    }));
  },

  /**
   * Cancel a running QA run
   */
  async cancelRun(runId: string): Promise<void> {
    await fetch(`/qa/runs/${runId}/cancel`, { method: 'POST' });
  },

  /**
   * Get the WebSocket URL for real-time updates
   */
  getWebSocketUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  },

  // getProductIntelligence is defined above with the enhanced 8-report version

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
    const url = `/qa/wiki/${runId}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch repo wiki: ${response.status}`);
    }
    return response.json();
  },

  /**
   * Check git freshness for a repository — whether analyzed commit is up-to-date
   */
  /**
   * Send a chat message to an agent and get a contextual response
   */
  async chat(runId: string, agent: string, message: string, conversationId?: string): Promise<{
    conversationId: string;
    response: string;
    agent: string;
    runId: string;
  }> {
    const response = await fetch(`/qa/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, agent, message, conversationId }),
    });
    if (!response.ok) throw new Error(`Chat failed: ${response.status}`);
    return response.json();
  },

  /**
   * Get chat history for a conversation
   */
  async getChatHistory(conversationId: string): Promise<{
    conversationId: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
    total: number;
  }> {
    const response = await fetch(`/qa/chat/${conversationId}`);
    if (!response.ok) return { conversationId, messages: [], total: 0 };
    return response.json();
  },

  /**
   * Get agent conversations for a run (the actual LLM prompts/responses)
   */
  async getConversations(runId: string, agent?: string): Promise<{
    conversations: AgentConversation[];
    total: number;
  }> {
    const params = agent ? `?agent=${agent}` : '';
    const response = await fetch(`/qa/conversations/${runId}${params}`);
    if (!response.ok) return { conversations: [], total: 0 };
    return response.json();
  },

  /**
   * Get full product intelligence (all 8 reports) for a run
   */
  async getProductIntelligence(runId: string): Promise<ProductIntelligenceData> {
    const response = await fetch(`/qa/product/${runId}`);
    if (!response.ok) throw new Error(`Product intelligence not available: ${response.status}`);
    return response.json();
  },

  /**
   * Get health score history across runs for a repository
   */
  async getHealthHistory(repositoryId: string): Promise<{
    repositoryId: string;
    history: HealthHistoryEntry[];
    total: number;
  }> {
    const response = await fetch(`/qa/product/health-history/${repositoryId}`);
    if (!response.ok) return { repositoryId, history: [], total: 0 };
    return response.json();
  },

  /**
   * Get agent conversations for a specific agent in a run (simplified URL-based API)
   */
  async getAgentConversations(runId: string, agentId?: string): Promise<any[]> {
    const url = agentId
      ? `/qa/conversations/${runId}/${agentId}`
      : `/qa/conversations/${runId}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    return response.json();
  },

  async getFreshness(repositoryId: string): Promise<{
    repositoryId: string;
    lastAnalyzedCommit: string | null;
    lastAnalyzedDate: string | null;
    lastAnalyzedMessage: string | null;
    remoteHeadCommit: string | null;
    isStale: boolean | 'unknown';
    commitsBehind: number | null;
  }> {
    const response = await fetch(`/qa/freshness/${repositoryId}`);
    if (!response.ok) throw new Error(`Freshness check failed: ${response.status}`);
    return response.json();
  },
};

export default qaService;
