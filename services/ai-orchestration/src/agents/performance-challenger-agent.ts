// =====================================================
// PERFORMANCE CHALLENGER AGENT - FINDING VERIFICATION
// =====================================================
// Debate triad role: CHALLENGER
// Receives unverified performance findings from the
// PerformanceAnalyzerAgent and verifies each one by checking
// actual file contents, looking for mitigating patterns
// (caching, memoization, pagination), and context (startup vs request).

import {
  EnhancedBaseA2AAgent,
  AnalysisRequest,
  AnalysisResult,
  Finding,
  Recommendation,
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
// PERFORMANCE CHALLENGER AGENT
// =====================================================

export class PerformanceChallengerAgent extends EnhancedBaseA2AAgent {

  constructor(communicationBus: A2ACommunicationBus) {
    const capabilities: A2ACapabilities = {
      methods: [
        'verify_performance_findings',
        'check_optimizations',
        'assess_false_positives'
      ],
      domains: [A2AAgentDomain.PERFORMANCE],
      maxConcurrentRequests: 5,
      supportedProtocolVersion: '1.0',
      features: [
        'finding_verification',
        'optimization_detection',
        'context_assessment',
        'debate_challenger_role'
      ]
    };

    super('PerformanceChallengerAgent', A2AAgentDomain.PERFORMANCE, capabilities, 7, communicationBus);
  }

  // =====================================================
  // MAIN ANALYSIS ENTRY POINT
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`[PerformanceChallenger] Verifying findings for ${request.type}`);
    const startTime = Date.now();

    try {
      const findingsToVerify: Finding[] = request.parameters?.findingsToVerify ?? [];
      const sourceFiles = this.resolveSourceFiles(request);

      if (findingsToVerify.length === 0) {
        return this.createEmptyResult(request, 'No findings to verify');
      }

      console.log(`[PerformanceChallenger] Verifying ${findingsToVerify.length} finding(s) against ${sourceFiles.size} file(s)`);

      const verificationResults: VerificationResult[] = [];
      const verifiedFindings: Finding[] = [];
      const falsePositives: Finding[] = [];

      for (const finding of findingsToVerify) {
        const result = this.verifyFinding(finding, sourceFiles);
        verificationResults.push(result);

        const updatedFinding: Finding = {
          ...finding,
          verificationStatus: result.verified ? 'verified' : 'false_positive',
          verificationEvidence: result.evidence,
          challengerNotes: result.mitigationsFound.length > 0
            ? `Mitigations found: ${result.mitigationsFound.join('; ')}`
            : undefined,
          confidence: result.adjustedConfidence,
          severity: result.adjustedSeverity ?? finding.severity
        };

        if (result.verified) {
          verifiedFindings.push(updatedFinding);
        } else {
          falsePositives.push(updatedFinding);
        }
      }

      const recommendations: Recommendation[] = verificationResults
        .filter(vr => vr.verified)
        .map(vr => ({
          id: `perf_challenge_rec_${uuidv4().slice(0, 8)}`,
          type: 'verification_result',
          priority: 'medium' as const,
          title: `Verified: finding ${vr.findingId}`,
          description: vr.evidence,
          impact: `Adjusted confidence: ${vr.adjustedConfidence}`,
          effort: 'low' as const,
          implementation: vr.mitigationsFound.length > 0
            ? [`Review existing optimizations: ${vr.mitigationsFound.join(', ')}`]
            : ['No existing optimizations found -- implement fix'],
          relatedFindings: [vr.findingId],
          estimatedValue: Math.round(vr.adjustedConfidence * 100)
        }));

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: 0.85,
        findings: verifiedFindings,
        recommendations,
        metrics: {
          totalVerified: findingsToVerify.length,
          confirmedFindings: verifiedFindings.length,
          falsePositives: falsePositives.length,
          falsePositiveRate: findingsToVerify.length > 0
            ? falsePositives.length / findingsToVerify.length
            : 0
        },
        rawData: {
          verificationResults,
          falsePositives
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[PerformanceChallenger] Verification failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // FINDING VERIFICATION
  // =====================================================

  private verifyFinding(finding: Finding, sourceFiles: Map<string, string>): VerificationResult {
    const filePath = finding.location?.file;
    const claimedLine = finding.location?.line;

    // Step 1: Confirm the file exists
    if (!filePath || !sourceFiles.has(filePath)) {
      return {
        findingId: finding.id,
        verified: false,
        evidence: `File '${filePath}' not available for verification`,
        adjustedConfidence: 0.1,
        mitigationsFound: [],
        challengerAgent: this.id
      };
    }

    const fileContent = sourceFiles.get(filePath)!;
    const lines = fileContent.split('\n');

    // Step 2: Validate line range
    if (claimedLine && (claimedLine < 1 || claimedLine > lines.length)) {
      return {
        findingId: finding.id,
        verified: false,
        evidence: `Claimed line ${claimedLine} is out of range (file has ${lines.length} lines)`,
        adjustedConfidence: 0.05,
        mitigationsFound: [],
        challengerAgent: this.id
      };
    }

    const lineContent = claimedLine ? lines[claimedLine - 1] : '';

    // Step 3: Confirm the pattern exists at the claimed location
    const patternConfirmed = this.confirmPattern(finding.type, lineContent);
    if (!patternConfirmed) {
      return {
        findingId: finding.id,
        verified: false,
        evidence: `Pattern '${finding.type}' not confirmed at ${filePath}:${claimedLine}. Line does not contain expected pattern.`,
        adjustedConfidence: 0.1,
        mitigationsFound: [],
        challengerAgent: this.id
      };
    }

    // Step 4: Check for mitigations based on finding type
    const mitigations = this.findMitigations(finding.type, filePath, fileContent, claimedLine);

    // Step 5: Check if it's a test file
    if (this.isTestFile(filePath)) {
      return {
        findingId: finding.id,
        verified: false,
        evidence: `Finding is in a test file (${filePath}) -- performance in tests is rarely a production concern.`,
        adjustedConfidence: 0.1,
        mitigationsFound: ['test_file'],
        challengerAgent: this.id
      };
    }

    // Step 6: Determine verdict
    const hasMitigations = mitigations.length > 0;
    let adjustedConfidence = finding.confidence;
    let adjustedSeverity = finding.severity;

    if (hasMitigations) {
      adjustedConfidence = Math.max(0.15, finding.confidence - 0.25);
      const downgrade: Record<string, Finding['severity']> = {
        critical: 'high',
        high: 'medium',
        medium: 'low',
        low: 'info',
        info: 'info'
      };
      adjustedSeverity = downgrade[finding.severity] ?? finding.severity;
    } else {
      adjustedConfidence = Math.min(0.95, finding.confidence + 0.1);
    }

    return {
      findingId: finding.id,
      verified: true,
      evidence: hasMitigations
        ? `Pattern confirmed at ${filePath}:${claimedLine} with mitigations: ${mitigations.join(', ')}. Severity downgraded.`
        : `Pattern confirmed at ${filePath}:${claimedLine}. No mitigations found. Finding is valid.`,
      adjustedSeverity,
      adjustedConfidence,
      mitigationsFound: mitigations,
      challengerAgent: this.id
    };
  }

  // =====================================================
  // PATTERN CONFIRMATION
  // =====================================================

  private confirmPattern(findingType: string, lineContent: string): boolean {
    const patterns: Record<string, RegExp> = {
      nested_loop: /\b(for|while)\s*\(/,
      string_concat_in_loop: /(\+\s*=|\+\s*['"`]|['"`]\s*\+)/,
      sync_io: /\b(readFileSync|writeFileSync|appendFileSync|existsSync|mkdirSync|statSync|readdirSync|execSync|spawnSync|accessSync)\b/,
      missing_await: /\b(fetch|\.query|\.findOne|\.findMany|\.create|\.update|\.delete|\.save|\.remove|\.execute)\s*\(/
    };

    const pattern = patterns[findingType];
    if (!pattern) return true;
    return pattern.test(lineContent);
  }

  // =====================================================
  // MITIGATION DETECTION
  // =====================================================

  private findMitigations(
    findingType: string,
    filePath: string,
    fileContent: string,
    claimedLine?: number
  ): string[] {
    const mitigations: string[] = [];
    const lines = fileContent.split('\n');

    // Neighborhood: 10 lines before and after
    const start = Math.max(0, (claimedLine ?? 1) - 11);
    const end = Math.min(lines.length, (claimedLine ?? 1) + 10);
    const neighborhood = lines.slice(start, end).join('\n');

    // Broader file context
    const fullText = fileContent;

    switch (findingType) {
      case 'nested_loop': {
        // Check for caching, memoization, pagination, Map/Set lookups
        if (/\b(cache|memoize|memo|useMemo|useCallback|lru|LRU)\b/i.test(neighborhood)) {
          mitigations.push('caching_or_memoization_nearby');
        }
        if (/\b(Map|Set|WeakMap|WeakSet)\b/.test(neighborhood)) {
          mitigations.push('indexed_data_structure_nearby');
        }
        if (/\b(paginate|pagination|limit|offset|skip|take|cursor)\b/i.test(neighborhood)) {
          mitigations.push('pagination_nearby');
        }
        // Check if the outer data set is small/bounded
        if (/\.length\s*[<>]=?\s*\d{1,2}\b/.test(neighborhood)) {
          mitigations.push('bounded_iteration_size');
        }
        break;
      }

      case 'string_concat_in_loop': {
        // Check for Array.push + join pattern nearby
        if (/\.(push|join)\s*\(/.test(neighborhood)) {
          mitigations.push('array_join_pattern_nearby');
        }
        // Check if it's a small loop (known small iteration count)
        if (/\.length\s*[<>]=?\s*\d{1,2}\b/.test(neighborhood)) {
          mitigations.push('bounded_iteration_count');
        }
        break;
      }

      case 'sync_io': {
        // Check if this is in a startup/initialization context
        const functionContext = this.getFunctionContext(lines, claimedLine ?? 1);
        if (/\b(init|setup|bootstrap|configure|startup|main|constructor|module\.exports)\b/i.test(functionContext)) {
          mitigations.push('startup_or_initialization_context');
        }
        // Check if it's at the top level (module scope) -- typically run once
        if (claimedLine && this.isTopLevelCode(lines, claimedLine)) {
          mitigations.push('module_scope_runs_once');
        }
        // Check if it's inside a try-catch
        if (/\btry\s*\{/.test(neighborhood)) {
          mitigations.push('error_handling_present');
        }
        break;
      }

      case 'missing_await': {
        // Check if it is an intentional fire-and-forget with .catch()
        if (/\.catch\s*\(/.test(neighborhood)) {
          mitigations.push('catch_handler_present');
        }
        // Check for void keyword (explicit fire-and-forget)
        if (/\bvoid\b/.test(neighborhood)) {
          mitigations.push('explicit_void_fire_and_forget');
        }
        // Check if result is used later (Promise.all, etc.)
        if (/\bPromise\.(all|allSettled|race|any)\b/.test(fullText)) {
          mitigations.push('promise_combinators_used');
        }
        // Check if it is in an event handler or callback (less critical)
        if (/\b(on|once|addEventListener|subscribe)\s*\(/.test(neighborhood)) {
          mitigations.push('event_handler_context');
        }
        break;
      }
    }

    return mitigations;
  }

  /**
   * Get the surrounding function context for a given line.
   */
  private getFunctionContext(lines: string[], lineNum: number): string {
    // Look backwards for the function declaration
    for (let i = Math.min(lineNum - 1, lines.length - 1); i >= Math.max(0, lineNum - 30); i--) {
      if (/\b(function|async\s+function|class|constructor|\w+\s*\(.*\)\s*\{|\w+\s*=\s*(async\s+)?\(.*\)\s*=>)/.test(lines[i])) {
        return lines.slice(i, Math.min(i + 3, lines.length)).join('\n');
      }
    }
    return '';
  }

  /**
   * Check if a line is at the top level of the module (not inside any function/class).
   */
  private isTopLevelCode(lines: string[], lineNum: number): boolean {
    let braceDepth = 0;
    for (let i = 0; i < lineNum - 1 && i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
    }
    return braceDepth === 0;
  }

  // =====================================================
  // UTILITIES
  // =====================================================

  private isTestFile(filePath: string): boolean {
    return /\.(test|spec|__test__|__spec__)\.[jt]sx?$/.test(filePath)
      || /[/\\](test|tests|__tests__|__mocks__|fixtures?)[/\\]/.test(filePath);
  }

  private resolveSourceFiles(request: AnalysisRequest): Map<string, string> {
    if (request.sourceFiles && request.sourceFiles.size > 0) return request.sourceFiles;
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

  private createEmptyResult(request: AnalysisRequest, reason: string): AnalysisResult {
    return {
      requestId: request.id,
      agentId: this.id,
      domain: this.domain,
      timestamp: Date.now(),
      status: 'success',
      confidence: 0.5,
      findings: [],
      recommendations: [],
      metrics: { totalVerified: 0, note: reason } as any
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

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const relevant = ['performance', 'optimization', 'verification', 'challenge'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.performanceImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Performance challenger verification supports this proposal.'
      : 'Performance challenger found issues with the proposed findings.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['performance', 'optimization', 'verification', 'bottleneck'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { PerformanceChallengerAgent };
