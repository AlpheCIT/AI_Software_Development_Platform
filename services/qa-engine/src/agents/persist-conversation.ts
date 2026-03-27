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
}

export async function persistConversation(
  dbClient: any,
  conversation: AgentConversation
): Promise<void> {
  const key = `conv_${conversation.runId}_${conversation.agent}_${Date.now()}`;
  try {
    await dbClient.upsertDocument(QA_COLLECTIONS.AGENT_CONVERSATIONS, {
      _key: key,
      ...conversation,
    });
  } catch (error: any) {
    console.warn(`[PersistConversation] Failed to save ${conversation.agent} conversation: ${error.message}`);
  }
}
