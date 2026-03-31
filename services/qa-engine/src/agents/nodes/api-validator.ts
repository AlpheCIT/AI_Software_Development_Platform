import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';
import { isDSPyAvailable, callDSPyExpert, handleSubAgents } from '../dspy-client.js';
import { detectGlobalMiddleware, routeHasErrorHandling, routeHasInputValidation } from './verification-helpers.js';
import { extractRelationships, buildGraphContext, formatGraphContextForPrompt } from './graph-helpers.js';
import { calculateCalibratedScore, enrichFindingsWithBlastRadius } from './scoring-helpers.js';

const API_VALIDATOR_SYSTEM_PROMPT = `You are an API security and reliability expert. Your job is to discover all API routes from a codebase and validate them for correctness, security, and completeness.

Analyze the codebase for:

1. **Route Discovery** — Find ALL API endpoints (Express routes, controller methods, etc.)
2. **Error Handling** — Are endpoints wrapped in try/catch? Do they return proper error codes?
3. **Input Validation** — Are request bodies/params validated before use?
4. **Authentication/Authorization** — Are protected routes actually checking auth?
5. **CORS Configuration** — Is CORS properly configured?
6. **Rate Limiting** — Are public endpoints rate-limited?
7. **Schema Consistency** — Do request/response shapes match documentation or types?
8. **Missing Endpoints** — Are there route handlers that reference non-existent controllers?

Output format — respond with ONLY valid JSON:
{
  "endpoints": [
    {
      "method": "GET|POST|PUT|DELETE|PATCH",
      "path": "/api/endpoint",
      "file": "path/to/file",
      "handler": "function name",
      "hasErrorHandling": true,
      "hasInputValidation": true,
      "hasAuth": true,
      "hasRateLimiting": false,
      "issues": ["issue1", "issue2"]
    }
  ],
  "missingErrorHandling": [
    {
      "endpoint": "METHOD /path",
      "file": "path/to/file",
      "severity": "critical|high|medium|low",
      "fix": "how to fix"
    }
  ],
  "schemaIssues": [
    {
      "endpoint": "METHOD /path",
      "issue": "description",
      "severity": "critical|high|medium|low",
      "fix": "how to fix"
    }
  ],
  "securityGaps": [
    {
      "type": "missing-auth|missing-validation|missing-rate-limit|cors-misconfigured|injection-risk",
      "endpoint": "METHOD /path",
      "description": "what's wrong",
      "severity": "critical|high|medium|low",
      "fix": "how to fix"
    }
  ],
  "apiHealthScore": 0-100,
  "summary": "One-paragraph summary"
}`;

export interface APIValidationReport {
  endpoints: Array<{
    method: string;
    path: string;
    file: string;
    handler: string;
    hasErrorHandling: boolean;
    hasInputValidation: boolean;
    hasAuth: boolean;
    hasRateLimiting: boolean;
    issues: string[];
  }>;
  missingErrorHandling: Array<{
    endpoint: string;
    file: string;
    severity: string;
    fix: string;
  }>;
  schemaIssues: Array<{
    endpoint: string;
    issue: string;
    severity: string;
    fix: string;
  }>;
  securityGaps: Array<{
    type: string;
    endpoint: string;
    description: string;
    severity: string;
    fix: string;
  }>;
  apiHealthScore: number;
  summary: string;
}

export async function apiValidatorNode(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<APIValidationReport> {
  console.log(`[APIValidator] Validating API endpoints for ${repoUrl}`);

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'api-validator',
    step: 'Discovering and validating all API endpoints',
  });

  // Extract business context from enriched codeFiles
  const bizContextFile = codeFiles.find((f: any) => f.path === '__business_context__');
  const businessContextPrompt = bizContextFile?.content ? `## Business Context\n${bizContextFile.content}\n` : '';

  // Build graph context
  const graphRelationships = extractRelationships(codeFiles);
  const graphContext = buildGraphContext(graphRelationships, codeFiles);
  const graphPrompt = formatGraphContextForPrompt(graphContext);

  // Detect global middleware BEFORE the LLM call to provide context
  const globalMiddleware = detectGlobalMiddleware(codeFiles);
  const globalMiddlewareContext = globalMiddleware.details.length > 0
    ? `\n## IMPORTANT: Global Middleware Detected\n${globalMiddleware.details.join('\n')}\nDO NOT report "missing rate limiting" or "missing auth" for routes already covered by these global middleware.\n`
    : '';

  // === DSPy Expert Chain Path ===
  if (dbClient) {
    try {
      const dspyAvailable = await isDSPyAvailable();
      if (dspyAvailable) {
        console.log('[APIValidator] DSPy available — using Backend Expert chain');
        eventPublisher?.emit('qa:agent.progress', {
          runId, agent: 'api-validator', progress: 10,
          message: 'Using DSPy Backend Expert chain for multi-step analysis',
        });

        const sourceContext = codeFiles
          .filter((f: any) => f.content && f.path !== '__business_context__')
          .slice(0, 30)
          .map((f: any) => `### ${f.path}\n${f.content}`)
          .join('\n\n');

        const dspyResult = await callDSPyExpert(
          '/analyze/backend-expert',
          sourceContext,
          dbClient, runId, 'api-validator', 'API Validator (DSPy)',
          eventPublisher
        );

        // Handle sub-agents if requested
        if (dspyResult.subAgentsNeeded.length > 0) {
          const lastStepIndex = dspyResult.steps.length - 1;
          const sessionId = `sess_${runId}_api-validator_${Date.now()}`;
          const parentStepId = `step_${sessionId}_${lastStepIndex}`;

          const subResults = await handleSubAgents(
            dspyResult.subAgentsNeeded, sourceContext,
            dbClient, runId, sessionId, parentStepId, eventPublisher
          );
          if (dspyResult.report) dspyResult.report._subAgentResults = subResults;
        }

        // Map DSPy report to APIValidationReport format
        let dspyReport = dspyResult.report || {};
        if (typeof dspyReport === 'string') {
          try { dspyReport = JSON.parse(dspyReport); } catch { dspyReport = {}; }
        }
        if (dspyReport.error) {
          throw new Error(`DSPy returned error: ${dspyReport.error}`);
        }
        const report: APIValidationReport = {
          endpoints: dspyReport.endpoints || [],
          missingErrorHandling: dspyReport.missingErrorHandling || dspyReport.missing_error_handling || [],
          schemaIssues: dspyReport.schemaIssues || dspyReport.schema_issues || [],
          securityGaps: dspyReport.securityGaps || dspyReport.security_gaps || [],
          apiHealthScore: dspyReport.apiHealthScore ?? dspyReport.api_health_score ?? null,
          summary: dspyReport.summary || `DSPy analysis completed (${dspyResult.steps.length} steps)`,
        };

        // Programmatic verification on DSPy results
        report.securityGaps = (report.securityGaps || []).filter(gap => {
          if (gap.type === 'missing-rate-limit' && globalMiddleware.hasRateLimiting) return false;
          if (gap.type === 'missing-auth' && (globalMiddleware.hasAuth || globalMiddleware.hasRouterAuth)) return false;
          if (gap.type === 'missing-validation' || gap.type === 'injection-risk') {
            const hasValidation = routeHasInputValidation(codeFiles, (gap as any).file || '', gap.endpoint || '');
            if (hasValidation) return false;
          }
          return true;
        });

        report.missingErrorHandling = (report.missingErrorHandling || []).filter(item => {
          return !routeHasErrorHandling(codeFiles, item.file || '', item.endpoint || '');
        });

        // Recalculate calibrated score
        const allFindings = [
          ...report.securityGaps.map((g: any) => ({ severity: g.severity || 'medium', confidence: 0.8, verified: true })),
          ...report.missingErrorHandling.map((g: any) => ({ severity: g.severity || 'medium', confidence: 0.7, verified: true })),
          ...report.schemaIssues.map((g: any) => ({ severity: g.severity || 'medium', confidence: 0.6, verified: true })),
        ];
        let calibratedResult = calculateCalibratedScore(allFindings, codeFiles.length);

        // Blend with DSPy chain's own score when it provides a more conservative assessment
        const dspyScore = dspyReport?.apiHealthScore ?? dspyReport?.api_health_score ?? dspyReport?.healthScore ?? dspyReport?.health_score;
        if (typeof dspyScore === 'number' && dspyScore > 0 && dspyScore < calibratedResult.score) {
          calibratedResult = {
            ...calibratedResult,
            score: Math.round(calibratedResult.score * 0.4 + dspyScore * 0.6),
          };
          // Re-derive grade from blended score
          calibratedResult.grade = calibratedResult.score >= 90 ? 'A' : calibratedResult.score >= 75 ? 'B' : calibratedResult.score >= 60 ? 'C' : calibratedResult.score >= 40 ? 'D' : 'F';
        }

        report.apiHealthScore = calibratedResult.score;

        enrichFindingsWithBlastRadius(report.securityGaps, graphContext.dependentGraph);
        enrichFindingsWithBlastRadius(report.missingErrorHandling, graphContext.dependentGraph);

        eventPublisher?.emit('qa:agent.completed', {
          runId, agent: 'api-validator',
          result: {
            endpointsFound: report.endpoints.length,
            missingErrorHandling: report.missingErrorHandling.length,
            schemaIssues: report.schemaIssues.length,
            securityGaps: report.securityGaps.length,
            criticalSecurityGaps: report.securityGaps.filter(g => g.severity === 'critical').length,
            apiHealthScore: report.apiHealthScore, source: 'dspy',
          },
        });

        console.log(`[APIValidator] DSPy: Found ${report.endpoints.length} endpoints, ${report.securityGaps.length} security gaps. API Health: ${report.apiHealthScore}/100`);
        return report;
      }
    } catch (dspyErr) {
      console.warn(`[APIValidator] DSPy call failed, falling back to direct LLM: ${(dspyErr as Error).message}`);
    }
  }

  // === Fallback: Direct LLM Call (original logic) ===
  console.log('[APIValidator] Using direct LLM call (DSPy unavailable)');

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'api-validator',
    progress: 15,
    message: `Phase A: Identifying route, middleware, and auth files from ${codeFiles.length} total files`,
  });

  // === PHASE A: File identification (lightweight) ===
  const identifyModel = createModel({ temperature: 0.2, maxTokens: 4096 });

  const allFilePaths = codeFiles
    .filter((f: any) => f.content && f.path !== '__business_context__')
    .map((f: any) => `- ${f.path} (${f.language || f.path?.split('.').pop() || 'unknown'}, ${f.size || (f.content || '').length}b)`)
    .join('\n');

  const identifyResponse = await throttledInvoke(identifyModel, [
    new SystemMessage('You are an API security expert. Given a repo file list, identify which 20 files are most relevant for API validation: route definitions, controllers, middleware, authentication, authorization, validation schemas, server entry points, and CORS configuration. Return ONLY a JSON array of file paths.'),
    new HumanMessage(`${businessContextPrompt}${graphPrompt}\n${globalMiddlewareContext}\n\nFiles:\n${allFilePaths}`),
  ], 'api-validator-identify', eventPublisher, runId);

  let targetFiles: string[] = [];
  try {
    const cleaned = identifyResponse.content.toString().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    targetFiles = JSON.parse(cleaned);
  } catch {
    // Fallback: heuristic selection of route/middleware/server files
    targetFiles = codeFiles
      .filter((f: any) => f.content && (
        f.path?.match(/(route|controller|handler|endpoint|api|middleware|auth|server|app|index)\.(ts|js)$/i) ||
        f.path?.match(/(routes|controllers|handlers|middleware)\//)
      ))
      .slice(0, 20)
      .map((f: any) => f.path);
  }

  console.log(`[APIValidator] Phase A identified ${targetFiles.length} files for deep analysis`);

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'api-validator',
    progress: 35,
    message: `Phase B: Deep API validation of ${targetFiles.length} identified files`,
  });

  // === PHASE B: Deep analysis with FULL file contents ===
  const deepContext = targetFiles.map((path: string) => {
    const file = codeFiles.find((f: any) => f.path === path);
    if (!file?.content) return '';
    return `### ${path}\n\`\`\`\n${file.content}\n\`\`\``;
  }).filter(Boolean).join('\n\n');

  const analyzeModel = createModel({ temperature: 0.2, maxTokens: 16384 });

  const userMessage = `Discover and validate all API endpoints in this codebase.

## Repository: ${repoUrl}

${businessContextPrompt}${graphPrompt}
${globalMiddlewareContext}

## Full Source Code for Deep Analysis
${deepContext}

## All Code Entities
${codeEntities.filter((e: any) => e.type === 'function' || e.type === 'method').slice(0, 60).map((e: any) => `${e.type} ${e.name} (${e.file})`).join('\n')}

Discover every API endpoint, then validate each for error handling, input validation, authentication, and security.

Respond with ONLY valid JSON, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(analyzeModel, [
    new SystemMessage(API_VALIDATOR_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'api-validator-analyze', eventPublisher, runId);
  const durationMs = Date.now() - startMs;

  const responseText = typeof response.content === 'string' ? response.content : '';
  if (dbClient) {
    persistConversation(dbClient, {
      runId,
      agent: 'api-validator',
      systemPrompt: API_VALIDATOR_SYSTEM_PROMPT,
      userMessage,
      response: responseText,
      tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  let report: APIValidationReport;
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    report = JSON.parse(cleaned);
  } catch {
    console.error('[APIValidator] Failed to parse response');
    report = {
      endpoints: [],
      missingErrorHandling: [],
      schemaIssues: [],
      securityGaps: [],
      apiHealthScore: 0,
      summary: 'Analysis failed — retry recommended',
    };
  }

  // --- PASS 2: Programmatic verification of each finding ---
  const preVerifyCount = {
    securityGaps: (report.securityGaps || []).length,
    missingErrorHandling: (report.missingErrorHandling || []).length,
  };

  // Ensure arrays exist
  report.securityGaps = report.securityGaps || [];
  report.missingErrorHandling = report.missingErrorHandling || [];
  report.endpoints = report.endpoints || [];
  report.schemaIssues = report.schemaIssues || [];

  // Verify security gaps
  report.securityGaps = report.securityGaps.filter(gap => {
    // Missing rate limiting? But global rate limiter exists
    if (gap.type === 'missing-rate-limit' && globalMiddleware.hasRateLimiting) {
      console.log(`[APIValidator] Filtered: ${gap.endpoint} - global rate limiting exists`);
      return false;
    }
    // Missing auth? Check if route or parent router has auth
    if (gap.type === 'missing-auth' && (globalMiddleware.hasAuth || globalMiddleware.hasRouterAuth)) {
      console.log(`[APIValidator] Filtered: ${gap.endpoint} - global/router auth middleware exists`);
      return false;
    }
    // Input validation / injection risk? Check the actual file
    if (gap.type === 'missing-validation' || gap.type === 'injection-risk') {
      const hasValidation = routeHasInputValidation(codeFiles, (gap as any).file || '', gap.endpoint || '');
      if (hasValidation) {
        console.log(`[APIValidator] Filtered: ${gap.endpoint} - input validation exists`);
        return false;
      }
    }
    return true;
  });

  // Verify missing error handling
  report.missingErrorHandling = report.missingErrorHandling.filter(item => {
    const hasHandling = routeHasErrorHandling(codeFiles, item.file || '', item.endpoint || '');
    if (hasHandling) {
      console.log(`[APIValidator] Filtered: ${item.endpoint} - error handling exists`);
      return false;
    }
    return true;
  });

  // Recalculate health score with calibrated scoring
  const allFindings = [
    ...report.securityGaps.map((g: any) => ({ severity: g.severity || 'medium', confidence: 0.8, verified: true })),
    ...report.missingErrorHandling.map((g: any) => ({ severity: g.severity || 'medium', confidence: 0.7, verified: true })),
    ...report.schemaIssues.map((g: any) => ({ severity: g.severity || 'medium', confidence: 0.6, verified: true })),
  ];
  const { score: calibratedScore } = calculateCalibratedScore(allFindings, codeFiles.length);
  report.apiHealthScore = calibratedScore;

  // Enrich findings with blast radius from graph context
  enrichFindingsWithBlastRadius(report.securityGaps, graphContext.dependentGraph);
  enrichFindingsWithBlastRadius(report.missingErrorHandling, graphContext.dependentGraph);

  const filteredCount =
    (preVerifyCount.securityGaps - report.securityGaps.length) +
    (preVerifyCount.missingErrorHandling - report.missingErrorHandling.length);
  if (filteredCount > 0) {
    console.log(`[APIValidator] Verification pass filtered ${filteredCount} false positives`);
    report.summary = `[Verified] ${report.summary} (${filteredCount} false positives removed by code verification)`;
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'api-validator',
    result: {
      endpointsFound: report.endpoints.length,
      missingErrorHandling: report.missingErrorHandling.length,
      schemaIssues: report.schemaIssues.length,
      securityGaps: report.securityGaps.length,
      criticalSecurityGaps: report.securityGaps.filter(g => g.severity === 'critical').length,
      apiHealthScore: report.apiHealthScore,
    },
  });

  console.log(`[APIValidator] Found ${report.endpoints.length} endpoints, ${report.securityGaps.length} security gaps. API Health: ${report.apiHealthScore}/100`);
  return report;
}
