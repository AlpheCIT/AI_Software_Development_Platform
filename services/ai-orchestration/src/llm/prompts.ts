// ─── LLM Prompt Templates ───────────────────────────────────────────────────
// Each agent role has a prompt function returning { system, user } strings.
// Prompts are designed to reduce false positives by emphasizing evidence-based
// analysis and explicit mitigation checking.

import {
  SecurityAnalysisSchema,
  SecurityChallengerSchema,
  PerformanceAnalysisSchema,
  PerformanceChallengerSchema,
  DocumentationAnalysisSchema,
  DocumentationChallengerSchema,
  DocumentationDrafterSchema,
  DocumentationVerificationSchema,
  DocumentationPolishSchema,
  DependencyAnalysisSchema,
  DependencyChallengerSchema,
  SynthesizerReportSchema,
} from './schemas.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PromptPair {
  system: string;
  user: string;
}

export interface SecurityAnalyzerContext {
  files: Map<string, string>;
  candidates?: Array<{ file: string; line: number; pattern: string }>;
  maxChars?: number;
}

export interface ChallengerContext {
  files: Map<string, string>;
  findings: any[];
  maxChars?: number;
}

export interface SynthesizerContext {
  domain: string;
  verifiedFindings: any[];
  repoName?: string;
  maxChars?: number;
}

export interface DocumentationAnalyzerContext {
  files: Map<string, string>;
  readmeContent?: string;
  packageJson?: object;
  maxChars?: number;
}

export interface DependencyAnalyzerContext {
  files: Map<string, string>;
  packageJson?: object;
  lockfileContent?: string;
  maxChars?: number;
}

// ─── Code Context Helper ────────────────────────────────────────────────────

/**
 * Formats source files with line numbers and truncates to stay within token
 * limits. Files are included in order, truncated once maxChars is reached.
 */
export function buildCodeContext(files: Map<string, string>, maxChars: number = 50000): string {
  const parts: string[] = [];
  let currentChars = 0;
  const entries = Array.from(files.entries());

  for (const [filePath, content] of entries) {
    const header = `\n--- FILE: ${filePath} ---\n`;
    const numbered = content
      .split('\n')
      .map((line, i) => `${String(i + 1).padStart(5)}| ${line}`)
      .join('\n');

    const section = header + numbered + '\n';

    if (currentChars + section.length > maxChars) {
      const remaining = maxChars - currentChars;
      if (remaining > 200) {
        parts.push(header + numbered.slice(0, remaining - header.length - 50) + '\n... (truncated)\n');
      }
      break;
    }

    parts.push(section);
    currentChars += section.length;
  }

  return parts.join('');
}

/**
 * Builds code context focused around specific candidate locations, showing
 * surrounding lines for context.
 */
function buildCandidateContext(
  files: Map<string, string>,
  candidates: Array<{ file: string; line: number; pattern: string }>,
  contextLines: number = 15,
  maxChars: number = 50000
): string {
  const parts: string[] = [];
  let currentChars = 0;

  // Group candidates by file
  const byFile = new Map<string, Array<{ line: number; pattern: string }>>();
  for (const c of candidates) {
    if (!byFile.has(c.file)) byFile.set(c.file, []);
    byFile.get(c.file)!.push({ line: c.line, pattern: c.pattern });
  }

  for (const [filePath, fileCandidates] of Array.from(byFile.entries())) {
    const content = files.get(filePath);
    if (!content) continue;

    const lines = content.split('\n');
    const header = `\n--- FILE: ${filePath} ---\n`;
    const snippets: string[] = [];

    for (const candidate of fileCandidates) {
      const start = Math.max(0, candidate.line - contextLines - 1);
      const end = Math.min(lines.length, candidate.line + contextLines);
      const snippet = lines
        .slice(start, end)
        .map((line, i) => {
          const lineNum = start + i + 1;
          const marker = lineNum === candidate.line ? ' >> ' : '    ';
          return `${marker}${String(lineNum).padStart(5)}| ${line}`;
        })
        .join('\n');

      snippets.push(`  [Candidate: ${candidate.pattern} at line ${candidate.line}]\n${snippet}`);
    }

    const section = header + snippets.join('\n\n') + '\n';

    if (currentChars + section.length > maxChars) {
      const remaining = maxChars - currentChars;
      if (remaining > 200) {
        parts.push(section.slice(0, remaining - 50) + '\n... (truncated)\n');
      }
      break;
    }

    parts.push(section);
    currentChars += section.length;
  }

  return parts.join('');
}

// ─── Security Prompts ───────────────────────────────────────────────────────

export function securityAnalyzerPrompt(ctx: SecurityAnalyzerContext): PromptPair {
  const maxChars = ctx.maxChars ?? 50000;

  const codeContext = ctx.candidates && ctx.candidates.length > 0
    ? buildCandidateContext(ctx.files, ctx.candidates, 15, maxChars)
    : buildCodeContext(ctx.files, maxChars);

  return {
    system: `You are a senior application security engineer performing a code audit.
Analyze the provided source code for security vulnerabilities.

CRITICAL RULES:
1) Only report REAL vulnerabilities with concrete evidence from the code.
2) Every finding MUST cite the exact file path and line number.
3) Before reporting an issue, CHECK if the code has mitigations:
   - Global middleware (express-rate-limit, helmet, cors, csrf protection)
   - Input validation libraries (joi, zod, express-validator)
   - Parameterized queries / prepared statements
   - Sanitization functions (DOMPurify, escape-html, validator.js)
   - Authentication middleware on routes
4) Do NOT report issues in test files, comment blocks, or disabled/dead code.
5) Do NOT report hypothetical issues -- only what is demonstrably present.
6) Assign confidence based on how certain you are (0.0-1.0). Use < 0.5 for uncertain.
7) Return findings as structured JSON matching the provided schema.

JSON Schema: ${JSON.stringify(SecurityAnalysisSchema)}`,

    user: `Analyze the following source code for security vulnerabilities.
${ctx.candidates && ctx.candidates.length > 0
  ? `Focus on these candidate locations that matched security patterns, but also check the surrounding code for context and mitigations:\n`
  : 'Scan all code for potential security issues:\n'
}
${codeContext}`,
  };
}

export function securityChallengerPrompt(ctx: ChallengerContext): PromptPair {
  const maxChars = ctx.maxChars ?? 50000;
  const codeContext = buildCodeContext(ctx.files, maxChars);

  return {
    system: `You are a security review expert. Your job is to VERIFY or REFUTE each security finding.

For EACH finding provided:
1) Read the actual source code at the reported file and line number.
2) Check for mitigations that would prevent exploitation:
   - Global middleware (express-rate-limit, helmet, cors)
   - Input validation (joi, zod, express-validator, custom validators)
   - Parameterized queries / ORM protection
   - Sanitization functions
   - Authentication/authorization middleware
3) Check if the code is in a test file, comment block, example, or disabled path.
4) Check if the vulnerability is reachable (is the function exported? called? in a route handler?).
5) Mark as "verified" ONLY if the vulnerability genuinely exists with no mitigation.
   Mark as "false_positive" with clear evidence if mitigated or not real.
   Mark as "needs_more_context" only if you cannot determine from the provided code.

Be SKEPTICAL. Most static analysis findings are false positives. Look hard for mitigations.

JSON Schema: ${JSON.stringify(SecurityChallengerSchema)}`,

    user: `Verify or refute the following security findings against the source code.

FINDINGS TO VERIFY:
${JSON.stringify(ctx.findings, null, 2)}

SOURCE CODE:
${codeContext}`,
  };
}

export function securitySynthesizerPrompt(ctx: SynthesizerContext): PromptPair {
  return {
    system: `You are a security report writer producing an actionable report for developers.

Given verified security findings, produce a concise report including:
1) Executive summary (1-2 sentences on overall security posture).
2) Findings ranked by severity (critical first) then confidence.
3) For each finding: title, severity, file:line, description, remediation steps, estimated effort.
4) Quick wins section: low effort + high impact items developers can fix immediately.
5) Remediation plan: phased approach (immediate, short-term, medium-term, long-term).
6) Overall security grade (A = excellent, F = critical issues).

Be specific in remediation -- include code patterns or library suggestions where relevant.

JSON Schema: ${JSON.stringify(SynthesizerReportSchema)}`,

    user: `Generate a security report for repository "${ctx.repoName ?? 'unknown'}".

Domain: ${ctx.domain}

VERIFIED FINDINGS:
${JSON.stringify(ctx.verifiedFindings, null, 2)}`,
  };
}

// ─── Performance Prompts ────────────────────────────────────────────────────

export function performanceAnalyzerPrompt(ctx: SecurityAnalyzerContext): PromptPair {
  const maxChars = ctx.maxChars ?? 50000;

  const codeContext = ctx.candidates && ctx.candidates.length > 0
    ? buildCandidateContext(ctx.files, ctx.candidates, 15, maxChars)
    : buildCodeContext(ctx.files, maxChars);

  return {
    system: `You are a senior performance engineer analyzing code for performance issues.

Analyze the provided source code for performance problems including:
- N+1 query patterns (loops making individual DB/API calls)
- Synchronous I/O in async contexts (blocking the event loop)
- Memory leaks (unclosed resources, growing caches, event listener leaks)
- Excessive algorithmic complexity (nested loops on large datasets)
- Missing database indexes (queries on unindexed fields)
- Unbounded queries (no LIMIT clause, fetching all records)
- Blocking event loop operations (CPU-heavy sync work in Node.js)
- Missing caching for expensive or repeated operations
- Inefficient algorithms (O(n^2) where O(n log n) exists)

CRITICAL RULES:
1) Only report REAL performance issues with evidence from the code.
2) Every finding MUST cite the exact file and line number.
3) Check if existing caching, pagination, or optimization already mitigates the issue.
4) Do NOT report issues in test files or disabled code.
5) Consider the runtime context (Node.js single-threaded, browser, etc.).
6) Assign confidence (0.0-1.0) based on certainty.

JSON Schema: ${JSON.stringify(PerformanceAnalysisSchema)}`,

    user: `Analyze the following source code for performance issues:

${codeContext}`,
  };
}

export function performanceChallengerPrompt(ctx: ChallengerContext): PromptPair {
  const maxChars = ctx.maxChars ?? 50000;
  const codeContext = buildCodeContext(ctx.files, maxChars);

  return {
    system: `You are a performance review expert. Your job is to VERIFY or REFUTE each performance finding.

For EACH finding:
1) Read the actual source code at the reported location.
2) Check for mitigations: caching layers, pagination, batch operations, worker threads, streaming.
3) Consider if the data volume makes the issue relevant (a loop over 5 items is not N+1).
4) Check if the code path is hot (called frequently) or cold (initialization, admin routes).
5) Evaluate if the suggested impact is realistic for the application's scale.
6) Mark as "verified" only if the issue is real, unmitigated, and impactful.

Be SKEPTICAL. Not every loop is N+1 and not every sync call blocks meaningfully.

JSON Schema: ${JSON.stringify(PerformanceChallengerSchema)}`,

    user: `Verify or refute the following performance findings against the source code.

FINDINGS TO VERIFY:
${JSON.stringify(ctx.findings, null, 2)}

SOURCE CODE:
${codeContext}`,
  };
}

export function performanceSynthesizerPrompt(ctx: SynthesizerContext): PromptPair {
  return {
    system: `You are a performance report writer producing an actionable report for developers.

Given verified performance findings, produce a concise report including:
1) Executive summary of performance posture.
2) Findings ranked by severity and estimated impact.
3) For each: title, severity, file:line, description, remediation with code patterns, effort estimate.
4) Quick wins: easy optimizations with high payoff.
5) Phased remediation plan.
6) Overall performance grade (A-F).

Focus on measurable impact -- mention expected latency/throughput improvements where possible.

JSON Schema: ${JSON.stringify(SynthesizerReportSchema)}`,

    user: `Generate a performance report for repository "${ctx.repoName ?? 'unknown'}".

Domain: ${ctx.domain}

VERIFIED FINDINGS:
${JSON.stringify(ctx.verifiedFindings, null, 2)}`,
  };
}

// ─── Documentation Prompts ──────────────────────────────────────────────────

export function documentationAnalyzerPrompt(ctx: DocumentationAnalyzerContext): PromptPair {
  const maxChars = ctx.maxChars ?? 50000;
  const codeContext = buildCodeContext(ctx.files, maxChars);

  return {
    system: `You are a technical documentation expert evaluating code documentation quality.

Assess the following documentation aspects:
- README completeness (setup, usage, API reference, examples, contributing)
- Inline code comments (JSDoc/TSDoc on public APIs, complex logic explanations)
- API documentation (endpoint descriptions, request/response schemas, error codes)
- Architecture documentation (system design, data flow, component relationships)
- Example code and tutorials
- Changelog and versioning documentation
- Configuration documentation (environment variables, options)

For each section, rate:
- completeness (0.0-1.0): How much of what should be documented is documented
- accuracy (0.0-1.0): How correct and up-to-date the documentation is
- status: missing, incomplete, outdated, adequate, good, excellent

CRITICAL RULES:
1) Base assessments on actual code content, not assumptions.
2) Check if JSDoc comments match function signatures.
3) Check if README instructions match actual project structure.
4) Note any discrepancies between documented and actual behavior.

JSON Schema: ${JSON.stringify(DocumentationAnalysisSchema)}`,

    user: `Evaluate the documentation quality of this codebase:

${ctx.readmeContent ? `README CONTENT:\n${ctx.readmeContent}\n\n` : ''}${ctx.packageJson ? `PACKAGE.JSON:\n${JSON.stringify(ctx.packageJson, null, 2)}\n\n` : ''}SOURCE CODE:
${codeContext}`,
  };
}

export function documentationChallengerPrompt(ctx: ChallengerContext): PromptPair {
  const maxChars = ctx.maxChars ?? 50000;
  const codeContext = buildCodeContext(ctx.files, maxChars);

  return {
    system: `You are a documentation review expert. Verify the documentation assessment.

For EACH section evaluation:
1) Cross-check claims against the actual source code.
2) Verify that "missing" documentation is truly missing (check all files, not just README).
3) Check if inline comments compensate for lack of formal docs.
4) Assess if the completeness/accuracy scores are fair.
5) Mark as "accurate", "overly_critical", "overly_generous", or "needs_revision".

Some documentation may exist in unexpected places (code comments, config files, wiki links).

JSON Schema: ${JSON.stringify(DocumentationChallengerSchema)}`,

    user: `Verify the following documentation assessment against the source code.

ASSESSMENT TO VERIFY:
${JSON.stringify(ctx.findings, null, 2)}

SOURCE CODE:
${codeContext}`,
  };
}

export function documentationSynthesizerPrompt(ctx: SynthesizerContext): PromptPair {
  return {
    system: `You are a documentation report writer producing an actionable report.

Given the verified documentation assessment, produce:
1) Executive summary of documentation quality.
2) Sections ranked by priority (what to document first).
3) For each section: current status, gaps, specific suggestions, effort estimate.
4) Quick wins: easy documentation improvements (adding JSDoc to key exports, etc.).
5) Phased documentation plan.
6) Overall documentation grade (A-F).

Focus on actionable, specific suggestions -- not vague "add more docs".

JSON Schema: ${JSON.stringify(SynthesizerReportSchema)}`,

    user: `Generate a documentation report for repository "${ctx.repoName ?? 'unknown'}".

Domain: ${ctx.domain}

VERIFIED ASSESSMENT:
${JSON.stringify(ctx.verifiedFindings, null, 2)}`,
  };
}

// ─── Documentation Drafter / Challenger / Synthesizer Prompts ───────────────

export interface DocDrafterContext {
  frameworkInfo: string;
  apiEndpoints: string;
  dependencies: string;
  sourceFilesSummary: string;
  maxChars?: number;
}

export interface DocVerificationContext {
  sectionContent: string;
  sourceCode: string;
  sectionName: string;
}

export interface DocPolishContext {
  rawDocument: string;
  verificationNotes: string;
  repoName: string;
}

export function docDrafterPrompt(ctx: DocDrafterContext): PromptPair {
  return {
    system: `You are a senior technical writer generating project documentation from source code analysis.

Generate documentation sections based on the provided metadata and source files.
Produce four sections: Getting Started, API Reference, Architecture Overview, Configuration Guide.

CRITICAL RULES:
1) Base ALL content on actual data provided. Do not invent features or endpoints.
2) For API Reference, only include endpoints that appear in the metadata.
3) For Getting Started, derive install commands from actual package.json scripts.
4) For Architecture, describe the structure visible in the source files.
5) For Configuration, only list env vars and config files that actually exist.
6) Use Markdown formatting with proper headings, code blocks, and lists.
7) Each section should be self-contained and useful.

JSON Schema: ${JSON.stringify(DocumentationDrafterSchema)}`,

    user: `Generate documentation for this project based on the following data:

FRAMEWORK INFO:
${ctx.frameworkInfo}

API ENDPOINTS:
${ctx.apiEndpoints}

DEPENDENCIES:
${ctx.dependencies}

SOURCE FILES:
${ctx.sourceFilesSummary}`,
  };
}

export function docVerificationPrompt(ctx: DocVerificationContext): PromptPair {
  return {
    system: `You are a documentation accuracy reviewer. Verify the given documentation section against actual source code.

For the documentation section provided, check:
1) Are function signatures correct and matching the source code?
2) Are parameter names and types accurate?
3) Are any features mentioned that don't actually exist in the code?
4) Are any important features missing from the documentation?
5) Are install commands and scripts accurate?
6) Are file paths and directory references correct?

Be thorough and specific. Cite exact evidence from the source code.

JSON Schema: ${JSON.stringify(DocumentationVerificationSchema)}`,

    user: `Verify this documentation section against the source code.

SECTION: ${ctx.sectionName}

DOCUMENTATION CONTENT:
${ctx.sectionContent}

SOURCE CODE:
${ctx.sourceCode}`,
  };
}

export function docPolishPrompt(ctx: DocPolishContext): PromptPair {
  return {
    system: `You are a technical editor producing final polished documentation.

Given a raw documentation draft and verification notes, produce a polished final document.

INSTRUCTIONS:
1) Fix any inaccuracies noted in the verification feedback.
2) Improve clarity, flow, and formatting.
3) Add a table of contents at the top.
4) Ensure consistent Markdown formatting throughout.
5) Add verification badges indicating which sections were verified.
6) Do NOT add information that was not in the original draft or verification notes.
7) Preserve all accurate technical details from the original.

JSON Schema: ${JSON.stringify(DocumentationPolishSchema)}`,

    user: `Polish and finalize this documentation for repository "${ctx.repoName}".

RAW DOCUMENT:
${ctx.rawDocument}

VERIFICATION NOTES:
${ctx.verificationNotes}`,
  };
}

// ─── Dependency Prompts ─────────────────────────────────────────────────────

export function dependencyAnalyzerPrompt(ctx: DependencyAnalyzerContext): PromptPair {
  const maxChars = ctx.maxChars ?? 50000;
  const codeContext = buildCodeContext(ctx.files, maxChars);

  return {
    system: `You are a dependency security and health expert analyzing project dependencies.

Evaluate dependencies for:
- Known vulnerabilities (CVEs) in current versions
- Outdated packages (major version behind, unmaintained > 2 years)
- License risks (GPL in commercial projects, AGPL, SSPL, unknown licenses)
- Deprecated packages (official deprecation notices)
- Unmaintained packages (no commits in 2+ years, archived repos)
- Excessive transitive dependencies (packages pulling in huge dep trees)
- Duplicate packages (same functionality from different packages)
- Lockfile issues (missing lockfile, outdated lockfile)
- Version pinning issues (ranges too wide, missing caret/tilde)

CRITICAL RULES:
1) Only flag issues you are CONFIDENT about based on the dependency data.
2) Include the package name, current version, and latest version if known.
3) For vulnerabilities, include CVE IDs when known.
4) For license issues, specify the problematic license.
5) Check if dev dependencies vs production dependencies matters for the issue.

JSON Schema: ${JSON.stringify(DependencyAnalysisSchema)}`,

    user: `Analyze the dependencies of this project:

${ctx.packageJson ? `PACKAGE.JSON:\n${JSON.stringify(ctx.packageJson, null, 2)}\n\n` : ''}${ctx.lockfileContent ? `LOCKFILE (excerpt):\n${ctx.lockfileContent.slice(0, 10000)}\n\n` : ''}SOURCE CODE (for usage context):
${codeContext}`,
  };
}

export function dependencyChallengerPrompt(ctx: ChallengerContext): PromptPair {
  const maxChars = ctx.maxChars ?? 50000;
  const codeContext = buildCodeContext(ctx.files, maxChars);

  return {
    system: `You are a dependency review expert. Verify each dependency finding.

For EACH finding:
1) Check if the vulnerability is actually exploitable in this project's usage.
2) Verify version numbers against the actual package.json.
3) Check if the "outdated" package is actually stable and intentionally pinned.
4) For license risks, check if the package is only a dev dependency (less risky).
5) Verify that deprecated alternatives actually exist and are better.
6) Mark as "verified" only if the issue is real and actionable.

Be SKEPTICAL. Not every outdated package needs updating, and not every CVE is exploitable.

JSON Schema: ${JSON.stringify(DependencyChallengerSchema)}`,

    user: `Verify the following dependency findings:

FINDINGS TO VERIFY:
${JSON.stringify(ctx.findings, null, 2)}

SOURCE CODE AND CONFIG:
${codeContext}`,
  };
}

export function dependencySynthesizerPrompt(ctx: SynthesizerContext): PromptPair {
  return {
    system: `You are a dependency health report writer producing an actionable report.

Given verified dependency findings, produce:
1) Executive summary of dependency health.
2) Findings ranked by severity (critical vulnerabilities first).
3) For each: package name, issue type, current vs recommended version, remediation steps.
4) Quick wins: safe version bumps, drop-in replacements.
5) Phased update plan (group related updates, note breaking changes).
6) Overall dependency health grade (A-F).

Note breaking changes and migration effort for major version updates.

JSON Schema: ${JSON.stringify(SynthesizerReportSchema)}`,

    user: `Generate a dependency health report for repository "${ctx.repoName ?? 'unknown'}".

Domain: ${ctx.domain}

VERIFIED FINDINGS:
${JSON.stringify(ctx.verifiedFindings, null, 2)}`,
  };
}
