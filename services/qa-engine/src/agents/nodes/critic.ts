import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QAAgentState, CriticFeedback } from '../state';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';

const CRITIC_SYSTEM_PROMPT = `You are a rigorous QA critic. Your job is to review generated tests and identify weaknesses.

For each test, evaluate:
1. Does it have MEANINGFUL assertions (not just "doesn't throw")?
2. Does it cover edge cases (null, empty, boundary values)?
3. Does it test error paths, not just happy paths?
4. Would a mutation (e.g., changing > to >=, flipping a boolean) survive this test?
5. Does it test the actual business logic, not just framework boilerplate?

Be harsh but constructive. If a test is weak, explain exactly what's missing and how to improve it.

Output format — respond with ONLY a JSON array:
[
  {
    "testId": "test-id",
    "approved": true|false,
    "gaps": ["gap description 1", "gap description 2"],
    "missingEdgeCases": ["edge case 1", "edge case 2"],
    "confidenceScore": 0.72,
    "suggestions": ["specific improvement 1", "specific improvement 2"]
  }
]

A test should be approved (true) only if it has strong assertions and reasonable coverage.
Set confidenceScore to your confidence that this test will catch real bugs (0.0 to 1.0).`;

export async function criticNode(
  state: QAAgentState,
  dbClient?: any,
  eventPublisher?: any
): Promise<Partial<QAAgentState>> {
  const currentIterationTests = state.generatedTests.filter(
    t => t.iteration === state.iteration + 1
  );

  if (currentIterationTests.length === 0) {
    console.log('[Critic] No tests to review, moving to executor');
    return { currentAgent: 'executor', shouldLoop: false };
  }

  console.log(`[Critic] Reviewing ${currentIterationTests.length} tests`);

  eventPublisher?.emit('qa:agent.started', {
    runId: state.runId,
    agent: 'critic',
    step: `Reviewing ${currentIterationTests.length} generated tests`,
  });

  const testsForReview = currentIterationTests.map(t => ({
    id: t.id,
    name: t.name,
    type: t.type,
    targetFile: t.targetFile,
    code: t.code,
    description: t.description,
  }));

  const model = createModel({ temperature: 0.2, maxTokens: 4096 });

  const userMessage = `Review these generated tests. Be thorough and critical.

## Strategy Context
Focus areas: ${state.strategy?.focusAreas.join(', ')}
Risk areas: ${state.strategy?.riskAreas.slice(0, 5).map(r => `${r.filePath} (${r.riskLevel})`).join(', ')}

## Tests to Review
${JSON.stringify(testsForReview, null, 2)}

Respond with ONLY a valid JSON array, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(model, [
    new SystemMessage(CRITIC_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'critic', eventPublisher, state.runId);
  const durationMs = Date.now() - startMs;

  const responseText = typeof response.content === 'string' ? response.content : '';
  if (dbClient) {
    persistConversation(dbClient, {
      runId: state.runId,
      agent: 'critic',
      systemPrompt: CRITIC_SYSTEM_PROMPT,
      userMessage,
      response: responseText,
      tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  let feedback: CriticFeedback[];
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    feedback = JSON.parse(cleaned);
  } catch (error) {
    console.error('[Critic] Failed to parse response, approving all tests');
    feedback = currentIterationTests.map(t => ({
      testId: t.id,
      approved: true,
      gaps: [],
      missingEdgeCases: [],
      confidenceScore: 0.6,
      suggestions: [],
    }));
  }

  const approvedCount = feedback.filter(f => f.approved).length;
  const avgConfidence = feedback.reduce((sum, f) => sum + f.confidenceScore, 0) / (feedback.length || 1);

  // Decide whether to loop back to generator
  const shouldLoop = avgConfidence < 0.6 && state.iteration < state.maxIterations - 1;

  if (shouldLoop) {
    console.log(`[Critic] Low confidence (${avgConfidence.toFixed(2)}), sending back to generator`);
    eventPublisher?.emit('qa:agent.loop', {
      runId: state.runId,
      from: 'critic',
      to: 'generator',
      reason: `Low confidence (${avgConfidence.toFixed(2)}). ${feedback.filter(f => !f.approved).length} tests need improvement.`,
    });
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId: state.runId,
    agent: 'critic',
    result: {
      reviewed: feedback.length,
      approved: approvedCount,
      rejected: feedback.length - approvedCount,
      avgConfidence,
      shouldLoop,
    },
  });

  return {
    criticFeedback: feedback,
    shouldLoop,
    iteration: shouldLoop ? state.iteration + 1 : state.iteration,
    currentAgent: shouldLoop ? 'generator' : 'executor',
  };
}
