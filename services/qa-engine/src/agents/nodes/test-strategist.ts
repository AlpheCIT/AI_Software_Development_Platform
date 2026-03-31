import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QAAgentState, RiskArea, TestStrategy } from '../state';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';

const STRATEGIST_SYSTEM_PROMPT = `You are a senior QA architect analyzing a codebase to create a comprehensive test strategy.

Your job:
1. Analyze the provided code files and entities to identify high-risk areas
2. Determine which files/functions need testing most urgently
3. Create a prioritized test strategy

For each risk area, consider:
- Complexity of the code (many branches, deep nesting)
- External dependencies (APIs, databases, file system)
- Authentication/authorization logic
- State management and transitions
- Data validation and transformation
- Error handling paths

Output your analysis as valid JSON with this structure:
{
  "riskAreas": [
    {
      "filePath": "path/to/file",
      "riskLevel": "high|medium|low",
      "reason": "why this is risky",
      "suggestedTestTypes": ["unit", "e2e", "api"]
    }
  ],
  "priorityScore": 0.87,
  "coverageStrategy": "description of overall strategy",
  "suggestedTestCount": 15,
  "focusAreas": ["auth", "state management", "API endpoints"]
}`;

export async function testStrategistNode(
  state: QAAgentState,
  dbClient: any,
  eventPublisher?: any
): Promise<Partial<QAAgentState>> {
  console.log(`[Strategist] Analyzing repository: ${state.config.repoUrl}`);

  // Emit agent started event
  eventPublisher?.emit('qa:agent.started', {
    runId: state.runId,
    agent: 'strategist',
    step: 'Analyzing codebase for risk areas',
  });

  // Use code files and entities already populated by the repo-ingester node.
  // The ingester either pulled them from ArangoDB or cloned the repo directly.
  const codeFiles = state.codeFiles;
  const codeEntities = state.codeEntities;

  eventPublisher?.emit('qa:agent.progress', {
    runId: state.runId,
    agent: 'strategist',
    progress: 20,
    message: `Analyzing ${codeFiles.length} files and ${codeEntities.length} code entities (source: ${(state as any).ingestionSource ?? 'unknown'})`,
  });

  // Emit streaming state so frontend shows what's being analyzed
  eventPublisher?.emit('qa:agent.streaming', {
    runId: state.runId,
    agent: 'strategist',
    text: 'Building codebase context...',
    currentFile: codeFiles[0]?.path,
    fileIndex: 1,
    fileTotal: codeFiles.length,
  });

  // Build context for Claude
  const filesSummary = codeFiles
    .slice(0, 100)
    .map((f: any) => `- ${f.path} (${f.language}, ${f.size} bytes)`)
    .join('\n');

  const entitiesSummary = codeEntities
    .slice(0, 200)
    .map((e: any) => `- ${e.type} ${e.name} in ${e.file}${e.signature ? ': ' + e.signature : ''}`)
    .join('\n');

  const sampleCode = codeFiles
    .filter((f: any) => f.content)
    .slice(0, 10)
    .map((f: any) => `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
    .join('\n\n');

  // Call Claude for strategy (throttled)
  const model = createModel({ temperature: 0.3, maxTokens: 4096 });

  const userMessage = `Analyze this codebase and create a test strategy.

## Repository
URL: ${state.config.repoUrl}
Branch: ${state.config.branch}
Test types requested: ${state.config.testTypes.join(', ')}
Max tests: ${state.config.maxTests}

## Files (${codeFiles.length} total)
${filesSummary}

## Code Entities (${codeEntities.length} total)
${entitiesSummary}

## Sample Code
${sampleCode}

Respond with ONLY valid JSON, no markdown fencing.`;

  eventPublisher?.emit('qa:agent.streaming', {
    runId: state.runId,
    agent: 'strategist',
    text: 'Sending to Claude for risk analysis...',
  });

  eventPublisher?.emit('qa:agent.progress', {
    runId: state.runId,
    agent: 'strategist',
    progress: 50,
    message: 'Claude analyzing codebase for risk areas...',
  });

  const startMs = Date.now();
  const response = await throttledInvoke(
    model,
    [new SystemMessage(STRATEGIST_SYSTEM_PROMPT), new HumanMessage(userMessage)],
    'strategist', eventPublisher, state.runId
  );
  const durationMs = Date.now() - startMs;

  const responseText = typeof response.content === 'string' ? response.content : '';
  persistConversation(dbClient, {
    runId: state.runId,
    agent: 'strategist',
    systemPrompt: STRATEGIST_SYSTEM_PROMPT,
    userMessage,
    response: responseText,
    tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
    durationMs,
    timestamp: new Date().toISOString(),
  });

  let strategy: TestStrategy;
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    strategy = JSON.parse(cleaned);
  } catch (error) {
    console.error('[Strategist] Failed to parse Claude response:', error);
    console.error('[Strategist] Raw response:', (typeof response.content === 'string' ? response.content : '').substring(0, 500));
    strategy = {
      riskAreas: [],
      priorityScore: null as any,
      coverageStrategy: 'Strategy generation failed — LLM response could not be parsed',
      suggestedTestCount: 0,
      focusAreas: [],
      error: 'Failed to parse LLM response into test strategy',
    } as any;
    state.errors = [...(state.errors || []), { agent: 'strategist', error: 'Failed to parse LLM response' }];
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId: state.runId,
    agent: 'strategist',
    result: {
      riskAreasCount: strategy.riskAreas.length,
      highRiskCount: strategy.riskAreas.filter((r: RiskArea) => r.riskLevel === 'high').length,
      priorityScore: strategy.priorityScore,
    },
  });

  return {
    strategy,
    currentAgent: 'generator',
  };
}
