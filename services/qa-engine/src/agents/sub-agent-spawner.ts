/**
 * sub-agent-spawner.ts - Dynamic sub-agent spawning for DSPy expert chains
 *
 * When a DSPy expert chain returns `sub_agents_needed`, this module
 * spawns child agent sessions, calls the appropriate DSPy endpoint,
 * and records all steps/findings in the reasoning graph.
 */

import { createAgentSession, recordStep, recordFinding, recordSubAgentSpawn } from './reasoning-graph.js';

export interface SubAgentTask {
  type: string;       // e.g., 'auth-flow-tracer', 'input-validator'
  description: string;
  context: string;    // focused subset of source files
  parentSessionId: string;
  parentStepId: string;
}

/**
 * Spawn sub-agents requested by a DSPy expert chain.
 * Each sub-agent gets its own session in the reasoning graph,
 * linked to the parent via a spawned_by edge.
 */
export async function spawnSubAgents(
  dbClient: any,
  runId: string,
  tasks: SubAgentTask[],
  dspyUrl: string,
  eventPublisher?: any
): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  for (const task of tasks) {
    // Create sub-agent session in ArangoDB
    const sessionId = await createAgentSession(dbClient, {
      runId,
      agentId: task.type,
      agentName: task.description,
      parentSessionId: task.parentSessionId,
      parentStepId: task.parentStepId,
    });

    // Record spawn edge
    await recordSubAgentSpawn(dbClient, {
      parentSessionId: task.parentSessionId,
      parentStepId: task.parentStepId,
      childSessionId: sessionId,
    });

    // Emit WebSocket event
    eventPublisher?.emit('agent:sub.spawned', {
      runId,
      parentSessionId: task.parentSessionId,
      parentStepId: task.parentStepId,
      subAgentName: task.type,
      subSessionId: sessionId,
    });

    // Call DSPy for the sub-agent analysis
    try {
      const endpoint = getSubAgentEndpoint(task.type);
      const response = await fetch(`${dspyUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_files: task.context }),
        signal: AbortSignal.timeout(120000),
      });

      if (response.ok) {
        const result = await response.json() as any;
        results[task.type] = result;

        // Record sub-agent steps in the reasoning graph
        for (const [i, step] of (result.steps || []).entries()) {
          await recordStep(dbClient, {
            sessionId,
            runId,
            stepIndex: i,
            stepName: step.name,
            stepType: step.type || 'analyze',
            prompt: step.input_summary || '',
            response: step.output_summary || '',
            durationMs: step.duration_ms || 0,
          });
        }

        // Record any findings from the sub-agent
        for (const finding of (result.report?.findings || [])) {
          await recordFinding(dbClient, {
            runId,
            sessionId,
            producedByStepId: `step_${sessionId}_${(result.steps || []).length - 1}`,
            type: finding.type || task.type,
            severity: finding.severity || 'medium',
            title: finding.title || finding.description || 'Sub-agent finding',
            description: finding.description || '',
            file: finding.file,
            line: finding.line,
            evidence: finding.evidence,
            confidence: finding.confidence || 0.7,
            remediation: finding.fix || finding.remediation,
          });
        }

        eventPublisher?.emit('agent:sub.completed', {
          runId,
          subSessionId: sessionId,
          findings_count: (result.report?.findings || []).length,
        });
      } else {
        const errorText = await response.text().catch(() => 'unknown error');
        console.error(`[SubAgent] ${task.type} returned ${response.status}: ${errorText}`);
        results[task.type] = { error: `HTTP ${response.status}: ${errorText}` };
      }
    } catch (err) {
      console.error(`[SubAgent] ${task.type} failed:`, err);
      results[task.type] = { error: (err as Error).message };

      eventPublisher?.emit('agent:sub.failed', {
        runId,
        subSessionId: sessionId,
        error: (err as Error).message,
      });
    }
  }

  return results;
}

/**
 * Map sub-agent types to DSPy endpoints.
 * Sub-agents are routed to the most appropriate expert chain.
 */
function getSubAgentEndpoint(type: string): string {
  const endpoints: Record<string, string> = {
    'auth-flow-tracer': '/analyze/security-expert',
    'input-validator': '/analyze/security-expert',
    'injection-scanner': '/analyze/security-expert',
    'component-flow-tracer': '/analyze/frontend-expert',
    'accessibility-auditor': '/analyze/frontend-expert',
    'route-analyzer': '/analyze/backend-expert',
    'error-handler-auditor': '/analyze/backend-expert',
    'middleware-inspector': '/analyze/middleware-expert',
    'duplication-scanner': '/analyze/quality-architect',
    'complexity-analyzer': '/analyze/quality-architect',
  };
  return endpoints[type] || '/analyze/security-expert';
}
