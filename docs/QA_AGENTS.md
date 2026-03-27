# QA Intelligence Platform - Agent Documentation

All agent nodes live in `services/qa-engine/src/agents/nodes/`.

---

## 1. Repo Ingester

**File:** `repo-ingester.ts`

**Role:** First agent in the pipeline. Obtains source code for analysis either by reading cached data from ArangoDB or by cloning the Git repository to a temp directory.

**System Prompt:** N/A (no LLM call -- pure code logic).

**Input:**
- `state.config.repoUrl` -- Git repository URL
- `state.config.branch` -- Branch to analyze (default: main)
- `state.config.repositoryId` -- Deterministic ID for caching
- `state.config.credentials.token` -- Optional access token for private repos

**Output:**
```typescript
{
  codeFiles: CodeFile[];       // path, language, size, content (first 2000 chars)
  codeEntities: CodeEntity[];  // name, type, file, signature (functions, classes, etc.)
  ingestionSource: 'arangodb' | 'git_clone' | 'failed';
  commitSha?: string;
  commitMessage?: string;
  commitDate?: string;
}
```

**Events Emitted:**
- `qa:agent.started` -- with step "Checking for existing code data or cloning repository"
- `qa:agent.progress` -- at 10% (cloning), 40% (reading files)
- `qa:agent.completed` -- with `{ source, files, entities }` counts
- `qa:agent.failed` -- if clone fails

**Chat Capability:** No (no LLM analysis to discuss).

**Report Schema:** No persistent report. Data flows to next agents via state.

**Failure Behavior:** Returns empty `codeFiles` and `codeEntities` arrays. Downstream agents degrade gracefully with limited data.

---

## 2. Test Strategist

**File:** `test-strategist.ts`

**Role:** Analyzes the codebase to identify high-risk areas and creates a prioritized test strategy.

**System Prompt Summary:** Acts as a senior QA architect. Evaluates code complexity, external dependencies, auth logic, state management, data validation, and error handling paths. Outputs risk areas with suggested test types.

**Input:**
- `state.codeFiles` -- All source files from Repo Ingester
- `state.codeEntities` -- Extracted functions/classes/interfaces
- `state.config` -- repoUrl, branch, testTypes, maxTests

**Output:**
```typescript
{
  strategy: {
    riskAreas: Array<{ filePath, riskLevel, reason, suggestedTestTypes }>;
    priorityScore: number;        // 0-1
    coverageStrategy: string;
    suggestedTestCount: number;
    focusAreas: string[];
  };
  currentAgent: 'generator';
}
```

**Events Emitted:**
- `qa:agent.started`, `qa:agent.progress` (20%, 50%)
- `qa:agent.streaming` -- "Building codebase context..." / "Sending to Claude..."
- `qa:agent.completed` -- `{ riskAreasCount, highRiskCount, priorityScore }`

**Chat Capability:** Yes. System prompt: "You are the QA Strategist agent. You previously analyzed a codebase..."

**Failure Behavior:** Falls back to a default strategy targeting the first 5 files with medium risk.

---

## 3. Test Generator

**File:** `test-generator.ts`

**Role:** Generates executable test code (Jest/Vitest for unit, Playwright for E2E, supertest for API) targeting high-risk files identified by the Strategist.

**System Prompt Summary:** Expert test engineer generating real, runnable tests with meaningful assertions, edge cases, error paths, and boundary conditions.

**Input:**
- `state.strategy` -- Risk areas and focus areas from Strategist
- `state.codeFiles` -- Source code content (first 3000 chars per file)
- `state.criticFeedback` -- Gaps from previous iteration (if looping)
- `state.mutationResult.survivors` -- Surviving mutants (if looping from Mutation Verifier)

**Output:**
```typescript
{
  generatedTests: Array<{
    id: string;           // UUID
    name: string;
    type: 'unit' | 'e2e' | 'api';
    targetFile: string;
    targetFunction?: string;
    code: string;         // Full test source code
    description?: string;
    confidence: number;   // 0-1
    iteration: number;
  }>;
  currentAgent: 'critic';
}
```

**Events Emitted:**
- `qa:agent.started`, `qa:agent.streaming` (per file), `qa:agent.progress` (30%)
- `qa:agent.completed` -- `{ testsGenerated, testTypes, avgConfidence }`

**Chat Capability:** Yes. System prompt: "You are the Test Generator agent..."

**Failure Behavior:** Creates a minimal smoke test (`expect(true).toBe(true)`) so the pipeline continues.

---

## 4. Critic

**File:** `critic.ts`

**Role:** Reviews generated tests for quality. Evaluates assertion strength, edge case coverage, error path testing, and mutation resilience. Can trigger a loop back to Generator.

**System Prompt Summary:** Rigorous QA critic. Evaluates meaningful assertions, edge cases, error paths, mutation survival likelihood, and business logic coverage. Harsh but constructive.

**Input:**
- `state.generatedTests` -- Tests from current iteration
- `state.strategy` -- Original risk areas for context

**Output:**
```typescript
{
  criticFeedback: Array<{
    testId: string;
    approved: boolean;
    gaps: string[];
    missingEdgeCases: string[];
    confidenceScore: number;  // 0-1
    suggestions: string[];
  }>;
  shouldLoop: boolean;     // true if avg confidence < 0.6
  iteration: number;       // incremented if looping
  currentAgent: 'generator' | 'executor';
}
```

**Events Emitted:**
- `qa:agent.started`
- `qa:agent.loop` -- if sending back to Generator (includes reason)
- `qa:agent.completed` -- `{ reviewed, approved, rejected, avgConfidence, shouldLoop }`

**Chat Capability:** Yes. System prompt: "You are the QA Critic agent..."

**Failure Behavior:** Approves all tests with confidence 0.6, no gaps. Pipeline continues to executor.

---

## 5. Executor

**File:** `executor.ts`

**Role:** Executes generated tests. Writes test files to a temp directory, runs TypeScript compilation checks, and optionally executes Playwright E2E tests against a running application.

**System Prompt:** N/A (no LLM call -- executes code directly).

**Input:**
- `state.generatedTests` -- All generated tests
- `state.criticFeedback` -- To filter for approved tests only
- `state.config.baseUrl` -- If provided, runs E2E tests against this URL

**Output:**
```typescript
{
  testResults: Array<{
    testId: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;   // ms
    error?: string;
    stackTrace?: string;
  }>;
  currentAgent: 'mutation-verifier';
}
```

**Events Emitted:**
- `qa:agent.started`, `qa:agent.streaming` (per test file)
- `qa:test.started`, `qa:test.completed` (per individual test)
- `qa:agent.progress` -- percentage through test suite
- `qa:agent.completed` -- `{ total, passed, failed, skipped }`

**Chat Capability:** Yes. System prompt: "You are the Test Executor agent..."

**Failure Behavior:** Individual test failures are recorded; the agent continues executing remaining tests. Temp directory is cleaned up in all cases.

---

## 6. Mutation Verifier

**File:** `mutation-verifier.ts`

**Role:** Analyzes test quality through mutation testing. Identifies code mutations (changing `>` to `>=`, flipping booleans, etc.) that would survive the current tests, indicating weak test coverage.

**System Prompt Summary:** Mutation testing expert. Identifies realistic mutations that represent real bugs and assesses which tests would fail to catch them.

**Input:**
- `state.codeFiles` -- Source code to mutate (first 10 files with content)
- `state.generatedTests` -- Approved tests to analyze
- `state.criticFeedback` -- To filter approved tests

**Output:**
```typescript
{
  mutationResult: {
    totalMutants: number;
    killed: number;
    survived: number;
    score: number;         // percentage (killed/total * 100)
    survivors: Array<{
      mutantId: string;
      file: string;
      location: string;
      mutationType: string;
      originalCode: string;
      mutatedCode: string;
    }>;
  };
  shouldLoop: boolean;     // true if score < threshold AND survivors exist
  status: 'running' | 'completed';
}
```

**Events Emitted:**
- `qa:mutation.started`, `qa:agent.started`
- `qa:agent.loop` -- if score below threshold
- `qa:mutation.completed` -- `{ score, survivors }`
- `qa:agent.completed` -- `{ score, killed, survived, threshold, passed }`

**Chat Capability:** Yes. System prompt: "You are the Mutation Verifier agent..."

**Failure Behavior:** Returns estimated score (67%) based on test count. Pipeline continues.

---

## 7. Product Manager

**File:** `product-intelligence/product-manager.ts`

**Role:** Analyzes the codebase from a product strategy perspective. Identifies the app domain, current strengths, critical gaps, and builds a prioritized feature roadmap with user personas and competitive analysis.

**System Prompt Summary:** World-class VP of Product. Obsessed with user value, competitive moats, and shipping features that dominate the market segment. Thinks in terms of 80/20 impact, integrations, and user journey breakdowns.

**Input:**
- `codeFiles` -- All source files
- `codeEntities` -- Extracted code entities
- `repoUrl` -- Repository URL for context

**Output:**
```typescript
{
  appDomain: string;
  currentStrengths: string[];
  criticalGaps: string[];
  roadmap: {
    immediate: FeatureRecommendation[];
    shortTerm: FeatureRecommendation[];
    mediumTerm: FeatureRecommendation[];
    longTerm: FeatureRecommendation[];
  };
  competitiveAnalysis: { marketSegment, competitors, uniquePositioning };
  userPersonas: Array<{ name, role, painPoints, desiredOutcomes }>;
}
```

**Events Emitted:** `qa:agent.progress` (agent: product-manager)

**Chat Capability:** Yes. System prompt: "You are the Product Manager agent..."

**Report Schema:** Stored in `qa_product_roadmaps` collection.

**Failure Behavior:** Error logged, non-fatal. QA results are already persisted.

---

## 8. Research Assistant

**File:** `product-intelligence/research-assistant.ts`

**Role:** Takes the PM's roadmap and researches emerging technology trends, competitive intelligence, and monopoly strategies specific to the app's market segment.

**System Prompt Summary:** Elite technology research analyst. Identifies emerging technologies, market trends, competitor moves, integration opportunities, AI/ML potential, and monetization insights.

**Input:**
- `roadmap` -- Product Manager's output (appDomain, roadmap, competitive analysis)
- `codeFiles` -- Source files for technical context
- `repoUrl` -- Repository URL

**Output:**
```typescript
{
  domainAnalysis: { industry, marketSize, growthDirection, keyDrivers };
  trendInsights: Array<{ trend, category, description, relevance, implementationPath, examples, timeframe, effort }>;
  competitorIntel: Array<{ competitor, strengths, weaknesses, recentMoves, threatLevel }>;
  monopolyStrategies: Array<{ strategy, type, description, feasibility, implementation }>;
  enhancementRecommendations: Array<{ title, description, priority, basedOn, technologiesNeeded }>;
}
```

**Events Emitted:** `qa:agent.progress` (agent: research-assistant)

**Chat Capability:** Yes. System prompt: "You are the Research Assistant agent..."

**Report Schema:** Stored in `qa_research_insights` collection.

**Failure Behavior:** Error logged, non-fatal.

---

## 9. Code Quality Architect

**File:** `product-intelligence/code-quality-architect.ts`

**Role:** Deep code quality audit. Identifies code smells, duplication, complexity hotspots, architecture issues, and produces a refactoring roadmap. Assigns an overall health score (0-100) and letter grade.

**System Prompt Summary:** World-class Software Architect and Technical Debt specialist. Analyzes SOLID violations, God classes, feature envy, dead code, circular dependencies, and produces specific refactoring steps.

**Input:**
- `codeFiles` -- Source files with content
- `codeEntities` -- Functions, classes, interfaces

**Output:**
```typescript
{
  overallHealth: { score: number, grade: string };
  codeSmells: Array<{ file, line, type, severity, message, suggestion }>;
  duplicationHotspots: Array<{ files, lines, similarity, suggestion }>;
  complexityHotspots: Array<{ file, function, complexity, linesOfCode, suggestion }>;
  architectureIssues: Array<{ type, severity, description, affectedFiles, recommendation }>;
  refactoringRoadmap: Array<{ title, priority, effort, impact, files, category }>;
  consolidationOpportunities: Array<{ title, files, estimatedReduction, effort }>;
  deadCode: Array<{ file, type, name, line, confidence }>;
  bestPracticeViolations: Array<{ rule, severity, file, line, message, fix }>;
}
```

**Events Emitted:** `qa:agent.progress` (agent: code-quality-architect)

**Chat Capability:** Yes. System prompt: "You are the Code Quality Architect agent..."

**Report Schema:** Stored in `qa_code_quality_reports` collection.

**Failure Behavior:** Error logged, non-fatal.

---

## 10. Self-Healer

**File:** `self-healer.ts`

**Role:** Detects subtle cross-file issues that linters miss: type mismatches across file boundaries, broken imports, missing dependencies, environment variable issues, and config inconsistencies. Provides auto-fix suggestions for each issue.

**System Prompt Summary:** Expert static analysis engineer. Finds runtime/integration bugs: interface changes not propagated, circular deps causing undefined, packages missing from package.json, env vars without fallbacks, port mismatches between services.

**Input:**
- `codeFiles` -- Source files with content
- `codeEntities` -- Functions, classes, types

**Output:**
```typescript
{
  typeMismatches: Array<{ file, line, expected, actual, severity, fix }>;
  brokenImports: Array<{ file, importStatement, issue, severity, fix }>;
  missingDeps: Array<{ package, usedIn, inPackageJson, fix }>;
  configIssues: Array<{ type, description, files, severity, fix }>;
  autoFixes: Array<{ title, description, files, changes, confidence, breakingRisk }>;
  healthScore: number;  // 0-100
  summary: string;
}
```

**Events Emitted:** `qa:agent.progress` (agent: self-healer)

**Chat Capability:** Yes. System prompt: "You are the Self-Healing Code Detection agent..."

**Report Schema:** Stored in `qa_self_healing_reports` collection.

**Failure Behavior:** `Promise.allSettled` -- if this agent fails, others continue. Error logged.

---

## 11. API Validator

**File:** `api-validator.ts`

**Role:** Discovers all API endpoints in the codebase and validates them for error handling, input validation, authentication, CORS, rate limiting, and schema consistency.

**System Prompt Summary:** API security and reliability expert. Discovers Express routes, controller methods, and validates each for try/catch wrapping, param validation, auth checks, CORS config, rate limiting, and schema consistency.

**Input:**
- `codeFiles` -- Source files (especially route files, controllers)
- `codeEntities` -- Functions and handlers

**Output:**
```typescript
{
  endpoints: Array<{ method, path, file, handler, hasErrorHandling, hasInputValidation, hasAuth, hasRateLimiting, issues }>;
  missingErrorHandling: Array<{ endpoint, file, severity, fix }>;
  schemaIssues: Array<{ endpoint, issue, severity, fix }>;
  securityGaps: Array<{ type, endpoint, description, severity, fix }>;
  apiHealthScore: number;  // 0-100
  summary: string;
}
```

**Events Emitted:** `qa:agent.progress` (agent: api-validator)

**Chat Capability:** Yes. System prompt: "You are the API Validator agent..."

**Report Schema:** Stored in `qa_api_validation_reports` collection.

**Failure Behavior:** `Promise.allSettled` -- isolated failure.

---

## 12. Coverage Auditor

**File:** `coverage-auditor.ts`

**Role:** Cross-references backend APIs with frontend consumers to find coverage gaps: hidden backend features with no UI, broken frontend API calls, orphaned routes, data shape mismatches, and incomplete CRUD operations.

**System Prompt Summary:** Expert at finding features on one side but not the other. Prevents hidden capabilities and broken calls.

**Input:**
- `codeFiles` -- Both backend and frontend source files
- `codeEntities` -- Route handlers, service functions, API clients

**Output:**
```typescript
{
  unexposedBackendFeatures: Array<{ endpoint, file, description, suggestedUILocation, priority }>;
  brokenFrontendCalls: Array<{ file, call, expectedEndpoint, issue, fix }>;
  orphanedRoutes: Array<{ endpoint, file, reason, recommendation }>;
  dataShapeMismatches: Array<{ endpoint, backendShape, frontendExpects, files, fix }>;
  missingCrudOperations: Array<{ resource, hasCreate, hasRead, hasUpdate, hasDelete, missingOperations, priority }>;
  coverageScore: number;  // 0-100
  summary: string;
}
```

**Events Emitted:** `qa:agent.progress` (agent: coverage-auditor)

**Chat Capability:** Yes. System prompt: "You are the Backend-Frontend Coverage Auditor agent..."

**Report Schema:** Stored in `qa_coverage_audit_reports` collection.

**Failure Behavior:** `Promise.allSettled` -- isolated failure.

---

## 13. UI/UX Analyst

**File:** `ui-ux-analyst.ts`

**Role:** Audits React/frontend code for accessibility (WCAG 2.1), UX anti-patterns, component quality, and user flow issues. Produces accessibility and UX scores.

**System Prompt Summary:** Senior UI/UX auditor and accessibility specialist. Checks missing aria-labels, alt text, color contrast, keyboard navigation, focus indicators, form labels. Finds missing loading states, error boundaries, empty states, confirmation dialogs, responsive breakpoints. Evaluates component complexity, i18n, memoization.

**Input:**
- `codeFiles` -- Frontend source files (.tsx, .jsx, .vue, .svelte)
- `codeEntities` -- React components, hooks

**Output:**
```typescript
{
  accessibilityIssues: Array<{ file, type, element, severity, wcagCriteria, fix }>;
  uxAntiPatterns: Array<{ file, pattern, description, userImpact, fix }>;
  componentIssues: Array<{ file, component, issue, severity, fix }>;
  userFlowIssues: Array<{ flow, issue, affectedFiles, fix }>;
  suggestions: Array<{ title, description, category, effort, impact }>;
  accessibilityScore: number;  // 0-100
  uxScore: number;              // 0-100
  summary: string;
}
```

**Events Emitted:** `qa:agent.progress` (agent: ui-ux-analyst)

**Chat Capability:** Yes. System prompt: "You are the UI/UX Analyst agent..."

**Report Schema:** Stored in `qa_ui_audit_reports` collection.

**Failure Behavior:** `Promise.allSettled` -- isolated failure.
