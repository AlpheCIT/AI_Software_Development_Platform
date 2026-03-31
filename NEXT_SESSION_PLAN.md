# Next Session Plan: Fix Data Display + Calibrate Expert Agent Scoring

## Session Summary (This Session)

### What Was Built
- **7 DSPy Expert Chain modules** (Python): security_expert, frontend_expert, backend_expert, middleware_expert, quality_architect, test_strategist, product_visionary — each with 4-5 step ChainOfThought reasoning
- **ArangoDB Reasoning Graph**: 8 collections (3 document + 5 edge) for full traceability of agent reasoning chains
- **Sub-agent spawner**: Dynamic spawning when experts need focused research
- **Frontend**: AgentSpawningTree (live execution tree), AgentReasoningTimeline (step-by-step conversations), "Agent Reasoning" tab
- **Data flow centralization**: productData in Zustand store, agent status inference
- **Critical fix**: businessContextAnalyzerNode missing dbClient parameter (caused cascade failure of ALL downstream agents)
- **10+ hooks violations fixed** across AgentReportsTab, RunManager, AgentFlowDiagram, AgentReasoningTimeline, NotificationBell, AgentDeepDivePanel

### Latest Run: 22 of 30 agents selected, ALL succeeded
- Unified Health Score: A (95/100) — BUT scores are unrealistically high (see Priority 3)
- executionLog: 22 entries persisted to ArangoDB
- Behavioral analyst ran via DSPy (42.5s)

---

## Priority 1: Stats Cards Don't Load From Selected Run

**Symptom:** Dropdown shows "15 tests, 71% mutation" but stat cards show "Total Tests: 0, Mutation: --"

**Root Cause:** The QA dashboard stat cards read from `qaRun.totalTests`, `qaRun.mutation.score` (useQARun hook local state). `applyRunData()` doesn't map `run.testsGenerated` → `totalTests` or `run.mutationScore` → `mutation.score` correctly.

**Files to fix:**
- `apps/frontend/src/hooks/useQARun.ts` — `applyRunData()` function
- Map: `run.testsGenerated` → `setTotalTests`, `run.mutationScore` → `setMutation({ score: ... })`

## Priority 2: Track 1 Agents IDLE Despite Run Completed

**Symptom:** Self-Healer/API Validator show COMPLETED but Strategist/Generator/Critic/Executor show IDLE

**Root Cause:** `loadCompletedRun()` in `qa-run-store.ts` infers agent statuses from report presence but only for intelligence pipeline agents. Add Track 1 inference:
```typescript
if (runData.testsGenerated > 0) {
  agentStatuses['strategist'] = { status: 'completed' };
  agentStatuses['generator'] = { status: 'completed' };
  // etc
}
```

**File:** `apps/frontend/src/stores/qa-run-store.ts`

## Priority 3: DSPy Scores All 95/100 (Unrealistic)

**Symptom:** Every agent reports 95/100 — unrealistic for any real codebase

**Root Cause:** When DSPy is available, the TS agents use DSPy output but may bypass their own scoring/calibration logic, defaulting to high scores.

**Fix:** After DSPy call, the TS agent should:
1. Parse the DSPy report for actual findings (not just trust the score)
2. Run existing scoring logic on those findings
3. Use verification pass to filter false positives before scoring

**Files:** self-healer.ts, api-validator.ts, coverage-auditor.ts, ui-ux-analyst.ts, code-quality-architect.ts

## Priority 4: Remaining Hooks Violations

Files with inline `useColorModeValue` in `.map()`:
- `ActionCenter.tsx` lines 310, 477
- `AgentConversationPanel.tsx` line 167
- `AgentDebateView.tsx` line 164

## Priority 5: Agent Spawning Tree Shows "NO DATA"

The component reads from `productData.executionLog` but the data structure doesn't match what it expects (sessions with steps). It needs to read from the reasoning graph collections or be adapted to work with the flat executionLog.

---

## Working Branch: `claude/lucid-banzai`

Start services:
```bash
cd services/visionary-agent/src && python -m uvicorn main:app --host 0.0.0.0 --port 8010
cd services/qa-engine && npm run dev
cd apps/frontend && npm run dev
```

Test with: `https://github.com/AlpheCIT/MES` branch `dev`

Anthropic API key required for LLM calls. DSPy service (port 8010) required for expert chains.
