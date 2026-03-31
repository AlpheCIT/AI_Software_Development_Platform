/**
 * dspy-client.ts - Shared DSPy HTTP client for all agent nodes
 *
 * Provides health checking, expert chain calls, step recording,
 * and sub-agent spawning integration.
 */

import { createAgentSession, recordStep } from './reasoning-graph.js';
import { persistConversation } from './persist-conversation.js';
import { spawnSubAgents, SubAgentTask } from './sub-agent-spawner.js';

const DSPY_URL = () => process.env.DSPY_URL || 'http://localhost:8010';

// Cache health status to avoid hammering the health endpoint
let _healthCache: { available: boolean; checkedAt: number } | null = null;
const HEALTH_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Check if the DSPy service is available.
 * Results are cached for 30 seconds.
 */
export async function isDSPyAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_healthCache && (now - _healthCache.checkedAt) < HEALTH_CACHE_TTL_MS) {
    return _healthCache.available;
  }

  try {
    const response = await fetch(`${DSPY_URL()}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const available = response.ok;
    _healthCache = { available, checkedAt: now };
    return available;
  } catch {
    _healthCache = { available: false, checkedAt: now };
    return false;
  }
}

/**
 * Reset the health cache (useful for testing or after config changes).
 */
export function resetDSPyHealthCache(): void {
  _healthCache = null;
}

export interface DSPyExpertResult {
  report: any;
  steps: any[];
  subAgentsNeeded: any[];
}

/**
 * Call a DSPy expert chain endpoint and persist all steps
 * to the reasoning graph in ArangoDB.
 */
export async function callDSPyExpert(
  expertEndpoint: string,
  sourceFiles: string,
  dbClient: any,
  runId: string,
  agentId: string,
  agentName: string,
  eventPublisher?: any
): Promise<DSPyExpertResult> {
  const dspyUrl = DSPY_URL();

  // Create session in reasoning graph
  const sessionId = await createAgentSession(dbClient, { runId, agentId, agentName });

  eventPublisher?.emit('agent:dspy.calling', {
    runId,
    agentId,
    endpoint: expertEndpoint,
    sessionId,
  });

  // Call DSPy chain
  const startMs = Date.now();
  const response = await fetch(`${dspyUrl}${expertEndpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_files: sourceFiles }),
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown');
    throw new Error(`DSPy ${expertEndpoint} returned ${response.status}: ${errorBody}`);
  }

  const result = await response.json() as any;
  const totalDurationMs = Date.now() - startMs;

  // Record each step in the reasoning graph
  for (const [i, step] of (result.steps || []).entries()) {
    const stepId = await recordStep(dbClient, {
      sessionId,
      runId,
      stepIndex: i,
      stepName: step.name,
      stepType: step.type || 'analyze',
      prompt: step.input_summary || step.prompt || '',
      response: step.output_summary || step.response || '',
      reasoning: step.reasoning || '',
      tokensUsed: step.tokens_used,
      durationMs: step.duration_ms || 0,
      spawnedSubAgents: step.spawned_sub_agents || [],
    });

    eventPublisher?.emit('agent:step.completed', {
      runId,
      sessionId,
      stepName: step.name,
      stepIndex: i,
      totalSteps: result.steps.length,
      output_summary: (step.output_summary || '').slice(0, 200),
    });
  }

  // Persist conversation for legacy frontend compatibility
  await persistConversation(dbClient, {
    runId,
    agent: agentId,
    systemPrompt: `${agentName} (${result.steps?.length || 0}-step DSPy ChainOfThought)`,
    userMessage: `Analyzed ${sourceFiles.length} chars of source code`,
    response: typeof result.report === 'string' ? result.report : JSON.stringify(result.report),
    tokensUsed: result.total_tokens_used,
    durationMs: totalDurationMs,
    timestamp: new Date().toISOString(),
    step: 'dspy-chain',
    stepIndex: 0,
  });

  eventPublisher?.emit('agent:dspy.completed', {
    runId,
    agentId,
    sessionId,
    stepsCount: (result.steps || []).length,
    durationMs: totalDurationMs,
  });

  return {
    report: result.report,
    steps: result.steps || [],
    subAgentsNeeded: result.sub_agents_needed || [],
  };
}

/**
 * Handle sub-agent spawning if the DSPy chain requested it.
 * Returns merged sub-agent results.
 */
export async function handleSubAgents(
  subAgentsNeeded: any[],
  sourceFiles: string,
  dbClient: any,
  runId: string,
  parentSessionId: string,
  parentStepId: string,
  eventPublisher?: any
): Promise<Record<string, any>> {
  if (!subAgentsNeeded || subAgentsNeeded.length === 0) {
    return {};
  }

  const dspyUrl = DSPY_URL();

  const tasks: SubAgentTask[] = subAgentsNeeded.map((sa: any) => ({
    type: sa.type || sa.agent_type || 'unknown',
    description: sa.description || sa.reason || `Sub-agent: ${sa.type}`,
    context: sa.context || sourceFiles,
    parentSessionId,
    parentStepId,
  }));

  console.log(`[DSPyClient] Spawning ${tasks.length} sub-agents: ${tasks.map(t => t.type).join(', ')}`);

  return spawnSubAgents(dbClient, runId, tasks, dspyUrl, eventPublisher);
}
