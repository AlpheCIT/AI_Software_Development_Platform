import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';
import { fileExistsInCodeFiles, exportExistsInFile, packageExistsInManifests, isStandardDevProxy } from './verification-helpers.js';
import { extractRelationships, buildGraphContext, formatGraphContextForPrompt } from './graph-helpers.js';
import { calculateCalibratedScore, enrichFindingsWithBlastRadius } from './scoring-helpers.js';

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

  // Extract business context from enriched codeFiles
  const bizContextFile = codeFiles.find((f: any) => f.path === '__business_context__');
  const businessContextPrompt = bizContextFile?.content ? `## Business Context\n${bizContextFile.content}\n` : '';

  // Build graph context
  const relationships = extractRelationships(codeFiles);
  const graphContext = buildGraphContext(relationships, codeFiles);
  const graphPrompt = formatGraphContextForPrompt(graphContext);

  // Package.json analysis
  const packageFiles = codeFiles.filter((f: any) => f.path?.endsWith('package.json'));
  const packageContext = packageFiles
    .slice(0, 5)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 2000)}`)
    .join('\n\n');

  // Config files
  const configFiles = codeFiles.filter((f: any) => f.path?.match(/config\.(ts|js|json)$/));
  const configContext = configFiles
    .slice(0, 10)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 1500)}`)
    .join('\n\n');

  // Env files
  const envFiles = codeFiles.filter((f: any) => f.path?.match(/\.env/));
  const envContext = envFiles
    .slice(0, 5)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 1000)}`)
    .join('\n\n');

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'self-healer',
    progress: 15,
    message: `Phase A: Identifying high-risk files from ${codeFiles.length} total files`,
  });

  // === PHASE A: File identification (lightweight) ===
  const identifyModel = createModel({ temperature: 0.2, maxTokens: 4096 });

  const allFilePaths = codeFiles
    .filter((f: any) => f.content && f.path !== '__business_context__')
    .map((f: any) => `- ${f.path} (${f.language || f.path?.split('.').pop() || 'unknown'}, ${f.size || (f.content || '').length}b)`)
    .join('\n');

  const identifyResponse = await throttledInvoke(identifyModel, [
    new SystemMessage('You are a code analysis expert. Given a repo file list, identify which 20 files are most likely to have cross-file issues (broken imports, type mismatches, missing exports, config inconsistencies). Prioritize files that are hub files (many connections), config files, entry points, and shared utilities. Return ONLY a JSON array of file paths.'),
    new HumanMessage(`${businessContextPrompt}${graphPrompt}\n\nFiles:\n${allFilePaths}`),
  ], 'self-healer-identify', eventPublisher, runId);

  let targetFiles: string[] = [];
  try {
    const cleaned = identifyResponse.content.toString().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    targetFiles = JSON.parse(cleaned);
  } catch {
    // Fallback: take first 20 source files
    targetFiles = codeFiles
      .filter((f: any) => f.content && f.path?.match(/\.(ts|tsx|js|jsx)$/))
      .slice(0, 20)
      .map((f: any) => f.path);
  }

  console.log(`[SelfHealer] Phase A identified ${targetFiles.length} files for deep analysis`);

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'self-healer',
    progress: 35,
    message: `Phase B: Deep analysis of ${targetFiles.length} identified files`,
  });

  // === PHASE B: Deep analysis with FULL file contents ===
  const deepContext = targetFiles.map((path: string) => {
    const file = codeFiles.find((f: any) => f.path === path);
    if (!file?.content) return '';
    return `### ${path}\n\`\`\`\n${file.content}\n\`\`\``;
  }).filter(Boolean).join('\n\n');

  // Also include ALL import/export summaries (for cross-file analysis)
  const importExportSummary = codeFiles
    .filter((f: any) => f.content && f.path?.match(/\.(ts|tsx|js|jsx)$/) && f.path !== '__business_context__')
    .map((f: any) => {
      const imports = (f.content.match(/^import\s.+/gm) || []).join('\n');
      const exports = (f.content.match(/^export\s.+/gm) || []).join('\n');
      return imports || exports ? `### ${f.path}\nImports: ${imports || '(none)'}\nExports: ${exports || '(none)'}` : '';
    }).filter(Boolean).join('\n\n');

  const analyzeModel = createModel({ temperature: 0.2, maxTokens: 16384 });

  const userMessage = `Detect cross-file issues in this codebase that compilers and linters miss.

## Repository: ${repoUrl}
Total files: ${codeFiles.length}
Total entities: ${codeEntities.length}

${businessContextPrompt}${graphPrompt}

## Full Source Code for Deep Analysis
${deepContext}

## Import/Export Map (all files)
${importExportSummary}

## Package Files
${packageContext}

## Environment Files
${envContext}

## Config Files
${configContext}

## Entities
${codeEntities.slice(0, 80).map((e: any) => `${e.type} ${e.name} (${e.file})`).join('\n')}

Find type mismatches, broken imports, missing dependencies, and config inconsistencies.
For each issue, provide a specific fix.

Respond with ONLY valid JSON, no markdown fencing.`;

  eventPublisher?.emit('qa:agent.streaming', {
    runId,
    agent: 'self-healer',
    text: 'Phase B: Deep cross-file analysis with full source code...',
  });

  const startMs = Date.now();
  const response = await throttledInvoke(analyzeModel, [
    new SystemMessage(SELF_HEALER_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'self-healer-analyze', eventPublisher, runId);
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

  // --- PASS 2: Programmatic verification of each finding ---
  const preVerifyCount = {
    brokenImports: (report.brokenImports || []).length,
    missingDeps: (report.missingDeps || []).length,
    configIssues: (report.configIssues || []).length,
  };

  // Ensure arrays exist
  report.brokenImports = report.brokenImports || [];
  report.missingDeps = report.missingDeps || [];
  report.configIssues = report.configIssues || [];
  report.typeMismatches = report.typeMismatches || [];
  report.autoFixes = report.autoFixes || [];

  // Verify type mismatches — filter claims about missing exports if exports exist
  report.typeMismatches = report.typeMismatches.filter(tm => {
    const desc = (tm.actual || '') + ' ' + (tm.expected || '');
    // If it claims something "is not exported" — check if it actually is
    const notExportedMatch = desc.match(/(\w+)\s+(?:is\s+)?not\s+exported\s+from\s+(\S+)/i);
    if (notExportedMatch) {
      const exportName = notExportedMatch[1];
      const fromFile = notExportedMatch[2].replace(/['"`]/g, '');
      // Check if the export exists in the file content
      const targetFile = codeFiles.find((f: any) => (f.path || '').includes(fromFile.replace(/^\.\//, '')));
      if (targetFile?.content && targetFile.content.includes(exportName)) {
        console.log(`[SelfHealer] Filtered type mismatch: ${exportName} found in ${fromFile}`);
        return false;
      }
    }
    return true;
  });

  // Verify broken imports
  report.brokenImports = report.brokenImports.filter(imp => {
    // Try multiple ways to extract the import path — LLM format is unreliable
    let importPath: string | undefined;

    // 1. Try extracting from importStatement field
    const fromMatch = imp.importStatement?.match(/from\s+['"]([^'"]+)['"]/);
    if (fromMatch) importPath = fromMatch[1];

    // 2. Try extracting from issue field (LLM sometimes puts the path there)
    if (!importPath) {
      const issueMatch = imp.issue?.match(/['"]([^'"]+\.(js|jsx|ts|tsx|json))['"]/);
      if (issueMatch) importPath = issueMatch[1];
    }

    // 3. Try extracting bare filename from importStatement or issue
    if (!importPath) {
      const bareMatch = (imp.importStatement || imp.issue || '').match(/(\w[\w.-]*\.(js|jsx|ts|tsx))/);
      if (bareMatch) importPath = './' + bareMatch[1];
    }

    // 4. Check if it mentions a file that exists anywhere in codeFiles by name
    const mentionedFile = (imp.importStatement || imp.issue || imp.fix || '').match(/(\w[\w/.-]*\.(js|jsx|ts|tsx))/g);
    if (mentionedFile) {
      for (const mf of mentionedFile) {
        // Search all codeFiles for a path ending with this filename
        const found = codeFiles.some(f => {
          const norm = (f.path || '').replace(/\\/g, '/');
          return norm.endsWith('/' + mf) || norm === mf || norm.endsWith(mf);
        });
        if (found) {
          console.log(`[SelfHealer] Filtered false positive: ${imp.file} — mentioned file ${mf} exists in codebase`);
          return false;
        }
      }
    }

    if (!importPath) return true; // can't verify, keep it

    const exists = fileExistsInCodeFiles(codeFiles, importPath, imp.file);
    if (exists) {
      // File exists — now check if the LLM claims specific exports are missing
      // Extract named imports from the import statement
      const namedImportMatch = imp.importStatement?.match(/\{([^}]+)\}/);
      if (namedImportMatch) {
        const namedImports = namedImportMatch[1].split(',').map((s: string) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        // Verify each named export against the actual file
        // Note: codeFiles only has first 2000 chars, so export check may miss exports later in file
        // If we can't verify (truncated content), give benefit of the doubt and filter
        const allExportsVerified = namedImports.every((name: string) => exportExistsInFile(codeFiles, importPath, name));
        if (allExportsVerified) {
          console.log(`[SelfHealer] Filtered: ${imp.file} — all named exports verified in ${importPath}`);
          return false;
        }
        // If exports NOT found, it could be because content is truncated (2000 chars)
        // Check if any of the named imports appear anywhere in the file content
        const targetFile = codeFiles.find((f: any) => (f.path || '').replace(/\\/g, '/').includes(importPath.replace(/^\.\//, '')));
        if (targetFile?.content) {
          const allNamesInContent = namedImports.every((name: string) => targetFile.content.includes(name));
          if (allNamesInContent) {
            console.log(`[SelfHealer] Filtered: ${imp.file} — named imports found in ${importPath} content (may be truncated)`);
            return false;
          }
        } else {
          // Can't read file content at all — file exists but content unavailable
          // This is likely a truncation issue, filter as probable false positive
          console.log(`[SelfHealer] Filtered: ${imp.file} — file ${importPath} exists, content not available for export verification`);
          return false;
        }
      } else {
        // No named imports (default import or side-effect import) — file exists, filter it
        console.log(`[SelfHealer] Filtered false positive: ${imp.file} import of ${importPath} — file exists`);
        return false;
      }
    }

    // Also check: does ANY file in codeFiles end with this filename?
    const basename = importPath.split('/').pop() || '';
    if (basename) {
      const anyMatch = codeFiles.some((f: any) => (f.path || '').endsWith(basename));
      if (anyMatch) {
        console.log(`[SelfHealer] Filtered false positive: ${imp.file} import of ${importPath} — file ${basename} exists somewhere in repo`);
        return false;
      }
    }

    return true;
  });

  // Verify missing deps
  report.missingDeps = report.missingDeps.filter(dep => {
    // If the LLM itself says it's in package.json, filter it
    if (dep.inPackageJson === true) {
      console.log(`[SelfHealer] Filtered false positive: ${dep.package} — LLM confirms in package.json`);
      return false;
    }
    const exists = packageExistsInManifests(codeFiles, dep.package);
    if (exists) {
      console.log(`[SelfHealer] Filtered false positive: ${dep.package} — found in package.json`);
      return false;
    }
    return true;
  });

  // Verify config issues
  report.configIssues = report.configIssues.filter(issue => {
    if (issue.type === 'port-mismatch' && isStandardDevProxy(codeFiles)) {
      console.log(`[SelfHealer] Filtered false positive: port mismatch is standard Vite proxy`);
      return false;
    }
    return true;
  });

  // Recalculate health score with calibrated scoring
  const allFindings = [
    ...report.typeMismatches.map((f: any) => ({ severity: f.severity || 'medium', confidence: 0.8, verified: true })),
    ...report.brokenImports.map((f: any) => ({ severity: f.severity || 'medium', confidence: 0.8, verified: true })),
    ...report.missingDeps.map(() => ({ severity: 'medium' as const, confidence: 0.7, verified: true })),
    ...report.configIssues.map((f: any) => ({ severity: f.severity || 'medium', confidence: 0.8, verified: true })),
  ];
  const { score: calibratedScore } = calculateCalibratedScore(allFindings, codeFiles.length);
  report.healthScore = calibratedScore;

  // Enrich findings with blast radius from graph context
  enrichFindingsWithBlastRadius(report.typeMismatches, graphContext.dependentGraph);
  enrichFindingsWithBlastRadius(report.brokenImports, graphContext.dependentGraph);
  enrichFindingsWithBlastRadius(report.configIssues, graphContext.dependentGraph);

  // Update auto-fixes to only reference verified issues
  report.autoFixes = report.autoFixes.filter(fix => {
    const relevantFiles = [
      ...report.brokenImports.map(i => i.file),
      ...report.typeMismatches.map(t => t.file),
      ...report.configIssues.flatMap(c => c.files),
    ];
    return fix.files.some(f => relevantFiles.includes(f));
  });

  const filteredCount =
    (preVerifyCount.brokenImports - report.brokenImports.length) +
    (preVerifyCount.missingDeps - report.missingDeps.length) +
    (preVerifyCount.configIssues - report.configIssues.length);
  if (filteredCount > 0) {
    console.log(`[SelfHealer] Verification pass filtered ${filteredCount} false positives`);
    report.summary = `[Verified] ${report.summary} (${filteredCount} false positives removed by code verification)`;
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
