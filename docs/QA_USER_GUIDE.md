# QA Intelligence Platform - User Guide

## Getting Started

### Starting a QA Run

1. Open the QA Intelligence Dashboard from the main navigation.
2. In the **QA Run Control** panel at the top, enter:
   - **Repository URL** -- any Git HTTPS URL (e.g., `https://github.com/org/repo`)
   - **Branch** -- defaults to `main`
   - **Test Types** -- select from Unit, E2E, and API
   - **Max Tests** -- cap on generated tests per run (default: 20)
3. Click **Start QA Run**. The system returns immediately with a `runId`.
4. The pipeline begins executing asynchronously. You will see real-time progress in the dashboard.

### What Happens During a Run

The system performs two sequential tracks:

**Track 1 -- QA Testing** (typically 2-5 minutes):
1. Clones your repository (or uses cached data)
2. Analyzes code risk areas
3. Generates executable tests targeting high-risk files
4. Reviews tests for quality (may loop to regenerate weak tests)
5. Executes tests and checks for compilation errors
6. Performs mutation analysis to score test effectiveness

**Track 2 -- Product Intelligence** (typically 3-8 minutes):
7. Product Manager analyzes your codebase strategically
8. Research Assistant investigates market trends
9. Five specialist agents run in parallel: Code Quality, Self-Healer, API Validator, Coverage Auditor, UI/UX Analyst

---

## Reading the Flow Diagram

The **Agent Flow Diagram** at the top of the dashboard shows all 13 agents as connected nodes.

### Node States

| Visual | Meaning |
|--------|---------|
| Gray circle | Idle -- agent has not started yet |
| Pulsing colored circle | Active -- agent is currently running |
| Green checkmark | Completed successfully |
| Red X | Failed |
| Orange loop arrow | Agent triggered a loop back |

### Arrows and Connections

- **Solid arrows** show the normal execution flow (left to right, top to bottom)
- **Dashed loop arrows** appear between Critic -> Generator and Mutation Verifier -> Generator when quality thresholds are not met
- **Parallel branches** show the five intelligence agents that run simultaneously

### Handoff Cards

Between connected agents, small cards appear showing what data was passed. For example, after the Strategist completes, you might see "12 risk areas, priority: 0.87" on the arrow to the Generator.

---

## Watching Agents Think

### Live Reasoning Stream

The **Live Reasoning Stream** panel shows real-time text from the active agent's LLM call. This is the actual AI "thinking" process -- you can see it building test strategies, writing test code, or analyzing your architecture.

The stream shows:
- The current file being analyzed (with file counter, e.g., "File 3/10")
- Partial LLM output as it streams in
- Which agent is active (color-coded header)

### Activity Ticker

Below the reasoning stream, the **Activity Ticker** shows a chronological feed of all events:
- Agent start/complete events
- Test generation and execution results
- Loop events (when an agent sends work back for improvement)
- Error events (highlighted in red)

Each entry is color-coded by agent and tagged with a timestamp.

---

## Talking to Agents

After a run completes, you can have follow-up conversations with any agent.

### Starting a Chat

1. Click any agent card in the **Agent Control Room** or **Agent Flow Diagram**
2. Click the **"Chat with Agent"** button
3. Type your question in the chat input

### What You Can Ask

Each agent remembers its original analysis and can discuss it in depth:

- **Strategist**: "Why did you rate auth.ts as high risk?" / "What about the database layer?"
- **Generator**: "Can you generate additional tests for the payment module?"
- **Critic**: "Why did you reject the login test?" / "What edge cases am I missing?"
- **Executor**: "Why did 3 tests fail?" / "How can I fix the timeout errors?"
- **Mutation Verifier**: "Which mutations are hardest to catch?" / "How do I improve from 72% to 90%?"
- **Product Manager**: "Tell me more about the user personas" / "What's the quickest win?"
- **Any Intelligence Agent**: Ask about specific findings, get elaboration, or request additional analysis

### Chat Persistence

Conversations are saved. You can return to a previous chat session and continue where you left off. Each agent-run combination maintains its own conversation thread.

---

## Understanding Reports

### Test Results Panel

Shows all generated tests with their execution status:
- **Passed** (green): Test compiled and assertions held
- **Failed** (red): Test assertion failed or runtime error
- **Skipped** (gray): TypeScript compilation error (typically missing project imports)

Click any test to see its full source code and error output.

### Mutation Score Gauge

A circular gauge showing test effectiveness as a percentage:
- **90-100%**: Excellent -- tests catch nearly all code mutations
- **70-89%**: Good -- most mutations caught, some gaps remain
- **50-69%**: Fair -- significant gaps in test coverage
- **Below 50%**: Poor -- tests miss many potential bugs

The gauge also shows total mutants, killed, and survived counts.

### Code Quality Report

From the Code Quality Architect agent:
- **Overall Health Score**: 0-100 with letter grade (A through F)
- **Code Smells**: God classes, feature envy, long parameter lists
- **Duplication Hotspots**: Copy-paste code that should be consolidated
- **Complexity Hotspots**: Functions with high cyclomatic complexity
- **Architecture Issues**: Layering violations, circular dependencies
- **Refactoring Roadmap**: Prioritized list of improvements with effort estimates

### Self-Healer Report

Cross-file issues that linters miss:
- **Type Mismatches**: Function returns `{ id }` but caller expects `{ _key }`
- **Broken Imports**: Named exports that were renamed or removed
- **Missing Dependencies**: Packages used in code but not in package.json
- **Config Inconsistencies**: Port mismatches, undefined env vars
- Each issue includes a specific auto-fix suggestion

### API Validator Report

API endpoint inventory and security audit:
- **Endpoints Table**: Every discovered route with method, path, and issue flags
- **Security Gaps**: Missing auth, missing validation, injection risks
- **Error Handling**: Endpoints without try/catch
- **API Health Score**: 0-100 based on coverage of security best practices

### Coverage Auditor Report

Backend-frontend alignment:
- **Unexposed Features**: Backend endpoints with no frontend consumer
- **Broken Calls**: Frontend API calls to non-existent endpoints
- **Data Shape Mismatches**: Backend sends different structure than frontend expects
- **Missing CRUD**: Resources with incomplete Create/Read/Update/Delete operations

### UI/UX Analyst Report

Accessibility and usability audit:
- **Accessibility Issues**: WCAG 2.1 violations with criteria references
- **UX Anti-Patterns**: Missing loading states, error boundaries, empty states
- **Component Quality**: Overly complex components, missing types, hardcoded strings
- **User Flow Issues**: Dead-end pages, missing breadcrumbs, no feedback on actions

---

## Health Scores

The **Health Score Dashboard** displays 7 metrics as gauges with trend lines.

| Metric | Agent Source | What It Measures | Good Score |
|--------|-------------|------------------|------------|
| Code Quality | Code Quality Architect | Smells, duplication, complexity, architecture | 75+ |
| Self-Healing | Self-Healer | Cross-file type safety, import health, dep integrity | 80+ |
| API Health | API Validator | Error handling, auth, validation, rate limiting | 80+ |
| Coverage | Coverage Auditor | Backend-frontend API alignment | 70+ |
| Accessibility | UI/UX Analyst | WCAG 2.1 compliance | 80+ |
| UX Score | UI/UX Analyst | Anti-patterns, component quality, user flows | 70+ |
| Mutation Score | Mutation Verifier | Test effectiveness at catching code changes | 80+ |

### Trend Lines

If you run the pipeline multiple times against the same repository, the dashboard shows how each score changes over time. This helps track improvement (or regression) across commits.

---

## Debate View

The **Agent Debate View** shows where agents disagree:

- **Generator vs Critic**: Tests the Generator was confident about but the Critic rejected, with both sides' reasoning
- **PM vs Research Assistant**: Features prioritized differently by each, with strategic vs market-driven perspectives
- **Multiple agents on the same file**: When different agents flag the same file for different reasons

This view helps you understand nuanced trade-offs rather than just seeing a single recommendation.

---

## Replay Mode

The **Run Replay Player** lets you replay a completed run as a time-lapse:

1. Select a completed run from the Run Manager
2. Click the **Play** button
3. Watch the flow diagram animate through each agent transition
4. Use the speed controls: 1x (real-time), 2x, 5x, 10x
5. Click anywhere on the timeline scrubber to jump to that moment
6. Pause to inspect the state at any point

This is useful for understanding the full pipeline flow or for demos.

---

## Terminal Mode

The **Operator Terminal** provides a full-screen, monospaced-font log view:

- All agent events displayed as timestamped log lines
- Color-coded by agent (matching the flow diagram colors)
- **Filter by log level**: Info, Warn, Error
- **Filter by agent**: Show only specific agent's events
- **Search**: Find specific text across all logs
- **Copy All**: Copy the entire log to clipboard

Toggle terminal mode from the dashboard header. Press Escape to return to the graphical view.

---

## Notifications

The **Notification Bell** in the dashboard header alerts you to important events:

### What Triggers Notifications

- **Run Completed** (success): Summary of test results and scores
- **Run Failed** (error): Error message and which agent failed
- **Critical Finding** (warning): Security gaps, critical code smells, or broken imports
- **Loop Event** (info): When the Critic or Mutation Verifier sends work back

### Managing Notifications

- Click the bell icon to see all notifications
- Click a notification to navigate to the relevant panel
- Click the X on individual notifications to dismiss them
- Use "Dismiss All" to clear the list

Notifications persist for the current session and reset on page refresh.
