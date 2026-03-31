import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { throttledInvoke, createModel } from '../llm-throttle';

const BUSINESS_CONTEXT_PROMPT = `You are an expert software architect. Analyze this codebase and determine:

1. **Application Type**: What kind of software is this? (e-commerce, SaaS, manufacturing system, internal tool, API service, mobile app, etc.)
2. **Business Domains**: What are the key business areas? (authentication, payments, scheduling, inventory, reporting, etc.)
3. **Critical User Flows**: What are the 3-5 most important user journeys? (e.g., "User logs in -> scans badge -> gets assigned to production line -> tracks job progress")
4. **Tech Stack**: What frameworks, databases, and key libraries are used?
5. **Architecture Pattern**: Monolith, microservices, serverless, etc.?

Output ONLY valid JSON:
{
  "appType": "Manufacturing Execution System (MES)",
  "businessDomains": ["badge-based authentication", "job tracking", "production scheduling"],
  "criticalFlows": ["Badge scan -> worker authentication -> line assignment"],
  "techStack": ["Express.js", "React", "SQLite/SQL Server"],
  "architecturePattern": "Monolith with PWA clients",
  "summary": "A manufacturing execution system that tracks jobs through production with badge-based worker authentication, production scheduling, and real-time floor monitoring via kiosk and patrol PWA apps."
}`;

export interface BusinessContext {
  appType: string;
  businessDomains: string[];
  criticalFlows: string[];
  techStack: string[];
  architecturePattern?: string;
  summary: string;
}

export async function businessContextAnalyzerNode(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<BusinessContext> {
  console.log(`[BusinessContext] Analyzing business context for ${repoUrl}`);

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'business-context',
    step: 'Discovering application type, business domains, and critical flows',
  });

  const model = createModel();

  // Gather key context files
  const readme = codeFiles.find((f: any) => f.path?.match(/readme/i))?.content || '';
  const packageJsons = codeFiles
    .filter((f: any) => f.path?.endsWith('package.json'))
    .slice(0, 3)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 3000)}`)
    .join('\n\n');

  // Main entry files (app.js, index.js, server.js, main.tsx)
  const entryFiles = codeFiles
    .filter((f: any) => f.path?.match(/(^|\/)((app|index|server|main)\.(ts|tsx|js|jsx))$/))
    .slice(0, 5)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 2000)}`)
    .join('\n\n');

  // Directory structure
  const dirStructure = Array.from(new Set(codeFiles.map((f: any) => {
    const parts = f.path.split('/');
    return parts.length > 1 ? parts.slice(0, 2).join('/') : parts[0];
  }))).sort().join('\n');

  // Route files for understanding API surface
  const routeFiles = codeFiles
    .filter((f: any) => f.path?.match(/(route|controller|handler|api)\.(ts|js)$/i) || f.path?.match(/routes\//))
    .slice(0, 10)
    .map((f: any) => `- ${f.path}`)
    .join('\n');

  const userMessage = `## Repository: ${repoUrl}

## README
${readme.substring(0, 3000) || '(no README found)'}

## Package Files
${packageJsons || '(none found)'}

## Entry Points
${entryFiles || '(none found)'}

## Directory Structure
${dirStructure}

## API Routes/Controllers
${routeFiles || '(none found)'}

## Code Entities (sample)
${codeEntities.slice(0, 50).map((e: any) => `${e.type} ${e.name} (${e.file})`).join('\n')}

Analyze and respond with ONLY valid JSON.`;

  try {
    const response = await throttledInvoke(model, [
      new SystemMessage(BUSINESS_CONTEXT_PROMPT),
      new HumanMessage(userMessage),
    ], 'business-context', eventPublisher, runId);

    const responseText = typeof response.content === 'string' ? response.content : '';
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const context: BusinessContext = JSON.parse(cleaned);

    console.log(`[BusinessContext] Identified: ${context.appType} with ${context.businessDomains?.length || 0} domains`);

    eventPublisher?.emit('qa:agent.completed', {
      runId,
      agent: 'business-context',
      result: { appType: context.appType, domains: context.businessDomains?.length || 0 },
    });

    return context;
  } catch (error) {
    console.error('[BusinessContext] Failed:', error);
    return {
      appType: 'Unknown',
      businessDomains: [],
      criticalFlows: [],
      techStack: [],
      summary: 'Business context analysis failed',
    };
  }
}
