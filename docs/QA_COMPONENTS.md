# QA Intelligence Platform - Component Documentation

All components live in `apps/frontend/src/components/qa-intelligence/`.

---

## 1. AgentFlowDiagram

**Purpose:** Animated pipeline diagram showing all 13 agents as nodes with directional arrows. The active agent pulses, completed agents show green checkmarks, and loop-back arrows animate when the critic or mutation verifier triggers re-generation.

**Props:**
```typescript
interface AgentFlowDiagramProps {
  activeAgent: AgentName | null;
  handoffData: Record<string, HandoffInfo>;
  streamingState: AgentStreamingState | null;
  runId: string | null;
}
```

**Data Sources:** `useAgentStream` hook (activeAgent, handoffData, streamingState).

**Interactions:** Click an agent node to expand its detail panel (opens AgentDeepDivePanel). Hover shows tooltip with agent description and last status.

---

## 2. LiveReasoningStream

**Purpose:** Typewriter-style display of the active agent's LLM streaming output. Shows what the AI is currently "thinking" -- partial text, the file being analyzed, and a file progress indicator (e.g., "File 3/10: src/routes/auth.ts").

**Props:**
```typescript
interface LiveReasoningStreamProps {
  streamingState: AgentStreamingState | null;
  activeAgent: AgentName | null;
}
```

**Data Sources:** `useAgentStream` hook (streamingState).

**Interactions:** Read-only. Auto-scrolls to bottom as text streams in.

---

## 3. ActivityTicker

**Purpose:** Scrolling log feed of agent events -- a compact, color-coded ticker showing the last N log entries. Each entry shows timestamp, agent badge (color-coded), and message.

**Props:**
```typescript
interface ActivityTickerProps {
  logs: AgentLogEntry[];
  maxVisible?: number;  // default: 10
}
```

**Data Sources:** `useAgentStream` hook (logs array).

**Interactions:** Auto-scrolls. Click a log entry to expand details. Warn/error entries are highlighted.

---

## 4. HandoffCard

**Purpose:** Compact card displayed between agent nodes in the flow diagram showing what data was passed from one agent to the next. Displays summary metrics (e.g., "12 risk areas", "8 tests generated", "mutation score: 85%").

**Props:**
```typescript
interface HandoffCardProps {
  handoff: HandoffInfo;
  fromAgent: AgentName;
  toAgent: AgentName;
}
```

**Data Sources:** `useAgentStream` hook (handoffData).

**Interactions:** Click to expand detailed handoff data. Shows the `detail` record as formatted key-value pairs.

---

## 5. AgentDeepDivePanel

**Purpose:** Full detail panel for a single agent. Shows the agent's system prompt summary, its input data, raw LLM conversation (prompt + response), output structure, duration, and token usage.

**Props:**
```typescript
interface AgentDeepDivePanelProps {
  runId: string;
  agent: AgentName;
  isOpen: boolean;
  onClose: () => void;
}
```

**Data Sources:** `qaService.getConversations(runId, agent)` -- fetches from `qa_agent_conversations`.

**Interactions:** Opens as a slide-over panel. Includes a "Chat with this agent" button that opens AgentChat.

---

## 6. AgentControlRoom

**Purpose:** Master control panel showing all 13 agents in a grid layout. Each agent card shows its status (idle/active/completed/failed), progress bar, last message, iteration count, and duration. The grid uses a compact 3-column layout fitting all 9 intelligence agents plus the 4 QA agents.

**Props:**
```typescript
interface AgentControlRoomProps {
  logs: AgentLogEntry[];
  activeAgent: AgentName | null;
  handoffData: Record<string, HandoffInfo>;
  agentTimeline: TimelineEntry[];
  streamingState: AgentStreamingState | null;
  runId: string | null;
}
```

**Data Sources:** `useAgentStream` hook (all fields).

**Interactions:** Click any agent card to open AgentDeepDivePanel. Active agents show a pulsing indicator. Failed agents show error details.

---

## 7. AgentConversationPanel

**Purpose:** Displays the actual LLM conversations (system prompt, user message, AI response) that occurred during a run. Shows token counts and duration for each agent call.

**Props:**
```typescript
interface AgentConversationPanelProps {
  runId: string;
  agent: AgentName;
}
```

**Data Sources:** `qaService.getConversations(runId, agent)` REST API.

**Interactions:** Read-only viewer. Expandable sections for system prompt and full response. Code blocks are syntax-highlighted.

---

## 8. AgentChat

**Purpose:** Interactive chat interface for asking follow-up questions to any agent. The agent responds using its original analysis context plus the chat history. Supports multi-turn conversations.

**Props:**
```typescript
interface AgentChatProps {
  runId: string;
  agent: AgentName;
  conversationId?: string;
}
```

**Data Sources:** `qaService.chat(runId, agent, message, conversationId)` for sending messages. `qaService.getChatHistory(conversationId)` for loading history.

**Interactions:** Text input with send button. Messages appear in a chat-bubble layout. Agent responses stream in. Conversation persists across sessions via `qa_chat_conversations`.

---

## 9. SelfHealerPanel

**Purpose:** Displays the Self-Healer agent's report: type mismatches, broken imports, missing dependencies, config inconsistencies, and auto-fix suggestions. Shows a health score gauge.

**Props:**
```typescript
interface SelfHealerPanelProps {
  report: SelfHealingReport;
}
```

**Data Sources:** `productData.selfHealing` from `qaService.getProductIntelligence(runId)`.

**Interactions:** Expandable issue cards. Each issue shows severity badge, file path, and a "Fix" code snippet. Copy-to-clipboard for fix suggestions.

---

## 10. APIValidatorPanel

**Purpose:** Displays API Validator report: discovered endpoints table, missing error handling, schema issues, and security gaps. Includes an API health score.

**Props:**
```typescript
interface APIValidatorPanelProps {
  report: APIValidationReport;
}
```

**Data Sources:** `productData.apiValidation` from `qaService.getProductIntelligence(runId)`.

**Interactions:** Sortable endpoints table (by method, path, issues count). Expandable security gap cards with severity-based color coding. Filter by issue type.

---

## 11. CoverageAuditorPanel

**Purpose:** Shows backend-frontend coverage analysis: unexposed backend features, broken frontend calls, orphaned routes, data shape mismatches, and missing CRUD operations. Includes a coverage score.

**Props:**
```typescript
interface CoverageAuditorPanelProps {
  report: CoverageAuditReport;
}
```

**Data Sources:** `productData.coverageAudit` from `qaService.getProductIntelligence(runId)`.

**Interactions:** Tabbed sections for each finding type. CRUD matrix visualization. Click endpoint to see affected files.

---

## 12. UIUXAnalystPanel

**Purpose:** Displays UI/UX audit results: accessibility issues (WCAG 2.1), UX anti-patterns, component quality issues, user flow problems, and improvement suggestions. Shows accessibility and UX scores.

**Props:**
```typescript
interface UIUXAnalystPanelProps {
  report: UIAuditReport;
}
```

**Data Sources:** `productData.uiAudit` from `qaService.getProductIntelligence(runId)`.

**Interactions:** Issues grouped by type with severity filtering. WCAG criteria links. Expandable fix suggestions per issue.

---

## 13. HealthScoreDashboard

**Purpose:** Unified health score overview showing 7 metrics as gauges: Code Quality, Self-Healing, API Health, Coverage, Accessibility, UX, and Mutation Score. Includes trend lines from historical data.

**Props:**
```typescript
interface HealthScoreDashboardProps {
  scores: HealthScores;
  history?: HealthHistoryEntry[];
  repositoryId?: string;
}
```

**Data Sources:** `productData.summary` for current scores. `qaService.getHealthHistory(repositoryId)` for trends.

**Interactions:** Click any gauge to drill into its agent's full report panel. Hover gauges for exact values. Trend chart shows score evolution across runs.

---

## 14. AgentDebateView

**Purpose:** Side-by-side comparison view showing where agents disagree. For example, if the Critic rejected tests that the Generator was confident about, or if the PM and Research Assistant prioritized different features. Highlights conflicting recommendations.

**Props:**
```typescript
interface AgentDebateViewProps {
  runId: string;
  conversations: AgentConversation[];
  criticFeedback?: CriticFeedback[];
}
```

**Data Sources:** `qaService.getConversations(runId)` for all agent conversations. Critic feedback from run results.

**Interactions:** Toggle between different debate topics. Expandable reasoning for each agent's position.

---

## 15. RunReplayPlayer

**Purpose:** Time-lapse playback of a completed run. Replays the agent timeline events in order with configurable speed (1x, 2x, 5x, 10x). Shows the flow diagram animating through each agent transition.

**Props:**
```typescript
interface RunReplayPlayerProps {
  runId: string;
  timeline: TimelineEntry[];
}
```

**Data Sources:** `useAgentStream` hook (agentTimeline) for live runs. `qaService.getConversations(runId)` for completed run replay.

**Interactions:** Play/pause/speed controls. Timeline scrubber. Click any point in the timeline to jump to that moment.

---

## 16. OperatorTerminal

**Purpose:** Full-screen terminal-style view showing all agent events as a scrolling log with monospaced font. Designed for operators who want to monitor runs without the graphical dashboard.

**Props:**
```typescript
interface OperatorTerminalProps {
  logs: AgentLogEntry[];
  isConnected: boolean;
  activeAgent: AgentName | null;
}
```

**Data Sources:** `useAgentStream` hook (logs, isConnected, activeAgent).

**Interactions:** Full-screen toggle. Log-level filtering (info/warn/error). Agent name filtering. Search within logs. Copy all logs to clipboard.

---

## 17. NotificationBell

**Purpose:** Notification icon in the dashboard header showing unread alerts. Alerts are generated for: run completion, run failure, critical findings (security gaps, critical code smells), and loop events.

**Props:**
```typescript
interface NotificationBellProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}
```

**Data Sources:** Derived from `useAgentStream` logs -- filters for error-level events and completion events.

**Interactions:** Click bell to open dropdown. Click notification to navigate to relevant panel. Dismiss individual or all notifications.

---

## 18. useNotifications Hook

**Purpose:** Custom React hook that derives notification state from the agent stream. Watches for significant events and creates notification entries with read/unread tracking.

**Interface:**
```typescript
interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => void;
  dismissAll: () => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  agent?: AgentName;
  timestamp: string;
  read: boolean;
}
```

**Data Sources:** Subscribes to `useAgentStream` logs. Creates notifications for: `qa:run.completed`, `qa:run.failed`, `qa:agent.failed`, critical findings in completion results.

**Usage:**
```typescript
const { notifications, unreadCount, markRead, dismissAll } = useNotifications(logs);
```
