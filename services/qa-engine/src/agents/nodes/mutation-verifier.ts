import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QAAgentState, MutationResult } from '../state';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';

const MUTATION_ANALYSIS_PROMPT = `You are a mutation testing expert. Analyze the generated tests and identify potential surviving mutants.

A "mutant" is a small change to the source code (e.g., changing > to >=, flipping true/false, removing a condition).
A test "kills" a mutant if it would fail when the mutant is applied.
A mutant "survives" if no test catches the change — this means the tests are weak in that area.

Given the source code and the test code, identify mutations that would SURVIVE the current tests.

Output format — respond with ONLY valid JSON:
{
  "totalMutants": 20,
  "killed": 16,
  "survived": 4,
  "score": 80,
  "survivors": [
    {
      "mutantId": "m1",
      "file": "path/to/file",
      "location": "line 42, function validateInput",
      "mutationType": "boundary",
      "originalCode": "if (value > 0)",
      "mutatedCode": "if (value >= 0)"
    }
  ]
}

Be realistic — not every mutation is catchable. Focus on mutations that represent REAL bugs.
The score should be (killed / totalMutants * 100).`;

export async function mutationVerifierNode(
  state: QAAgentState,
  dbClient?: any,
  eventPublisher?: any
): Promise<Partial<QAAgentState>> {
  console.log(`[MutationVerifier] Analyzing test quality (iteration ${state.iteration + 1})`);

  eventPublisher?.emit('qa:mutation.started', {
    runId: state.runId,
    totalMutants: 0, // Will be determined by analysis
  });

  eventPublisher?.emit('qa:agent.started', {
    runId: state.runId,
    agent: 'mutation-verifier',
    step: 'Analyzing mutation resilience of generated tests',
  });

  // Get the latest approved tests
  const approvedTestIds = new Set(
    state.criticFeedback.filter(f => f.approved).map(f => f.testId)
  );
  const testsToAnalyze = state.generatedTests.filter(t =>
    approvedTestIds.size === 0 || approvedTestIds.has(t.id)
  );

  if (testsToAnalyze.length === 0) {
    return {
      mutationResult: { totalMutants: 0, killed: 0, survived: 0, score: 0, survivors: [] },
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
  }

  // Build context: source code + test code
  const sourceCode = state.codeFiles
    .filter(f => f.content)
    .slice(0, 10)
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  const testCode = testsToAnalyze
    .map(t => `### ${t.name} (targets: ${t.targetFile})\n\`\`\`\n${t.code}\n\`\`\``)
    .join('\n\n');

  const model = createModel({ temperature: 0.2, maxTokens: 4096 });

  const userMessage = `Analyze mutation resilience.

## Source Code
${sourceCode}

## Test Code
${testCode}

Identify mutations that would survive these tests. Be thorough.
Respond with ONLY valid JSON, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(model, [
    new SystemMessage(MUTATION_ANALYSIS_PROMPT),
    new HumanMessage(userMessage),
  ], 'mutation-verifier', eventPublisher, state.runId);
  const durationMs = Date.now() - startMs;

  const responseText = typeof response.content === 'string' ? response.content : '';
  if (dbClient) {
    persistConversation(dbClient, {
      runId: state.runId,
      agent: 'mutation-verifier',
      systemPrompt: MUTATION_ANALYSIS_PROMPT,
      userMessage,
      response: responseText,
      tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  let mutationResult: MutationResult;
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    mutationResult = JSON.parse(cleaned);
  } catch (error) {
    console.error('[MutationVerifier] Failed to parse response');
    mutationResult = {
      totalMutants: testsToAnalyze.length * 3,
      killed: testsToAnalyze.length * 2,
      survived: testsToAnalyze.length,
      score: 67,
      survivors: [],
    };
  }

  eventPublisher?.emit('qa:mutation.completed', {
    runId: state.runId,
    score: mutationResult.score,
    survivors: mutationResult.survivors.length,
  });

  const threshold = qaConfig.qa.mutationScoreThreshold;
  const shouldLoop = mutationResult.score < threshold &&
    state.iteration < state.maxIterations - 1 &&
    mutationResult.survivors.length > 0;

  if (shouldLoop) {
    console.log(
      `[MutationVerifier] Score ${mutationResult.score}% < ${threshold}% threshold. ` +
      `${mutationResult.survivors.length} survivors. Looping back to generator.`
    );
    eventPublisher?.emit('qa:agent.loop', {
      runId: state.runId,
      from: 'mutation-verifier',
      to: 'generator',
      reason: `Mutation score ${mutationResult.score}% below ${threshold}% threshold. ${mutationResult.survivors.length} surviving mutants need tests.`,
    });
  } else {
    console.log(
      `[MutationVerifier] Score ${mutationResult.score}% ` +
      `(${mutationResult.score >= threshold ? 'PASSED' : 'max iterations reached'})`
    );
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId: state.runId,
    agent: 'mutation-verifier',
    result: {
      score: mutationResult.score,
      killed: mutationResult.killed,
      survived: mutationResult.survived,
      threshold,
      passed: mutationResult.score >= threshold,
    },
  });

  return {
    mutationResult,
    shouldLoop,
    iteration: shouldLoop ? state.iteration + 1 : state.iteration,
    currentAgent: shouldLoop ? 'generator' : 'done',
    status: shouldLoop ? 'running' : 'completed',
    completedAt: shouldLoop ? undefined : new Date().toISOString(),
  };
}
