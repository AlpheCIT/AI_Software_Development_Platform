import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { QAAgentState, RiskArea, TestStrategy } from '../state';
import { qaConfig } from '../../config';

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
    progress: 40,
    message: `Analyzing ${codeFiles.length} files and ${codeEntities.length} code entities (source: ${(state as any).ingestionSource ?? 'unknown'})`,
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

  // Call Claude for strategy
  const model = new ChatAnthropic({
    modelName: qaConfig.anthropic.model,
    anthropicApiKey: qaConfig.anthropic.apiKey,
    temperature: 0.3,
    maxTokens: 4096,
  });

  const response = await model.invoke([
    new SystemMessage(STRATEGIST_SYSTEM_PROMPT),
    new HumanMessage(`Analyze this codebase and create a test strategy.

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

Respond with ONLY valid JSON, no markdown fencing.`),
  ]);

  let strategy: TestStrategy;
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    strategy = JSON.parse(cleaned);
  } catch (error) {
    console.error('[Strategist] Failed to parse Claude response, using fallback strategy');
    strategy = {
      riskAreas: codeFiles.slice(0, 5).map((f: any) => ({
        filePath: f.path,
        riskLevel: 'medium' as const,
        reason: 'Default analysis - file in repository',
        suggestedTestTypes: state.config.testTypes,
      })),
      priorityScore: 0.5,
      coverageStrategy: 'Basic coverage of main files',
      suggestedTestCount: Math.min(state.config.maxTests, 10),
      focusAreas: ['general'],
    };
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
