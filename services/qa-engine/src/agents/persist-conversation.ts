import { QA_COLLECTIONS } from '../graph/collections';

export interface AgentConversation {
  runId: string;
  agent: string;
  systemPrompt: string;
  userMessage: string;
  response: string;
  tokensUsed?: { input?: number; output?: number };
  durationMs: number;
  timestamp: string;
  /** Optional step label for multi-step DSPy chains (e.g., 'observe', 'analyze', 'verify') */
  step?: string;
  /** Optional step index within a multi-step chain (0-based) */
  stepIndex?: number;
}

export async function persistConversation(
  dbClient: any,
  conversation: AgentConversation
): Promise<void> {
  const stepSuffix = conversation.step ? `_${conversation.step}` : '';
  const key = `conv_${conversation.runId}_${conversation.agent}${stepSuffix}_${Date.now()}`;
  try {
    await dbClient.upsertDocument(QA_COLLECTIONS.AGENT_CONVERSATIONS, {
      _key: key,
      ...conversation,
    });
  } catch (error: any) {
    console.warn(`[PersistConversation] Failed to save ${conversation.agent} conversation: ${error.message}`);
  }
}
