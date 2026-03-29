/**
 * useAgentStream - Hook for streaming agent activity events
 * Subscribes to WebSocket qa:agent.* events for the live log feed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AgentName, AgentLogEntry } from '../services/qaService';
import { useQARunStore } from '../stores/qa-run-store';

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || '';
const MAX_LOG_ENTRIES = 200;

// ── Agent Color Map ────────────────────────────────────────────────────────

export const AGENT_COLORS: Record<AgentName, string> = {
  strategist: 'blue',
  generator: 'green',
  critic: 'orange',
  executor: 'purple',
  mutation: 'red',
  'product-manager': 'teal',
  'research-assistant': 'cyan',
  'code-quality-architect': 'yellow',
  'self-healer': 'pink',
  'api-validator': 'orange',
  'coverage-auditor': 'linkedin',
  'ui-ux-analyst': 'purple',
};

export const AGENT_LABELS: Record<AgentName, string> = {
  strategist: 'Strategist',
  generator: 'Generator',
  critic: 'Critic',
  executor: 'Executor',
  mutation: 'Mutation Verifier',
  'product-manager': 'Product Manager',
  'research-assistant': 'Research Assistant',
  'code-quality-architect': 'Code Quality Architect',
  'self-healer': 'Self-Healer',
  'api-validator': 'API Validator',
  'coverage-auditor': 'Coverage Auditor',
  'ui-ux-analyst': 'UI/UX Analyst',
};

// ── Hook Interface ─────────────────────────────────────────────────────────

export interface AgentStreamingState {
  agent: AgentName;
  text: string;
  currentFile?: string;
  fileIndex?: number;
  fileTotal?: number;
}

export interface HandoffInfo {
  fromAgent: string;
  toAgent: string;
  summary: string;
  detail?: Record<string, unknown>;
  timestamp: string;
}

export interface TimelineEntry {
  event: string;
  agent: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface UseAgentStreamReturn {
  logs: AgentLogEntry[];
  activeAgent: AgentName | null;
  streamingState: AgentStreamingState | null;
  handoffData: Record<string, HandoffInfo>;
  streamingBuffer: string;
  agentTimeline: TimelineEntry[];
  isConnected: boolean;
  connectionError: string | null;
  clearLogs: () => void;
}

// ── Hook Implementation ────────────────────────────────────────────────────

export function useAgentStream(runId: string | null): UseAgentStreamReturn {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentName | null>(null);
  const [streamingState, setStreamingState] = useState<AgentStreamingState | null>(null);
  const [handoffData, setHandoffData] = useState<Record<string, HandoffInfo>>({});
  const [agentTimeline, setAgentTimeline] = useState<TimelineEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const logIdCounter = useRef(0);
  const streamingBufferRef = useRef<string>('');

  // Store reference for persisting agent status
  const storeRef = useRef(useQARunStore.getState());
  useEffect(() => {
    const unsub = useQARunStore.subscribe(state => { storeRef.current = state; });
    return unsub;
  }, []);

  const addTimelineEntry = useCallback((event: string, agent: string, data: Record<string, unknown> = {}) => {
    setAgentTimeline(prev => [...prev, { event, agent, data, timestamp: new Date().toISOString() }]);
  }, []);

  const addLogEntry = useCallback((agent: AgentName, message: string, level: AgentLogEntry['level'] = 'info', data?: Record<string, unknown>) => {
    logIdCounter.current += 1;
    const entry: AgentLogEntry = {
      id: `log-${logIdCounter.current}`,
      timestamp: new Date().toISOString(),
      agent,
      message,
      level,
      data,
    };

    setLogs(prev => {
      const updated = [...prev, entry];
      // Keep buffer capped at MAX_LOG_ENTRIES
      if (updated.length > MAX_LOG_ENTRIES) {
        return updated.slice(updated.length - MAX_LOG_ENTRIES);
      }
      return updated;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    logIdCounter.current = 0;
  }, []);

  // ── WebSocket Connection ───────────────────────────────────────────────

  useEffect(() => {
    if (!runId) {
      // No active run, disconnect if connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let socket: Socket;

    try {
      socket = io(QA_ENGINE_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        query: { runId },
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        setConnectionError(null);
        addLogEntry('strategist', 'Connected to QA Engine stream', 'info');

        // Subscribe to this run's events
        socket.emit('subscribe', { runId });
      });

      socket.on('disconnect', (reason) => {
        setIsConnected(false);
        if (reason !== 'io client disconnect') {
          addLogEntry('strategist', `Stream disconnected: ${reason}`, 'warn');
        }
      });

      socket.on('connect_error', (err) => {
        setIsConnected(false);
        setConnectionError(err.message);
      });

      // ── Agent Events ─────────────────────────────────────────────────

      socket.on('qa:agent.started', (data: { agent: AgentName; message: string; step?: string }) => {
        setActiveAgent(data.agent);
        streamingBufferRef.current = ''; // Reset buffer for new agent
        addLogEntry(data.agent, data.message || `${AGENT_LABELS[data.agent]} started`, 'info');
        addTimelineEntry('agent.started', data.agent, data as any);
        // Sync to persistent store
        storeRef.current.updateAgentStatus(data.agent, { status: 'running' });
        storeRef.current.addActivityLog({ agent: data.agent, message: data.message || `${AGENT_LABELS[data.agent]} started`, type: 'info' });
      });

      socket.on('qa:agent.progress', (data: { agent: AgentName; message: string; progress: number; data?: Record<string, unknown> }) => {
        setActiveAgent(data.agent);
        addLogEntry(data.agent, data.message, 'info', data.data);
      });

      socket.on('qa:agent.failed', (data: { agent: AgentName; message: string; error: string }) => {
        addLogEntry(data.agent, data.error || data.message, 'error');
        // Sync to persistent store
        storeRef.current.updateAgentStatus(data.agent, { status: 'error' });
        storeRef.current.addActivityLog({ agent: data.agent, message: data.error || data.message, type: 'error' });
      });

      socket.on('qa:agent.loop', (data: { from: AgentName; to: AgentName; reason: string; iteration: number }) => {
        addLogEntry(data.from, `Loop back to ${AGENT_LABELS[data.to]}: ${data.reason} (iteration ${data.iteration})`, 'warn');
        addTimelineEntry('agent.loop', data.from, data as any);
      });

      // Streaming events — partial LLM output
      socket.on('qa:agent.streaming', (data: { agent: AgentName; text: string; currentFile?: string; fileIndex?: number; fileTotal?: number; streamType?: string }) => {
        // Accumulate streaming buffer
        if (data.text) {
          streamingBufferRef.current += data.text.length > streamingBufferRef.current.length
            ? data.text.substring(streamingBufferRef.current.length) // delta from full text
            : data.text; // treat as append
        }
        setStreamingState({
          agent: data.agent,
          text: data.text,
          currentFile: data.currentFile,
          fileIndex: data.fileIndex,
          fileTotal: data.fileTotal,
        });
        addTimelineEntry('agent.streaming', data.agent, data as any);
      });

      socket.on('qa:agent.completed', (data: { agent: AgentName; message: string; result?: Record<string, unknown> }) => {
        setStreamingState(null);
        streamingBufferRef.current = '';
        addLogEntry(data.agent, data.message || `${AGENT_LABELS[data.agent]} completed`, 'info');
        addTimelineEntry('agent.completed', data.agent, data as any);
        // Sync to persistent store
        storeRef.current.updateAgentStatus(data.agent, { status: 'completed', result: data.result, completedAt: new Date().toISOString() });
        storeRef.current.addActivityLog({ agent: data.agent, message: data.message || `${AGENT_LABELS[data.agent]} completed`, type: 'success' });

        // Build handoff data from completion results
        if (data.result) {
          const summaryParts: string[] = [];
          const r = data.result;
          if (r.riskAreasCount) summaryParts.push(`${r.riskAreasCount} risk areas`);
          if (r.testsGenerated) summaryParts.push(`${r.testsGenerated} tests generated`);
          if (r.reviewed) summaryParts.push(`${r.approved}/${r.reviewed} approved`);
          if (r.total) summaryParts.push(`${r.passed} passed, ${r.failed} failed`);
          if (r.score !== undefined) summaryParts.push(`mutation score: ${r.score}%`);
          if (r.totalFeatures) summaryParts.push(`${r.totalFeatures} features`);
          if (r.trendsFound) summaryParts.push(`${r.trendsFound} trends`);
          if (r.healthScore !== undefined) summaryParts.push(`health: ${r.healthScore}/100`);
          if (r.endpointsFound) summaryParts.push(`${r.endpointsFound} endpoints`);
          if (r.coverageScore !== undefined) summaryParts.push(`coverage: ${r.coverageScore}%`);
          if (r.accessibilityScore !== undefined) summaryParts.push(`a11y: ${r.accessibilityScore}/100`);

          if (summaryParts.length > 0) {
            setHandoffData(prev => ({
              ...prev,
              [data.agent]: {
                fromAgent: data.agent,
                toAgent: 'next',
                summary: summaryParts.join(', '),
                detail: r,
                timestamp: new Date().toISOString(),
              },
            }));
          }
        }
      });

      // ── Test Events ──────────────────────────────────────────────────

      socket.on('qa:test.generated', (data: { agent: AgentName; testName: string; count: number }) => {
        addLogEntry(data.agent, `Generated test: ${data.testName} (${data.count} total)`, 'info');
      });

      socket.on('qa:test.result', (data: { testName: string; status: string; duration: number }) => {
        const level = data.status === 'failed' ? 'error' : 'info';
        addLogEntry('executor', `${data.testName}: ${data.status} (${data.duration}ms)`, level);
      });

      socket.on('qa:mutation.result', (data: { mutant: string; status: string; score: number }) => {
        addLogEntry('mutation', `Mutant ${data.mutant}: ${data.status} (score: ${(data.score * 100).toFixed(1)}%)`, 'info');
      });

      // ── Run Events ───────────────────────────────────────────────────

      socket.on('qa:run.completed', (data: { message: string }) => {
        addLogEntry('strategist', data.message || 'QA run completed', 'info');
        setActiveAgent(null);
      });

      socket.on('qa:run.failed', (data: { error: string }) => {
        addLogEntry('strategist', data.error || 'QA run failed', 'error');
        setActiveAgent(null);
      });

    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Failed to connect to QA Engine stream');
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [runId, addLogEntry]);

  return {
    logs,
    activeAgent,
    streamingState,
    handoffData,
    streamingBuffer: streamingBufferRef.current,
    agentTimeline,
    isConnected,
    connectionError,
    clearLogs,
  };
}

export default useAgentStream;
