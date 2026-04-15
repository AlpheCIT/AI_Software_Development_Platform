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

  const MAX_FILE_CHARS = 3000;

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

  // Detect project language
  const jsFiles = state.codeFiles.filter(f => f.language === 'javascript' || f.path?.endsWith('.js') || f.path?.endsWith('.jsx'));
  const tsFiles = state.codeFiles.filter(f => f.language === 'typescript' || f.path?.endsWith('.ts') || f.path?.endsWith('.tsx'));
  const projectLanguage = tsFiles.length > jsFiles.length ? 'TypeScript' : 'JavaScript';
  const fileExtension = projectLanguage === 'TypeScript' ? '.ts' : '.js';

  // ── Batched test generation ─────────────────────────────────────────
  // Split high-risk files into small batches to avoid JSON truncation.
  // Each batch gets its own LLM call with ~6-9K chars of context,
  // producing a short JSON array that won't exceed maxTokens.
  const BATCH_SIZE = 3;
  const batches: typeof highRiskFiles[] = [];
  for (let i = 0; i < highRiskFiles.length; i += BATCH_SIZE) {
    batches.push(highRiskFiles.slice(i, i + BATCH_SIZE));
  }

  const model = createModel({ temperature: 0.4, maxTokens: 8192 });
  const testsPerBatch = Math.ceil(state.config.maxTests / Math.max(batches.length, 1));
  let allTests: GeneratedTest[] = [];

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchFileNames = batch.map(b => b.filePath.split('/').pop()).join(', ');

    // Build code context for THIS batch only
    const batchContext = batch.map(risk => {
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

    // Emit progress for each batch
    eventPublisher?.emit('qa:agent.progress', {
      runId: state.runId,
      agent: 'generator',
      progress: 30 + Math.round((batchIdx / batches.length) * 50),
      message: `Batch ${batchIdx + 1}/${batches.length}: generating tests for ${batchFileNames}`,
    });

    for (const risk of batch) {
      eventPublisher?.emit('qa:agent.streaming', {
        runId: state.runId,
        agent: 'generator',
        text: `Building test context for ${risk.filePath}`,
        currentFile: risk.filePath,
        fileIndex: batchIdx * BATCH_SIZE + batch.indexOf(risk) + 1,
        fileTotal: highRiskFiles.length,
      });
    }

    const batchMessage = `Generate ${testsPerBatch} tests for these ${batch.length} files.

## Project Language: **${projectLanguage}** (use ${projectLanguage === 'JavaScript' ? 'require()/module.exports' : 'import/export'}, extension: ${fileExtension})
## Test types: ${state.config.testTypes.join(', ')}

## Code to Test
${batchContext}
${feedbackContext}
${mutationContext}

Respond with ONLY a valid JSON array of test objects. No markdown fencing.`;

    try {
      const startMs = Date.now();
      const response = await throttledInvoke(model, [
        new SystemMessage(GENERATOR_SYSTEM_PROMPT),
        new HumanMessage(batchMessage),
      ], 'generator', eventPublisher, state.runId);
      const durationMs = Date.now() - startMs;

      const responseText = typeof response.content === 'string' ? response.content : '';

      // Persist conversation for this batch
      if (dbClient) {
        persistConversation(dbClient, {
          runId: state.runId,
          agent: 'generator',
          systemPrompt: GENERATOR_SYSTEM_PROMPT,
          userMessage: batchMessage,
          response: responseText,
          tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
          durationMs,
          timestamp: new Date().toISOString(),
        });
      }

      let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Handle truncated JSON
      if (!cleaned.endsWith(']')) {
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace > 0) {
          cleaned = cleaned.substring(0, lastBrace + 1) + ']';
          if (!cleaned.startsWith('[')) cleaned = '[' + cleaned;
          console.warn(`[Generator] Batch ${batchIdx + 1} response truncated — recovered partial JSON`);
        }
      }

      const parsed = JSON.parse(cleaned);
      const batchTests = (Array.isArray(parsed) ? parsed : [parsed])
        .filter((t: any) => t.code && t.name)
        .map((t: any) => ({ ...t, id: uuidv4(), iteration: state.iteration + 1 }));

      console.log(`[Generator] Batch ${batchIdx + 1}/${batches.length}: produced ${batchTests.length} tests for ${batchFileNames}`);
      allTests.push(...batchTests);
    } catch (err) {
      console.error(`[Generator] Batch ${batchIdx + 1}/${batches.length} failed:`, err);
      // Continue with other batches — don't abort entire generation
    }
  }

  // Retry with single file if all batches failed
  if (allTests.length === 0 && highRiskFiles.length > 0) {
    console.log('[Generator] All batches produced 0 tests. Retrying with single file...');
    const singleFile = highRiskFiles[0];
    const fileContent = (state.codeFiles.find(f => f.path === singleFile.filePath)?.content || '').substring(0, 2000);
    const retryMessage = `Generate exactly 1 simple unit test for this file.

File: ${singleFile.filePath}
\`\`\`
${fileContent}
\`\`\`

Respond with a JSON array containing exactly 1 test object with fields: name, type, targetFile, code, confidence.`;

    try {
      const retryResponse = await throttledInvoke(model, [
        new SystemMessage(GENERATOR_SYSTEM_PROMPT),
        new HumanMessage(retryMessage),
      ], 'generator', eventPublisher, state.runId);
      const retryText = typeof retryResponse.content === 'string' ? retryResponse.content : '';
      const retryCleaned = retryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const retryParsed = JSON.parse(retryCleaned);
      const retryTests = (Array.isArray(retryParsed) ? retryParsed : [retryParsed])
        .filter((t: any) => t.code && t.name)
        .map((t: any) => ({ ...t, id: uuidv4(), iteration: state.iteration + 1 }));
      console.log(`[Generator] Retry produced ${retryTests.length} tests`);
      allTests.push(...retryTests);
    } catch {
      console.error('[Generator] Single-file retry also failed');
    }
  }

  let tests: GeneratedTest[] = allTests;
  if (tests.length === 0) {
    state.errors = [...(state.errors || []), { agent: 'generator', error: 'Failed to generate test cases from LLM responses' }];
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
