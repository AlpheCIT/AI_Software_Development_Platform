export interface QARunConfig {
  repoUrl: string;
  branch: string;
  repositoryId: string;
  credentials?: {
    type: 'token' | 'ssh';
    token?: string;
  };
  testTypes: ('e2e' | 'api' | 'unit')[];
  maxTests: number;
  baseUrl?: string;
  apiBaseUrl?: string;
  testTimeoutMs: number;
}

export interface RiskArea {
  filePath: string;
  riskLevel: 'high' | 'medium' | 'low';
  reason: string;
  suggestedTestTypes: string[];
}

export interface TestStrategy {
  riskAreas: RiskArea[];
  priorityScore: number;
  coverageStrategy: string;
  suggestedTestCount: number;
  focusAreas: string[];
}

export interface GeneratedTest {
  id: string;
  name: string;
  type: 'e2e' | 'api' | 'unit';
  targetFile: string;
  targetFunction?: string;
  code: string;
  description: string;
  confidence: number;
  iteration: number;
}

export interface CriticFeedback {
  testId: string;
  approved: boolean;
  gaps: string[];
  missingEdgeCases: string[];
  confidenceScore: number;
  suggestions: string[];
}

export interface TestResult {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  duration: number;
  error?: string;
  stackTrace?: string;
}

export interface MutationResult {
  totalMutants: number;
  killed: number;
  survived: number;
  score: number;
  survivors: Array<{
    mutantId: string;
    file: string;
    location: string;
    mutationType: string;
    originalCode: string;
    mutatedCode: string;
  }>;
}

export interface QAAgentState {
  // Run configuration
  runId: string;
  config: QARunConfig;

  // Code context (populated by repo-ingester, consumed by strategist + downstream)
  codeFiles: Array<{ path: string; language: string; size: number; content?: string }>;
  codeEntities: Array<{ name: string; type: string; file: string; signature?: string }>;
  ingestionSource: 'arangodb' | 'git_clone' | 'failed' | 'pending';

  // Agent outputs
  strategy: TestStrategy | null;
  generatedTests: GeneratedTest[];
  criticFeedback: CriticFeedback[];
  testResults: TestResult[];
  mutationResult: MutationResult | null;

  // Control flow
  currentAgent: string;
  iteration: number;
  maxIterations: number;
  shouldLoop: boolean;
  status: 'running' | 'completed' | 'failed';
  errors: string[];

  // Timestamps
  startedAt: string;
  completedAt?: string;
}

export function createInitialState(runId: string, config: QARunConfig): QAAgentState {
  return {
    runId,
    config,
    codeFiles: [],
    codeEntities: [],
    ingestionSource: 'pending',
    strategy: null,
    generatedTests: [],
    criticFeedback: [],
    testResults: [],
    mutationResult: null,
    currentAgent: 'strategist',
    iteration: 0,
    maxIterations: config.testTimeoutMs ? 3 : 3,
    shouldLoop: false,
    status: 'running',
    errors: [],
    startedAt: new Date().toISOString(),
  };
}
