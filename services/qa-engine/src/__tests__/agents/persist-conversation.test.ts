/**
 * Tests for persistConversation helper
 * Verifies correct writing to qa_agent_conversations collection,
 * key format, field storage, and graceful error handling.
 */

import { persistConversation, AgentConversation } from '../../agents/persist-conversation';
import { QA_COLLECTIONS } from '../../graph/collections';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDbClient = {
  upsertDocument: jest.fn(),
};

// Spy on console.warn to verify error logging
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

// ── Test Data ──────────────────────────────────────────────────────────────

function makeConversation(overrides: Partial<AgentConversation> = {}): AgentConversation {
  return {
    runId: 'run-abc-123',
    agent: 'strategist',
    systemPrompt: 'You are the QA Strategist agent...',
    userMessage: 'Analyze the repository for risk areas',
    response: 'I identified 5 high-risk areas...',
    tokensUsed: { input: 500, output: 1200 },
    durationMs: 3500,
    timestamp: '2024-01-15T10:30:00.000Z',
    ...overrides,
  };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('persistConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Pin Date.now for deterministic key generation
    jest.spyOn(Date, 'now').mockReturnValue(1705312200000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should write to the qa_agent_conversations collection', async () => {
    mockDbClient.upsertDocument.mockResolvedValueOnce({});

    const conversation = makeConversation();
    await persistConversation(mockDbClient as any, conversation);

    expect(mockDbClient.upsertDocument).toHaveBeenCalledTimes(1);
    expect(mockDbClient.upsertDocument).toHaveBeenCalledWith(
      QA_COLLECTIONS.AGENT_CONVERSATIONS,
      expect.any(Object),
    );
  });

  it('should use the correct collection name constant', async () => {
    mockDbClient.upsertDocument.mockResolvedValueOnce({});

    await persistConversation(mockDbClient as any, makeConversation());

    const [collectionArg] = mockDbClient.upsertDocument.mock.calls[0];
    expect(collectionArg).toBe('qa_agent_conversations');
  });

  it('should generate key in format conv_${runId}_${agent}_${timestamp}', async () => {
    mockDbClient.upsertDocument.mockResolvedValueOnce({});

    const conversation = makeConversation({ runId: 'run-xyz', agent: 'critic' });
    await persistConversation(mockDbClient as any, conversation);

    const [, docArg] = mockDbClient.upsertDocument.mock.calls[0];
    expect(docArg._key).toBe('conv_run-xyz_critic_1705312200000');
  });

  it('should store all conversation fields correctly', async () => {
    mockDbClient.upsertDocument.mockResolvedValueOnce({});

    const conversation = makeConversation();
    await persistConversation(mockDbClient as any, conversation);

    const [, docArg] = mockDbClient.upsertDocument.mock.calls[0];

    expect(docArg).toEqual({
      _key: `conv_run-abc-123_strategist_1705312200000`,
      runId: 'run-abc-123',
      agent: 'strategist',
      systemPrompt: 'You are the QA Strategist agent...',
      userMessage: 'Analyze the repository for risk areas',
      response: 'I identified 5 high-risk areas...',
      tokensUsed: { input: 500, output: 1200 },
      durationMs: 3500,
      timestamp: '2024-01-15T10:30:00.000Z',
    });
  });

  it('should handle optional tokensUsed field', async () => {
    mockDbClient.upsertDocument.mockResolvedValueOnce({});

    const conversation = makeConversation({ tokensUsed: undefined });
    await persistConversation(mockDbClient as any, conversation);

    const [, docArg] = mockDbClient.upsertDocument.mock.calls[0];
    expect(docArg.tokensUsed).toBeUndefined();
  });

  it('should handle dbClient errors gracefully - warns, does not throw', async () => {
    mockDbClient.upsertDocument.mockRejectedValueOnce(new Error('ArangoDB connection refused'));

    const conversation = makeConversation();

    // Must NOT throw
    await expect(persistConversation(mockDbClient as any, conversation)).resolves.toBeUndefined();

    // Should warn with the agent name and error message
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PersistConversation]'),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('strategist'),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('ArangoDB connection refused'),
    );
  });

  it('should handle network timeout errors gracefully', async () => {
    mockDbClient.upsertDocument.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    await expect(persistConversation(mockDbClient as any, makeConversation())).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('ETIMEDOUT'),
    );
  });

  it('should produce unique keys for different agents on the same run', async () => {
    mockDbClient.upsertDocument.mockResolvedValue({});

    const conv1 = makeConversation({ agent: 'strategist' });
    const conv2 = makeConversation({ agent: 'generator' });

    await persistConversation(mockDbClient as any, conv1);
    await persistConversation(mockDbClient as any, conv2);

    const key1 = mockDbClient.upsertDocument.mock.calls[0][1]._key;
    const key2 = mockDbClient.upsertDocument.mock.calls[1][1]._key;

    expect(key1).not.toBe(key2);
    expect(key1).toContain('strategist');
    expect(key2).toContain('generator');
  });
});
