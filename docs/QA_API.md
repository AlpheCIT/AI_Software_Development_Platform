# QA Intelligence Platform - API Documentation

**Base URL:** `http://localhost:3005`

All request and response bodies are JSON. The `Content-Type: application/json` header is required for POST requests.

---

## QA Run Endpoints

### POST /qa/run

Start a new QA run against a repository. Returns immediately; the pipeline runs asynchronously.

**Request Body:**
```json
{
  "repoUrl": "https://github.com/org/repo",
  "branch": "main",
  "credentials": {
    "token": "ghp_xxxx"
  },
  "config": {
    "testTypes": ["unit", "e2e"],
    "maxTests": 20,
    "baseUrl": "http://localhost:3000",
    "apiBaseUrl": "http://localhost:3001",
    "timeout": 30000
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| repoUrl | string | Yes | Git HTTPS URL |
| branch | string | No | Branch to analyze (default: "main") |
| credentials.token | string | No | Access token for private repos |
| config.testTypes | string[] | No | Test types: "unit", "e2e", "api" (default: ["unit", "e2e"]) |
| config.maxTests | number | No | Max tests to generate (capped at server config) |
| config.baseUrl | string | No | App URL for E2E test execution |
| config.timeout | number | No | Test timeout in ms (default: 30000) |

**Response (202 Accepted):**
```json
{
  "runId": "a1b2c3d4-...",
  "repositoryId": "repo_abc123...",
  "status": "started",
  "repoIngested": true,
  "message": "QA run started against existing repository data",
  "endpoints": {
    "status": "/qa/runs/a1b2c3d4-...",
    "results": "/qa/results/a1b2c3d4-..."
  }
}
```

**Error Codes:**
- `400` -- Missing `repoUrl`
- `500` -- Internal server error

---

### GET /qa/runs/:runId

Get the current status of a QA run.

**Path Parameters:** `runId` -- UUID of the run

**Response (200):**
```json
{
  "runId": "a1b2c3d4-...",
  "status": "running",
  "startedAt": "2025-03-27T10:00:00.000Z"
}
```

If the run is complete (stored in ArangoDB), the response includes all fields from the `qa_runs` collection:
```json
{
  "_key": "a1b2c3d4-...",
  "repositoryId": "repo_abc123...",
  "repoUrl": "https://github.com/org/repo",
  "branch": "main",
  "status": "completed",
  "testsGenerated": 15,
  "testsExecuted": 12,
  "testsPassed": 10,
  "testsFailed": 2,
  "mutationScore": 82,
  "iterations": 2,
  "commitSha": "abc1234...",
  "commitMessage": "feat: add auth module",
  "commitDate": "2025-03-26 14:30:00 +0000",
  "startedAt": "2025-03-27T10:00:00.000Z",
  "completedAt": "2025-03-27T10:04:30.000Z"
}
```

**Error Codes:**
- `404` -- Run not found
- `500` -- Internal server error

---

### GET /qa/results/:runId

Get full results of a completed QA run including test cases, executions, failures, and mutations.

**Path Parameters:** `runId` -- UUID of the run

**Response (200):**
```json
{
  "run": { /* qa_runs document */ },
  "testCases": [
    {
      "_key": "uuid",
      "name": "test-auth-login",
      "type": "unit",
      "targetFile": "src/auth/login.ts",
      "targetFunction": "validateCredentials",
      "code": "describe('validateCredentials', () => { ... });",
      "description": "Tests login validation logic",
      "confidence": 0.85,
      "iteration": 1
    }
  ],
  "executions": [
    {
      "_key": "exec_runId_testId",
      "testCaseId": "uuid",
      "runId": "runId",
      "status": "passed",
      "duration": 245,
      "executedAt": "2025-03-27T10:03:00.000Z"
    }
  ],
  "failures": [
    {
      "_key": "fail_runId_testId",
      "testCaseId": "uuid",
      "runId": "runId",
      "category": "test_failure",
      "error": "Expected 200 but got 401",
      "stackTrace": "at Object.<anonymous> ..."
    }
  ],
  "mutations": {
    "totalMutants": 20,
    "killed": 16,
    "survived": 4,
    "score": 80,
    "survivors": [
      {
        "mutantId": "m1",
        "file": "src/auth/login.ts",
        "mutationType": "boundary",
        "originalCode": "if (attempts > 3)",
        "mutatedCode": "if (attempts >= 3)"
      }
    ]
  },
  "summary": {
    "totalTests": 15,
    "executed": 12,
    "passed": 10,
    "failed": 2,
    "skipped": 0,
    "mutationScore": 80,
    "failureCount": 2
  }
}
```

**Error Codes:**
- `404` -- Run not found
- `500` -- Internal server error

---

### GET /qa/runs

List all QA runs, sorted by most recent first.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max results (capped at 100) |

**Response (200):**
```json
{
  "runs": [
    {
      "_key": "a1b2c3d4-...",
      "repositoryId": "repo_abc123...",
      "repoUrl": "https://github.com/org/repo",
      "status": "completed",
      "testsGenerated": 15,
      "testsPassed": 10,
      "testsFailed": 2,
      "mutationScore": 82,
      "startedAt": "2025-03-27T10:00:00.000Z",
      "completedAt": "2025-03-27T10:04:30.000Z"
    }
  ],
  "total": 1
}
```

Returns `{ runs: [], total: 0 }` if the collection does not exist yet.

---

## Conversation Endpoints

### GET /qa/conversations/:runId

Get all agent LLM conversations (prompts and responses) for a run.

**Path Parameters:** `runId` -- UUID of the run

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agent | string | No | Filter by agent name (e.g., "strategist", "critic") |

**Response (200):**
```json
{
  "conversations": [
    {
      "runId": "a1b2c3d4-...",
      "agent": "strategist",
      "systemPrompt": "You are a senior QA architect...",
      "userMessage": "Analyze this codebase...",
      "response": "{ \"riskAreas\": [...] }",
      "tokensUsed": { "input": 4200, "output": 1800 },
      "durationMs": 12500,
      "timestamp": "2025-03-27T10:01:00.000Z"
    }
  ],
  "total": 6
}
```

---

## Freshness Endpoint

### GET /qa/freshness/:repositoryId

Check whether the last analyzed commit is still the HEAD of the remote branch.

**Path Parameters:** `repositoryId` -- Repository ID (base64url-encoded repoUrl:branch)

**Response (200):**
```json
{
  "repositoryId": "repo_abc123...",
  "lastAnalyzedCommit": "abc1234567890...",
  "lastAnalyzedDate": "2025-03-26 14:30:00 +0000",
  "lastAnalyzedMessage": "feat: add auth module",
  "remoteHeadCommit": "def5678901234...",
  "isStale": true,
  "commitsBehind": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| isStale | boolean or "unknown" | `true` if remote has newer commits, `"unknown"` if git ls-remote failed |
| commitsBehind | number or null | Minimum estimate (1 if different, 0 if same, null if unknown) |

**Error Codes:**
- `404` -- No runs found for this repository
- `500` -- Internal server error

---

## Chat Endpoints

### POST /qa/chat

Send a message to an agent and receive a contextual response. The agent uses its original analysis as context.

**Request Body:**
```json
{
  "runId": "a1b2c3d4-...",
  "agent": "strategist",
  "message": "Why did you rate auth.ts as high risk?",
  "conversationId": "optional-uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| runId | string | Yes | Run to provide context from |
| agent | string | Yes | Agent to chat with (see Agent names below) |
| message | string | Yes | User's question |
| conversationId | string | No | Continue existing conversation (auto-generated if omitted) |

**Valid agent names:** `strategist`, `generator`, `critic`, `executor`, `mutation-verifier`, `product-manager`, `research-assistant`, `code-quality-architect`, `self-healer`, `api-validator`, `coverage-auditor`, `ui-ux-analyst`

**Response (200):**
```json
{
  "conversationId": "conv-uuid",
  "response": "I rated auth.ts as high risk because...",
  "agent": "strategist",
  "runId": "a1b2c3d4-..."
}
```

**Error Codes:**
- `400` -- Missing runId, agent, or message
- `500` -- LLM call failed

---

### GET /qa/chat/:conversationId

Get the full chat history for a conversation.

**Path Parameters:** `conversationId` -- UUID of the conversation

**Response (200):**
```json
{
  "conversationId": "conv-uuid",
  "messages": [
    { "role": "user", "content": "Why high risk?", "timestamp": "2025-03-27T10:10:00.000Z" },
    { "role": "assistant", "content": "Because...", "timestamp": "2025-03-27T10:10:05.000Z" }
  ],
  "total": 2
}
```

---

## Product Intelligence Endpoints

### GET /qa/product/:runId

Get the full product intelligence report for a run (all 8 agent reports combined).

**Path Parameters:** `runId` -- UUID of the run

**Response (200):**
```json
{
  "roadmap": {
    "appDomain": "Manufacturing Execution System",
    "currentStrengths": ["Real-time monitoring", "..."],
    "criticalGaps": ["No mobile support", "..."],
    "roadmap": {
      "immediate": [{ "title": "...", "userImpact": "high", "effort": "M", "..." }],
      "shortTerm": [],
      "mediumTerm": [],
      "longTerm": []
    },
    "userPersonas": [{ "name": "Plant Manager", "..." }]
  },
  "research": {
    "domainAnalysis": { "industry": "...", "marketSize": "...", "..." },
    "trendInsights": [{ "trend": "...", "relevance": "game-changer", "..." }],
    "competitorIntel": [{ "competitor": "...", "threatLevel": "high", "..." }],
    "monopolyStrategies": [{ "strategy": "...", "feasibility": "high", "..." }]
  },
  "codeQuality": {
    "overallHealth": { "score": 72, "grade": "B-" },
    "codeSmells": [],
    "complexityHotspots": [],
    "..."
  },
  "selfHealing": {
    "healthScore": 85,
    "typeMismatches": [],
    "brokenImports": [],
    "..."
  },
  "apiValidation": {
    "apiHealthScore": 68,
    "endpoints": [],
    "securityGaps": [],
    "..."
  },
  "coverageAudit": {
    "coverageScore": 74,
    "unexposedBackendFeatures": [],
    "brokenFrontendCalls": [],
    "..."
  },
  "uiAudit": {
    "accessibilityScore": 62,
    "uxScore": 70,
    "accessibilityIssues": [],
    "..."
  },
  "priorities": [
    {
      "rank": 1,
      "title": "Feature Name",
      "source": "combined",
      "description": "...",
      "impact": "high",
      "effort": "M",
      "monopolyPotential": true
    }
  ],
  "summary": {
    "appDomain": "Manufacturing Execution System",
    "totalFeatures": 24,
    "criticalGaps": 5,
    "gameChangerTrends": 3,
    "monopolyStrategies": 2,
    "combinedPriorities": 18,
    "codeHealthScore": 72,
    "codeHealthGrade": "B-",
    "totalFindings": 45,
    "selfHealingScore": 85,
    "apiHealthScore": 68,
    "coverageScore": 74,
    "accessibilityScore": 62,
    "uxScore": 70
  }
}
```

**Error Codes:**
- `404` -- Product intelligence not yet available (agents may still be running)
- `500` -- Internal server error

---

### GET /qa/product

List all product intelligence reports, sorted by most recent.

**Response (200):**
```json
{
  "reports": [
    {
      "runId": "a1b2c3d4-...",
      "repositoryId": "repo_abc123...",
      "appDomain": "Manufacturing Execution System",
      "totalFeatures": 24,
      "criticalGaps": 5,
      "createdAt": "2025-03-27T10:04:00.000Z"
    }
  ]
}
```

---

### GET /qa/product/health-history/:repositoryId

Get health score trends across multiple runs for a repository.

**Path Parameters:** `repositoryId` -- Repository ID

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max runs to return (capped at 50) |

**Response (200):**
```json
{
  "repositoryId": "repo_abc123...",
  "history": [
    {
      "runId": "run1-uuid",
      "date": "2025-03-25T10:00:00.000Z",
      "scores": {
        "codeQuality": 65,
        "selfHealing": 78,
        "apiHealth": 60,
        "coverage": 70,
        "accessibility": 55,
        "ux": 62,
        "mutation": 72
      }
    },
    {
      "runId": "run2-uuid",
      "date": "2025-03-27T10:00:00.000Z",
      "scores": {
        "codeQuality": 72,
        "selfHealing": 85,
        "apiHealth": 68,
        "coverage": 74,
        "accessibility": 62,
        "ux": 70,
        "mutation": 82
      }
    }
  ],
  "total": 2
}
```

---

## System Endpoints

### GET /health

Health check endpoint.

**Response (200):**
```json
{
  "service": "qa-engine",
  "status": "healthy",
  "timestamp": "2025-03-27T10:00:00.000Z",
  "version": "1.0.0",
  "config": {
    "anthropicModel": "claude-sonnet-4-20250514",
    "hasApiKey": true,
    "mutationThreshold": 70,
    "maxTestsPerRun": 50
  }
}
```

---

### GET /metrics

Aggregate metrics across all runs.

**Response (200):**
```json
{
  "service": "qa-engine",
  "totalRuns": 47,
  "avgMutationScore": 76.3,
  "timestamp": "2025-03-27T10:00:00.000Z"
}
```

**Error Codes:**
- `500` -- Failed to query metrics

---

## WebSocket Events

Connect to `ws://localhost:3005` via Socket.IO for real-time agent events during a run.

**Connection:**
```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3005', {
  transports: ['websocket', 'polling'],
  query: { runId: 'your-run-id' }
});

socket.on('qa:agent.started', (data) => { /* ... */ });
socket.on('qa:agent.completed', (data) => { /* ... */ });
socket.on('qa:run.completed', (data) => { /* ... */ });
```

See the [Architecture Documentation](./QA_INTELLIGENCE_ARCHITECTURE.md#event-system) for the complete list of Socket.IO events and their payloads.
