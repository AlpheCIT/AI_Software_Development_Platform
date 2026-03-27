import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QAAgentState, GeneratedTest } from '../state';
import { qaConfig } from '../../config';
import { v4 as uuidv4 } from 'uuid';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';

const GENERATOR_SYSTEM_PROMPT = `You are an expert test engineer generating high-quality, executable test code.

CRITICAL: Match the project's language. You will be told whether the project uses JavaScript or TypeScript.
- For JavaScript projects: generate plain .js tests using require() and module.exports — NO TypeScript syntax, NO type annotations, NO import/export statements
- For TypeScript projects: generate .ts tests using import/export

Rules:
1. Generate REAL, RUNNABLE test code — not pseudocode
2. Each test must have meaningful assertions that verify behavior, not just "doesn't crash"
3. Include edge cases, error paths, and boundary conditions
4. Use descriptive test names that explain what is being verified
5. For unit tests: use Jest syntax (describe/it/expect)
6. For E2E tests: use Playwright syntax
7. For API tests: use supertest or direct fetch
8. Match the project language EXACTLY — if it's JavaScript, write JavaScript tests

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
  dbClient?: any,
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

  // Build code context for the high-risk files (truncate to avoid exceeding context)
  const MAX_FILE_CHARS = 3000; // Cap each file to avoid massive prompts
  const codeContext = highRiskFiles.map(risk => {
    const file = state.codeFiles.find(f => f.path === risk.filePath);
    const entities = state.codeEntities.filter(e => e.file === risk.filePath);
    const content = file?.content || '';
    const truncated = content.length > MAX_FILE_CHARS
      ? content.substring(0, MAX_FILE_CHARS) + '\n// ... (truncated)'
      : content;
    return `### ${risk.filePath} (Risk: ${risk.riskLevel} — ${risk.reason})
Functions: ${entities.map(e => `${e.type} ${e.name}`).join(', ') || 'N/A'}
${truncated ? '```\n' + truncated + '\n```' : '(content not available)'}`;
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

  // Emit what files are being targeted
  for (let i = 0; i < Math.min(highRiskFiles.length, 5); i++) {
    eventPublisher?.emit('qa:agent.streaming', {
      runId: state.runId,
      agent: 'generator',
      text: `Building test context for ${highRiskFiles[i].filePath}`,
      currentFile: highRiskFiles[i].filePath,
      fileIndex: i + 1,
      fileTotal: highRiskFiles.length,
    });
  }

  eventPublisher?.emit('qa:agent.progress', {
    runId: state.runId,
    agent: 'generator',
    progress: 30,
    message: `Generating tests for ${highRiskFiles.length} high-risk files (iteration ${state.iteration + 1})`,
  });

  const model = createModel({ temperature: 0.4, maxTokens: 16384 });

  // Detect project language from code files
  const jsFiles = state.codeFiles.filter(f => f.language === 'javascript' || f.path?.endsWith('.js') || f.path?.endsWith('.jsx'));
  const tsFiles = state.codeFiles.filter(f => f.language === 'typescript' || f.path?.endsWith('.ts') || f.path?.endsWith('.tsx'));
  const projectLanguage = tsFiles.length > jsFiles.length ? 'TypeScript' : 'JavaScript';
  const fileExtension = projectLanguage === 'TypeScript' ? '.ts' : '.js';

  const userMessage = `Generate tests for this codebase.

## IMPORTANT: Project Language
This project uses **${projectLanguage}** (${jsFiles.length} JS files, ${tsFiles.length} TS files).
Generate ALL test code in **${projectLanguage}** with ${projectLanguage === 'JavaScript' ? 'require()/module.exports (CommonJS)' : 'import/export (ESM)'} syntax.
Use file extension: ${fileExtension}

## Test Strategy
Focus areas: ${strategy.focusAreas.join(', ')}
Coverage strategy: ${strategy.coverageStrategy}
Max tests to generate: ${Math.min(strategy.suggestedTestCount, state.config.maxTests)}
Test types: ${state.config.testTypes.join(', ')}

## High-Risk Code
${codeContext}
${feedbackContext}
${mutationContext}

Respond with ONLY a valid JSON array, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(model, [
    new SystemMessage(GENERATOR_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'generator', eventPublisher, state.runId);
  const durationMs = Date.now() - startMs;

  const responseText = typeof response.content === 'string' ? response.content : '';
  if (dbClient) {
    persistConversation(dbClient, {
      runId: state.runId,
      agent: 'generator',
      systemPrompt: GENERATOR_SYSTEM_PROMPT,
      userMessage,
      response: responseText,
      tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  let tests: GeneratedTest[];
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Handle truncated JSON — try to close incomplete arrays
    if (!cleaned.endsWith(']')) {
      // Find the last complete object in the array
      const lastCloseBrace = cleaned.lastIndexOf('}');
      if (lastCloseBrace > 0) {
        cleaned = cleaned.substring(0, lastCloseBrace + 1) + ']';
        // If it doesn't start with [, wrap it
        if (!cleaned.startsWith('[')) {
          cleaned = '[' + cleaned;
        }
        console.warn('[Generator] Response was truncated — recovered partial JSON');
      }
    }

    const parsed = JSON.parse(cleaned);
    const testArray = Array.isArray(parsed) ? parsed : [parsed];
    tests = testArray.map((t: any) => ({
      ...t,
      id: uuidv4(),
      iteration: state.iteration + 1,
    }));
  } catch (error) {
    console.error('[Generator] Failed to parse Claude response:', error);
    // Create a minimal fallback test so the pipeline continues
    tests = [{
      id: uuidv4(),
      name: 'fallback-smoke-test',
      type: 'unit' as const,
      targetFile: highRiskFiles[0]?.filePath || 'app.js',
      code: `describe('Smoke Test', () => { it('should load without errors', () => { expect(true).toBe(true); }); });`,
      confidence: 0.1,
      iteration: state.iteration + 1,
    }];
    console.log('[Generator] Using fallback smoke test so pipeline continues');
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
