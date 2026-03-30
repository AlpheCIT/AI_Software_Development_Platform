/**
 * Pipeline Executor — Runs selected agents respecting priority, parallelism,
 * dependencies, and timeouts.
 *
 * Execution model:
 *
 * 1. Agents are grouped by priority level (0, 10, 20, ...).
 * 2. Each priority group runs in sequence (group 0 before group 10, etc.).
 * 3. Within a group, agents marked `parallel: true` run concurrently via
 *    Promise.allSettled. Sequential agents run one-by-one after the parallel batch.
 * 4. Before running an agent, its `dependsOn` list is checked — all listed
 *    agents must have completed successfully. If a dependency failed or was
 *    skipped, the dependent agent is also skipped.
 * 5. Each agent is wrapped in a timeout (Promise.race). On timeout, the agent
 *    is treated as a failure.
 * 6. Optional agents (optional: true) log failures but do not abort the pipeline.
 *    Required agents throw on failure, aborting the current pipeline run.
 * 7. Results from completed agents are stored in `context.previousResults` so
 *    downstream agents can access them.
 */

import type { AgentDefinition, AgentContext } from './agent-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecutionStatus = 'success' | 'failure' | 'timeout' | 'skipped' | 'dependency-missing';

/** A single entry in the execution log — one per agent. */
export interface ExecutionLogEntry {
  agentId: string;
  agentName: string;
  status: ExecutionStatus;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  error?: string;
  /** Whether this agent was optional */
  optional: boolean;
  /** Priority level this agent ran at */
  priority: number;
}

/** The complete result from a pipeline execution. */
export interface PipelineResult {
  /** Agent results keyed by agent ID */
  results: Record<string, any>;
  /** IDs of agents that were selected and attempted */
  selectedAgentIds: string[];
  /** Detailed execution log for every agent */
  executionLog: ExecutionLogEntry[];
  /** Total pipeline wall-clock time in ms */
  totalDurationMs: number;
  /** Whether all required agents succeeded */
  success: boolean;
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * `ms` milliseconds, the returned promise rejects with a timeout error.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[${label}] Timed out after ${ms}ms`));
    }, ms);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// Grouping helper
// ---------------------------------------------------------------------------

/**
 * Groups agents by priority level, preserving sort order within each group.
 */
function groupByPriority(agents: AgentDefinition[]): Map<number, AgentDefinition[]> {
  const groups = new Map<number, AgentDefinition[]>();
  for (const agent of agents) {
    const group = groups.get(agent.priority);
    if (group) {
      group.push(agent);
    } else {
      groups.set(agent.priority, [agent]);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

/**
 * Execute a pipeline of selected agents.
 *
 * @param selectedAgents - Agents to run (already filtered by the dynamic-router)
 * @param context - The shared AgentContext. `previousResults` will be mutated
 *                  as agents complete, so downstream agents can access results.
 * @param eventPublisher - Optional event emitter for real-time progress updates.
 *
 * @returns PipelineResult with all results, the execution log, and timing info.
 *
 * @throws If a **required** agent fails and is not marked optional.
 */
export async function executePipeline(
  selectedAgents: AgentDefinition[],
  context: AgentContext,
  eventPublisher?: any,
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const executionLog: ExecutionLogEntry[] = [];
  const completedAgents = new Set<string>();
  const failedAgents = new Set<string>();
  const results: Record<string, any> = { ...context.previousResults };

  // Ensure context.previousResults points to our mutable results map
  context.previousResults = results;

  // Also set eventPublisher on context if provided
  if (eventPublisher && !context.eventPublisher) {
    context.eventPublisher = eventPublisher;
  }

  const selectedIds = selectedAgents.map(a => a.id);

  eventPublisher?.emit('qa:pipeline.started', {
    runId: context.runId,
    agentCount: selectedAgents.length,
    agentIds: selectedIds,
  });

  // Sort and group by priority
  const sorted = [...selectedAgents].sort((a, b) => a.priority - b.priority);
  const priorityGroups = groupByPriority(sorted);
  const priorityLevels = Array.from(priorityGroups.keys()).sort((a, b) => a - b);

  let pipelineSuccess = true;

  for (const priority of priorityLevels) {
    const group = priorityGroups.get(priority)!;

    // Split into parallel and sequential agents
    const parallelAgents = group.filter(a => a.parallel !== false);
    const sequentialAgents = group.filter(a => a.parallel === false);

    // --- Run parallel agents concurrently ---
    if (parallelAgents.length > 0) {
      const parallelTasks = parallelAgents.map(agent =>
        runSingleAgent(agent, context, completedAgents, failedAgents, results, executionLog, eventPublisher),
      );

      const outcomes = await Promise.allSettled(parallelTasks);

      // Check for required agent failures
      for (let i = 0; i < outcomes.length; i++) {
        const outcome = outcomes[i];
        const agent = parallelAgents[i];
        if (outcome.status === 'rejected' && !agent.optional) {
          pipelineSuccess = false;
          const errorMsg = outcome.reason?.message || String(outcome.reason);
          console.error(`[PipelineExecutor] Required agent "${agent.id}" failed: ${errorMsg}`);
          eventPublisher?.emit('qa:pipeline.error', {
            runId: context.runId,
            agent: agent.id,
            error: errorMsg,
          });
        }
      }
    }

    // --- Run sequential agents one by one ---
    for (const agent of sequentialAgents) {
      try {
        await runSingleAgent(agent, context, completedAgents, failedAgents, results, executionLog, eventPublisher);
      } catch (err: any) {
        if (!agent.optional) {
          pipelineSuccess = false;
          console.error(`[PipelineExecutor] Required agent "${agent.id}" failed: ${err.message}`);
          eventPublisher?.emit('qa:pipeline.error', {
            runId: context.runId,
            agent: agent.id,
            error: err.message,
          });
        }
      }
    }
  }

  const totalDurationMs = Date.now() - pipelineStart;

  eventPublisher?.emit('qa:pipeline.completed', {
    runId: context.runId,
    totalDurationMs,
    agentCount: selectedAgents.length,
    successCount: completedAgents.size,
    failedCount: failedAgents.size,
    success: pipelineSuccess,
  });

  console.log(
    `[PipelineExecutor] Pipeline completed in ${totalDurationMs}ms — ` +
    `${completedAgents.size}/${selectedAgents.length} agents succeeded` +
    (failedAgents.size > 0 ? `, ${failedAgents.size} failed` : ''),
  );

  return {
    results,
    selectedAgentIds: selectedIds,
    executionLog,
    totalDurationMs,
    success: pipelineSuccess,
  };
}

// ---------------------------------------------------------------------------
// Single agent runner
// ---------------------------------------------------------------------------

/**
 * Run a single agent with dependency checking, timeout, and logging.
 * Mutates completedAgents, failedAgents, results, and executionLog.
 */
async function runSingleAgent(
  agent: AgentDefinition,
  context: AgentContext,
  completedAgents: Set<string>,
  failedAgents: Set<string>,
  results: Record<string, any>,
  executionLog: ExecutionLogEntry[],
  eventPublisher?: any,
): Promise<void> {
  const startedAt = Date.now();

  // --- Dependency check ---
  if (agent.dependsOn && agent.dependsOn.length > 0) {
    for (const depId of agent.dependsOn) {
      if (failedAgents.has(depId)) {
        // Dependency failed — skip this agent
        const entry: ExecutionLogEntry = {
          agentId: agent.id,
          agentName: agent.name,
          status: 'dependency-missing',
          startedAt,
          completedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          error: `Dependency "${depId}" failed or was skipped`,
          optional: agent.optional,
          priority: agent.priority,
        };
        executionLog.push(entry);
        failedAgents.add(agent.id);

        console.log(`[PipelineExecutor] Skipping "${agent.id}" — dependency "${depId}" not available`);
        eventPublisher?.emit('qa:agent.skipped', {
          runId: context.runId,
          agent: agent.id,
          reason: `dependency "${depId}" failed`,
        });

        if (!agent.optional) {
          throw new Error(`Agent "${agent.id}" skipped: dependency "${depId}" failed`);
        }
        return;
      }

      // Dependency not yet completed (shouldn't happen with proper priority ordering,
      // but guard against misconfiguration)
      if (!completedAgents.has(depId)) {
        // Check if the dependency was simply not selected (not in the pipeline)
        // In that case, we allow the agent to proceed without that dependency's data
        console.warn(
          `[PipelineExecutor] Agent "${agent.id}" depends on "${depId}" which hasn't completed. ` +
          `It may not have been selected. Proceeding anyway.`,
        );
      }
    }
  }

  // --- Execute with timeout ---
  console.log(`[PipelineExecutor] Running "${agent.name}" (${agent.id}) [priority=${agent.priority}]`);
  eventPublisher?.emit('qa:agent.started', {
    runId: context.runId,
    agent: agent.id,
    name: agent.name,
    priority: agent.priority,
  });

  try {
    const result = await withTimeout(
      agent.invoke(context),
      agent.timeout,
      agent.name,
    );

    const completedAt = Date.now();
    const durationMs = completedAt - startedAt;

    // Store result for downstream agents
    results[agent.id] = result;
    completedAgents.add(agent.id);

    // If this is business-context, also set it on the context object
    if (agent.id === 'business-context' && result && !result.stub) {
      context.businessContext = result;
    }

    executionLog.push({
      agentId: agent.id,
      agentName: agent.name,
      status: 'success',
      startedAt,
      completedAt,
      durationMs,
      optional: agent.optional,
      priority: agent.priority,
    });

    console.log(`[PipelineExecutor] "${agent.name}" completed in ${durationMs}ms`);
    eventPublisher?.emit('qa:agent.completed', {
      runId: context.runId,
      agent: agent.id,
      durationMs,
      resultKeys: result ? Object.keys(result) : [],
    });

  } catch (err: any) {
    const completedAt = Date.now();
    const durationMs = completedAt - startedAt;
    const isTimeout = err.message?.includes('Timed out');
    const status: ExecutionStatus = isTimeout ? 'timeout' : 'failure';

    failedAgents.add(agent.id);

    // Always store a result entry for failed agents so downstream persistence can record them
    results[agent.id] = { __failed: true, status, error: err?.message || String(err), durationMs };

    executionLog.push({
      agentId: agent.id,
      agentName: agent.name,
      status,
      startedAt,
      completedAt,
      durationMs,
      error: err.message || String(err),
      optional: agent.optional,
      priority: agent.priority,
    });

    console.error(
      `[PipelineExecutor] "${agent.name}" ${status}: ${err.message} (${durationMs}ms)`,
    );
    eventPublisher?.emit('qa:agent.failed', {
      runId: context.runId,
      agent: agent.id,
      status,
      error: err.message,
      durationMs,
    });

    if (!agent.optional) {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Summarize an execution log into a human-readable report string.
 */
export function summarizeExecution(log: ExecutionLogEntry[]): string {
  const lines: string[] = ['Pipeline Execution Summary', '='.repeat(40)];

  const byStatus = { success: 0, failure: 0, timeout: 0, skipped: 0, 'dependency-missing': 0 };
  let totalMs = 0;

  for (const entry of log) {
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    totalMs += entry.durationMs;

    const statusIcon =
      entry.status === 'success' ? 'OK' :
      entry.status === 'failure' ? 'FAIL' :
      entry.status === 'timeout' ? 'TIMEOUT' :
      'SKIP';
    const optTag = entry.optional ? ' (optional)' : '';
    lines.push(
      `  [${statusIcon}] ${entry.agentName} — ${entry.durationMs}ms${optTag}` +
      (entry.error ? ` — ${entry.error}` : ''),
    );
  }

  lines.push('');
  lines.push(
    `Total: ${log.length} agents | ` +
    `${byStatus.success} succeeded, ${byStatus.failure} failed, ` +
    `${byStatus.timeout} timed out, ${byStatus.skipped + byStatus['dependency-missing']} skipped`,
  );

  return lines.join('\n');
}
