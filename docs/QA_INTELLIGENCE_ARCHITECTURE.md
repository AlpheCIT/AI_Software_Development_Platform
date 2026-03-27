# QA Intelligence Platform - Architecture Documentation

## System Overview

The QA Intelligence Platform is a multi-agent AI system that performs automated quality assurance and product intelligence analysis on Git repositories. It combines test generation, mutation testing, code quality auditing, and strategic product analysis into a single pipeline.

### Core Components

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| QA Engine | Express + LangGraph + Claude | 3005 | Agent orchestration, LLM calls, pipeline execution |
| Frontend | React + Chakra UI | 3000 | Dashboard, live agent visualization, reports |
| ArangoDB | Document + Graph DB | 8529 | Persistent storage for runs, tests, reports |
| Socket.IO | WebSocket layer | 3005 | Real-time agent event streaming to frontend |

### Architecture Diagram

```
Frontend (React)                    QA Engine (Express)
+-----------------------+           +-----------------------------+
| QAIntelligenceDashboard|  WS/HTTP | Socket.IO Server            |
|  - AgentFlowDiagram   |<-------->|  eventPublisher.emit()      |
|  - LiveReasoningStream |          |                             |
|  - AgentControlRoom   |          | LangGraph StateGraph        |
|  - HealthScoreDashboard|          |  repo_ingester              |
|  - Agent Report Panels |          |  strategist -> generator    |
+-----------------------+           |  critic <-> generator (loop)|
         |                          |  executor -> mutation_verifier|
         | REST API                 |  persist_results            |
         |                          |  product_intelligence       |
         v                          +-----------------------------+
+------------------+                         |
| qaService.ts     |                         | DatabaseClient
| (API Client)     |                         v
+------------------+                +--------------------+
                                    | ArangoDB           |
                                    | 14 doc collections |
                                    | 9 edge collections |
                                    | 4 PI collections   |
                                    | 4 agent reports    |
                                    +--------------------+
```

---

## Agent Pipeline Topology

The pipeline has two sequential tracks: QA Testing (Track 1) followed by Product Intelligence (Track 2).

### Track 1: QA Testing Pipeline

```
repo_ingester -> strategist -> generator <-> critic (loop) -> executor -> mutation_verifier (loop) -> persist_results
```

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | **Repo Ingester** | Clones repo (or reads from ArangoDB cache), extracts code files + entities |
| 2 | **Strategist** | Analyzes codebase risk areas, creates prioritized test strategy |
| 3 | **Generator** | Generates executable test code (Jest/Vitest/Playwright) for high-risk files |
| 4 | **Critic** | Reviews tests for quality, edge cases, assertion strength |
| 5 | **Executor** | Writes tests to disk, runs TypeScript compilation, executes E2E tests |
| 6 | **Mutation Verifier** | Identifies mutations that survive existing tests, scores test quality |
| 7 | **persist_results** | Stores run record, test cases, executions, failures, mutations to ArangoDB |

#### Loop Conditions

**Critic -> Generator Loop:**
- Triggers when average confidence score < 0.6
- Sends `criticFeedback` (gaps, missing edge cases) back to Generator
- Max iterations controlled by `state.maxIterations` (default: 3)

**Mutation Verifier -> Generator Loop:**
- Triggers when mutation score < configured threshold AND surviving mutants exist
- Sends `mutationResult.survivors` back to Generator with specific mutations to catch
- Same max iterations limit applies

#### Conditional Edge Logic (from `graph.ts`)

```typescript
// Critic decision
graph.addConditionalEdges('critic', (state) => {
  if (state.shouldLoop && state.currentAgent === 'generator') return 'generator';
  return 'executor';
});

// Mutation verifier decision
graph.addConditionalEdges('mutation_verifier', (state) => {
  if (state.shouldLoop && state.currentAgent === 'generator') return 'generator';
  return 'persist_results';
});
```

### Track 2: Product Intelligence Pipeline

Runs after `persist_results` completes. Failures are non-fatal (QA results are already saved).

```
product_manager -> research_assistant -> [parallel: code_quality_architect, self_healer, api_validator, coverage_auditor, ui_ux_analyst]
```

| Step | Agent | Depends On |
|------|-------|-----------|
| 1 | **Product Manager** | codeFiles, codeEntities |
| 2 | **Research Assistant** | PM roadmap output |
| 3a | **Code Quality Architect** | codeFiles, codeEntities (parallel) |
| 3b | **Self-Healer** | codeFiles, codeEntities (parallel) |
| 3c | **API Validator** | codeFiles, codeEntities (parallel) |
| 3d | **Coverage Auditor** | codeFiles, codeEntities (parallel) |
| 3e | **UI/UX Analyst** | codeFiles, codeEntities (parallel) |

Steps 3a-3e run via `Promise.allSettled()` -- individual failures do not block others.

---

## Event System

All events are broadcast via Socket.IO to all connected clients. Events are emitted by `eventPublisher.emit(event, data)` in the QA Engine.

### Agent Lifecycle Events

| Event | Payload | When |
|-------|---------|------|
| `qa:agent.started` | `{ runId, agent, step }` | Agent begins processing |
| `qa:agent.progress` | `{ runId, agent, progress (0-100), message, data? }` | Agent progress update |
| `qa:agent.streaming` | `{ runId, agent, text, currentFile?, fileIndex?, fileTotal? }` | Partial LLM output / file being processed |
| `qa:agent.completed` | `{ runId, agent, message?, result? }` | Agent finishes successfully |
| `qa:agent.failed` | `{ runId, agent, message, error }` | Agent encounters an error |
| `qa:agent.loop` | `{ runId, from, to, reason, iteration? }` | Agent triggers a feedback loop |

### Test Events

| Event | Payload | When |
|-------|---------|------|
| `qa:test.started` | `{ runId, testId, name }` | Individual test execution begins |
| `qa:test.completed` | `{ runId, testId, status, duration, error? }` | Individual test finishes |
| `qa:test.generated` | `{ runId, agent, testName, count }` | Test code generated |
| `qa:test.result` | `{ testName, status, duration }` | Test result available |

### Mutation Events

| Event | Payload | When |
|-------|---------|------|
| `qa:mutation.started` | `{ runId, totalMutants }` | Mutation analysis begins |
| `qa:mutation.completed` | `{ runId, score, survivors }` | Mutation analysis complete |
| `qa:mutation.result` | `{ mutant, status, score }` | Individual mutant result |

### Run Events

| Event | Payload | When |
|-------|---------|------|
| `qa:run.started` | `{ runId, repoUrl, config }` | Pipeline starts |
| `qa:run.completed` | `{ runId, summary }` | Pipeline finishes successfully |
| `qa:run.failed` | `{ runId, error }` | Pipeline fails |

---

## Data Model

### Document Collections (14)

| Collection | Key Pattern | Purpose |
|-----------|-------------|---------|
| `qa_runs` | `{runId}` | Run metadata: repo, branch, status, test counts, mutation score |
| `qa_test_suites` | `suite_{runId}` | Test strategy and suite metadata |
| `qa_test_cases` | `{uuid}` | Individual generated test: code, target file, confidence |
| `qa_test_executions` | `exec_{runId}_{testId}` | Execution results: status, duration, error |
| `qa_failures` | `fail_{runId}_{testId}` | Failure details: category, error, stack trace |
| `qa_mutations` | `mutation_{runId}` | Mutation testing results: score, survivors |
| `qa_specifications` | - | Test specifications |
| `qa_learnings` | - | Agent learnings over time |
| `qa_risk_scores` | - | Repository risk assessments |
| `qa_agent_effectiveness` | - | Agent performance tracking |
| `qa_bug_archetypes` | - | Recurring bug patterns |
| `qa_wiki_data` | `wiki_{runId}` | Snapshot of files and entities for wiki endpoint |
| `qa_agent_conversations` | auto-generated | LLM prompt/response pairs per agent per run |
| `qa_chat_conversations` | `chat_{convId}_{ts}_{role}` | User follow-up chat messages with agents |

### Edge Collections (9)

| Collection | From -> To | Purpose |
|-----------|------------|---------|
| `qa_tests_file` | test_case -> code_file | Which file a test targets |
| `qa_tests_function` | test_case -> code_entity | Which function a test targets |
| `qa_execution_of` | execution -> test_case | Links execution to its test |
| `qa_failure_from` | failure -> execution | Links failure to its execution |
| `qa_suite_contains` | suite -> test_case | Tests in a suite |
| `qa_run_uses_suite` | run -> suite | Which suite a run used |
| `qa_spec_for` | spec -> code_entity | Specification coverage |
| `qa_mutation_of` | mutation -> test_case | Mutation targeting |
| `qa_similar_to` | test_case -> test_case | Similar test detection |

### Product Intelligence Collections (4)

| Collection | Key Pattern | Purpose |
|-----------|-------------|---------|
| `qa_product_roadmaps` | `roadmap_{runId}` | PM analysis: domain, strengths, gaps, roadmap, personas |
| `qa_research_insights` | `research_{runId}` | Research: trends, competitors, monopoly strategies |
| `qa_product_priorities` | `priorities_{runId}` | Combined ranked priorities from PM + Research |
| `qa_code_quality_reports` | `quality_{runId}` | Code smells, duplication, complexity, architecture |

### Agent Report Collections (4)

| Collection | Key Pattern | Purpose |
|-----------|-------------|---------|
| `qa_self_healing_reports` | `selfheal_{runId}` | Type mismatches, broken imports, missing deps, config issues |
| `qa_api_validation_reports` | `apivalidation_{runId}` | Endpoint inventory, security gaps, error handling |
| `qa_coverage_audit_reports` | `coverage_{runId}` | Backend/frontend coverage gaps, broken calls, CRUD gaps |
| `qa_ui_audit_reports` | `uiaudit_{runId}` | Accessibility, UX anti-patterns, component quality |

---

## State Flow: Backend Events -> Frontend

### 1. Backend emits Socket.IO events

```
eventPublisher.emit('qa:agent.started', { runId, agent: 'strategist', step: '...' })
```

### 2. `useAgentStream` hook receives events

The hook (`apps/frontend/src/hooks/useAgentStream.ts`) connects to Socket.IO and manages:

- `logs: AgentLogEntry[]` -- Rolling buffer of agent messages (max 200)
- `activeAgent: AgentName | null` -- Currently running agent
- `streamingState: AgentStreamingState | null` -- Current LLM streaming text + file info
- `handoffData: Record<string, HandoffInfo>` -- Completion summaries per agent
- `agentTimeline: TimelineEntry[]` -- Full ordered event history
- `isConnected: boolean` -- WebSocket connection status

### 3. React components consume hook state

```
QAIntelligenceDashboard
  |-- useAgentStream(runId) -- connects to Socket.IO
  |-- AgentFlowDiagram(activeAgent, handoffData) -- animated pipeline nodes
  |-- LiveReasoningStream(streamingState) -- typewriter LLM output
  |-- ActivityTicker(logs) -- scrolling log feed
  |-- AgentControlRoom(logs, activeAgent, handoffData, timeline)
  |-- HealthScoreDashboard(productData.summary)
  |-- Agent Report Panels (productData.selfHealing, etc.)
```

### Agent Color Map

| Agent | Color | Label |
|-------|-------|-------|
| strategist | blue | Strategist |
| generator | green | Generator |
| critic | orange | Critic |
| executor | purple | Executor |
| mutation | red | Mutation Verifier |
| product-manager | teal | Product Manager |
| research-assistant | cyan | Research Assistant |
| code-quality-architect | yellow | Code Quality Architect |
| self-healer | pink | Self-Healer |
| api-validator | orange | API Validator |
| coverage-auditor | linkedin | Coverage Auditor |
| ui-ux-analyst | purple | UI/UX Analyst |
