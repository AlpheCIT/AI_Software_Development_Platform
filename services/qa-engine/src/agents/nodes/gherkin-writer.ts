/**
 * Gherkin Writer — calls DSPy visionary-agent to generate Gherkin feature files
 * from behavioral specifications produced by the Behavioral Analyst.
 */

export interface GherkinFeature {
  featureName: string;
  fileName: string;
  gherkinContent: string;
  scenarioCount: number;
  source: 'frontend' | 'backend' | 'e2e';
}

export interface GherkinWriterResult {
  features: GherkinFeature[];
  totalScenarios: number;
  totalFeatures: number;
}

export async function gherkinWriterNode(
  behavioralSpecs: any,
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<GherkinWriterResult> {
  const DSPY_URL = process.env.DSPY_URL || 'http://localhost:8010';
  const TIMEOUT = 180000; // 3 min

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'gherkin-writer',
    step: 'Generating Gherkin feature files from behavioral specs',
  });

  let features: GherkinFeature[] = [];

  try {
    eventPublisher?.emit('qa:agent.progress', {
      runId,
      agent: 'gherkin-writer',
      progress: 20,
      message: 'Converting behavioral specs to Gherkin scenarios...',
    });

    const res = await fetch(`${DSPY_URL}/analyze/gherkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frontend_specs: JSON.stringify(behavioralSpecs.frontendSpecs || {}),
        backend_specs: JSON.stringify(behavioralSpecs.backendSpecs || {}),
        synthesis: JSON.stringify(behavioralSpecs.synthesis || {}),
        audit: JSON.stringify(behavioralSpecs.audit || {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (res.ok) {
      const data = await res.json();
      features = data.features || [];
    }
  } catch (e: any) {
    console.log(`[GherkinWriter] Gherkin generation: ${e.message}`);
  }

  const totalScenarios = features.reduce((sum, f) => sum + (f.scenarioCount || 0), 0);

  const result: GherkinWriterResult = {
    features,
    totalScenarios,
    totalFeatures: features.length,
  };

  // Persist to ArangoDB
  if (dbClient) {
    try {
      await dbClient.upsertDocument('qa_gherkin_features', {
        _key: `gherkin_${runId}`,
        runId,
        repositoryId: `repo_${Buffer.from(repoUrl).toString('base64url').substring(0, 32)}`,
        features,
        totalFeatures: features.length,
        totalScenarios,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* non-fatal */
    }
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'gherkin-writer',
    result: {
      features: features.length,
      scenarios: totalScenarios,
    },
  });

  return result;
}
