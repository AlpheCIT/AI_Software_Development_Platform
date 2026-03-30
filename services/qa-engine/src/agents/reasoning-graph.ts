/**
 * reasoning-graph.ts - Persists agent reasoning chains to ArangoDB
 *
 * Collections (document): agent_sessions, agent_steps, agent_findings
 * Collections (edge): step_sequence, informed_by, spawned_by, verified_by, consolidated_into
 * Named graph: reasoning_graph
 */

// ── Collection Names ─────────────────────────────────────────────────────────

const DOC_COLLECTIONS = ['agent_sessions', 'agent_steps', 'agent_findings'] as const;
const EDGE_COLLECTIONS = [
  'step_sequence',
  'informed_by',
  'spawned_by',
  'verified_by',
  'consolidated_into',
] as const;

const GRAPH_NAME = 'reasoning_graph';

// ── Ensure Schema ────────────────────────────────────────────────────────────

let _ensured = false;

export async function ensureReasoningGraphSchema(dbClient: any): Promise<void> {
  if (_ensured) return;

  try {
    const { Database } = require('arangojs');
    const config = require('../config').qaConfig;
    const db = new Database({
      url: config.arango.url,
      databaseName: config.arango.database,
      auth: { username: config.arango.username, password: config.arango.password },
    });

    // Create document collections
    for (const name of DOC_COLLECTIONS) {
      const coll = db.collection(name);
      if (!(await coll.exists())) {
        await coll.create();
        console.log(`[ReasoningGraph] Created document collection: ${name}`);
      }
    }

    // Create edge collections
    for (const name of EDGE_COLLECTIONS) {
      const coll = db.collection(name);
      if (!(await coll.exists())) {
        await coll.create({ type: 3 }); // type 3 = edge collection
        console.log(`[ReasoningGraph] Created edge collection: ${name}`);
      }
    }

    // Create named graph if it doesn't exist
    const graph = db.graph(GRAPH_NAME);
    if (!(await graph.exists())) {
      await graph.create({
        edgeDefinitions: [
          {
            collection: 'step_sequence',
            from: ['agent_steps'],
            to: ['agent_steps'],
          },
          {
            collection: 'informed_by',
            from: ['agent_findings'],
            to: ['agent_steps'],
          },
          {
            collection: 'spawned_by',
            from: ['agent_sessions'],
            to: ['agent_sessions'],
          },
          {
            collection: 'verified_by',
            from: ['agent_findings'],
            to: ['agent_findings'],
          },
          {
            collection: 'consolidated_into',
            from: ['agent_findings'],
            to: ['agent_findings'],
          },
        ],
      });
      console.log(`[ReasoningGraph] Created named graph: ${GRAPH_NAME}`);
    }

    _ensured = true;
  } catch (err: any) {
    console.warn(`[ReasoningGraph] Schema setup warning: ${err.message}`);
    // Non-fatal: collections may already exist via another path
    _ensured = true;
  }
}

// ── createAgentSession ───────────────────────────────────────────────────────

export async function createAgentSession(dbClient: any, params: {
  runId: string;
  agentId: string;
  agentName: string;
  parentSessionId?: string;
  parentStepId?: string;
}): Promise<string> {
  await ensureReasoningGraphSchema(dbClient);

  const key = `sess_${params.runId}_${params.agentId}_${Date.now()}`;

  await dbClient.upsertDocument('agent_sessions', {
    _key: key,
    runId: params.runId,
    agentId: params.agentId,
    agentName: params.agentName,
    parentSessionId: params.parentSessionId || null,
    parentStepId: params.parentStepId || null,
    startedAt: new Date().toISOString(),
    status: 'running',
  });

  return key;
}

// ── recordStep ───────────────────────────────────────────────────────────────

export async function recordStep(dbClient: any, params: {
  sessionId: string;
  runId: string;
  stepIndex: number;
  stepName: string;
  stepType: 'observe' | 'focus' | 'analyze' | 'verify' | 'report' | 'consolidate';
  prompt: string;
  response: string;
  reasoning?: string;
  tokensUsed?: { input: number; output: number };
  durationMs: number;
  spawnedSubAgents?: string[];
}): Promise<string> {
  const key = `step_${params.sessionId}_${params.stepIndex}`;

  await dbClient.upsertDocument('agent_steps', {
    _key: key,
    sessionId: params.sessionId,
    runId: params.runId,
    stepIndex: params.stepIndex,
    stepName: params.stepName,
    stepType: params.stepType,
    prompt: params.prompt,
    response: params.response,
    reasoning: params.reasoning || null,
    tokensUsed: params.tokensUsed || null,
    durationMs: params.durationMs,
    spawnedSubAgents: params.spawnedSubAgents || [],
    completedAt: new Date().toISOString(),
  });

  // Create step_sequence edge to previous step (if not first step)
  if (params.stepIndex > 0) {
    const prevKey = `step_${params.sessionId}_${params.stepIndex - 1}`;
    try {
      await dbClient.upsertDocument('step_sequence', {
        _key: `seq_${prevKey}_${key}`,
        _from: `agent_steps/${prevKey}`,
        _to: `agent_steps/${key}`,
        runId: params.runId,
        sessionId: params.sessionId,
      });
    } catch (err: any) {
      console.warn(`[ReasoningGraph] Failed to create step_sequence edge: ${err.message}`);
    }
  }

  return key;
}

// ── recordFinding ────────────────────────────────────────────────────────────

export async function recordFinding(dbClient: any, params: {
  runId: string;
  sessionId: string;
  producedByStepId: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  evidence?: string;
  confidence: number;
  remediation?: string;
}): Promise<string> {
  const key = `finding_${params.runId}_${params.producedByStepId}_${Date.now()}`;

  await dbClient.upsertDocument('agent_findings', {
    _key: key,
    runId: params.runId,
    sessionId: params.sessionId,
    producedByStepId: params.producedByStepId,
    type: params.type,
    severity: params.severity,
    title: params.title,
    description: params.description,
    file: params.file || null,
    line: params.line || null,
    evidence: params.evidence || null,
    confidence: params.confidence,
    remediation: params.remediation || null,
    createdAt: new Date().toISOString(),
  });

  // Create informed_by edge from finding to the step that produced it
  try {
    await dbClient.upsertDocument('informed_by', {
      _key: `inf_${key}`,
      _from: `agent_findings/${key}`,
      _to: `agent_steps/${params.producedByStepId}`,
      runId: params.runId,
    });
  } catch (err: any) {
    console.warn(`[ReasoningGraph] Failed to create informed_by edge: ${err.message}`);
  }

  return key;
}

// ── recordSubAgentSpawn ──────────────────────────────────────────────────────

export async function recordSubAgentSpawn(dbClient: any, params: {
  parentSessionId: string;
  parentStepId: string;
  childSessionId: string;
}): Promise<void> {
  try {
    await dbClient.upsertDocument('spawned_by', {
      _key: `spawn_${params.childSessionId}`,
      _from: `agent_sessions/${params.childSessionId}`,
      _to: `agent_sessions/${params.parentSessionId}`,
      parentStepId: params.parentStepId,
    });
  } catch (err: any) {
    console.warn(`[ReasoningGraph] Failed to create spawned_by edge: ${err.message}`);
  }
}

// ── getReasoningChain ────────────────────────────────────────────────────────

/**
 * Traverse the reasoning graph backwards from a finding through all steps
 * and sub-agent sessions that contributed to it.
 */
export async function getReasoningChain(dbClient: any, findingId: string): Promise<any[]> {
  try {
    const cursor = await dbClient.query(
      `LET finding = DOCUMENT(CONCAT("agent_findings/", @findingId))
       LET chain = (
         FOR v, e, p IN 1..10 OUTBOUND finding
           informed_by, step_sequence, spawned_by
           OPTIONS { uniqueVertices: "global", bfs: true }
           RETURN {
             id: v._key,
             collection: PARSE_IDENTIFIER(v._id).collection,
             data: v,
             edge: e._id,
             depth: LENGTH(p.edges)
           }
       )
       RETURN {
         finding: finding,
         chain: chain
       }`,
      { findingId }
    );
    const result = await cursor.all();
    return result.length > 0 ? result[0].chain : [];
  } catch (err: any) {
    console.error(`[ReasoningGraph] Failed to get reasoning chain: ${err.message}`);
    return [];
  }
}
