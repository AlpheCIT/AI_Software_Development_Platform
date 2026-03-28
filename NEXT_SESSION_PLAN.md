# Platform Vision: Intelligence Engine Powered by Graph Relationships

## Session Summary (Completed)
12 commits: Plant Manager Control Room, 13 AI agents, zero fake data, repo caching, security fixes, rich analytics, wiki auto-load, learnings engine, JS language detection, report enhancements.

---

## TIER 1: Critical Fixes (Do First)

### 1. Fix Dashboard Timestamp
Show current run's startedAt when running, not previous run's completedAt.

### 2. Fix Token/Cost Metrics
Metrics tab shows 0 tokens. Check LangChain's `response.response_metadata?.usage` path.

### 3. Show Commit SHA
Display in QARunControl: "Analyzing commit: abc1234 — feat: Add heartbeat (Mar 26)"

### 4. Surface Security Findings in Report
API Validator found CRITICAL issues (unauthenticated endpoints) — these need to be prominent in the Cumulative Report, not buried in Agent Reports tab.

### 5. PDF Export
Add real PDF download for the Cumulative Report (html2pdf or puppeteer).

---

## TIER 2: Graph-Powered Intelligence (THE BIG IDEA)

ArangoDB has 9 edge collections defining relationships between code entities, but the QA agents completely ignore them. The graph makes the platform exponentially smarter.

### Graph Relationships Available
- `qa_tests_file` — which test covers which file
- `qa_tests_function` — which test covers which function
- `qa_execution_of` — test execution → test case
- `qa_failure_from` — failure → execution
- `qa_suite_contains` — suite → test cases
- `qa_run_uses_suite` — run → suite
- `qa_spec_for` — spec → code entity
- `qa_mutation_of` — mutation → test
- `qa_similar_to` — similarity between code entities

### What Graph Intelligence Enables

**Impact Analysis**: "If I change `auth.js`, what else might break?"
- Traverse `imports` edges to find all files that depend on auth.js
- Traverse `qa_tests_file` to find tests covering those files
- Show blast radius: "Changing auth.js affects 12 files, 8 tests, 3 API endpoints"

**Smart Test Prioritization**: "Which tests should run first?"
- Files with more dependents = higher risk = test first
- If File A imports File B and B's test fails, A needs testing too
- Weight risk by graph centrality (hub files are riskier)

**Dependency-Aware Code Quality**: "Why is this module risky?"
- Circular dependency detection via graph cycles
- Coupling analysis: modules with many cross-edges are tightly coupled
- Cohesion analysis: modules whose functions don't call each other are poorly organized

**Cross-Agent Graph Queries**: Feed graph data to agents
- Strategist: "Here are the top 10 most-connected files — prioritize these"
- Self-Healer: "These import chains are circular — suggest breaking them"
- Coverage Auditor: "These backend endpoints have no frontend consumer in the graph"

### Implementation Path
1. Populate edge collections during repo-ingester (parse imports/requires)
2. Add AQL queries to strategist: find high-centrality files
3. Add "Impact Analysis" panel: select a file → see blast radius
4. Add "Dependency Graph" to Wiki: per-file dependency visualization
5. Feed graph metrics to all agents as additional context

---

## TIER 3: Agent Evolution

### Multi-Round Agent Debates
Currently agents are one-shot. Real intelligence comes from debate:
- Strategist proposes risk areas → PM challenges priorities → Strategist revises
- Generator creates tests → Critic reviews → Generator improves (this exists but could go deeper)
- API Validator finds gaps → Self-Healer proposes fixes → Code Quality validates the fix doesn't introduce new issues

### Cross-Agent Validation
- If 3+ agents flag the same file as problematic, weight it MUCH higher
- Consensus scoring: combine all agent scores into a unified risk rating
- Disagreement flagging: "Strategist says low-risk but API Validator found critical gap"

### Agent Memory Across Sessions
- Remember which recommendations the team acted on vs ignored
- Adjust future recommendations: "We suggested refactoring auth.js 3 times but it wasn't addressed. Escalate priority."
- Track which agent predictions were accurate (strategist said high-risk → was a bug found?)

### Diff-Aware Analysis
- Only analyze changed files + their graph neighbors (dependents/dependencies)
- Cache previous analysis for unchanged files
- Show "Since last run: 3 new issues, 5 recurring, 2 resolved"
- Estimated 60-80% token savings per incremental run

---

## TIER 4: Platform Integration

### Jira Integration (Auto-Create Tickets)
- After run: auto-create Jira issues for HIGH/CRITICAL findings
- Map: code smell → Jira task, security gap → Jira bug, refactoring → Jira story
- Deduplicate: don't create duplicate issues for recurring findings
- Link: Jira issue links to specific file + line in the platform
- Track: "Jira issue PROJ-123 was resolved → mark finding as addressed"

### GitHub Integration
- Auto-comment on PRs with QA findings for changed files
- Status checks: "QA Analysis: 3 new issues found in this PR"
- PR-scoped runs: analyze only files changed in the PR
- Auto-suggest reviewers based on file ownership from git blame

### CI/CD Pipeline
- Run QA analysis as a CI step (GitHub Actions, Jenkins, GitLab CI)
- Fail builds if mutation score drops below threshold
- Generate test files that can be committed back to the repo
- Nightly full analysis + daily incremental on changed files

---

## TIER 5: Killer Features (Competitive Moats)

### "What-If" Simulation
The `WhatIfSimulation.tsx` component exists but is empty. Connect it to the graph:
- "What if I delete this file?" → Show impact via graph traversal
- "What if I add a new API endpoint?" → Suggest required tests, auth, validation
- "What if I merge these two modules?" → Show dependency conflicts

### Semantic Code Search
The `SemanticSearchBox.tsx` exists. Connect it to the QA data:
- "Find all unauthenticated endpoints" → query API Validator results
- "Show me the riskiest functions" → query Strategist + mutation results
- "Which files changed most often but have no tests?" → combine git + QA data

### Auto-Generated Documentation
The Wiki shows file entities but doesn't generate docs. Add:
- AI-generated JSDoc for undocumented functions
- Auto-generated README for each directory
- Architecture diagrams from graph relationships
- API documentation from endpoint analysis

### Team Dashboard
Currently single-user. Add:
- Assign findings to team members
- Track resolution progress
- Code review queue based on QA priority
- Weekly email digest: "Your codebase improved 5% this week"

---

## Implementation Priority

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| 1 (Next Session) | Tier 1 fixes + Security in report + PDF export | 1 day | Credibility |
| 2 | Graph edge population + Impact Analysis panel | 2 days | Intelligence leap |
| 3 | Diff-aware analysis + Issue tracking | 2 days | Cost savings + value |
| 4 | Jira integration + Agent memory | 3 days | Enterprise readiness |
| 5 | What-If simulation + Semantic search | 3 days | Competitive moat |
| 6 | CI/CD integration + Team dashboard | 5 days | Market fit |
