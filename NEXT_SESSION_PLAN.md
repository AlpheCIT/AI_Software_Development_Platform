# Next Session: Accuracy, Intelligence & Cost Efficiency

## Critical Fixes (from live testing feedback)

### 1. Dashboard Shows Wrong Run Timestamp
**Problem:** "Last run: 5:09 PM" shows even while a new run is active
**Fix:** When `status === 'running'`, show current run's startedAt, not the previous run's completedAt

### 2. Token/Cost Metrics Show Zero
**Problem:** Metrics tab shows 0 tokens, $0 cost for all agents
**Root Cause:** `(response as any).usage_metadata?.input_tokens` path is incorrect for LangChain's ChatAnthropic response
**Fix:** Check the actual response structure from `@langchain/anthropic` — may need `response.response_metadata?.usage` or `response.usage_metadata`

### 3. Show Which Commit Is Being Analyzed
**Problem:** No way to know which commit the run is analyzing
**Data exists:** `commitSha`, `commitMessage`, `commitDate` stored in `qa_runs`
**Fix:** Display in the QARunControl bar: "Analyzing commit: abc1234 — feat: Add device heartbeat (Mar 26)"

### 4. Diff-Aware Analysis (Major Feature)
**Problem:** Every run re-analyzes the entire repo (198 files, 1110 entities) — wasteful tokens
**Design:**
- On run start, check `qa_runs` for the last completed run's `commitSha`
- If previous commit exists, run `git diff --name-only previousSha..HEAD` to get changed files
- Pass ONLY changed files + their immediate dependents to the agents
- Show in UI: "Analyzing 12 changed files (186 cached from previous run)"
- Strategist focuses risk analysis on changed files
- Generator only generates tests for changed code
- Estimated token savings: 60-80% per incremental run

### 5. Issue Tracking: Addressed vs Outstanding
**Problem:** Each run produces findings but doesn't track which were fixed
**Design:**
- Compare current run's findings against previous run's findings
- Mark findings as: "New" (first appearance), "Recurring" (still present), "Resolved" (was present, now gone)
- Store in `qa_learnings` with `status: 'new' | 'recurring' | 'resolved'`
- Dashboard shows: "3 new issues, 5 recurring, 2 resolved since last run"
- Cumulative report section: "Progress Since Last Run"

### 6. Improve Test Quality for JavaScript Projects
**Problem:** Only 4/24 tests executed (16% execution rate)
**Root Cause:** Generated tests may use wrong require paths, reference project-specific modules
**Fixes:**
- Generator prompt: include actual file paths from the repo (not guessed paths)
- Generator prompt: show the `package.json` dependencies so it knows available modules
- Executor: for `require()` failures, try resolving relative to the cloned repo path
- Consider running tests IN the cloned repo directory (with jest installed)

### 7. Language-Specific Test Frameworks
**Problem:** "Jest/Vitest syntax" is too generic for JavaScript projects
**Fix:**
- Detect if project uses Jest, Mocha, Tape, or Node's built-in test runner
- Check `package.json` devDependencies for test framework
- Generate tests matching the project's ACTUAL test framework
- If no test framework found, use Node.js built-in `assert` module

## Implementation Priority

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | Fix timestamp display | High (credibility) | XS |
| 2 | Fix token/cost metrics | High (transparency) | S |
| 3 | Show commit info | High (trust) | S |
| 4 | Diff-aware analysis | Very High (cost savings) | L |
| 5 | Issue tracking (new/recurring/resolved) | High (value) | M |
| 6 | Improve JS test quality | High (accuracy) | M |
| 7 | Language-specific frameworks | Medium | M |
