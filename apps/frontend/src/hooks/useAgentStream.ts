/**
 * useAgentStream - Hook for streaming agent activity events
 * Subscribes to WebSocket qa:agent.* events for the live log feed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AgentName, AgentLogEntry } from '../services/qaService';

const QA_ENGINE_URL = import.meta.env.VITE_QA_ENGINE_URL || 'http://localhost:3005';
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
};

export const AGENT_LABELS: Record<AgentName, string> = {
  strategist: 'Strategist',
  generator: 'Generator',
  critic: 'Critic',
  executor: 'Executor',
  mutation: 'Mutation Verifier',
  'product-manager': 'Product Manager',
  'research-assistant': 'Research Assistant',
};

// ── Hook Interface ─────────────────────────────────────────────────────────

export interface UseAgentStreamReturn {
  logs: AgentLogEntry[];
  activeAgent: AgentName | null;
  isConnected: boolean;
  connectionError: string | null;
  clearLogs: () => void;
}

// ── Hook Implementation ────────────────────────────────────────────────────

export function useAgentStream(runId: string | null): UseAgentStreamReturn {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentName | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const logIdCounter = useRef(0);

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

      socket.on('qa:agent.started', (data: { agent: AgentName; message: string }) => {
        setActiveAgent(data.agent);
        addLogEntry(data.agent, data.message || `${AGENT_LABELS[data.agent]} started`, 'info');
      });

      socket.on('qa:agent.progress', (data: { agent: AgentName; message: string; progress: number; data?: Record<string, unknown> }) => {
        setActiveAgent(data.agent);
        addLogEntry(data.agent, data.message, 'info', data.data);
      });

      socket.on('qa:agent.completed', (data: { agent: AgentName; message: string }) => {
        addLogEntry(data.agent, data.message || `${AGENT_LABELS[data.agent]} completed`, 'info');
      });

      socket.on('qa:agent.failed', (data: { agent: AgentName; message: string; error: string }) => {
        addLogEntry(data.agent, data.error || data.message, 'error');
      });

      socket.on('qa:agent.loop', (data: { from: AgentName; to: AgentName; reason: string; iteration: number }) => {
        addLogEntry(data.from, `Loop back to ${AGENT_LABELS[data.to]}: ${data.reason} (iteration ${data.iteration})`, 'warn');
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
    isConnected,
    connectionError,
    clearLogs,
  };
}

export default useAgentStream;
