import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../../config';
import { persistConversation } from '../../persist-conversation';
import { throttledInvoke, createModel } from '../../llm-throttle';
import { isDSPyAvailable, callDSPyExpert, handleSubAgents } from '../../dspy-client.js';
import { extractRelationships, buildGraphContext, formatGraphContextForPrompt } from '../graph-helpers.js';
import { calculateCalibratedScore, enrichFindingsWithBlastRadius } from '../scoring-helpers.js';

const CODE_QUALITY_SYSTEM_PROMPT = `You are a world-class Software Architect and Technical Debt specialist — the kind of engineer who gets called in to rescue codebases at companies like Google, Stripe, and Netflix. You have an encyclopedic knowledge of design patterns, SOLID principles, and clean code practices across every language and framework.

Your job: Perform a deep code quality audit and produce an actionable refactoring roadmap. You don't just find problems — you explain WHY they matter and HOW to fix them with specific, implementable steps.

## What You Analyze

### 1. Code Smells & Anti-Patterns
- God classes/functions (doing too much)
- Long parameter lists
- Feature envy (class using another class's data more than its own)
- Data clumps (groups of data that always appear together)
- Primitive obsession (using primitives instead of small objects)
- Switch statements that should be polymorphism
- Speculative generality (unused abstractions)
- Message chains (a.b().c().d())
- Middle man (delegating everything)
- Inappropriate intimacy (classes too tightly coupled)

### 2. Duplication & Consolidation Opportunities
- Copy-paste code across files (exact or near-duplicate)
- Similar logic that could be abstracted into shared utilities
- Repeated patterns that should be extracted into base classes or mixins
- Configuration that's hardcoded in multiple places
- Test setup code that should be shared fixtures

### 3. Complexity Hotspots
- Cyclomatic complexity (deeply nested conditionals)
- Cognitive complexity (hard to understand at a glance)
- Functions that are too long (>50 lines)
- Files that are too large (>500 lines)
- Deep inheritance hierarchies
- Circular dependencies

### 4. Architecture Issues
- Layering violations (UI calling DB directly, etc.)
- Missing abstractions (no interfaces between layers)
- Inconsistent patterns across the codebase
- Tight coupling between modules
- Missing dependency injection
- Global state / singletons where not appropriate

### 5. Performance & Reliability Concerns
- N+1 query patterns
- Memory leaks (event listeners not cleaned up, subscriptions not unsubscribed)
- Missing error handling
- Synchronous operations that should be async
- Missing timeouts on external calls
- Race conditions in concurrent code

### 6. Maintainability Issues
- Missing or misleading documentation
- Inconsistent naming conventions
- Magic numbers/strings
- Dead code (unused functions, unreachable branches)
- TODO/FIXME/HACK comments that need addressing
- Missing type definitions (any, unknown abuse)

### 7. Documentation Coverage
- Count files with JSDoc/docstrings vs files without
- Count functions with documentation vs without
- Flag directories without README files
- Identify code with high complexity but no documentation (critical gaps)
- Calculate overall documentation coverage percentage

## Output Format

Your output must be structured JSON:
{
  "overallHealth": {
    "score": 0-100,
    "grade": "A|B|C|D|F",
    "summary": "One-paragraph overall assessment",
    "techDebtHours": "Estimated hours to resolve critical issues"
  },
  "codeSmells": [
    {
      "type": "god-class|long-method|feature-envy|data-clump|primitive-obsession|...",
      "severity": "critical|high|medium|low",
      "location": "file path and line range",
      "description": "What the smell is",
      "impact": "Why this matters (maintainability, bugs, performance)",
      "refactoring": "Specific refactoring technique to apply",
      "effort": "XS|S|M|L|XL",
      "before": "Brief code pattern showing the problem",
      "after": "Brief code pattern showing the fix"
    }
  ],
  "duplicationHotspots": [
    {
      "pattern": "Description of the duplicated logic",
      "locations": ["file1:lines", "file2:lines"],
      "similarity": 0-100,
      "consolidation": "How to extract into shared code",
      "sharedModule": "Suggested module/utility name",
      "linesReduced": "Approximate lines that would be removed"
    }
  ],
  "complexityHotspots": [
    {
      "file": "file path",
      "function": "function name",
      "cyclomaticComplexity": "estimated number",
      "cognitiveComplexity": "estimated number",
      "lineCount": "number of lines",
      "recommendation": "How to simplify",
      "technique": "extract-method|replace-conditional|strategy-pattern|..."
    }
  ],
  "architectureIssues": [
    {
      "issue": "Description",
      "type": "layering-violation|missing-abstraction|tight-coupling|circular-dependency|...",
      "severity": "critical|high|medium|low",
      "affectedFiles": ["file1", "file2"],
      "recommendation": "How to fix",
      "designPattern": "Pattern to apply (if applicable)"
    }
  ],
  "refactoringRoadmap": {
    "quickWins": [
      {
        "title": "Refactoring Name",
        "description": "What to do",
        "files": ["affected files"],
        "effort": "XS|S",
        "impact": "What improves",
        "technique": "The refactoring technique"
      }
    ],
    "shortTerm": [],
    "strategic": []
  },
  "consolidationOpportunities": [
    {
      "title": "Proposed shared module/utility",
      "description": "What it would contain",
      "consumingFiles": ["files that would use it"],
      "currentDuplication": "How many times this logic is repeated",
      "proposedApi": "Brief interface/function signatures",
      "estimatedReduction": "Lines of code saved"
    }
  ],
  "deadCode": [
    {
      "file": "file path",
      "item": "function/class/variable name",
      "type": "unused-function|unreachable-branch|unused-import|unused-variable",
      "confidence": "high|medium|low",
      "safeToRemove": true
    }
  ],
  "bestPracticeViolations": [
    {
      "rule": "The best practice being violated",
      "severity": "critical|high|medium|low",
      "locations": ["file:line"],
      "currentPattern": "What the code does now",
      "recommendedPattern": "What it should do instead",
      "reference": "Link or reference to the best practice"
    }
  ],
  "documentationCoverage": {
    "totalFiles": "number of source files analyzed",
    "documentedFiles": "number of files with JSDoc/docstrings",
    "undocumentedFiles": "number of files without any documentation",
    "coveragePercent": "percentage of files with documentation (0-100)",
    "criticalGaps": ["files with high complexity but no docs"],
    "missingReadmes": ["directories without README files"],
    "totalFunctions": "total functions/methods found",
    "documentedFunctions": "number of functions with doc comments"
  }
}

Be brutally honest but constructive. Every finding must have a specific, actionable fix. Prioritize findings by impact — what would make the biggest difference to code quality and developer productivity?`;

export interface CodeQualityReport {
  overallHealth: {
    score: number;
    grade: string;
    summary: string;
    techDebtHours: string;
  };
  codeSmells: CodeSmell[];
  duplicationHotspots: DuplicationHotspot[];
  complexityHotspots: ComplexityHotspot[];
  architectureIssues: ArchitectureIssue[];
  refactoringRoadmap: {
    quickWins: RefactoringItem[];
    shortTerm: RefactoringItem[];
    strategic: RefactoringItem[];
  };
  consolidationOpportunities: ConsolidationOpportunity[];
  deadCode: DeadCodeItem[];
  bestPracticeViolations: BestPracticeViolation[];
  documentationCoverage?: DocumentationCoverage;
}

export interface CodeSmell {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  impact: string;
  refactoring: string;
  effort: string;
  before: string;
  after: string;
}

export interface DuplicationHotspot {
  pattern: string;
  locations: string[];
  similarity: number;
  consolidation: string;
  sharedModule: string;
  linesReduced: string;
}

export interface ComplexityHotspot {
  file: string;
  function: string;
  cyclomaticComplexity: string;
  cognitiveComplexity: string;
  lineCount: string;
  recommendation: string;
  technique: string;
}

export interface ArchitectureIssue {
  issue: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedFiles: string[];
  recommendation: string;
  designPattern: string;
}

export interface RefactoringItem {
  title: string;
  description: string;
  files: string[];
  effort: string;
  impact: string;
  technique: string;
}

export interface ConsolidationOpportunity {
  title: string;
  description: string;
  consumingFiles: string[];
  currentDuplication: string;
  proposedApi: string;
  estimatedReduction: string;
}

export interface DeadCodeItem {
  file: string;
  item: string;
  type: string;
  confidence: string;
  safeToRemove: boolean;
}

export interface BestPracticeViolation {
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  locations: string[];
  currentPattern: string;
  recommendedPattern: string;
  reference: string;
}

export interface DocumentationCoverage {
  totalFiles: number;
  documentedFiles: number;
  undocumentedFiles: number;
  coveragePercent: number;
  criticalGaps: string[];
  missingReadmes: string[];
  totalFunctions: number;
  documentedFunctions: number;
}

export async function codeQualityArchitectNode(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<CodeQualityReport> {
  console.log(`[CodeQualityArchitect] Auditing ${repoUrl} for code quality and refactoring opportunities`);

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'code-quality-architect',
    step: 'Deep code quality audit — analyzing smells, duplication, complexity, and architecture',
  });

  // Extract business context from enriched codeFiles
  const bizContextFile = codeFiles.find((f: any) => f.path === '__business_context__');
  const businessContextPrompt = bizContextFile?.content ? `## Business Context\n${bizContextFile.content}\n` : '';

  // Build graph context
  const graphRelationships = extractRelationships(codeFiles);
  const graphContext = buildGraphContext(graphRelationships, codeFiles);
  const graphPrompt = formatGraphContextForPrompt(graphContext);

  // Build detailed code context
  const filesByDir = new Map<string, number>();
  const filesByExt = new Map<string, number>();
  let totalLines = 0;

  for (const f of codeFiles) {
    if (f.path === '__business_context__') continue;
    const dir = f.path?.split('/').slice(0, 2).join('/') || 'root';
    filesByDir.set(dir, (filesByDir.get(dir) || 0) + 1);
    const ext = f.path?.split('.').pop() || 'unknown';
    filesByExt.set(ext, (filesByExt.get(ext) || 0) + 1);
    totalLines += (f.content || '').split('\n').length;
  }

  // Analyze code entities for patterns
  const functions = codeEntities.filter((e: any) => e.type === 'function' || e.type === 'method');
  const classes = codeEntities.filter((e: any) => e.type === 'class');
  const interfaces = codeEntities.filter((e: any) => e.type === 'interface');

  // Find potentially long functions
  const longFunctions = functions
    .filter((f: any) => f.lineCount && f.lineCount > 30)
    .map((f: any) => `${f.name} (${f.file}, ${f.lineCount} lines)`)
    .slice(0, 20);

  // Find large files
  const largeFiles = codeFiles
    .filter((f: any) => f.content && f.path !== '__business_context__' && f.content.split('\n').length > 200)
    .map((f: any) => `${f.path} (${f.content.split('\n').length} lines)`)
    .slice(0, 20);

  // Documentation coverage statistics
  const sourceFiles = codeFiles.filter((f: any) =>
    f.path?.match(/\.(ts|tsx|js|jsx|py|java|cs|go|rs|rb|php)$/)
  );
  const documentedFiles = sourceFiles.filter((f: any) => f.hasDocumentation === true);
  const undocumentedFiles = sourceFiles.filter((f: any) => f.hasDocumentation === false);
  const docCoveragePercent = sourceFiles.length > 0
    ? Math.round((documentedFiles.length / sourceFiles.length) * 100)
    : 0;

  // Detect directories missing READMEs
  const directoriesWithFiles = new Set<string>();
  const directoriesWithReadmes = new Set<string>();
  for (const f of codeFiles) {
    const dir = f.path?.split('/').slice(0, -1).join('/') || '.';
    directoriesWithFiles.add(dir);
    if (f.path?.toLowerCase().endsWith('readme.md') || f.path?.toLowerCase().endsWith('readme')) {
      directoriesWithReadmes.add(dir);
    }
  }
  const missingReadmeDirs = Array.from(directoriesWithFiles)
    .filter(d => !directoriesWithReadmes.has(d) && d !== '.')
    .slice(0, 20);

  // Look for common anti-patterns in code
  const todoCount = codeFiles.reduce((acc: number, f: any) =>
    acc + ((f.content || '').match(/TODO|FIXME|HACK|XXX|TEMP/gi) || []).length, 0);
  const anyCount = codeFiles.reduce((acc: number, f: any) =>
    acc + ((f.content || '').match(/: any[;\s,)]/g) || []).length, 0);
  const consoleLogCount = codeFiles.reduce((acc: number, f: any) =>
    acc + ((f.content || '').match(/console\.(log|warn|error)/g) || []).length, 0);

  // === DSPy Expert Chain Path ===
  if (dbClient) {
    try {
      const dspyAvailable = await isDSPyAvailable();
      if (dspyAvailable) {
        console.log('[CodeQualityArchitect] DSPy available — using Quality Architect chain');
        eventPublisher?.emit('qa:agent.progress', {
          runId, agent: 'code-quality-architect', progress: 10,
          message: 'Using DSPy Quality Architect chain for multi-step analysis',
        });

        const sourceContext = codeFiles
          .filter((f: any) => f.content && f.path !== '__business_context__')
          .slice(0, 30)
          .map((f: any) => `### ${f.path}\n${f.content}`)
          .join('\n\n');

        const dspyResult = await callDSPyExpert(
          '/analyze/quality-architect',
          sourceContext,
          dbClient, runId, 'code-quality-architect', 'Code Quality Architect (DSPy)',
          eventPublisher
        );

        // Handle sub-agents if requested
        if (dspyResult.subAgentsNeeded.length > 0) {
          const lastStepIndex = dspyResult.steps.length - 1;
          const sessionId = `sess_${runId}_code-quality-architect_${Date.now()}`;
          const parentStepId = `step_${sessionId}_${lastStepIndex}`;

          const subResults = await handleSubAgents(
            dspyResult.subAgentsNeeded, sourceContext,
            dbClient, runId, sessionId, parentStepId, eventPublisher
          );
          if (dspyResult.report) dspyResult.report._subAgentResults = subResults;
        }

        // Map DSPy report to CodeQualityReport format
        const dspyReport = dspyResult.report || {};
        const report: CodeQualityReport = {
          overallHealth: dspyReport.overallHealth || dspyReport.overall_health || {
            score: 0, grade: 'N/A', summary: 'DSPy analysis completed', techDebtHours: 'Unknown'
          },
          codeSmells: dspyReport.codeSmells || dspyReport.code_smells || [],
          duplicationHotspots: dspyReport.duplicationHotspots || dspyReport.duplication_hotspots || [],
          complexityHotspots: dspyReport.complexityHotspots || dspyReport.complexity_hotspots || [],
          architectureIssues: dspyReport.architectureIssues || dspyReport.architecture_issues || [],
          refactoringRoadmap: dspyReport.refactoringRoadmap || dspyReport.refactoring_roadmap || {
            quickWins: [], shortTerm: [], strategic: []
          },
          consolidationOpportunities: dspyReport.consolidationOpportunities || dspyReport.consolidation_opportunities || [],
          deadCode: dspyReport.deadCode || dspyReport.dead_code || [],
          bestPracticeViolations: dspyReport.bestPracticeViolations || dspyReport.best_practice_violations || [],
          documentationCoverage: dspyReport.documentationCoverage || dspyReport.documentation_coverage || {
            totalFiles: sourceFiles.length,
            documentedFiles: documentedFiles.length,
            undocumentedFiles: undocumentedFiles.length,
            coveragePercent: docCoveragePercent,
            criticalGaps: [],
            missingReadmes: missingReadmeDirs,
            totalFunctions: functions.length,
            documentedFunctions: 0,
          },
        };

        // Recalculate calibrated score
        const allFindings = [
          ...report.codeSmells.map((s: any) => ({ severity: s.severity || 'medium', confidence: 0.8, verified: true })),
          ...report.complexityHotspots.map(() => ({ severity: 'medium' as const, confidence: 0.7, verified: true })),
          ...report.architectureIssues.map((a: any) => ({ severity: a.severity || 'medium', confidence: 0.7, verified: true })),
          ...report.bestPracticeViolations.map((b: any) => ({ severity: b.severity || 'low', confidence: 0.6, verified: true })),
        ];
        const { score: calibratedScore, grade: calibratedGrade } = calculateCalibratedScore(allFindings, codeFiles.length);
        report.overallHealth.score = calibratedScore;
        report.overallHealth.grade = calibratedGrade;

        enrichFindingsWithBlastRadius(
          report.codeSmells.map((s: any) => ({ ...s, file: s.file || (s.location || '').split(':')[0] })),
          graphContext.dependentGraph
        );
        enrichFindingsWithBlastRadius(report.architectureIssues as any[], graphContext.dependentGraph);
        enrichFindingsWithBlastRadius(report.complexityHotspots, graphContext.dependentGraph);

        const totalFindings =
          report.codeSmells.length + report.duplicationHotspots.length +
          report.complexityHotspots.length + report.architectureIssues.length +
          report.deadCode.length + report.bestPracticeViolations.length;

        eventPublisher?.emit('qa:agent.completed', {
          runId, agent: 'code-quality-architect',
          result: {
            healthScore: report.overallHealth.score, grade: report.overallHealth.grade,
            totalFindings, codeSmells: report.codeSmells.length,
            duplicationHotspots: report.duplicationHotspots.length,
            complexityHotspots: report.complexityHotspots.length,
            architectureIssues: report.architectureIssues.length,
            quickWins: report.refactoringRoadmap.quickWins.length,
            documentationCoverage: report.documentationCoverage?.coveragePercent ?? docCoveragePercent,
            source: 'dspy',
          },
        });

        console.log(`[CodeQualityArchitect] DSPy: Health: ${report.overallHealth.score}/100 (${report.overallHealth.grade}). ${totalFindings} findings`);
        return report;
      }
    } catch (dspyErr) {
      console.warn(`[CodeQualityArchitect] DSPy call failed, falling back to direct LLM: ${(dspyErr as Error).message}`);
    }
  }

  // === Fallback: Direct LLM Call (original logic) ===
  console.log('[CodeQualityArchitect] Using direct LLM call (DSPy unavailable)');

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'code-quality-architect',
    progress: 15,
    message: `Phase A: Identifying largest/most complex files from ${codeFiles.length} total files`,
  });

  // === PHASE A: File identification (lightweight) ===
  const identifyModel = createModel({ temperature: 0.2, maxTokens: 4096 });

  const allFilePaths = codeFiles
    .filter((f: any) => f.content && f.path !== '__business_context__')
    .map((f: any) => `- ${f.path} (${f.language || f.path?.split('.').pop() || 'unknown'}, ${f.size || (f.content || '').length}b)`)
    .join('\n');

  const identifyResponse = await throttledInvoke(identifyModel, [
    new SystemMessage('You are a world-class Software Architect. Given a repo file list, identify which 20 files are most important for a code quality audit: the largest/most complex files, core architecture files, shared utilities, base classes, and files likely to have code smells or duplication. Prioritize hub files (many connections) and large files. Return ONLY a JSON array of file paths.'),
    new HumanMessage(`${businessContextPrompt}${graphPrompt}\n\n## Red Flags\n- Long functions: ${longFunctions.length}\n- Large files: ${largeFiles.length}\n- TODO/FIXME/HACK: ${todoCount}\n- 'any' types: ${anyCount}\n\n## Large Files\n${largeFiles.join('\n')}\n\n## Long Functions\n${longFunctions.join('\n')}\n\nFiles:\n${allFilePaths}`),
  ], 'code-quality-identify', eventPublisher, runId);

  let targetFiles: string[] = [];
  try {
    const cleaned = identifyResponse.content.toString().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    targetFiles = JSON.parse(cleaned);
  } catch {
    // Fallback: take largest source files
    targetFiles = [...codeFiles]
      .filter((f: any) => f.content && f.path?.match(/\.(ts|tsx|js|jsx|py|java|cs|go|rs)$/) && f.path !== '__business_context__')
      .sort((a: any, b: any) => (b.content?.length || 0) - (a.content?.length || 0))
      .slice(0, 20)
      .map((f: any) => f.path);
  }

  console.log(`[CodeQualityArchitect] Phase A identified ${targetFiles.length} files for deep analysis`);

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'code-quality-architect',
    progress: 35,
    message: `Phase B: Deep code quality analysis of ${targetFiles.length} identified files`,
  });

  // === PHASE B: Deep analysis with FULL file contents ===
  const deepContext = targetFiles.map((path: string) => {
    const file = codeFiles.find((f: any) => f.path === path);
    if (!file?.content) return '';
    return `### ${path} (${(file.content || '').split('\n').length} lines)\n\`\`\`\n${file.content}\n\`\`\``;
  }).filter(Boolean).join('\n\n');

  const analyzeModel = createModel({ temperature: 0.3, maxTokens: 16384 });

  const userMessage = `Perform a comprehensive code quality audit of this repository.

## Repository
URL: ${repoUrl}
Total files: ${codeFiles.length}
Total lines: ${totalLines}
Total functions: ${functions.length}
Total classes: ${classes.length}
Total interfaces: ${interfaces.length}

${businessContextPrompt}${graphPrompt}

## File Distribution
${Array.from(filesByExt.entries()).sort((a, b) => b[1] - a[1]).map(([ext, count]) => `${ext}: ${count} files`).join(', ')}

## Directory Structure
${Array.from(filesByDir.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([dir, count]) => `${dir}: ${count} files`).join('\n')}

## Red Flags Detected
- TODO/FIXME/HACK comments: ${todoCount}
- Uses of 'any' type: ${anyCount}
- console.log/warn/error calls: ${consoleLogCount}
- Functions > 30 lines: ${longFunctions.length}
- Files > 200 lines: ${largeFiles.length}

## Documentation Coverage
- Source files with documentation: ${documentedFiles.length}/${sourceFiles.length} (${docCoveragePercent}%)
- Undocumented source files: ${undocumentedFiles.length}
- Directories missing README: ${missingReadmeDirs.length} (${missingReadmeDirs.slice(0, 10).join(', ')})

## Long Functions
${longFunctions.join('\n')}

## Large Files
${largeFiles.join('\n')}

## Full Source Code for Deep Analysis
${deepContext}

## Key Entities
${codeEntities.slice(0, 80).map((e: any) => `${e.type} ${e.name} (${e.file})`).join('\n')}

Based on this comprehensive analysis:
1. Score overall code health (0-100)
2. Identify specific code smells with refactoring instructions
3. Find duplication that could be consolidated
4. Flag complexity hotspots
5. Identify architecture issues
6. Create a prioritized refactoring roadmap (quick wins -> strategic)
7. List consolidation opportunities (shared utilities/modules to create)
8. Find dead code
9. Flag best practice violations
10. Analyze documentation coverage -- count documented vs undocumented files/functions, flag critical gaps (high complexity with no docs), and list directories missing READMEs

Be specific -- reference actual files and code patterns. Every finding must have an actionable fix.

Respond with ONLY valid JSON, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(analyzeModel, [
    new SystemMessage(CODE_QUALITY_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'code-quality-architect-analyze', eventPublisher, runId);
  const durationMs = Date.now() - startMs;

  const cqResponseText = typeof response.content === 'string' ? response.content : '';
  if (dbClient) {
    persistConversation(dbClient, {
      runId,
      agent: 'code-quality-architect',
      systemPrompt: CODE_QUALITY_SYSTEM_PROMPT,
      userMessage,
      response: cqResponseText,
      tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  let report: CodeQualityReport;
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    report = JSON.parse(cleaned);
  } catch (error) {
    console.error('[CodeQualityArchitect] Failed to parse response, using fallback');
    report = {
      overallHealth: { score: 0, grade: 'N/A', summary: 'Analysis failed — retry recommended', techDebtHours: 'Unknown' },
      codeSmells: [],
      duplicationHotspots: [],
      complexityHotspots: [],
      architectureIssues: [],
      refactoringRoadmap: { quickWins: [], shortTerm: [], strategic: [] },
      consolidationOpportunities: [],
      deadCode: [],
      bestPracticeViolations: [],
      documentationCoverage: {
        totalFiles: sourceFiles.length,
        documentedFiles: documentedFiles.length,
        undocumentedFiles: undocumentedFiles.length,
        coveragePercent: docCoveragePercent,
        criticalGaps: [],
        missingReadmes: missingReadmeDirs,
        totalFunctions: functions.length,
        documentedFunctions: 0,
      },
    };
  }

  // Ensure documentationCoverage is always present (LLM may omit it)
  if (!report.documentationCoverage) {
    report.documentationCoverage = {
      totalFiles: sourceFiles.length,
      documentedFiles: documentedFiles.length,
      undocumentedFiles: undocumentedFiles.length,
      coveragePercent: docCoveragePercent,
      criticalGaps: [],
      missingReadmes: missingReadmeDirs,
      totalFunctions: functions.length,
      documentedFunctions: 0,
    };
  }

  // Recalculate health score with calibrated scoring
  const allFindings = [
    ...report.codeSmells.map((s: any) => ({ severity: s.severity || 'medium', confidence: 0.8, verified: true })),
    ...report.complexityHotspots.map(() => ({ severity: 'medium' as const, confidence: 0.7, verified: true })),
    ...report.architectureIssues.map((a: any) => ({ severity: a.severity || 'medium', confidence: 0.7, verified: true })),
    ...report.bestPracticeViolations.map((b: any) => ({ severity: b.severity || 'low', confidence: 0.6, verified: true })),
  ];
  const { score: calibratedScore, grade: calibratedGrade, gradeDescription } = calculateCalibratedScore(allFindings, codeFiles.length);
  report.overallHealth.score = calibratedScore;
  report.overallHealth.grade = calibratedGrade;

  // Enrich findings with blast radius from graph context
  // CodeSmell uses `location` as a string, so map to file for blast radius lookup
  enrichFindingsWithBlastRadius(
    report.codeSmells.map((s: any) => ({ ...s, file: s.file || (s.location || '').split(':')[0] })),
    graphContext.dependentGraph
  );
  enrichFindingsWithBlastRadius(report.architectureIssues as any[], graphContext.dependentGraph);
  enrichFindingsWithBlastRadius(report.complexityHotspots, graphContext.dependentGraph);

  const totalFindings =
    report.codeSmells.length +
    report.duplicationHotspots.length +
    report.complexityHotspots.length +
    report.architectureIssues.length +
    report.deadCode.length +
    report.bestPracticeViolations.length;

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'code-quality-architect',
    result: {
      healthScore: report.overallHealth.score,
      grade: report.overallHealth.grade,
      totalFindings,
      codeSmells: report.codeSmells.length,
      duplicationHotspots: report.duplicationHotspots.length,
      complexityHotspots: report.complexityHotspots.length,
      architectureIssues: report.architectureIssues.length,
      quickWins: report.refactoringRoadmap.quickWins.length,
      documentationCoverage: report.documentationCoverage?.coveragePercent ?? docCoveragePercent,
    },
  });

  console.log(
    `[CodeQualityArchitect] Health: ${report.overallHealth.score}/100 (${report.overallHealth.grade}). ` +
    `${totalFindings} findings, ${report.refactoringRoadmap.quickWins.length} quick wins`
  );

  return report;
}
