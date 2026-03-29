/**
 * Change Tracker — compares current behavioral specs against the previous run's specs
 * stored in ArangoDB, then calls DSPy to produce a structured change report.
 */

export interface BehaviorChange {
  area: string;
  changeType: 'added' | 'removed' | 'modified';
  description: string;
  impact: 'high' | 'medium' | 'low';
  affectedFlows: string[];
}

export interface ChangeTrackerResult {
  changes: BehaviorChange[];
  totalChanges: number;
  regressionRisks: string[];
  previousRunId?: string;
}

export async function changeTrackerNode(
  currentSpecs: any,
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<ChangeTrackerResult> {
  const DSPY_URL = process.env.DSPY_URL || 'http://localhost:8010';
  const TIMEOUT = 180000; // 3 min

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'change-tracker',
    step: 'Comparing behavioral specs against previous run',
  });

  let changes: BehaviorChange[] = [];
  let regressionRisks: string[] = [];
  let previousRunId: string | undefined;

  // Fetch previous run's specs from ArangoDB
  let previousSpecs: any = null;
  if (dbClient) {
    try {
      const repoId = `repo_${Buffer.from(repoUrl).toString('base64url').substring(0, 32)}`;
      // Query for the most recent behavioral spec for this repo that isn't the current run
      const query = `
        FOR doc IN qa_behavioral_specs
          FILTER doc.repositoryId == @repoId AND doc.runId != @currentRunId
          SORT doc.createdAt DESC
          LIMIT 1
          RETURN doc
      `;
      const result = await dbClient.query(query, { repoId, currentRunId: runId });
      const docs = await result.all?.() || result;
      if (Array.isArray(docs) && docs.length > 0) {
        previousSpecs = docs[0];
        previousRunId = previousSpecs.runId;
      }
    } catch (e: any) {
      console.log(`[ChangeTracker] Could not fetch previous specs: ${e.message}`);
    }
  }

  // If we have both current and previous, call DSPy for change analysis
  if (currentSpecs && previousSpecs) {
    try {
      eventPublisher?.emit('qa:agent.progress', {
        runId,
        agent: 'change-tracker',
        progress: 40,
        message: `Comparing with previous run ${previousRunId}...`,
      });

      const res = await fetch(`${DSPY_URL}/analyze/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_frontend: JSON.stringify(currentSpecs.frontendSpecs || {}),
          current_backend: JSON.stringify(currentSpecs.backendSpecs || {}),
          current_flows: JSON.stringify(currentSpecs.synthesis?.flows || []),
          previous_frontend: JSON.stringify(previousSpecs.frontendSpecs || {}),
          previous_backend: JSON.stringify(previousSpecs.backendSpecs || {}),
          previous_flows: JSON.stringify(previousSpecs.synthesis?.flows || []),
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      });

      if (res.ok) {
        const data = await res.json();
        changes = data.changes || [];
        regressionRisks = data.regression_risks || [];
      }
    } catch (e: any) {
      console.log(`[ChangeTracker] Change analysis: ${e.message}`);
    }
  } else if (!previousSpecs) {
    console.log('[ChangeTracker] No previous run found — this is the baseline run');
  }

  const result: ChangeTrackerResult = {
    changes,
    totalChanges: changes.length,
    regressionRisks,
    previousRunId,
  };

  // Persist to ArangoDB
  if (dbClient) {
    try {
      await dbClient.upsertDocument('qa_behavior_changes', {
        _key: `changes_${runId}`,
        runId,
        repositoryId: `repo_${Buffer.from(repoUrl).toString('base64url').substring(0, 32)}`,
        previousRunId: previousRunId || null,
        changes,
        totalChanges: changes.length,
        regressionRisks,
        isBaselineRun: !previousSpecs,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* non-fatal */
    }
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'change-tracker',
    result: {
      changes: changes.length,
      regressionRisks: regressionRisks.length,
      isBaseline: !previousSpecs,
    },
  });

  return result;
}
