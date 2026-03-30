/**
 * Behavioral Analyst — calls DSPy visionary-agent for full-stack behavioral analysis.
 * Orchestrates: frontend behavioral + backend behavioral + middleware + synthesis + audit
 */

export async function behavioralAnalystNode(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<any> {
  const DSPY_URL = process.env.DSPY_URL || 'http://localhost:8010';
  const TIMEOUT = 180000; // 3 min per call

  // Pre-flight: check if DSPy service is reachable before doing any work
  try {
    const healthRes = await fetch(`${DSPY_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!healthRes.ok) throw new Error(`DSPy returned ${healthRes.status}`);
  } catch (healthErr: any) {
    throw new Error(`DSPy service not reachable at ${DSPY_URL}. Start the visionary-agent service. (${healthErr.message})`);
  }

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'behavioral-analyst',
    step: 'Mining behavioral specifications from full codebase',
  });

  // Prepare file data (full content, max 50 files for DSPy)
  const sourceFiles = codeFiles
    .filter(f => f.content && f.path !== '__business_context__')
    .slice(0, 50);

  const fileList = sourceFiles.map(f => f.path).join('\n');
  const fileContents: Record<string, string> = {};
  for (const f of sourceFiles) {
    fileContents[f.path] = (f.content || '').substring(0, 15000);
  }

  const bizContext =
    codeFiles.find(f => f.path === '__business_context__')?.content || '';

  // Extract routes from entity list
  const routes = codeEntities
    .filter(e => e.type === 'function' && e.file?.match(/route|screen|page/i))
    .map(e => `${e.name} (${e.file})`)
    .join('\n');

  let frontendSpecs = null;
  let backendSpecs = null;
  let middlewareMap = null;
  let synthesis = null;
  let audit = null;

  // 1. Frontend Behavioral Analysis
  try {
    eventPublisher?.emit('qa:agent.progress', {
      runId,
      agent: 'behavioral-analyst',
      progress: 10,
      message: 'Analyzing frontend components...',
    });
    const res = await fetch(`${DSPY_URL}/analyze/behavioral-frontend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_list: fileList,
        file_contents: fileContents,
        business_context: bizContext,
        routes,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.ok) frontendSpecs = await res.json();
  } catch (e: any) {
    console.log(`[BehavioralAnalyst] Frontend analysis: ${e.message}`);
  }

  // 2. Backend Behavioral Analysis
  try {
    eventPublisher?.emit('qa:agent.progress', {
      runId,
      agent: 'behavioral-analyst',
      progress: 30,
      message: 'Analyzing backend routes...',
    });
    const res = await fetch(`${DSPY_URL}/analyze/behavioral-backend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_list: fileList,
        file_contents: fileContents,
        business_context: bizContext,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.ok) backendSpecs = await res.json();
  } catch (e: any) {
    console.log(`[BehavioralAnalyst] Backend analysis: ${e.message}`);
  }

  // 3. Middleware Analysis
  try {
    eventPublisher?.emit('qa:agent.progress', {
      runId,
      agent: 'behavioral-analyst',
      progress: 50,
      message: 'Mapping middleware stack...',
    });
    const res = await fetch(`${DSPY_URL}/analyze/middleware`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_list: fileList,
        file_contents: fileContents,
        business_context: bizContext,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.ok) middlewareMap = await res.json();
  } catch (e: any) {
    console.log(`[BehavioralAnalyst] Middleware analysis: ${e.message}`);
  }

  // 4. Full Stack Synthesis (needs frontend + backend)
  if (frontendSpecs && backendSpecs) {
    try {
      eventPublisher?.emit('qa:agent.progress', {
        runId,
        agent: 'behavioral-analyst',
        progress: 70,
        message: 'Synthesizing end-to-end flows...',
      });
      const res = await fetch(`${DSPY_URL}/analyze/synthesis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontend_specs: JSON.stringify(frontendSpecs),
          backend_specs: JSON.stringify(backendSpecs),
          middleware_map: JSON.stringify(middlewareMap || {}),
          business_context: bizContext,
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.ok) synthesis = await res.json();
    } catch (e: any) {
      console.log(`[BehavioralAnalyst] Synthesis: ${e.message}`);
    }
  }

  // 5. Full Stack Audit (finds mismatches)
  if (frontendSpecs && backendSpecs) {
    try {
      eventPublisher?.emit('qa:agent.progress', {
        runId,
        agent: 'behavioral-analyst',
        progress: 85,
        message: 'Auditing full-stack integration...',
      });
      const res = await fetch(`${DSPY_URL}/analyze/fullstack-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontend_specs: JSON.stringify(frontendSpecs),
          backend_specs: JSON.stringify(backendSpecs),
          middleware_map: JSON.stringify(middlewareMap || {}),
          end_to_end_flows: JSON.stringify((synthesis as any)?.flows || []),
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.ok) audit = await res.json();
    } catch (e: any) {
      console.log(`[BehavioralAnalyst] Audit: ${e.message}`);
    }
  }

  const result = { frontendSpecs, backendSpecs, middlewareMap, synthesis, audit };

  // Persist to ArangoDB
  if (dbClient) {
    try {
      await dbClient.upsertDocument('qa_behavioral_specs', {
        _key: `behavior_${runId}`,
        runId,
        repositoryId: `repo_${Buffer.from(repoUrl).toString('base64url').substring(0, 32)}`,
        frontendSpecs,
        backendSpecs,
        middlewareMap,
        synthesis,
        audit,
        totalScreens: frontendSpecs?.specs?.length || 0,
        totalEndpoints: backendSpecs?.specs?.length || 0,
        totalFlows: synthesis?.flows?.length || 0,
        totalMismatches: audit?.mismatches?.length || 0,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* non-fatal */
    }
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'behavioral-analyst',
    result: {
      screens: frontendSpecs?.specs?.length || 0,
      endpoints: backendSpecs?.specs?.length || 0,
      flows: synthesis?.flows?.length || 0,
      mismatches: audit?.mismatches?.length || 0,
    },
  });

  return result;
}
