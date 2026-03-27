import { Router, Request, Response } from 'express';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { QA_COLLECTIONS } from '../graph/collections';
import { qaConfig } from '../config';
import { v4 as uuidv4 } from 'uuid';

const AGENT_CHAT_PROMPTS: Record<string, string> = {
  strategist: `You are the QA Strategist agent. You previously analyzed a codebase and identified risk areas and a test strategy. The user is now asking follow-up questions about your analysis. Use the context provided to give specific, actionable answers. Reference actual files and code patterns.`,
  generator: `You are the Test Generator agent. You previously generated test cases for a codebase. The user is asking about the tests you created. Explain your reasoning, suggest improvements, or generate additional tests if requested.`,
  critic: `You are the QA Critic agent. You previously reviewed generated tests and provided feedback. The user is asking about your critique. Explain why certain tests were flagged, what gaps you identified, and how to improve test quality.`,
  executor: `You are the Test Executor agent. You previously ran tests against the codebase. The user is asking about test results. Explain failures, suggest fixes, or provide insights about test execution.`,
  'mutation-verifier': `You are the Mutation Verifier agent. You previously analyzed test quality through mutation testing. The user is asking about surviving mutants and test strength. Explain which mutations survived and how to write tests that catch them.`,
  'product-manager': `You are the Product Manager agent. You previously analyzed the codebase for product opportunities, user personas, and competitive positioning. The user is asking about your product roadmap and recommendations. Be strategic and specific.`,
  'research-assistant': `You are the Research Assistant agent. You previously researched market trends, competitor intelligence, and technology opportunities. The user is asking about your findings. Provide specific, actionable recommendations.`,
  'code-quality-architect': `You are the Code Quality Architect agent. You previously audited the codebase for code smells, duplication, complexity, and architecture issues. The user is asking about your findings. Explain issues and provide specific refactoring guidance.`,
  'self-healer': `You are the Self-Healing Code Detection agent. You previously scanned the codebase for cross-file type mismatches, broken imports, missing dependencies, and config inconsistencies. The user is asking about the issues you found. Explain each issue clearly and provide specific auto-fix suggestions.`,
  'api-validator': `You are the API Validator agent. You previously discovered and validated all API endpoints in the codebase. The user is asking about endpoint security, error handling, and completeness. Provide specific recommendations for each issue found.`,
  'coverage-auditor': `You are the Backend-Frontend Coverage Auditor agent. You previously cross-referenced backend APIs with frontend consumers. The user is asking about coverage gaps, unexposed features, and broken calls. Explain what was found and how to fix the gaps.`,
  'ui-ux-analyst': `You are the UI/UX Analyst agent. You previously audited React components for accessibility (WCAG 2.1), UX anti-patterns, component quality, and user flow issues. The user is asking about your findings. Provide specific, actionable recommendations for improving the user experience and accessibility.`,
};

export function createChatRouter(dbClient: any) {
  const router = Router();

  /**
   * POST /qa/chat
   * Send a message to an agent and get a contextual response
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { runId, agent, message, conversationId } = req.body;

      if (!runId || !agent || !message) {
        return res.status(400).json({ error: 'runId, agent, and message are required' });
      }

      const chatConversationId = conversationId || uuidv4();

      // Load the agent's original analysis as context
      let agentContext = '';
      try {
        const conversations = await dbClient.query(
          `FOR c IN ${QA_COLLECTIONS.AGENT_CONVERSATIONS}
             FILTER c.runId == @runId AND c.agent == @agent
             SORT c.timestamp ASC
             RETURN c`,
          { runId, agent }
        );
        if (conversations.length > 0) {
          agentContext = conversations.map((c: any) =>
            `## Original Analysis\n### Prompt:\n${c.userMessage.substring(0, 2000)}\n\n### Response:\n${c.response.substring(0, 4000)}`
          ).join('\n\n---\n\n');
        }
      } catch { /* collection may not exist */ }

      // Load previous chat messages for this conversation
      let chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      try {
        const history = await dbClient.query(
          `FOR m IN ${QA_COLLECTIONS.CHAT_CONVERSATIONS}
             FILTER m.conversationId == @convId
             SORT m.timestamp ASC
             RETURN m`,
          { convId: chatConversationId }
        );
        chatHistory = history.map((m: any) => ({ role: m.role, content: m.content }));
      } catch { /* collection may not exist */ }

      // Build the system prompt
      const systemPrompt = `${AGENT_CHAT_PROMPTS[agent] || 'You are a QA agent. Answer the user\'s questions based on your analysis context.'}

${agentContext ? `## Your Previous Analysis Context\n${agentContext}` : 'No previous analysis context available for this run.'}

Be concise but thorough. Reference specific files, functions, and findings from your analysis when relevant. If you don't have enough context to answer, say so.`;

      // Build messages array
      const messages: Array<SystemMessage | HumanMessage | AIMessage> = [
        new SystemMessage(systemPrompt),
      ];

      // Add chat history
      for (const msg of chatHistory) {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content));
        } else {
          messages.push(new AIMessage(msg.content));
        }
      }

      // Add current message
      messages.push(new HumanMessage(message));

      // Call Claude
      const model = new ChatAnthropic({
        modelName: qaConfig.anthropic.model,
        anthropicApiKey: qaConfig.anthropic.apiKey,
        temperature: 0.4,
        maxTokens: 4096,
      });

      const response = await model.invoke(messages);
      const responseText = typeof response.content === 'string' ? response.content : '';

      // Persist user message
      await dbClient.upsertDocument(QA_COLLECTIONS.CHAT_CONVERSATIONS, {
        _key: `chat_${chatConversationId}_${Date.now()}_user`,
        conversationId: chatConversationId,
        runId,
        agent,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Persist assistant response
      await dbClient.upsertDocument(QA_COLLECTIONS.CHAT_CONVERSATIONS, {
        _key: `chat_${chatConversationId}_${Date.now()}_assistant`,
        conversationId: chatConversationId,
        runId,
        agent,
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
      });

      res.json({
        conversationId: chatConversationId,
        response: responseText,
        agent,
        runId,
      });
    } catch (error: any) {
      console.error('[Chat] Error:', error.message);
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  });

  /**
   * GET /qa/chat/:conversationId
   * Get chat history for a conversation
   */
  router.get('/:conversationId', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const messages = await dbClient.query(
        `FOR m IN ${QA_COLLECTIONS.CHAT_CONVERSATIONS}
           FILTER m.conversationId == @convId
           SORT m.timestamp ASC
           RETURN { role: m.role, content: m.content, timestamp: m.timestamp }`,
        { convId: conversationId }
      );
      res.json({ conversationId, messages, total: messages.length });
    } catch (error: any) {
      res.json({ conversationId: req.params.conversationId, messages: [], total: 0 });
    }
  });

  return router;
}
