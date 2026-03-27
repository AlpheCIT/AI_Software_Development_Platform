/**
 * Tests for the useAgentStream hook
 * Verifies WebSocket connection lifecycle, event handling,
 * streaming buffer accumulation, handoff data, and timeline tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentStream } from '../../hooks/useAgentStream';

// ── Socket.io Mock ─────────────────────────────────────────────────────────

type EventHandler = (...args: any[]) => void;

const mockSocketHandlers: Record<string, EventHandler[]> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: EventHandler) => {
    if (!mockSocketHandlers[event]) mockSocketHandlers[event] = [];
    mockSocketHandlers[event].push(handler);
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
};

function emitSocketEvent(event: string, data: any) {
  const handlers = mockSocketHandlers[event] || [];
  handlers.forEach(handler => handler(data));
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useAgentStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear accumulated handlers from previous tests
    Object.keys(mockSocketHandlers).forEach(key => delete mockSocketHandlers[key]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not connect when runId is null', () => {
    const { io } = require('socket.io-client');

    renderHook(() => useAgentStream(null));

    expect(io).not.toHaveBeenCalled();
  });

  it('should connect on mount with a valid runId', () => {
    const { io } = require('socket.io-client');

    renderHook(() => useAgentStream('run-123'));

    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        transports: ['websocket', 'polling'],
        query: { runId: 'run-123' },
      }),
    );
  });

  it('should subscribe to runId on connect', () => {
    renderHook(() => useAgentStream('run-456'));

    // Simulate the connect event
    act(() => {
      emitSocketEvent('connect', undefined);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', { runId: 'run-456' });
  });

  it('should set isConnected to true on connect', () => {
    const { result } = renderHook(() => useAgentStream('run-789'));

    act(() => {
      emitSocketEvent('connect', undefined);
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should set isConnected to false on disconnect', () => {
    const { result } = renderHook(() => useAgentStream('run-789'));

    act(() => {
      emitSocketEvent('connect', undefined);
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      emitSocketEvent('disconnect', 'transport close');
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('should set connectionError on connect_error', () => {
    const { result } = renderHook(() => useAgentStream('run-err'));

    act(() => {
      emitSocketEvent('connect_error', { message: 'ECONNREFUSED' });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionError).toBe('ECONNREFUSED');
  });

  it('should populate handoffData from qa:agent.completed events with results', () => {
    const { result } = renderHook(() => useAgentStream('run-handoff'));

    act(() => {
      emitSocketEvent('qa:agent.completed', {
        agent: 'strategist',
        message: 'Strategy complete',
        result: { riskAreasCount: 5 },
      });
    });

    expect(result.current.handoffData).toHaveProperty('strategist');
    expect(result.current.handoffData.strategist.fromAgent).toBe('strategist');
    expect(result.current.handoffData.strategist.summary).toContain('5 risk areas');
  });

  it('should populate handoff summary with multiple result fields', () => {
    const { result } = renderHook(() => useAgentStream('run-multi'));

    act(() => {
      emitSocketEvent('qa:agent.completed', {
        agent: 'executor',
        message: 'Execution done',
        result: { total: 10, passed: 8, failed: 2 },
      });
    });

    const summary = result.current.handoffData.executor.summary;
    expect(summary).toContain('8 passed');
    expect(summary).toContain('2 failed');
  });

  it('should not add handoff entry when result has no recognized fields', () => {
    const { result } = renderHook(() => useAgentStream('run-empty'));

    act(() => {
      emitSocketEvent('qa:agent.completed', {
        agent: 'generator',
        message: 'Done',
        result: { unknownField: 42 },
      });
    });

    expect(result.current.handoffData).not.toHaveProperty('generator');
  });

  it('should update streamingState from qa:agent.streaming events', () => {
    const { result } = renderHook(() => useAgentStream('run-stream'));

    act(() => {
      emitSocketEvent('qa:agent.streaming', {
        agent: 'generator',
        text: 'Generating test for',
        currentFile: 'src/utils.ts',
        fileIndex: 1,
        fileTotal: 5,
      });
    });

    expect(result.current.streamingState).not.toBeNull();
    expect(result.current.streamingState!.agent).toBe('generator');
    expect(result.current.streamingState!.text).toBe('Generating test for');
    expect(result.current.streamingState!.currentFile).toBe('src/utils.ts');
    expect(result.current.streamingState!.fileIndex).toBe(1);
    expect(result.current.streamingState!.fileTotal).toBe(5);
  });

  it('should clear streaming state on qa:agent.completed', () => {
    const { result } = renderHook(() => useAgentStream('run-clear'));

    act(() => {
      emitSocketEvent('qa:agent.streaming', {
        agent: 'generator',
        text: 'Partial output...',
      });
    });
    expect(result.current.streamingState).not.toBeNull();

    act(() => {
      emitSocketEvent('qa:agent.completed', {
        agent: 'generator',
        message: 'Done',
      });
    });
    expect(result.current.streamingState).toBeNull();
  });

  it('should record all events chronologically in agentTimeline', () => {
    const { result } = renderHook(() => useAgentStream('run-timeline'));

    act(() => {
      emitSocketEvent('qa:agent.started', { agent: 'strategist', message: 'Starting' });
    });

    act(() => {
      emitSocketEvent('qa:agent.streaming', { agent: 'strategist', text: 'Working...' });
    });

    act(() => {
      emitSocketEvent('qa:agent.completed', { agent: 'strategist', message: 'Done' });
    });

    expect(result.current.agentTimeline).toHaveLength(3);
    expect(result.current.agentTimeline[0].event).toBe('agent.started');
    expect(result.current.agentTimeline[1].event).toBe('agent.streaming');
    expect(result.current.agentTimeline[2].event).toBe('agent.completed');

    // All entries should have timestamps
    result.current.agentTimeline.forEach(entry => {
      expect(entry.timestamp).toBeDefined();
      expect(entry.agent).toBe('strategist');
    });
  });

  it('should set activeAgent from qa:agent.started', () => {
    const { result } = renderHook(() => useAgentStream('run-active'));

    act(() => {
      emitSocketEvent('qa:agent.started', { agent: 'critic', message: 'Critic starting' });
    });

    expect(result.current.activeAgent).toBe('critic');
  });

  it('should clear activeAgent on qa:run.completed', () => {
    const { result } = renderHook(() => useAgentStream('run-done'));

    act(() => {
      emitSocketEvent('qa:agent.started', { agent: 'executor', message: 'Executing' });
    });
    expect(result.current.activeAgent).toBe('executor');

    act(() => {
      emitSocketEvent('qa:run.completed', { message: 'All done' });
    });
    expect(result.current.activeAgent).toBeNull();
  });

  it('should add log entries for agent events', () => {
    const { result } = renderHook(() => useAgentStream('run-logs'));

    act(() => {
      emitSocketEvent('connect', undefined);
    });

    act(() => {
      emitSocketEvent('qa:agent.started', { agent: 'strategist', message: 'Analyzing...' });
    });

    // At least 2 log entries: connect message + agent started
    expect(result.current.logs.length).toBeGreaterThanOrEqual(2);
    expect(result.current.logs.some(l => l.message === 'Analyzing...')).toBe(true);
  });

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useAgentStream('run-unmount'));

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should clear logs when clearLogs is called', () => {
    const { result } = renderHook(() => useAgentStream('run-clearlog'));

    act(() => {
      emitSocketEvent('connect', undefined);
      emitSocketEvent('qa:agent.started', { agent: 'strategist', message: 'Log entry' });
    });

    expect(result.current.logs.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearLogs();
    });

    expect(result.current.logs).toHaveLength(0);
  });
});
