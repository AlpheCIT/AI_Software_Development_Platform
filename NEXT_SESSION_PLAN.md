# Next Session Plan — Interactive AI Development Partner

## Context
The QA Intelligence Platform is built and working. 9 AI agents analyze repos (tested on AlpheCIT/MES with 198 files, 1,110 entities). The UI has Action Center (Developer/PM/Executive views), Run Manager, Wiki, Analytics, Mutation Trends, Risk Heatmap, and Cumulative Report. 24 commits, ~23,000 lines of new code on branch `claude/suspicious-northcutt`.

## What Needs to Be Built

### 1. Agent Communication Viewer (HIGH PRIORITY)
**Problem:** Agent tiles are static — you can't see what the agent is thinking or doing.
**Solution:** Click an agent tile to expand and see the actual LLM conversation:
- The prompt sent to Claude (system prompt + user message)
- Claude's response (streaming, not just final)
- Decision points: "I found 8 risk areas, prioritizing auth module because..."

**Implementation:**
- Backend: Store each agent's prompt/response in ArangoDB `qa_agent_conversations` collection
- Each agent node (strategist, generator, etc.) should save: `{ runId, agent, prompt, response, timestamp, tokensUsed }`
- Frontend: Expandable agent tile → shows chat-like transcript
- File: Update all 9 agent nodes to persist conversations
- File: New `AgentConversationPanel.tsx` component

### 2. Active Agent Animations (HIGH PRIORITY)
**Problem:** When an agent is working, the tile just shows a spinning icon — no sense of real activity.
**Solution:**
- Show streaming text preview (first 100 chars of Claude's response as it comes in)
- Typing indicator animation (three dots bouncing)
- File being analyzed indicator (show current file name)
- Progress details: "Analyzing file 45/198: client/kiosk/js/queue.js"

**Implementation:**
- Backend: Emit more granular Socket.IO events: `qa:agent.streaming` with partial text
- Frontend: AgentPipeline tiles show streaming preview text
- Use Framer Motion for typing indicator

### 3. Human-in-the-Loop Chat (MAJOR FEATURE)
**Problem:** Results are one-shot — you can't ask follow-up questions or guide the analysis.
**Solution:** Chat interface per agent where humans can:
- Ask "Why did you flag auth.js as high risk?"
- Request "Dig deeper into the scheduling module"
- Provide context "We're planning to rewrite the kiosk app in React Native"
- The agent responds with maintained context from its original analysis

**Implementation:**
- Backend: New endpoint `POST /qa/chat` accepting `{ runId, agent, message, conversationId }`
- Uses ChatAnthropic with conversation history (system prompt + original analysis + user messages)
- Stores conversation in `qa_conversations` collection
- Frontend: New `AgentChat.tsx` component — chat bubble UI in expanded agent tile
- Context: Include the agent's original analysis results as system context

### 4. New Agent: UI/UX Analyst
**Problem:** No automated checking if the frontend works correctly, is accessible, or follows UX best practices.
**What it does:**
- Analyzes React/JSX components for accessibility (aria labels, keyboard nav, color contrast)
- Checks if all routes render without errors
- Validates responsive design breakpoints
- Flags UX anti-patterns (missing loading states, no error boundaries, inconsistent styling)
- Suggests improvements based on modern UX principles

**Implementation:**
- New file: `services/qa-engine/src/agents/nodes/ui-ux-analyst.ts`
- Scans .tsx/.jsx files for accessibility issues via regex + LLM analysis
- Produces: `UIAuditReport { accessibilityIssues, renderErrors, responsiveIssues, uxAntiPatterns, suggestions }`
- New ArangoDB collection: `qa_ui_audit_reports`

### 5. New Agent: API Validator
**Problem:** No automated testing that API endpoints work correctly, return proper schemas, handle errors.
**What it does:**
- Discovers all API routes from the codebase (Express routes, controller files)
- Validates request/response schemas
- Checks error handling (are all endpoints wrapped in try/catch?)
- Tests if documented endpoints actually exist
- Validates CORS, auth middleware, rate limiting

**Implementation:**
- New file: `services/qa-engine/src/agents/nodes/api-validator.ts`
- Scans route files, extracts endpoint definitions
- LLM analyzes each endpoint for completeness and security
- Produces: `APIValidationReport { endpoints[], missingErrorHandling[], schemaIssues[], securityGaps[] }`
- New ArangoDB collection: `qa_api_validation_reports`

### 6. New Agent: Backend-Frontend Coverage Auditor
**Problem:** Backend has features that aren't exposed in the UI (like the code quality data that existed but wasn't rendered).
**What it does:**
- Cross-references backend API endpoints with frontend service calls
- Finds backend capabilities with no frontend counterpart
- Finds frontend components making calls to non-existent endpoints
- Flags orphaned code (backend routes with no consumers)

**Implementation:**
- New file: `services/qa-engine/src/agents/nodes/coverage-auditor.ts`
- Scans backend route files → builds API surface list
- Scans frontend service files → builds consumer list
- LLM cross-references and identifies gaps
- Produces: `CoverageAuditReport { unexposedBackendFeatures[], brokenFrontendCalls[], orphanedRoutes[] }`
- New ArangoDB collection: `qa_coverage_audit_reports`

### 7. Self-Healing Code Detection Agent
**Problem:** TypeScript errors, import mismatches, missing deps, config issues aren't caught until runtime.
**What it does:**
- Detects type mismatches across file boundaries (like the `_key` vs `id` issue)
- Finds broken imports (importing from files that don't export what's expected)
- Validates package.json dependencies vs actual imports
- Checks environment variable usage vs .env definitions
- Validates config file consistency

**Implementation:**
- New file: `services/qa-engine/src/agents/nodes/self-healer.ts`
- Static analysis of imports, types, and configurations
- LLM identifies subtle issues that linting misses
- Produces: `SelfHealingReport { typeMismatches[], brokenImports[], missingDeps[], configIssues[], fixes[] }`
- Each issue includes an auto-fix suggestion

### 8. Interactive Full Report
**Problem:** The cumulative report is static — you can't ask follow-up questions.
**Solution:** Add a chat interface at the bottom of the Full Report:
- "Ask about this report" input
- Maintains context of the entire report content
- Can answer: "What's the ROI of implementing the notification system?" or "Which developer should work on the auth refactoring?"

**Implementation:**
- Uses the same `/qa/chat` endpoint as Human-in-the-Loop
- System context includes the full report data
- Frontend: Chat component embedded in CumulativeReport.tsx

---

## Priority Order for Next Session

1. **Agent Communication Viewer** — Quick win, high visual impact
2. **Active Agent Animations** — Pairs with #1, makes the pipeline feel alive
3. **Human-in-the-Loop Chat** — Core differentiator, enables iterative improvement
4. **Self-Healing Code Detection** — Catches the exact type of bugs we hit during development
5. **API Validator** — Ensures backend reliability
6. **Backend-Frontend Coverage Auditor** — Prevents "feature exists but UI doesn't show it"
7. **UI/UX Analyst** — Quality assurance for the frontend
8. **Interactive Report** — Extension of Human-in-the-Loop

## Technical Prerequisites
- QA Engine running on port 3005 with Anthropic API key
- ArangoDB running on port 8529
- Frontend running on port 3000
- Branch: `claude/suspicious-northcutt` (24 commits ahead of main)

## Key Files to Reference
- Agent nodes: `services/qa-engine/src/agents/nodes/`
- Agent graph: `services/qa-engine/src/agents/graph.ts`
- Agent state: `services/qa-engine/src/agents/state.ts`
- Frontend pipeline: `apps/frontend/src/components/qa-intelligence/AgentPipeline.tsx`
- Action Center: `apps/frontend/src/components/qa-intelligence/ActionCenter.tsx`
- QA Dashboard: `apps/frontend/src/components/qa-intelligence/QAIntelligenceDashboard.tsx`
- Service client: `apps/frontend/src/services/qaService.ts`
- Socket.IO events: `services/qa-engine/src/index.ts` (eventPublisher)
