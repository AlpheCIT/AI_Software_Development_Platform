// =====================================================
// SECURITY CHALLENGER AGENT - FINDING VERIFICATION
// =====================================================
// Debate triad role: CHALLENGER
// Receives unverified findings from the SecurityAnalyzerAgent and
// verifies each one by checking actual file contents, looking for
// mitigations, and flagging false positives.

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
import { LLMClient } from '../llm/llm-client.js';
import { securityChallengerPrompt } from '../llm/prompts.js';
import { SecurityChallengerSchema } from '../llm/schemas.js';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// SECURITY CHALLENGER AGENT
// =====================================================

export class SecurityChallengerAgent extends EnhancedBaseA2AAgent {

  constructor(communicationBus: A2ACommunicationBus, llmClient?: LLMClient | null) {
    const capabilities: A2ACapabilities = {
      methods: [
        'verify_security_findings',
        'check_mitigations',
        'assess_false_positives'
      ],
      domains: [A2AAgentDomain.SECURITY],
      maxConcurrentRequests: 5,
      supportedProtocolVersion: '1.0',
      features: [
        'finding_verification',
        'mitigation_detection',
        'false_positive_assessment',
        'debate_challenger_role'
      ]
    };

    super('SecurityChallengerAgent', A2AAgentDomain.SECURITY, capabilities, 8, communicationBus, llmClient);
  }

  // =====================================================
  // MAIN ANALYSIS ENTRY POINT
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`[SecurityChallenger] Verifying findings for ${request.type}`);
    const startTime = Date.now();

    try {
      const findingsToVerify: Finding[] = request.parameters?.findingsToVerify ?? [];
      const sourceFiles: Map<string, string> = this.resolveSourceFiles(request);

      if (findingsToVerify.length === 0) {
        return this.createEmptyResult(request, 'No findings to verify');
      }

      console.log(`[SecurityChallenger] Verifying ${findingsToVerify.length} finding(s) against ${sourceFiles.size} file(s)`);

      const verificationResults: VerificationResult[] = [];
      const verifiedFindings: Finding[] = [];
      const falsePositives: Finding[] = [];

      // Try LLM-based verification first
      if (this.hasLLM() && sourceFiles.size > 0) {
        try {
          const prompt = securityChallengerPrompt({
            files: sourceFiles,
            findings: findingsToVerify.map(f => ({
              id: f.id,
              type: f.type,
              severity: f.severity,
              title: f.title,
              description: f.description,
              file: f.location?.file,
              line: f.location?.line,
              confidence: f.confidence,
              evidence: f.evidence
            }))
          });

          console.log(`[SecurityChallenger] Calling LLM for verification...`);
          const llmResult = await this.callLLM(prompt.system, prompt.user, {
            jsonSchema: SecurityChallengerSchema
          });

          if (llmResult && llmResult.verifications && Array.isArray(llmResult.verifications)) {
            console.log(`[SecurityChallenger] LLM returned ${llmResult.verifications.length} verification(s)`);

            // Build a map of LLM verifications by findingId
            const llmVerificationMap = new Map<string, any>();
            for (const v of llmResult.verifications) {
              if (v.findingId) llmVerificationMap.set(v.findingId, v);
            }

            // Process each finding using LLM verification
            for (const finding of findingsToVerify) {
              // Secret scanner findings are pre-verified
              if ((finding as any).source === 'secret_scanner' || finding.type === 'exposed_secret') {
                const autoResult: VerificationResult = {
                  findingId: finding.id,
                  verified: true,
                  evidence: 'Detected by dedicated secret scanner with pattern matching',
                  adjustedConfidence: 0.95,
                  mitigationsFound: [],
                  challengerAgent: this.id
                };
                verificationResults.push(autoResult);
                verifiedFindings.push({
                  ...finding,
                  verificationStatus: 'verified',
                  verificationEvidence: autoResult.evidence,
                  verificationMethod: 'llm',
                  confidence: 0.95,
                });
                continue;
              }

              const llmVerification = llmVerificationMap.get(finding.id);

              if (llmVerification) {
                const isVerified = llmVerification.verdict === 'verified';
                const result: VerificationResult = {
                  findingId: finding.id,
                  verified: isVerified,
                  evidence: llmVerification.evidence || llmVerification.reasoning || '',
                  adjustedSeverity: llmVerification.adjustedSeverity,
                  adjustedConfidence: llmVerification.adjustedConfidence ?? finding.confidence,
                  mitigationsFound: llmVerification.mitigationsFound ?? [],
                  challengerAgent: this.id
                };
                verificationResults.push(result);

                const updatedFinding: Finding = {
                  ...finding,
                  verificationStatus: isVerified ? 'verified' : 'false_positive',
                  verificationEvidence: result.evidence,
                  verificationMethod: 'llm',
                  challengerNotes: llmVerification.reasoning || (result.mitigationsFound.length > 0
                    ? `Mitigations found: ${result.mitigationsFound.join('; ')}`
                    : undefined),
                  confidence: result.adjustedConfidence,
                  severity: result.adjustedSeverity ?? finding.severity
                };

                if (isVerified) {
                  verifiedFindings.push(updatedFinding);
                } else {
                  falsePositives.push(updatedFinding);
                }
              } else {
                // LLM didn't return a verification for this finding -- fall back to code-based
                const result = this.verifyFinding(finding, sourceFiles);
                verificationResults.push(result);
                const updatedFinding: Finding = {
                  ...finding,
                  verificationStatus: result.verified ? 'verified' : 'false_positive',
                  verificationEvidence: result.evidence,
                  verificationMethod: 'regex',
                  challengerNotes: result.mitigationsFound.length > 0
                    ? `Mitigations found: ${result.mitigationsFound.join('; ')}`
                    : undefined,
                  confidence: result.adjustedConfidence,
                  severity: result.adjustedSeverity ?? finding.severity
                };
                if (result.verified) verifiedFindings.push(updatedFinding);
                else falsePositives.push(updatedFinding);
              }
            }
          } else {
            // LLM returned nothing useful -- fall back to code-based verification
            console.warn('[SecurityChallenger] LLM returned no verifications, falling back to code-based');
            this.codeBasedVerification(findingsToVerify, sourceFiles, verificationResults, verifiedFindings, falsePositives);
          }
        } catch (llmError) {
          console.error('[SecurityChallenger] LLM verification failed, falling back to code-based:', llmError);
          this.codeBasedVerification(findingsToVerify, sourceFiles, verificationResults, verifiedFindings, falsePositives);
        }
      } else {
        // No LLM -- use existing code-based verification
        this.codeBasedVerification(findingsToVerify, sourceFiles, verificationResults, verifiedFindings, falsePositives);
      }

      // Build recommendations from verification results as data payload
      const recommendations: Recommendation[] = verificationResults
        .filter(vr => vr.verified)
        .map(vr => ({
          id: `challenge_rec_${uuidv4().slice(0, 8)}`,
          type: 'verification_result',
          priority: 'medium' as const,
          title: `Verified: finding ${vr.findingId}`,
          description: vr.evidence,
          impact: `Adjusted confidence: ${vr.adjustedConfidence}`,
          effort: 'low' as const,
          implementation: vr.mitigationsFound.length > 0
            ? [`Review existing mitigations: ${vr.mitigationsFound.join(', ')}`]
            : ['No existing mitigations found -- implement fix'],
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
            : 0,
          verificationMethod: this.hasLLM() ? 'llm' : 'code-based'
        },
        rawData: {
          verificationResults,
          falsePositives
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[SecurityChallenger] Verification failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // CODE-BASED VERIFICATION FALLBACK
  // =====================================================

  private codeBasedVerification(
    findingsToVerify: Finding[],
    sourceFiles: Map<string, string>,
    verificationResults: VerificationResult[],
    verifiedFindings: Finding[],
    falsePositives: Finding[]
  ): void {
    for (const finding of findingsToVerify) {
      // Secret scanner findings are pre-verified
      if ((finding as any).source === 'secret_scanner' || finding.type === 'exposed_secret') {
        const autoResult: VerificationResult = {
          findingId: finding.id,
          verified: true,
          evidence: 'Detected by dedicated secret scanner with pattern matching',
          adjustedConfidence: 0.95,
          mitigationsFound: [],
          challengerAgent: this.id
        };
        verificationResults.push(autoResult);
        verifiedFindings.push({
          ...finding,
          verificationStatus: 'verified',
          verificationEvidence: autoResult.evidence,
          verificationMethod: 'regex',
          confidence: 0.95,
        });
        continue;
      }

      const result = this.verifyFinding(finding, sourceFiles);
      verificationResults.push(result);

      const updatedFinding: Finding = {
        ...finding,
        verificationStatus: result.verified ? 'verified' : 'false_positive',
        verificationEvidence: result.evidence,
        verificationMethod: 'regex',
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
  }

  // =====================================================
  // FINDING VERIFICATION
  // =====================================================

  private verifyFinding(finding: Finding, sourceFiles: Map<string, string>): VerificationResult {
    const filePath = finding.location?.file;
    const claimedLine = finding.location?.line;

    // Step 1: Confirm the file exists in our source set
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

    // Step 2: Check the claimed line actually has the claimed pattern
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
    const patternConfirmed = this.confirmPattern(finding.type, lineContent);

    if (!patternConfirmed) {
      return {
        findingId: finding.id,
        verified: false,
        evidence: `Pattern '${finding.type}' not confirmed at ${filePath}:${claimedLine}. Line content does not match expected vulnerability pattern.`,
        adjustedConfidence: 0.1,
        mitigationsFound: [],
        challengerAgent: this.id
      };
    }

    // Step 3: Check for mitigations
    const mitigations = this.findMitigations(finding.type, filePath, fileContent, sourceFiles, claimedLine);

    // Step 4: Check if the code is in a test file, example, or comment context
    const isTestOrExample = this.isTestOrExample(filePath);

    if (isTestOrExample) {
      return {
        findingId: finding.id,
        verified: false,
        evidence: `Finding is in a test/example file (${filePath}) -- not a production risk.`,
        adjustedConfidence: 0.1,
        mitigationsFound: ['test_or_example_file'],
        challengerAgent: this.id
      };
    }

    // Step 5: Determine final verdict
    const hasMitigations = mitigations.length > 0;
    let adjustedConfidence = finding.confidence;
    let adjustedSeverity = finding.severity;

    if (hasMitigations) {
      // Mitigations reduce confidence and may reduce severity
      adjustedConfidence = Math.max(0.15, finding.confidence - 0.3);
      const severityDowngrade: Record<string, Finding['severity']> = {
        critical: 'high',
        high: 'medium',
        medium: 'low',
        low: 'info',
        info: 'info'
      };
      adjustedSeverity = severityDowngrade[finding.severity] ?? finding.severity;
    } else {
      // No mitigations -- slightly boost confidence since we confirmed the pattern
      adjustedConfidence = Math.min(0.95, finding.confidence + 0.1);
    }

    return {
      findingId: finding.id,
      verified: true,
      evidence: hasMitigations
        ? `Pattern confirmed at ${filePath}:${claimedLine} but mitigations detected: ${mitigations.join(', ')}. Severity downgraded.`
        : `Pattern confirmed at ${filePath}:${claimedLine} with no mitigations found. Finding is valid.`,
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
      sql_injection: /\b(query|execute|raw)\b/i,
      cross_site_scripting: /(innerHTML|dangerouslySetInnerHTML|document\.write)/,
      hardcoded_credentials: /(password|secret|api_?key|token|private_?key|auth_?token)\s*[:=]/i,
      missing_authentication: /\b(app|router)\.(get|post|put|delete|patch)\s*\(/
    };

    const pattern = patterns[findingType];
    if (!pattern) return true; // Unknown type -- give benefit of the doubt
    return pattern.test(lineContent);
  }

  // =====================================================
  // MITIGATION DETECTION
  // =====================================================

  private findMitigations(
    findingType: string,
    filePath: string,
    fileContent: string,
    allFiles: Map<string, string>,
    claimedLine?: number
  ): string[] {
    const mitigations: string[] = [];

    // --- Global middleware checks (search all files) ---
    const globalPatterns: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /app\.use\(\s*helmet/i, name: 'helmet_middleware' },
      { pattern: /app\.use\(\s*rateLimit/i, name: 'rate_limiting' },
      { pattern: /app\.use\(\s*cors/i, name: 'cors_middleware' },
      { pattern: /app\.use\(\s*csrf/i, name: 'csrf_protection' },
      { pattern: /app\.use\(\s*xss/i, name: 'xss_middleware' },
      { pattern: /csp|contentSecurityPolicy/i, name: 'content_security_policy' }
    ];

    for (const [, content] of allFiles) {
      for (const gp of globalPatterns) {
        if (gp.pattern.test(content) && !mitigations.includes(gp.name)) {
          mitigations.push(gp.name);
        }
      }
    }

    // --- Local mitigations near the finding ---
    const lines = fileContent.split('\n');
    const start = Math.max(0, (claimedLine ?? 1) - 6);
    const end = Math.min(lines.length, (claimedLine ?? 1) + 5);
    const neighborhood = lines.slice(start, end).join('\n');

    const localPatterns: Record<string, Array<{ pattern: RegExp; name: string }>> = {
      sql_injection: [
        { pattern: /\b(sanitize|escape|validate|whitelist|parameterized|prepared|bindParam|placeholder)\b/i, name: 'input_sanitization' },
        { pattern: /\?\s*,?\s*\[/i, name: 'parameterized_query' },
        { pattern: /\$\d+/i, name: 'positional_parameters' }
      ],
      cross_site_scripting: [
        { pattern: /\b(sanitize|escape|encode|purify|DOMPurify|xss)\b/i, name: 'output_sanitization' },
        { pattern: /textContent\s*=/i, name: 'safe_text_assignment' }
      ],
      hardcoded_credentials: [
        { pattern: /process\.env|os\.environ|getenv/i, name: 'env_variable_reference_nearby' }
      ],
      missing_authentication: [
        { pattern: /\b(auth|authenticate|authorize|requireAuth|isAuthenticated|passport|jwt|verifyToken|protect|guard)\b/i, name: 'auth_middleware_nearby' }
      ]
    };

    const typePatterns = localPatterns[findingType] ?? [];
    for (const lp of typePatterns) {
      if (lp.pattern.test(neighborhood) && !mitigations.includes(lp.name)) {
        mitigations.push(lp.name);
      }
    }

    return mitigations;
  }

  // =====================================================
  // UTILITIES
  // =====================================================

  private isTestOrExample(filePath: string): boolean {
    return /\.(test|spec|__test__|__spec__)\.[jt]sx?$/.test(filePath)
      || /[/\\](test|tests|__tests__|__mocks__|examples?|fixtures?)[/\\]/.test(filePath)
      || /[/\\](demo|sample|mock)[/\\]/i.test(filePath);
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
    const relevant = ['security', 'vulnerability', 'verification', 'challenge'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.securityImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Challenger verification supports this proposal.'
      : 'Challenger found issues with the proposed findings.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['vulnerability', 'security', 'verification', 'mitigation'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { SecurityChallengerAgent };
