import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';
import { extractAllRoutes, fileExistsInCodeFiles } from './verification-helpers.js';
import { extractRelationships, buildGraphContext, formatGraphContextForPrompt } from './graph-helpers.js';
import { calculateCalibratedScore, enrichFindingsWithBlastRadius } from './scoring-helpers.js';

const COVERAGE_AUDITOR_SYSTEM_PROMPT = `You are an expert at cross-referencing backend APIs with frontend consumers. Your job is to find features that exist on one side but not the other — preventing "hidden features" and "broken calls".

Analyze the codebase to find:

1. **Backend features with no frontend counterpart** — API endpoints that are implemented but have no corresponding UI or frontend service call. These represent hidden capabilities.

2. **Frontend calls to non-existent endpoints** — Frontend service files making API calls to endpoints that don't exist in the backend. These represent broken functionality.

3. **Orphaned backend routes** — Routes that are registered but whose handler functions are empty, never called, or dead code.

4. **Data shape mismatches** — Frontend expects a different response shape than what the backend sends (e.g., frontend reads \`data.items\` but backend returns \`data.results\`).

5. **Missing CRUD operations** — If backend has Create/Read but not Update/Delete, flag it. If frontend has a delete button but backend has no delete endpoint, flag it.

Output format — respond with ONLY valid JSON:
{
  "unexposedBackendFeatures": [
    {
      "endpoint": "METHOD /path",
      "file": "backend file",
      "description": "what this endpoint does",
      "suggestedUILocation": "where in the frontend this could be surfaced",
      "priority": "high|medium|low"
    }
  ],
  "brokenFrontendCalls": [
    {
      "file": "frontend file",
      "call": "the API call being made",
      "expectedEndpoint": "METHOD /path",
      "issue": "why it's broken",
      "fix": "how to fix"
    }
  ],
  "orphanedRoutes": [
    {
      "endpoint": "METHOD /path",
      "file": "backend file",
      "reason": "why it's orphaned",
      "recommendation": "remove|implement|document"
    }
  ],
  "dataShapeMismatches": [
    {
      "endpoint": "METHOD /path",
      "backendShape": "what backend sends",
      "frontendExpects": "what frontend expects",
      "files": ["affected files"],
      "fix": "how to align them"
    }
  ],
  "missingCrudOperations": [
    {
      "resource": "resource name",
      "hasCreate": true,
      "hasRead": true,
      "hasUpdate": false,
      "hasDelete": false,
      "missingOperations": ["update", "delete"],
      "priority": "high|medium|low"
    }
  ],
  "coverageScore": 0-100,
  "summary": "One-paragraph summary"
}`;

export interface CoverageAuditReport {
  unexposedBackendFeatures: Array<{
    endpoint: string;
    file: string;
    description: string;
    suggestedUILocation: string;
    priority: string;
  }>;
  brokenFrontendCalls: Array<{
    file: string;
    call: string;
    expectedEndpoint: string;
    issue: string;
    fix: string;
  }>;
  orphanedRoutes: Array<{
    endpoint: string;
    file: string;
    reason: string;
    recommendation: string;
  }>;
  dataShapeMismatches: Array<{
    endpoint: string;
    backendShape: string;
    frontendExpects: string;
    files: string[];
    fix: string;
  }>;
  missingCrudOperations: Array<{
    resource: string;
    hasCreate: boolean;
    hasRead: boolean;
    hasUpdate: boolean;
    hasDelete: boolean;
    missingOperations: string[];
    priority: string;
  }>;
  coverageScore: number;
  summary: string;
}

export async function coverageAuditorNode(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<CoverageAuditReport> {
  console.log(`[CoverageAuditor] Cross-referencing backend and frontend for ${repoUrl}`);

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'coverage-auditor',
    step: 'Cross-referencing backend API surface with frontend consumers',
  });

  // Extract business context from enriched codeFiles
  const bizContextFile = codeFiles.find((f: any) => f.path === '__business_context__');
  const businessContextPrompt = bizContextFile?.content ? `## Business Context\n${bizContextFile.content}\n` : '';

  // Build graph context
  const graphRelationships = extractRelationships(codeFiles);
  const graphContext = buildGraphContext(graphRelationships, codeFiles);
  const graphPrompt = formatGraphContextForPrompt(graphContext);

  // Build complete route inventory BEFORE the LLM call
  const allRoutes = extractAllRoutes(codeFiles);
  const routeInventory = allRoutes.map(r => `${r.method} ${r.path} (${r.file})`).join('\n');

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'coverage-auditor',
    progress: 15,
    message: `Phase A: Identifying backend route and frontend API client files from ${codeFiles.length} total files`,
  });

  // === PHASE A: File identification (lightweight) ===
  const identifyModel = createModel({ temperature: 0.2, maxTokens: 4096 });

  const allFilePaths = codeFiles
    .filter((f: any) => f.content && f.path !== '__business_context__')
    .map((f: any) => `- ${f.path} (${f.language || f.path?.split('.').pop() || 'unknown'}, ${f.size || (f.content || '').length}b)`)
    .join('\n');

  const identifyResponse = await throttledInvoke(identifyModel, [
    new SystemMessage('You are a full-stack coverage expert. Given a repo file list, identify ALL files relevant to backend-frontend coverage analysis: backend route definitions, controllers, API handlers, frontend service/API client files, frontend hooks that make HTTP calls, and UI components that fetch data. Return ONLY a JSON array of file paths. Include up to 25 files.'),
    new HumanMessage(`${businessContextPrompt}${graphPrompt}\n\nFiles:\n${allFilePaths}`),
  ], 'coverage-auditor-identify', eventPublisher, runId);

  let targetFiles: string[] = [];
  try {
    const cleaned = identifyResponse.content.toString().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    targetFiles = JSON.parse(cleaned);
  } catch {
    // Fallback: heuristic selection
    const backendFiles = codeFiles.filter((f: any) =>
      f.content && (f.path?.match(/(route|controller|handler|api)\.(ts|js)$/i) || f.path?.match(/\/(routes|controllers|handlers)\//))
    ).slice(0, 12);
    const frontendFiles = codeFiles.filter((f: any) =>
      f.content && (f.path?.match(/(service|api|client|fetch|hook)\.(ts|tsx|js|jsx)$/i) || f.path?.match(/\/(services|api|hooks|lib)\//)) &&
      f.content?.match(/fetch|axios|api|endpoint|url/i)
    ).slice(0, 13);
    targetFiles = [...backendFiles, ...frontendFiles].map((f: any) => f.path);
  }

  console.log(`[CoverageAuditor] Phase A identified ${targetFiles.length} files for deep analysis`);

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'coverage-auditor',
    progress: 35,
    message: `Phase B: Deep coverage analysis of ${targetFiles.length} identified files`,
  });

  // === PHASE B: Deep analysis with FULL file contents ===
  const deepContext = targetFiles.map((path: string) => {
    const file = codeFiles.find((f: any) => f.path === path);
    if (!file?.content) return '';
    return `### ${path}\n\`\`\`\n${file.content}\n\`\`\``;
  }).filter(Boolean).join('\n\n');

  const analyzeModel = createModel({ temperature: 0.2, maxTokens: 16384 });

  const userMessage = `Cross-reference the backend API with frontend consumers to find coverage gaps.

## Repository: ${repoUrl}

${businessContextPrompt}${graphPrompt}

## Complete Backend Route Inventory (${allRoutes.length} routes extracted programmatically)
${routeInventory || '(no routes extracted)'}

## Full Source Code for Deep Analysis
${deepContext}

Find:
1. Backend endpoints with no frontend consumer
2. Frontend calls to non-existent endpoints
3. Orphaned/dead routes
4. Data shape mismatches between backend responses and frontend expectations
5. Missing CRUD operations

IMPORTANT: Use the Complete Backend Route Inventory above as the source of truth for which endpoints exist. Do NOT report a frontend call as "broken" if the endpoint exists in the inventory.

Respond with ONLY valid JSON, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(analyzeModel, [
    new SystemMessage(COVERAGE_AUDITOR_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'coverage-auditor-analyze', eventPublisher, runId);
  const durationMs = Date.now() - startMs;

  const responseText = typeof response.content === 'string' ? response.content : '';
  if (dbClient) {
    persistConversation(dbClient, {
      runId,
      agent: 'coverage-auditor',
      systemPrompt: COVERAGE_AUDITOR_SYSTEM_PROMPT,
      userMessage,
      response: responseText,
      tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  let report: CoverageAuditReport;
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    report = JSON.parse(cleaned);
  } catch {
    console.error('[CoverageAuditor] Failed to parse response');
    report = {
      unexposedBackendFeatures: [],
      brokenFrontendCalls: [],
      orphanedRoutes: [],
      dataShapeMismatches: [],
      missingCrudOperations: [],
      coverageScore: 0,
      summary: 'Analysis failed — retry recommended',
    };
  }

  // --- PASS 2: Programmatic verification of each finding ---
  const preVerifyBrokenCalls = (report.brokenFrontendCalls || []).length;

  // Ensure arrays exist
  report.brokenFrontendCalls = report.brokenFrontendCalls || [];
  report.unexposedBackendFeatures = report.unexposedBackendFeatures || [];
  report.orphanedRoutes = report.orphanedRoutes || [];
  report.dataShapeMismatches = report.dataShapeMismatches || [];
  report.missingCrudOperations = report.missingCrudOperations || [];

  // Verify broken frontend calls against the complete route inventory
  report.brokenFrontendCalls = report.brokenFrontendCalls.filter(call => {
    const callPath = (call.expectedEndpoint || call.call || '')
      .replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '')
      .replace(/\?.*$/, '')  // strip query params
      .trim();

    if (!callPath) return true; // can't verify, keep it

    const routeExists = allRoutes.some(r => {
      const rPath = r.path.replace(/\/$/, '');
      const cPath = callPath.replace(/\/$/, '');
      // Exact match
      if (rPath === cPath) return true;
      // Substring match (handles prefix differences)
      if (rPath.includes(cPath) || cPath.includes(rPath)) return true;
      // Match ignoring /auth/ or /v2/ prefix differences
      const rSegments = rPath.split('/').filter(Boolean);
      const cSegments = cPath.split('/').filter(Boolean);
      const rLast = rSegments.slice(-2).join('/');
      const cLast = cSegments.slice(-2).join('/');
      if (rLast === cLast) return true;
      return false;
    });

    if (routeExists) {
      console.log(`[CoverageAuditor] Filtered: ${call.call || call.expectedEndpoint} - route exists in inventory`);
      return false;
    }

    // Also check: does the LLM's "expected" route literally say "not found in provided backend files"?
    // This means the LLM couldn't find it in its truncated context — likely a false positive
    if ((call.issue || '').includes('not found in provided') ||
        (call.issue || '').includes('not found in backend') ||
        (call.issue || '').includes('not found in the') ||
        (call.issue || '').includes('verify if they exist in other files')) {
      // Check if any route file in codeFiles contains this endpoint path
      const pathToCheck = callPath.split('/').pop() || callPath;
      const fileContainsRoute = codeFiles.some(f =>
        f.content && f.content.includes(pathToCheck)
      );
      if (fileContainsRoute) {
        console.log(`[CoverageAuditor] Filtered: ${callPath} - route found in codebase files`);
        return false;
      }
    }

    return true;
  });

  // Recalculate with calibrated scoring
  const allFindings = [
    ...report.brokenFrontendCalls.map(() => ({ severity: 'high' as const, confidence: 0.8, verified: true })),
    ...report.dataShapeMismatches.map(() => ({ severity: 'high' as const, confidence: 0.7, verified: true })),
    ...report.orphanedRoutes.map(() => ({ severity: 'low' as const, confidence: 0.6, verified: true })),
  ];
  const { score: calibratedScore } = calculateCalibratedScore(allFindings, codeFiles.length);
  report.coverageScore = calibratedScore;

  // Enrich findings with blast radius from graph context
  enrichFindingsWithBlastRadius(report.brokenFrontendCalls, graphContext.dependentGraph);
  enrichFindingsWithBlastRadius(report.dataShapeMismatches, graphContext.dependentGraph);

  const filteredCount = preVerifyBrokenCalls - report.brokenFrontendCalls.length;
  if (filteredCount > 0) {
    console.log(`[CoverageAuditor] Verification pass filtered ${filteredCount} false positive broken calls`);
    report.summary = `[Verified] ${report.summary} (${filteredCount} false positives removed by code verification)`;
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'coverage-auditor',
    result: {
      unexposedFeatures: report.unexposedBackendFeatures.length,
      brokenCalls: report.brokenFrontendCalls.length,
      orphanedRoutes: report.orphanedRoutes.length,
      shapeMismatches: report.dataShapeMismatches.length,
      missingCrud: report.missingCrudOperations.length,
      coverageScore: report.coverageScore,
    },
  });

  console.log(
    `[CoverageAuditor] ${report.unexposedBackendFeatures.length} unexposed features, ` +
    `${report.brokenFrontendCalls.length} broken calls. Coverage: ${report.coverageScore}/100`
  );
  return report;
}
