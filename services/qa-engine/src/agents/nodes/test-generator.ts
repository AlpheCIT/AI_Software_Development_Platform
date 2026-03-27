import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QAAgentState, GeneratedTest } from '../state';
import { qaConfig } from '../../config';
import { v4 as uuidv4 } from 'uuid';

const GENERATOR_SYSTEM_PROMPT = `You are an expert test engineer generating high-quality, executable test code.

Rules:
1. Generate REAL, RUNNABLE test code — not pseudocode
2. Each test must have meaningful assertions that verify behavior, not just "doesn't crash"
3. Include edge cases, error paths, and boundary conditions
4. Use descriptive test names that explain what is being verified
5. For unit tests: use Jest/Vitest syntax
6. For E2E tests: use Playwright syntax
7. For API tests: use supertest or direct fetch

Output format — respond with ONLY a JSON array:
[
  {
    "name": "descriptive-test-name",
    "type": "unit|e2e|api",
    "targetFile": "path/to/source/file",
    "targetFunction": "functionName",
    "code": "// full test code here",
    "description": "what this test verifies",
    "confidence": 0.85
  }
]

If you received feedback from a prior iteration about missing edge cases or surviving mutants,
prioritize addressing those gaps in your generated tests.`;

export async function testGeneratorNode(
  state: QAAgentState,
  eventPublisher?: any
): Promise<Partial<QAAgentState>> {
  console.log(`[Generator] Creating tests (iteration ${state.iteration + 1})`);

  eventPublisher?.emit('qa:agent.started', {
    runId: state.runId,
    agent: 'generator',
    step: `Generating tests (iteration ${state.iteration + 1})`,
  });

  const strategy = state.strategy!;
  const highRiskFiles = strategy.riskAreas
    .filter(r => r.riskLevel === 'high' || r.riskLevel === 'medium')
    .slice(0, 10);

  // Build code context for the high-risk files
  const codeContext = highRiskFiles.map(risk => {
    const file = state.codeFiles.find(f => f.path === risk.filePath);
    const entities = state.codeEntities.filter(e => e.file === risk.filePath);
    return `### ${risk.filePath} (Risk: ${risk.riskLevel} — ${risk.reason})
Functions: ${entities.map(e => `${e.type} ${e.name}`).join(', ') || 'N/A'}
${file?.content ? '```\n' + file.content + '\n```' : '(content not available)'}`;
  }).join('\n\n');

  // Include critic feedback if this is a re-generation
  let feedbackContext = '';
  if (state.criticFeedback.length > 0) {
    feedbackContext = `\n\n## CRITIC FEEDBACK FROM PREVIOUS ITERATION
Address these gaps in your new tests:
${state.criticFeedback.map(f =>
    `- Test "${f.testId}": ${f.gaps.join(', ')}. Missing edge cases: ${f.missingEdgeCases.join(', ')}`
  ).join('\n')}`;
  }

  // Include mutation survivors if from mutation loop
  let mutationContext = '';
  if (state.mutationResult && state.mutationResult.survivors.length > 0) {
    mutationContext = `\n\n## SURVIVING MUTANTS (tests failed to catch these bugs)
These mutations were NOT caught by existing tests. Generate tests that WILL catch them:
${state.mutationResult.survivors.slice(0, 10).map(s =>
    `- ${s.file} (${s.mutationType}): Changed "${s.originalCode}" to "${s.mutatedCode}"`
  ).join('\n')}`;
  }

  const model = new ChatAnthropic({
    modelName: qaConfig.anthropic.model,
    anthropicApiKey: qaConfig.anthropic.apiKey,
    temperature: 0.4,
    maxTokens: 8192,
  });

  const response = await model.invoke([
    new SystemMessage(GENERATOR_SYSTEM_PROMPT),
    new HumanMessage(`Generate tests for this codebase.

## Test Strategy
Focus areas: ${strategy.focusAreas.join(', ')}
Coverage strategy: ${strategy.coverageStrategy}
Max tests to generate: ${Math.min(strategy.suggestedTestCount, state.config.maxTests)}
Test types: ${state.config.testTypes.join(', ')}

## High-Risk Code
${codeContext}
${feedbackContext}
${mutationContext}

Respond with ONLY a valid JSON array, no markdown fencing.`),
  ]);

  let tests: GeneratedTest[];
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    tests = parsed.map((t: any) => ({
      ...t,
      id: uuidv4(),
      iteration: state.iteration + 1,
    }));
  } catch (error) {
    console.error('[Generator] Failed to parse Claude response:', error);
    tests = [];
    return {
      errors: [...state.errors, 'Test generator failed to produce valid tests'],
      currentAgent: 'executor',
    };
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId: state.runId,
    agent: 'generator',
    result: {
      testsGenerated: tests.length,
      testTypes: [...new Set(tests.map(t => t.type))],
      avgConfidence: tests.reduce((sum, t) => sum + t.confidence, 0) / (tests.length || 1),
    },
  });

  console.log(`[Generator] Produced ${tests.length} tests`);

  return {
    generatedTests: [...state.generatedTests, ...tests],
    currentAgent: 'critic',
  };
}
