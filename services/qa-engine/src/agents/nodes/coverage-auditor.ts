import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';

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

  // Backend route files
  const backendFiles = codeFiles.filter((f: any) =>
    f.path?.match(/(route|controller|handler|api)\.(ts|js)$/i) ||
    f.path?.match(/\/(routes|controllers|handlers)\//)
  );
  const backendContext = backendFiles
    .slice(0, 15)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 2000)}\n\`\`\``)
    .join('\n\n');

  // Frontend service/API files
  const frontendFiles = codeFiles.filter((f: any) =>
    (f.path?.match(/(service|api|client|fetch|hook)\.(ts|tsx|js|jsx)$/i) ||
     f.path?.match(/\/(services|api|hooks|lib)\//)) &&
    f.content?.match(/fetch|axios|api|endpoint|url/i)
  );
  const frontendContext = frontendFiles
    .slice(0, 15)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 2000)}\n\`\`\``)
    .join('\n\n');

  // Frontend UI files that make data calls
  const uiFiles = codeFiles.filter((f: any) =>
    f.path?.match(/\.(tsx|jsx)$/) &&
    f.content?.match(/useEffect|fetch|axios|service\./i)
  );
  const uiContext = uiFiles
    .slice(0, 10)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 1500)}\n\`\`\``)
    .join('\n\n');

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'coverage-auditor',
    progress: 30,
    message: `Found ${backendFiles.length} backend route files, ${frontendFiles.length} frontend service files`,
  });

  const model = createModel({ temperature: 0.2, maxTokens: 8192 });

  const userMessage = `Cross-reference the backend API with frontend consumers to find coverage gaps.

## Repository: ${repoUrl}

## Backend Route/Controller Files (${backendFiles.length})
${backendContext}

## Frontend Service/API Files (${frontendFiles.length})
${frontendContext}

## Frontend UI Components Making Data Calls (${uiFiles.length})
${uiContext}

Find:
1. Backend endpoints with no frontend consumer
2. Frontend calls to non-existent endpoints
3. Orphaned/dead routes
4. Data shape mismatches between backend responses and frontend expectations
5. Missing CRUD operations

Respond with ONLY valid JSON, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(model, [
    new SystemMessage(COVERAGE_AUDITOR_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'coverage-auditor', eventPublisher, runId);
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
