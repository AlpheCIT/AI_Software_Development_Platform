// =====================================================
// SECURITY ANALYZER AGENT - REAL REGEX-BASED ANALYSIS
// =====================================================
// Debate triad role: ANALYZER
// Scans source files for security vulnerabilities using context-aware
// regex patterns. Findings are unverified until the challenger reviews them.

import {
  EnhancedBaseA2AAgent,
  AnalysisRequest,
  AnalysisResult,
  Finding,
  Recommendation,
  BusinessContext,
  CodeLocation,
  VerificationResult
} from './enhanced-base-agent.js';
import {
  A2AAgentDomain,
  A2ACapabilities,
  A2AContext,
  A2ACommunicationBus
} from '../communication/a2a-protocol.js';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// SECURITY-SPECIFIC INTERFACES
// =====================================================

interface SecurityFinding extends Finding {
  cveId?: string;
  cvssScore?: number;
  exploitability: 'none' | 'low' | 'medium' | 'high' | 'critical';
  threatVector: string;
  affectedAssets: string[];
  mitigationStatus: 'none' | 'partial' | 'complete';
  attackComplexity: 'low' | 'high';
  dataIntegrity: 'none' | 'partial' | 'complete';
  availabilityImpact: 'none' | 'partial' | 'complete';
}

// =====================================================
// HELPER: Strip comments and string contents
// =====================================================

/**
 * Strips comments and string literal contents from source code.
 * Preserves line structure (newlines stay intact) so line numbers remain valid.
 * String delimiters are kept but their contents are replaced with spaces.
 */
function stripCommentsAndStrings(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];

  let inBlockComment = false;

  for (const line of lines) {
    let stripped = '';
    let i = 0;

    if (inBlockComment) {
      const endIdx = line.indexOf('*/');
      if (endIdx === -1) {
        // Entire line is inside a block comment -- blank it out
        result.push(' '.repeat(line.length));
        continue;
      }
      // Skip past the closing */
      i = endIdx + 2;
      stripped += ' '.repeat(i);
      inBlockComment = false;
    }

    while (i < line.length) {
      const ch = line[i];
      const next = i + 1 < line.length ? line[i + 1] : '';

      // Line comment
      if (ch === '/' && next === '/') {
        stripped += ' '.repeat(line.length - i);
        break;
      }

      // Block comment start
      if (ch === '/' && next === '*') {
        const endIdx = line.indexOf('*/', i + 2);
        if (endIdx === -1) {
          inBlockComment = true;
          stripped += ' '.repeat(line.length - i);
          break;
        }
        const span = endIdx + 2 - i;
        stripped += ' '.repeat(span);
        i = endIdx + 2;
        continue;
      }

      // String literals -- replace contents with spaces, keep delimiters conceptually
      if (ch === "'" || ch === '"' || ch === '`') {
        const quote = ch;
        stripped += ch;
        i++;
        while (i < line.length) {
          if (line[i] === '\\' && i + 1 < line.length) {
            stripped += '  '; // escaped char -> two spaces
            i += 2;
            continue;
          }
          if (line[i] === quote) {
            stripped += line[i];
            i++;
            break;
          }
          // Template literal expressions ${...} -- keep them since they are code
          if (quote === '`' && line[i] === '$' && i + 1 < line.length && line[i + 1] === '{') {
            stripped += '${';
            i += 2;
            let braceDepth = 1;
            while (i < line.length && braceDepth > 0) {
              if (line[i] === '{') braceDepth++;
              if (line[i] === '}') braceDepth--;
              stripped += line[i];
              i++;
            }
            continue;
          }
          stripped += ' ';
          i++;
        }
        continue;
      }

      stripped += ch;
      i++;
    }

    result.push(stripped);
  }

  return result.join('\n');
}

// =====================================================
// SECURITY ANALYZER AGENT
// =====================================================

export class EnhancedSecurityExpertAgent extends EnhancedBaseA2AAgent {
  private securityKnowledge: Map<string, any> = new Map();

  constructor(communicationBus: A2ACommunicationBus) {
    const capabilities: A2ACapabilities = {
      methods: [
        'analyze_security_vulnerabilities',
        'assess_authentication_security',
        'analyze_data_exposure',
        'check_compliance',
        'comprehensive_security_analysis'
      ],
      domains: [A2AAgentDomain.SECURITY],
      maxConcurrentRequests: 5,
      supportedProtocolVersion: '1.0',
      features: [
        'vulnerability_scanning',
        'compliance_checking',
        'threat_assessment',
        'security_code_review',
        'debate_analyzer_role'
      ]
    };

    super('SecurityAnalyzerAgent', A2AAgentDomain.SECURITY, capabilities, 8, communicationBus);
    this.initializeSecurityKnowledge();
  }

  // =====================================================
  // MAIN ANALYSIS ENTRY POINT
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`[SecurityAnalyzer] Analyzing ${request.type}`);
    const startTime = Date.now();

    try {
      // Resolve source files from request parameters or top-level field
      const sourceFiles: Map<string, string> = this.resolveSourceFiles(request);

      if (sourceFiles.size === 0) {
        console.warn('[SecurityAnalyzer] No source files provided -- returning empty result');
        return this.createEmptyResult(request, 'No source files available for analysis');
      }

      console.log(`[SecurityAnalyzer] Scanning ${sourceFiles.size} file(s)`);

      const findings: SecurityFinding[] = [];
      const recommendations: Recommendation[] = [];

      for (const [filePath, fileContent] of sourceFiles) {
        const fileFindings = this.analyzeFile(filePath, fileContent);
        findings.push(...fileFindings);
      }

      // Generate one recommendation per finding
      for (const finding of findings) {
        recommendations.push(this.createSecurityRecommendation(finding, request.businessContext));
      }

      const securityScore = this.calculateSecurityScore(findings);

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: findings.length > 0 ? 0.75 : 0.5,
        findings: findings as Finding[],
        recommendations,
        metrics: {
          securityScore,
          vulnerabilityCount: findings.length,
          criticalVulnerabilities: findings.filter(f => f.severity === 'critical').length,
          highVulnerabilities: findings.filter(f => f.severity === 'high').length,
          filesScanned: sourceFiles.size
        },
        businessImpact: this.generateBusinessImpact(findings, request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[SecurityAnalyzer] Analysis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // SOURCE FILE RESOLUTION
  // =====================================================

  private resolveSourceFiles(request: AnalysisRequest): Map<string, string> {
    // Check top-level sourceFiles first
    if (request.sourceFiles && request.sourceFiles.size > 0) {
      return request.sourceFiles;
    }
    // Check parameters.sourceFiles (may be a Map or plain object)
    const paramFiles = request.parameters?.sourceFiles;
    if (paramFiles) {
      if (paramFiles instanceof Map) return paramFiles;
      if (typeof paramFiles === 'object') {
        const map = new Map<string, string>();
        for (const [k, v] of Object.entries(paramFiles)) {
          if (typeof v === 'string') map.set(k, v);
        }
        return map;
      }
    }
    return new Map();
  }

  // =====================================================
  // PER-FILE ANALYSIS
  // =====================================================

  private analyzeFile(filePath: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = content.split('\n');
    const stripped = stripCommentsAndStrings(content);
    const strippedLines = stripped.split('\n');

    // Skip non-code files
    if (!this.isCodeFile(filePath)) return findings;

    // --- SQL Injection ---
    this.detectSqlInjection(filePath, lines, strippedLines, findings);

    // --- XSS ---
    this.detectXss(filePath, lines, strippedLines, findings);

    // --- Hardcoded Secrets ---
    this.detectHardcodedSecrets(filePath, lines, strippedLines, findings);

    // --- Missing Auth Middleware ---
    this.detectMissingAuth(filePath, lines, strippedLines, findings);

    return findings;
  }

  // =====================================================
  // VULNERABILITY DETECTORS
  // =====================================================

  private detectSqlInjection(
    filePath: string,
    originalLines: string[],
    strippedLines: string[],
    findings: SecurityFinding[]
  ): void {
    // Pattern: query/execute/raw followed by template literal with ${} or string concatenation with +
    const sqlPattern = /\b(query|execute|raw|rawQuery|sequelize\.literal)\s*\(\s*(`[^`]*\$\{|['"][^'"]*['"]\s*\+|\+\s*\w)/;
    // Simpler pattern: direct string concat in a query-like call
    const concatPattern = /\b(query|execute|raw)\s*\([^)]*\+\s*\w+/;

    for (let i = 0; i < strippedLines.length; i++) {
      const line = strippedLines[i];
      if (sqlPattern.test(line) || concatPattern.test(line)) {
        findings.push(this.buildSecurityFinding({
          type: 'sql_injection',
          severity: 'high',
          title: 'Potential SQL Injection',
          description: 'Dynamic string interpolation or concatenation detected in a database query call. User-controlled input may reach the query without parameterization.',
          filePath,
          line: i + 1,
          originalLine: originalLines[i],
          cveId: 'CWE-89',
          cvssScore: 8.1,
          exploitability: 'high',
          confidence: 0.7,
          threatVector: 'Network-based SQL injection via unsanitized input',
          affectedAssets: ['database', 'user_data'],
          attackComplexity: 'low',
          dataIntegrity: 'complete',
          availabilityImpact: 'partial'
        }));
      }
    }
  }

  private detectXss(
    filePath: string,
    originalLines: string[],
    strippedLines: string[],
    findings: SecurityFinding[]
  ): void {
    const innerHtmlPattern = /\.innerHTML\s*=/;
    const dangerouslyPattern = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/;
    // Also catch document.write
    const docWritePattern = /document\.write\s*\(/;

    for (let i = 0; i < strippedLines.length; i++) {
      const line = strippedLines[i];

      if (innerHtmlPattern.test(line)) {
        // Check if it is assigned a static string (low risk) vs a variable (higher risk)
        const isStatic = /\.innerHTML\s*=\s*['"`][^'"]*['"`]\s*;?\s*$/.test(line);
        if (!isStatic) {
          findings.push(this.buildSecurityFinding({
            type: 'cross_site_scripting',
            severity: 'medium',
            title: 'Potential XSS via innerHTML',
            description: 'innerHTML is assigned a non-static value. If user-controlled data reaches this assignment, it enables cross-site scripting.',
            filePath,
            line: i + 1,
            originalLine: originalLines[i],
            cveId: 'CWE-79',
            cvssScore: 6.1,
            exploitability: 'medium',
            confidence: 0.5,
            threatVector: 'Client-side script injection',
            affectedAssets: ['web_application', 'user_sessions'],
            attackComplexity: 'low',
            dataIntegrity: 'partial',
            availabilityImpact: 'none'
          }));
        }
      }

      if (dangerouslyPattern.test(line)) {
        findings.push(this.buildSecurityFinding({
          type: 'cross_site_scripting',
          severity: 'medium',
          title: 'Potential XSS via dangerouslySetInnerHTML',
          description: 'React dangerouslySetInnerHTML used. Verify that the HTML content is properly sanitized before rendering.',
          filePath,
          line: i + 1,
          originalLine: originalLines[i],
          cveId: 'CWE-79',
          cvssScore: 6.1,
          exploitability: 'medium',
          confidence: 0.5,
          threatVector: 'Client-side script injection via React',
          affectedAssets: ['web_application', 'user_sessions'],
          attackComplexity: 'low',
          dataIntegrity: 'partial',
          availabilityImpact: 'none'
        }));
      }

      if (docWritePattern.test(line)) {
        findings.push(this.buildSecurityFinding({
          type: 'cross_site_scripting',
          severity: 'medium',
          title: 'Potential XSS via document.write',
          description: 'document.write() can introduce XSS if user-controlled data is passed.',
          filePath,
          line: i + 1,
          originalLine: originalLines[i],
          cveId: 'CWE-79',
          cvssScore: 6.1,
          exploitability: 'medium',
          confidence: 0.4,
          threatVector: 'Client-side script injection via document.write',
          affectedAssets: ['web_application'],
          attackComplexity: 'low',
          dataIntegrity: 'partial',
          availabilityImpact: 'none'
        }));
      }
    }
  }

  private detectHardcodedSecrets(
    filePath: string,
    originalLines: string[],
    strippedLines: string[],
    findings: SecurityFinding[]
  ): void {
    // Look for variable assignments where the name looks like a secret and value is a string literal (not process.env)
    const secretNamePattern = /\b(password|secret|api_?key|apikey|token|private_?key|auth_?token|access_?key)\b/i;

    for (let i = 0; i < originalLines.length; i++) {
      const original = originalLines[i];
      const stripped = strippedLines[i];

      // Must have an assignment to a string literal
      if (!secretNamePattern.test(stripped)) continue;

      // Check it is an assignment (=, :) followed by a string literal in the ORIGINAL line
      const assignmentPattern = /(?:password|secret|api_?key|apikey|token|private_?key|auth_?token|access_?key)\s*[:=]\s*['"`]/i;
      if (!assignmentPattern.test(original)) continue;

      // Exclude references to process.env or os.environ
      if (/process\.env|os\.environ|env\[|getenv|Environment\./i.test(original)) continue;

      // Exclude empty strings and placeholder values
      if (/[:=]\s*['"`]\s*['"`]/.test(original)) continue;
      if (/[:=]\s*['"`](changeme|todo|xxx|placeholder|your[_-])/i.test(original)) continue;

      // Exclude test files
      if (this.isTestFile(filePath)) continue;

      findings.push(this.buildSecurityFinding({
        type: 'hardcoded_credentials',
        severity: 'critical',
        title: 'Hardcoded Secret or Credential',
        description: `A variable matching a secret pattern (password, token, api_key, etc.) is assigned a string literal instead of using environment variables or a secret manager.`,
        filePath,
        line: i + 1,
        originalLine: originalLines[i],
        cveId: 'CWE-798',
        cvssScore: 9.0,
        exploitability: 'high',
        confidence: 0.7,
        threatVector: 'Credential exposure via source code',
        affectedAssets: ['credentials', 'system_access'],
        attackComplexity: 'low',
        dataIntegrity: 'complete',
        availabilityImpact: 'complete'
      }));
    }
  }

  private detectMissingAuth(
    filePath: string,
    originalLines: string[],
    strippedLines: string[],
    findings: SecurityFinding[]
  ): void {
    // Look for Express-style route handlers: app.get/post/put/delete/patch
    // or router.get/post/put/delete/patch
    // A handler WITH auth middleware typically has 3+ arguments: (path, authMiddleware, handler)
    // A handler WITHOUT: (path, handler) -- only 2 args
    const routePattern = /\b(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`][^'"]+['"`]\s*,\s*/;

    for (let i = 0; i < strippedLines.length; i++) {
      const line = strippedLines[i];
      if (!routePattern.test(line)) continue;

      // Check if there's evidence of auth middleware on the same line or a few lines around
      const contextWindow = strippedLines.slice(Math.max(0, i - 2), Math.min(strippedLines.length, i + 5)).join(' ');
      const authPatterns = /\b(auth|authenticate|authorize|requireAuth|isAuthenticated|passport|jwt|verifyToken|requireRole|protect|guard)\b/i;

      if (!authPatterns.test(contextWindow)) {
        // Count comma-separated arguments to see if middleware is present
        // Simple heuristic: if the route call has only path + one callback, likely no middleware
        const afterPath = line.replace(routePattern, '');
        const hasMiddleware = /\w+\s*,/.test(afterPath); // another identifier before the last callback

        if (!hasMiddleware) {
          findings.push(this.buildSecurityFinding({
            type: 'missing_authentication',
            severity: 'high',
            title: 'Route Handler Without Authentication Middleware',
            description: 'An Express route handler appears to lack authentication middleware. Sensitive endpoints should require authentication.',
            filePath,
            line: i + 1,
            originalLine: originalLines[i],
            cveId: 'CWE-306',
            cvssScore: 7.5,
            exploitability: 'high',
            confidence: 0.4,
            threatVector: 'Unauthenticated access to protected endpoint',
            affectedAssets: ['api_endpoints', 'user_data'],
            attackComplexity: 'low',
            dataIntegrity: 'partial',
            availabilityImpact: 'none'
          }));
        }
      }
    }
  }

  // =====================================================
  // FINDING BUILDER
  // =====================================================

  private buildSecurityFinding(params: {
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    filePath: string;
    line: number;
    originalLine: string;
    cveId: string;
    cvssScore: number;
    exploitability: SecurityFinding['exploitability'];
    confidence: number;
    threatVector: string;
    affectedAssets: string[];
    attackComplexity: SecurityFinding['attackComplexity'];
    dataIntegrity: SecurityFinding['dataIntegrity'];
    availabilityImpact: SecurityFinding['availabilityImpact'];
  }): SecurityFinding {
    return {
      id: `${params.type}_${uuidv4().slice(0, 8)}`,
      type: params.type,
      severity: params.severity,
      title: params.title,
      description: params.description,
      location: {
        file: params.filePath,
        line: params.line
      },
      evidence: {
        pattern: params.type,
        matchedLine: params.originalLine.trim(),
        detectionMethod: 'regex'
      },
      confidence: params.confidence,
      verificationStatus: 'unverified',
      verificationMethod: 'regex',
      cveId: params.cveId,
      cvssScore: params.cvssScore,
      exploitability: params.exploitability,
      threatVector: params.threatVector,
      affectedAssets: params.affectedAssets,
      mitigationStatus: 'none',
      attackComplexity: params.attackComplexity,
      dataIntegrity: params.dataIntegrity,
      availabilityImpact: params.availabilityImpact
    };
  }

  // =====================================================
  // RECOMMENDATION GENERATOR
  // =====================================================

  private createSecurityRecommendation(finding: SecurityFinding, businessContext?: BusinessContext): Recommendation {
    const remediationSteps = this.getRemediationSteps(finding.type);
    const priorityMap = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'low' } as const;

    return {
      id: `sec_rec_${uuidv4().slice(0, 8)}`,
      type: 'security_improvement',
      priority: priorityMap[finding.severity],
      title: `Remediate: ${finding.title}`,
      description: `Fix ${finding.type} in ${finding.location?.file}:${finding.location?.line} -- ${finding.description}`,
      impact: this.getSecurityImpactDescription(finding.type),
      effort: finding.severity === 'critical' || finding.severity === 'high' ? 'medium' : 'low',
      implementation: remediationSteps,
      relatedFindings: [finding.id],
      estimatedValue: finding.cvssScore ? Math.round(finding.cvssScore * 10) : 50,
      businessJustification: businessContext?.criticality === 'critical'
        ? `Critical business system -- addressing this ${finding.severity} vulnerability is mandatory.`
        : `Reduces security exposure and protects organizational assets.`
    };
  }

  private getRemediationSteps(findingType: string): string[] {
    const steps: Record<string, string[]> = {
      sql_injection: [
        'Replace string concatenation/interpolation with parameterized queries or prepared statements',
        'Use an ORM with built-in parameterization (e.g., Sequelize bind, Knex query builder)',
        'Add input validation and sanitization as defense-in-depth'
      ],
      cross_site_scripting: [
        'Replace innerHTML with textContent where HTML rendering is not needed',
        'Sanitize HTML with DOMPurify before using dangerouslySetInnerHTML',
        'Add Content-Security-Policy headers to restrict inline script execution'
      ],
      hardcoded_credentials: [
        'Move the secret to environment variables (process.env.SECRET_NAME)',
        'Use a secret manager (AWS Secrets Manager, HashiCorp Vault, etc.)',
        'Rotate the exposed credential immediately',
        'Add the pattern to .gitignore and pre-commit hooks'
      ],
      missing_authentication: [
        'Add authentication middleware to the route (e.g., requireAuth, passport.authenticate)',
        'If the endpoint is intentionally public, document the reason with a code comment',
        'Add rate limiting to public endpoints to prevent abuse'
      ]
    };
    return steps[findingType] || ['Review and remediate the identified security issue'];
  }

  private getSecurityImpactDescription(findingType: string): string {
    const impacts: Record<string, string> = {
      sql_injection: 'High -- Complete database compromise possible via crafted input',
      cross_site_scripting: 'Medium -- User session hijacking and data theft possible',
      hardcoded_credentials: 'Critical -- Full system compromise if credentials are leaked',
      missing_authentication: 'High -- Unauthorized access to protected resources'
    };
    return impacts[findingType] || 'Security risk identified';
  }

  // =====================================================
  // UTILITIES
  // =====================================================

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.java', '.go', '.rb', '.rs', '.cs'];
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }

  private isTestFile(filePath: string): boolean {
    return /\.(test|spec|__test__|__spec__)\.[jt]sx?$/.test(filePath)
      || /[/\\](test|tests|__tests__|__mocks__)[/\\]/.test(filePath);
  }

  private calculateSecurityScore(findings: SecurityFinding[]): number {
    if (findings.length === 0) return 95;
    const severityWeights: Record<string, number> = { critical: 50, high: 30, medium: 15, low: 5, info: 1 };
    const totalWeight = findings.reduce((sum, f) => sum + (severityWeights[f.severity] || 5), 0);
    return Math.max(10, 100 - Math.min(totalWeight, 90));
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
      metrics: { securityScore: 100, vulnerabilityCount: 0, note: reason } as any
    };
  }

  private createErrorResult(request: AnalysisRequest, error: any): AnalysisResult {
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

  private initializeSecurityKnowledge(): void {
    console.log(`[SecurityAnalyzer] Initialized security knowledge base`);
  }

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const securityRelated = ['security', 'vulnerability', 'compliance', 'threat'];
    const contextString = JSON.stringify(context).toLowerCase();
    return securityRelated.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.securityImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Security analysis supports this proposal -- no regressions detected.'
      : 'Security concerns identified. This proposal may introduce vulnerabilities.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const securityTopics = ['vulnerability', 'security', 'compliance', 'threat'];
    return securityTopics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { SecurityFinding, stripCommentsAndStrings };
