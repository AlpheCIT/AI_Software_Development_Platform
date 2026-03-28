import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';
import { detectGlobalMiddleware, routeHasErrorHandling, routeHasInputValidation } from './verification-helpers.js';

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

  // Find route/controller files
  const routeFiles = codeFiles.filter((f: any) =>
    f.path?.match(/(route|controller|handler|endpoint|api|middleware)\.(ts|js)$/i) ||
    f.path?.match(/routes\//) ||
    f.path?.match(/controllers\//)
  );

  const routeContext = routeFiles
    .slice(0, 20)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 2500)}\n\`\`\``)
    .join('\n\n');

  // Find middleware files
  const middlewareFiles = codeFiles.filter((f: any) =>
    f.path?.match(/middleware/i)
  );
  const middlewareContext = middlewareFiles
    .slice(0, 5)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 1500)}\n\`\`\``)
    .join('\n\n');

  // Server entry files
  const serverFiles = codeFiles.filter((f: any) =>
    f.path?.match(/(index|server|app|main)\.(ts|js)$/) && f.content?.includes('express')
  );
  const serverContext = serverFiles
    .slice(0, 3)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 2000)}\n\`\`\``)
    .join('\n\n');

  // Detect global middleware BEFORE the LLM call to provide context
  const globalMiddleware = detectGlobalMiddleware(codeFiles);
  const globalMiddlewareContext = globalMiddleware.details.length > 0
    ? `\n## IMPORTANT: Global Middleware Detected\n${globalMiddleware.details.join('\n')}\nDO NOT report "missing rate limiting" or "missing auth" for routes already covered by these global middleware.\n`
    : '';

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'api-validator',
    progress: 25,
    message: `Found ${routeFiles.length} route files, ${middlewareFiles.length} middleware files`,
  });

  const model = createModel({ temperature: 0.2, maxTokens: 8192 });

  const userMessage = `Discover and validate all API endpoints in this codebase.

## Repository: ${repoUrl}
${globalMiddlewareContext}
## Route/Controller Files (${routeFiles.length} found)
${routeContext}

## Middleware
${middlewareContext || '(none found)'}

## Server Entry Points
${serverContext || '(none found)'}

## All Code Entities
${codeEntities.filter((e: any) => e.type === 'function' || e.type === 'method').slice(0, 60).map((e: any) => `${e.type} ${e.name} (${e.file})`).join('\n')}

Discover every API endpoint, then validate each for error handling, input validation, authentication, and security.

Respond with ONLY valid JSON, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(model, [
    new SystemMessage(API_VALIDATOR_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'api-validator', eventPublisher, runId);
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

  // Recalculate health score
  const verifiedGaps = (report.securityGaps?.length || 0) + (report.missingErrorHandling?.length || 0);
  report.apiHealthScore = Math.max(report.apiHealthScore, Math.round(100 - verifiedGaps * 4));

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
