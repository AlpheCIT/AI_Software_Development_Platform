// =====================================================
// AUTO-REMEDIATION AGENT - CODE FIX GENERATION
// =====================================================
// The key insight: finding problems is table stakes. FIXING them is the value.
// This agent receives verified findings from the debate system and generates
// actual, copy-pasteable code fixes -- not abstract suggestions.

import {
  EnhancedBaseA2AAgent,
  AnalysisRequest,
  AnalysisResult,
  Finding,
  Recommendation
} from './enhanced-base-agent.js';
import {
  A2AAgentDomain,
  A2ACapabilities,
  A2AContext,
  A2ACommunicationBus
} from '../communication/a2a-protocol.js';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// REMEDIATION PATCH INTERFACE
// =====================================================

export interface RemediationPatch {
  findingId: string;
  filePath: string;
  lineNumber: number;
  patchType: 'replace' | 'insert_before' | 'insert_after' | 'wrap';
  originalCode: string;
  fixedCode: string;
  explanation: string;
  confidence: number;
  breakingChange: boolean;
  testSuggestion: string;
}

// =====================================================
// AUTO-REMEDIATION AGENT
// =====================================================

export class AutoRemediationAgent extends EnhancedBaseA2AAgent {

  constructor(communicationBus: A2ACommunicationBus) {
    const capabilities: A2ACapabilities = {
      methods: [
        'generate_fixes',
        'create_patches',
        'suggest_refactoring'
      ],
      domains: [A2AAgentDomain.QUALITY],
      maxConcurrentRequests: 5,
      supportedProtocolVersion: '1.0',
      features: [
        'security_fix_generation',
        'performance_fix_generation',
        'quality_fix_generation',
        'patch_creation',
        'refactoring_suggestions'
      ]
    };

    super('AutoRemediationAgent', A2AAgentDomain.QUALITY, capabilities, 7, communicationBus);
  }

  // =====================================================
  // MAIN ANALYSIS ENTRY POINT
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`[AutoRemediation] Generating fixes for ${request.type}`);
    const startTime = Date.now();

    try {
      const verifiedFindings: Finding[] = request.parameters?.verifiedFindings || [];
      const sourceFiles: Record<string, string> = this.resolveSourceFilesAsObject(request);

      if (verifiedFindings.length === 0) {
        console.warn('[AutoRemediation] No verified findings provided -- nothing to remediate');
        return this.createEmptyResult(request, 'No verified findings to remediate');
      }

      console.log(`[AutoRemediation] Processing ${verifiedFindings.length} verified finding(s) across ${Object.keys(sourceFiles).length} file(s)`);

      const patches: RemediationPatch[] = [];
      const recommendations: Recommendation[] = [];

      for (const finding of verifiedFindings) {
        // Skip false positives
        if (finding.verificationStatus === 'false_positive') continue;

        const filePath = finding.location?.file || '';
        const fileContent = sourceFiles[filePath] || '';
        const lines = fileContent ? fileContent.split('\n') : [];
        const lineNumber = finding.location?.line || 1;
        const originalLine = lines[lineNumber - 1] || '';

        const patch = this.generatePatchForFinding(finding, filePath, lineNumber, originalLine, lines);
        if (patch) {
          patches.push(patch);

          // Store as recommendation with type='remediation_patch'
          recommendations.push({
            id: `rem_${uuidv4().slice(0, 8)}`,
            type: 'remediation_patch',
            priority: this.mapSeverityToPriority(finding.severity),
            title: `Auto-fix: ${finding.title}`,
            description: patch.explanation,
            impact: `Resolves ${finding.type} finding in ${filePath}:${lineNumber}`,
            effort: 'low',
            implementation: [
              `Apply patch (${patch.patchType}) at ${patch.filePath}:${patch.lineNumber}`,
              patch.breakingChange ? 'WARNING: This fix may be a breaking change -- review carefully' : 'Non-breaking change -- safe to apply',
              patch.testSuggestion
            ],
            relatedFindings: [finding.id],
            estimatedValue: Math.round(patch.confidence * 100),
            technicalDetails: {
              complexity: 'low',
              dependencies: [],
              prerequisites: [],
              risks: patch.breakingChange ? ['Potential breaking change'] : [],
              alternatives: []
            } as any
          });
        }
      }

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: patches.length > 0 ? 0.8 : 0.3,
        findings: verifiedFindings,
        recommendations,
        metrics: {
          totalFindings: verifiedFindings.length,
          patchesGenerated: patches.length,
          breakingChanges: patches.filter(p => p.breakingChange).length,
          averageConfidence: patches.length > 0
            ? patches.reduce((sum, p) => sum + p.confidence, 0) / patches.length
            : 0
        },
        rawData: { patches },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[AutoRemediation] Fix generation failed:', error);
      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'failed',
        confidence: 0,
        findings: [],
        recommendations: [],
        metrics: { error: error instanceof Error ? error.message : String(error) } as any
      };
    }
  }

  // =====================================================
  // PATCH GENERATION ROUTER
  // =====================================================

  private generatePatchForFinding(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string,
    allLines: string[]
  ): RemediationPatch | null {
    const type = finding.type.toLowerCase();

    // Security fixes
    if (type.includes('sql_injection')) {
      return this.fixSqlInjection(finding, filePath, lineNumber, originalLine);
    }
    if (type.includes('hardcoded_credentials') || type.includes('hardcoded_secret')) {
      return this.fixHardcodedSecret(finding, filePath, lineNumber, originalLine);
    }
    if (type.includes('missing_auth') || type.includes('missing_authentication')) {
      return this.fixMissingAuth(finding, filePath, lineNumber, originalLine);
    }
    if (type.includes('cross_site_scripting') || type.includes('xss')) {
      return this.fixXss(finding, filePath, lineNumber, originalLine);
    }
    if (type.includes('missing_rate_limit')) {
      return this.fixMissingRateLimit(finding, filePath, lineNumber, originalLine);
    }

    // Performance fixes
    if (type.includes('nested_loop') || type.includes('n_plus_one')) {
      return this.fixNestedLoop(finding, filePath, lineNumber, originalLine, allLines);
    }
    if (type.includes('sync_io') || type.includes('blocking_io')) {
      return this.fixSyncIo(finding, filePath, lineNumber, originalLine);
    }
    if (type.includes('string_concatenation') || type.includes('string_concat_loop')) {
      return this.fixStringConcatInLoop(finding, filePath, lineNumber, originalLine, allLines);
    }

    // Quality fixes
    if (type.includes('missing_error_boundary')) {
      return this.fixMissingErrorBoundary(finding, filePath, lineNumber, originalLine);
    }
    if (type.includes('inconsistent_error_handling') || type.includes('error_handling')) {
      return this.fixInconsistentErrorHandling(finding, filePath, lineNumber, originalLine);
    }
    if (type.includes('missing_jsdoc') || type.includes('missing_documentation')) {
      return this.fixMissingJsDoc(finding, filePath, lineNumber, originalLine, allLines);
    }

    console.warn(`[AutoRemediation] No fix generator for finding type: ${finding.type}`);
    return null;
  }

  // =====================================================
  // SECURITY FIX GENERATORS
  // =====================================================

  private fixSqlInjection(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string
  ): RemediationPatch {
    // Detect common patterns and replace with parameterized versions
    const trimmed = originalLine.trim();
    let fixedCode: string;

    if (trimmed.includes('query(') || trimmed.includes('execute(')) {
      // Transform: db.query(`SELECT * FROM users WHERE id = ${userId}`)
      // Into:     db.query('SELECT * FROM users WHERE id = ?', [userId])
      fixedCode = originalLine
        .replace(
          /(\bquery|\bexecute)\s*\(\s*`([^`]*)\$\{(\w+)\}([^`]*)`/,
          (_, fn, before, param, after) => {
            const cleanSql = `${before}?${after}`.replace(/\$\{\w+\}/g, '?');
            return `${fn}('${cleanSql}', [${param}]`;
          }
        );

      // Fallback: if template literal replacement didn't trigger, handle string concatenation
      if (fixedCode === originalLine) {
        fixedCode = originalLine.replace(
          /(\bquery|\bexecute)\s*\(\s*(['"])([^'"]*)['"]\s*\+\s*(\w+)/,
          (_, fn, q, sql, param) => `${fn}('${sql}?', [${param}]`
        );
      }

      // If nothing matched, provide a template
      if (fixedCode === originalLine) {
        const indent = originalLine.match(/^(\s*)/)?.[1] || '';
        fixedCode = `${indent}// REMEDIATION: Use parameterized queries to prevent SQL injection\n${indent}// db.query('SELECT * FROM table WHERE col = ?', [userInput])`;
      }
    } else {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      fixedCode = `${indent}// REMEDIATION: Use parameterized queries to prevent SQL injection\n${indent}// db.query('SELECT * FROM table WHERE col = ?', [userInput])`;
    }

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'replace',
      originalCode: originalLine,
      fixedCode,
      explanation: 'Replace string interpolation/concatenation in SQL query with parameterized query using bind variables',
      confidence: 0.85,
      breakingChange: false,
      testSuggestion: 'Test that query returns correct results with parameterized input and verify SQL injection payloads are safely escaped'
    };
  }

  private fixHardcodedSecret(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string
  ): RemediationPatch {
    const trimmed = originalLine.trim();
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';

    // Extract the variable name and convert to ENV_VAR_NAME format
    const varNameMatch = trimmed.match(/\b(const|let|var|export\s+(?:const|let))?\s*(\w+)\s*[:=]/);
    const varName = varNameMatch?.[2] || 'SECRET';
    const envVarName = varName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

    // Reconstruct the assignment using process.env
    let fixedCode: string;
    if (trimmed.includes(':')) {
      // Object property: apiKey: 'hardcoded' --> apiKey: process.env.API_KEY || ''
      fixedCode = `${indent}${varName}: process.env.${envVarName} || '',`;
    } else {
      // Variable assignment
      const declMatch = trimmed.match(/^(const|let|var|export\s+(?:const|let|var))\s+/);
      const decl = declMatch?.[1] || 'const';
      fixedCode = `${indent}${decl} ${varName} = process.env.${envVarName} || '';`;
    }

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'replace',
      originalCode: originalLine,
      fixedCode,
      explanation: `Replace hardcoded secret with environment variable reference (process.env.${envVarName}). Add ${envVarName} to your .env file and secret manager.`,
      confidence: 0.9,
      breakingChange: false,
      testSuggestion: `Verify that ${envVarName} is set in .env and test that the application reads the value correctly from the environment`
    };
  }

  private fixMissingAuth(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string
  ): RemediationPatch {
    // Transform: router.get('/admin/users', handler)
    // Into:     router.get('/admin/users', requireRole('Admin'), handler)
    const fixedCode = originalLine.replace(
      /((?:app|router)\.\w+\s*\(\s*['"`][^'"]+['"`])\s*,\s*/,
      "$1, requireRole('Admin'), "
    );

    // If the regex didn't match, provide a manual template
    const finalFixed = fixedCode !== originalLine
      ? fixedCode
      : originalLine.replace(
          /((?:app|router)\.\w+\s*\()/,
          "$1 /* REMEDIATION: add auth middleware, e.g. requireAuth, */ "
        );

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'replace',
      originalCode: originalLine,
      fixedCode: finalFixed,
      explanation: "Add authentication middleware (requireRole('Admin')) to the route handler to protect the endpoint from unauthorized access",
      confidence: 0.75,
      breakingChange: true,
      testSuggestion: 'Test that unauthenticated requests receive 401/403 and authenticated requests with the correct role succeed'
    };
  }

  private fixXss(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string
  ): RemediationPatch {
    const trimmed = originalLine.trim();
    let fixedCode: string;

    if (trimmed.includes('innerHTML')) {
      // Replace .innerHTML = expr with .textContent = expr
      fixedCode = originalLine.replace(/\.innerHTML\s*=/, '.textContent =');
    } else if (trimmed.includes('dangerouslySetInnerHTML')) {
      // Wrap with DOMPurify
      fixedCode = originalLine.replace(
        /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(\w+)/,
        'dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize($1)'
      );
    } else if (trimmed.includes('document.write')) {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      fixedCode = `${indent}// REMEDIATION: Replace document.write with safe DOM manipulation\n${indent}// document.getElementById('target').textContent = safeValue;`;
    } else {
      fixedCode = originalLine;
    }

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'replace',
      originalCode: originalLine,
      fixedCode,
      explanation: 'Replace unsafe HTML injection with safe DOM API (textContent) or sanitize input with DOMPurify',
      confidence: 0.8,
      breakingChange: false,
      testSuggestion: 'Verify that XSS payloads like <script>alert(1)</script> are safely escaped and that legitimate content still renders correctly'
    };
  }

  private fixMissingRateLimit(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string
  ): RemediationPatch {
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';

    const rateLimiterCode = [
      `${indent}// Rate limiter: 100 requests per 15 minutes per IP`,
      `${indent}const rateLimit = require('express-rate-limit');`,
      `${indent}const limiter = rateLimit({`,
      `${indent}  windowMs: 15 * 60 * 1000,`,
      `${indent}  max: 100,`,
      `${indent}  standardHeaders: true,`,
      `${indent}  legacyHeaders: false,`,
      `${indent}  message: { error: 'Too many requests, please try again later.' }`,
      `${indent}});`,
    ].join('\n');

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'insert_before',
      originalCode: originalLine,
      fixedCode: rateLimiterCode,
      explanation: 'Add express-rate-limit middleware to prevent abuse. Apply the limiter to the route or globally via app.use(limiter).',
      confidence: 0.7,
      breakingChange: false,
      testSuggestion: 'Send more than 100 requests in 15 minutes from the same IP and verify a 429 status is returned'
    };
  }

  // =====================================================
  // PERFORMANCE FIX GENERATORS
  // =====================================================

  private fixNestedLoop(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string,
    allLines: string[]
  ): RemediationPatch {
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';

    // Suggest Map/Set-based lookup pattern
    const fixedCode = [
      `${indent}// REMEDIATION: Replace nested loop with Map-based lookup for O(n) instead of O(n*m)`,
      `${indent}const lookupMap = new Map(secondArray.map(item => [item.id, item]));`,
      `${indent}const results = firstArray.map(item => ({`,
      `${indent}  ...item,`,
      `${indent}  matched: lookupMap.get(item.id)`,
      `${indent}})).filter(item => item.matched);`,
    ].join('\n');

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'replace',
      originalCode: originalLine,
      fixedCode,
      explanation: 'Replace O(n*m) nested loop with O(n+m) Map-based lookup. Build a Map from the inner collection, then iterate the outer collection once.',
      confidence: 0.65,
      breakingChange: false,
      testSuggestion: 'Benchmark the original vs. fixed version with a large dataset (10k+ items) and verify identical output'
    };
  }

  private fixSyncIo(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string
  ): RemediationPatch {
    let fixedCode = originalLine;

    // Common sync-to-async replacements
    const syncToAsync: [RegExp, string][] = [
      [/\breadFileSync\s*\(/, 'await readFile('],
      [/\bwriteFileSync\s*\(/, 'await writeFile('],
      [/\bexistsSync\s*\(/, 'await access('],
      [/\bmkdirSync\s*\(/, 'await mkdir('],
      [/\breaddirSync\s*\(/, 'await readdir('],
      [/\bstatSync\s*\(/, 'await stat('],
      [/\bunlinkSync\s*\(/, 'await unlink('],
      [/\bcopyFileSync\s*\(/, 'await copyFile('],
    ];

    for (const [pattern, replacement] of syncToAsync) {
      if (pattern.test(fixedCode)) {
        fixedCode = fixedCode.replace(pattern, replacement);
        // Also update the import hint
        break;
      }
    }

    // If the line uses require('fs'), suggest fs/promises
    if (fixedCode === originalLine) {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      fixedCode = `${indent}// REMEDIATION: Replace synchronous I/O with async version\n${indent}// import { readFile, writeFile } from 'fs/promises';\n${originalLine.replace(/Sync/g, '')}`;
    }

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'replace',
      originalCode: originalLine,
      fixedCode,
      explanation: 'Replace synchronous file I/O with async equivalent from fs/promises to avoid blocking the event loop',
      confidence: 0.9,
      breakingChange: true,
      testSuggestion: 'Ensure the containing function is async. Verify file operations still complete successfully and handle errors with try/catch.'
    };
  }

  private fixStringConcatInLoop(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string,
    allLines: string[]
  ): RemediationPatch {
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';

    const fixedCode = [
      `${indent}// REMEDIATION: Use Array.push + .join instead of string concatenation in a loop`,
      `${indent}const parts: string[] = [];`,
      `${indent}for (const item of items) {`,
      `${indent}  parts.push(item.toString());`,
      `${indent}}`,
      `${indent}const result = parts.join('');`,
    ].join('\n');

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'replace',
      originalCode: originalLine,
      fixedCode,
      explanation: 'Replace string concatenation in a loop (O(n^2) due to immutable strings) with Array.push + .join pattern (O(n))',
      confidence: 0.7,
      breakingChange: false,
      testSuggestion: 'Verify the resulting string is identical to the original concatenation output'
    };
  }

  // =====================================================
  // QUALITY FIX GENERATORS
  // =====================================================

  private fixMissingErrorBoundary(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string
  ): RemediationPatch {
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';

    const errorBoundaryCode = [
      `${indent}import React, { Component, ErrorInfo, ReactNode } from 'react';`,
      `${indent}`,
      `${indent}interface ErrorBoundaryProps {`,
      `${indent}  children: ReactNode;`,
      `${indent}  fallback?: ReactNode;`,
      `${indent}}`,
      `${indent}`,
      `${indent}interface ErrorBoundaryState {`,
      `${indent}  hasError: boolean;`,
      `${indent}  error: Error | null;`,
      `${indent}}`,
      `${indent}`,
      `${indent}class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {`,
      `${indent}  state: ErrorBoundaryState = { hasError: false, error: null };`,
      `${indent}`,
      `${indent}  static getDerivedStateFromError(error: Error): ErrorBoundaryState {`,
      `${indent}    return { hasError: true, error };`,
      `${indent}  }`,
      `${indent}`,
      `${indent}  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {`,
      `${indent}    console.error('ErrorBoundary caught:', error, errorInfo);`,
      `${indent}  }`,
      `${indent}`,
      `${indent}  render(): ReactNode {`,
      `${indent}    if (this.state.hasError) {`,
      `${indent}      return this.props.fallback || <div>Something went wrong.</div>;`,
      `${indent}    }`,
      `${indent}    return this.props.children;`,
      `${indent}  }`,
      `${indent}}`,
      `${indent}`,
      `${indent}export default ErrorBoundary;`,
    ].join('\n');

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'insert_before',
      originalCode: originalLine,
      fixedCode: errorBoundaryCode,
      explanation: 'Add a React ErrorBoundary component to catch rendering errors and display a fallback UI instead of crashing the entire app',
      confidence: 0.85,
      breakingChange: false,
      testSuggestion: 'Test that a component throwing an error inside the ErrorBoundary shows the fallback UI instead of a white screen'
    };
  }

  private fixInconsistentErrorHandling(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string
  ): RemediationPatch {
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';

    // Replace ad-hoc error responses with standardized sendError
    let fixedCode: string;

    if (originalLine.includes('res.status') || originalLine.includes('reply.code')) {
      fixedCode = `${indent}return sendError(res, error instanceof Error ? error.message : 'Internal server error', error instanceof Error && error.name === 'ValidationError' ? 400 : 500);`;
    } else if (originalLine.includes('catch')) {
      fixedCode = [
        originalLine,
        `${indent}  console.error('Operation failed:', error);`,
        `${indent}  return sendError(res, error instanceof Error ? error.message : 'An unexpected error occurred', 500);`,
      ].join('\n');
    } else {
      fixedCode = `${indent}// REMEDIATION: Use standardized error handling\n${indent}// return sendError(res, 'Description of error', statusCode);`;
    }

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'replace',
      originalCode: originalLine,
      fixedCode,
      explanation: 'Replace ad-hoc error responses with a standardized sendError() utility to ensure consistent error format, proper status codes, and centralized logging',
      confidence: 0.7,
      breakingChange: false,
      testSuggestion: 'Verify that error responses consistently return { error: string, statusCode: number } and that the sendError utility is imported'
    };
  }

  private fixMissingJsDoc(
    finding: Finding,
    filePath: string,
    lineNumber: number,
    originalLine: string,
    allLines: string[]
  ): RemediationPatch {
    const trimmed = originalLine.trim();
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';

    // Try to extract function signature for intelligent JSDoc generation
    const funcMatch = trimmed.match(
      /(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?/
    );

    let jsdoc: string;

    if (funcMatch) {
      const [, funcName, rawParams, returnType] = funcMatch;
      const params = rawParams
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => {
          // Handle typed params like "name: string"
          const parts = p.split(':').map(s => s.trim());
          const paramName = parts[0].replace(/[?=].*/, '').trim();
          const paramType = parts[1] || '*';
          return { name: paramName, type: paramType };
        });

      const paramLines = params.map(p => `${indent} * @param {${p.type}} ${p.name} - TODO: describe ${p.name}`);
      const returnLine = returnType && returnType !== 'void'
        ? [`${indent} * @returns {${returnType}} TODO: describe return value`]
        : [];

      jsdoc = [
        `${indent}/**`,
        `${indent} * TODO: describe what ${funcName} does`,
        `${indent} *`,
        ...paramLines,
        ...returnLine,
        `${indent} */`,
      ].join('\n');
    } else {
      jsdoc = [
        `${indent}/**`,
        `${indent} * TODO: add description`,
        `${indent} */`,
      ].join('\n');
    }

    return {
      findingId: finding.id,
      filePath,
      lineNumber,
      patchType: 'insert_before',
      originalCode: originalLine,
      fixedCode: jsdoc,
      explanation: 'Add JSDoc documentation block with @param and @returns tags inferred from the function signature',
      confidence: 0.9,
      breakingChange: false,
      testSuggestion: 'Run your documentation linter (e.g., eslint-plugin-jsdoc) to verify the JSDoc block is valid and complete'
    };
  }

  // =====================================================
  // UTILITIES
  // =====================================================

  private resolveSourceFilesAsObject(request: AnalysisRequest): Record<string, string> {
    // Check top-level sourceFiles (Map)
    if (request.sourceFiles && request.sourceFiles.size > 0) {
      const obj: Record<string, string> = {};
      for (const [k, v] of request.sourceFiles) {
        obj[k] = v;
      }
      return obj;
    }
    // Check parameters.sourceFiles (may be Map or plain object)
    const paramFiles = request.parameters?.sourceFiles;
    if (paramFiles) {
      if (paramFiles instanceof Map) {
        const obj: Record<string, string> = {};
        for (const [k, v] of paramFiles) {
          if (typeof v === 'string') obj[k] = v;
        }
        return obj;
      }
      if (typeof paramFiles === 'object') {
        return paramFiles as Record<string, string>;
      }
    }
    return {};
  }

  private mapSeverityToPriority(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }

  private createEmptyResult(request: AnalysisRequest, reason: string): AnalysisResult {
    return {
      requestId: request.id,
      agentId: this.id,
      domain: this.domain,
      timestamp: Date.now(),
      status: 'success',
      confidence: 0.3,
      findings: [],
      recommendations: [],
      metrics: { patchesGenerated: 0, note: reason } as any
    };
  }

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const remediationRelated = ['remediation', 'fix', 'patch', 'refactor', 'quality'];
    const contextString = JSON.stringify(context).toLowerCase();
    return remediationRelated.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.type === 'remediation' || proposal.qualityImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Auto-remediation agent supports this proposal -- fixes are feasible and safe.'
      : 'Auto-remediation agent has concerns -- proposed changes may introduce regressions.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const relevantTopics = ['vulnerability', 'security', 'performance', 'quality', 'fix', 'patch'];
    return relevantTopics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { AutoRemediationAgent };
