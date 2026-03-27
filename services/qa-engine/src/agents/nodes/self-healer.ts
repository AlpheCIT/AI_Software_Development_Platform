import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';

const SELF_HEALER_SYSTEM_PROMPT = `You are an expert static analysis engineer specializing in detecting subtle cross-file issues that linters and compilers miss. Your focus is on finding bugs that only manifest at runtime or integration time.

Analyze the codebase for:

1. **Type Mismatches Across File Boundaries**
   - A function returns \`{ id: string }\` but the caller expects \`{ _key: string }\`
   - Interface changes that haven't propagated to all consumers
   - Generic type parameters that silently resolve to \`any\`

2. **Broken Imports**
   - Importing a named export that was renamed or removed
   - Circular dependency chains that cause undefined at runtime
   - Default vs named export mismatches

3. **Package.json vs Actual Imports**
   - Packages imported in code but missing from dependencies
   - Packages in dependencies but never imported (dead deps)
   - Version conflicts between workspace packages

4. **Environment Variable Issues**
   - \`.env\` references in code that aren't defined in any env file
   - Env vars used but without fallback defaults
   - Mismatched env var names across services

5. **Config Inconsistencies**
   - Port numbers that don't match between services
   - URL paths that reference non-existent endpoints
   - Schema definitions that diverge from actual data shapes

For EACH issue found, provide a specific auto-fix suggestion.

Output format — respond with ONLY valid JSON:
{
  "typeMismatches": [
    {
      "file": "path/to/file",
      "line": "approximate line",
      "expected": "what the code expects",
      "actual": "what it actually gets",
      "severity": "critical|high|medium|low",
      "fix": "specific code change to fix this"
    }
  ],
  "brokenImports": [
    {
      "file": "path/to/file",
      "importStatement": "the problematic import",
      "issue": "what's wrong",
      "severity": "critical|high|medium|low",
      "fix": "how to fix"
    }
  ],
  "missingDeps": [
    {
      "package": "package-name",
      "usedIn": ["files using it"],
      "inPackageJson": false,
      "fix": "npm install package-name"
    }
  ],
  "configIssues": [
    {
      "type": "env-var|port-mismatch|url-mismatch|schema-drift",
      "description": "what's wrong",
      "files": ["affected files"],
      "severity": "critical|high|medium|low",
      "fix": "how to fix"
    }
  ],
  "autoFixes": [
    {
      "title": "Fix title",
      "description": "What this fix does",
      "files": ["files to modify"],
      "changes": "Specific code changes",
      "confidence": "high|medium|low",
      "breakingRisk": "none|low|medium|high"
    }
  ],
  "healthScore": 0-100,
  "summary": "One-paragraph summary of findings"
}`;

export interface SelfHealingReport {
  typeMismatches: Array<{
    file: string;
    line: string;
    expected: string;
    actual: string;
    severity: string;
    fix: string;
  }>;
  brokenImports: Array<{
    file: string;
    importStatement: string;
    issue: string;
    severity: string;
    fix: string;
  }>;
  missingDeps: Array<{
    package: string;
    usedIn: string[];
    inPackageJson: boolean;
    fix: string;
  }>;
  configIssues: Array<{
    type: string;
    description: string;
    files: string[];
    severity: string;
    fix: string;
  }>;
  autoFixes: Array<{
    title: string;
    description: string;
    files: string[];
    changes: string;
    confidence: string;
    breakingRisk: string;
  }>;
  healthScore: number;
  summary: string;
}

export async function selfHealerNode(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<SelfHealingReport> {
  console.log(`[SelfHealer] Scanning ${repoUrl} for cross-file issues`);

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'self-healer',
    step: 'Detecting type mismatches, broken imports, and config issues across files',
  });

  // Gather imports and exports from code files
  const importExportSummary = codeFiles
    .filter((f: any) => f.content && f.path?.match(/\.(ts|tsx|js|jsx)$/))
    .slice(0, 30)
    .map((f: any) => {
      const imports = (f.content.match(/^import\s.+/gm) || []).join('\n');
      const exports = (f.content.match(/^export\s.+/gm) || []).join('\n');
      return `### ${f.path}\nImports:\n${imports || '(none)'}\nExports:\n${exports || '(none)'}`;
    })
    .join('\n\n');

  // Package.json analysis
  const packageFiles = codeFiles.filter((f: any) => f.path?.endsWith('package.json'));
  const packageContext = packageFiles
    .slice(0, 5)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 2000)}`)
    .join('\n\n');

  // Env files
  const envFiles = codeFiles.filter((f: any) => f.path?.match(/\.env/));
  const envContext = envFiles
    .slice(0, 5)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 1000)}`)
    .join('\n\n');

  // Config files
  const configFiles = codeFiles.filter((f: any) => f.path?.match(/config\.(ts|js|json)$/));
  const configContext = configFiles
    .slice(0, 10)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 1500)}`)
    .join('\n\n');

  // Sample code for deeper analysis
  const sampleCode = codeFiles
    .filter((f: any) => f.content && f.path?.match(/\.(ts|tsx|js|jsx)$/))
    .slice(0, 20)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 1500)}\n\`\`\``)
    .join('\n\n');

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'self-healer',
    progress: 30,
    message: `Analyzing imports/exports across ${codeFiles.length} files`,
  });

  const model = createModel({ temperature: 0.2, maxTokens: 8192 });

  const userMessage = `Detect cross-file issues in this codebase that compilers and linters miss.

## Repository: ${repoUrl}
Total files: ${codeFiles.length}
Total entities: ${codeEntities.length}

## Imports & Exports (all .ts/.tsx/.js/.jsx files)
${importExportSummary}

## Package Files
${packageContext}

## Environment Files
${envContext}

## Config Files
${configContext}

## Source Code Samples
${sampleCode}

## Entities
${codeEntities.slice(0, 80).map((e: any) => `${e.type} ${e.name} (${e.file})`).join('\n')}

Find type mismatches, broken imports, missing dependencies, and config inconsistencies.
For each issue, provide a specific fix.

Respond with ONLY valid JSON, no markdown fencing.`;

  eventPublisher?.emit('qa:agent.streaming', {
    runId,
    agent: 'self-healer',
    text: 'Sending to Claude for cross-file analysis...',
  });

  const startMs = Date.now();
  const response = await throttledInvoke(model, [
    new SystemMessage(SELF_HEALER_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'self-healer', eventPublisher, runId);
  const durationMs = Date.now() - startMs;

  const responseText = typeof response.content === 'string' ? response.content : '';
  if (dbClient) {
    persistConversation(dbClient, {
      runId,
      agent: 'self-healer',
      systemPrompt: SELF_HEALER_SYSTEM_PROMPT,
      userMessage,
      response: responseText,
      tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  let report: SelfHealingReport;
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    report = JSON.parse(cleaned);
  } catch {
    console.error('[SelfHealer] Failed to parse response');
    report = {
      typeMismatches: [],
      brokenImports: [],
      missingDeps: [],
      configIssues: [],
      autoFixes: [],
      healthScore: 0,
      summary: 'Analysis failed — retry recommended',
    };
  }

  const totalIssues = report.typeMismatches.length + report.brokenImports.length +
    report.missingDeps.length + report.configIssues.length;

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'self-healer',
    result: {
      totalIssues,
      typeMismatches: report.typeMismatches.length,
      brokenImports: report.brokenImports.length,
      missingDeps: report.missingDeps.length,
      configIssues: report.configIssues.length,
      autoFixes: report.autoFixes.length,
      healthScore: report.healthScore,
    },
  });

  console.log(`[SelfHealer] Found ${totalIssues} issues, ${report.autoFixes.length} auto-fixes. Health: ${report.healthScore}/100`);
  return report;
}
