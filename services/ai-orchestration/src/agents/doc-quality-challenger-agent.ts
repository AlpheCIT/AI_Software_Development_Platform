// =====================================================
// DOC QUALITY CHALLENGER AGENT - DEBATE TRIAD ROLE: CHALLENGER
// =====================================================
// Verifies documentation coverage findings produced by the
// DocumentationQualityAgent (acting as analyzer). Reads actual
// file content to confirm claimed coverage percentages, hub
// status, and JSDoc/docstring presence.

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
import { Database } from 'arangojs';

// =====================================================
// DOC QUALITY CHALLENGER AGENT
// =====================================================

export class DocQualityChallengerAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'doc_quality_challenger';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database) {
    const capabilities: A2ACapabilities = {
      methods: [
        'verify_doc_coverage',
        'check_doc_accuracy'
      ],
      domains: [A2AAgentDomain.QUALITY],
      maxConcurrentRequests: 3,
      supportedProtocolVersion: '1.0',
      features: [
        'doc_coverage_verification',
        'doc_accuracy_checking'
      ]
    };

    super(
      'DocQualityChallengerAgent',
      A2AAgentDomain.QUALITY,
      capabilities,
      6,
      communicationBus
    );

    this.db = db;
    console.log('🔍 DocQualityChallengerAgent: Initialized with ArangoDB connection');
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`🔍 DocQualityChallengerAgent: Verifying doc coverage findings for ${request.type}`);
    const startTime = Date.now();

    try {
      const repoId = request.repoId || request.entityKey;
      if (!repoId) {
        return this.createErrorResult(request, new Error('repoId or entityKey is required'));
      }

      const findingsToVerify: Finding[] = request.parameters.findingsToVerify || [];
      const sourceFiles: Map<string, string> = request.sourceFiles
        || request.parameters.sourceFiles
        || new Map<string, string>();

      if (findingsToVerify.length === 0) {
        return this.createErrorResult(request, new Error('findingsToVerify is required'));
      }

      // Verify each finding
      const verificationResults: VerificationResult[] = [];
      const verifiedFindings: Finding[] = [];

      for (const finding of findingsToVerify) {
        const result = await this.verifyDocCoverageFinding(finding, sourceFiles, repoId);
        verificationResults.push(result);
        verifiedFindings.push({
          ...finding,
          verificationStatus: result.verified ? 'verified' : 'false_positive',
          verificationMethod: 'debate',
          verificationEvidence: result.evidence,
          challengerNotes: result.mitigationsFound.join('; '),
          confidence: result.adjustedConfidence,
          severity: result.adjustedSeverity || finding.severity
        });
      }

      const verified = verificationResults.filter(v => v.verified).length;
      const falsePositives = verificationResults.filter(v => !v.verified).length;
      const recommendations = this.generateChallengerRecommendations(verificationResults);

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: verified / Math.max(verificationResults.length, 1),
        findings: verifiedFindings,
        recommendations,
        metrics: {
          findingsVerified: verified,
          falsePositives,
          totalChecked: verificationResults.length
        },
        rawData: { verificationResults },
        businessImpact: this.generateBusinessImpact(verifiedFindings, request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('DocQualityChallengerAgent: Verification failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // FINDING VERIFICATION
  // =====================================================

  private async verifyDocCoverageFinding(
    finding: Finding,
    sourceFiles: Map<string, string>,
    repoId: string
  ): Promise<VerificationResult> {
    switch (finding.type) {
      case 'undocumented_hub_file':
        return this.verifyHubFileFinding(finding, sourceFiles, repoId);
      case 'undocumented_exports':
        return this.verifyExportsFinding(finding, sourceFiles);
      case 'low_documentation_coverage':
        return this.verifyCoverageFinding(finding, sourceFiles);
      default:
        return this.genericVerification(finding);
    }
  }

  private async verifyHubFileFinding(
    finding: Finding,
    sourceFiles: Map<string, string>,
    repoId: string
  ): Promise<VerificationResult> {
    const mitigations: string[] = [];
    const evidence: string[] = [];
    let verified = true;

    const filePath = finding.evidence?.filePath
      || (finding as any).filePath
      || finding.location?.file;
    const claimedImportCount = finding.evidence?.importCount || (finding as any).importCount || 0;
    const claimedCoverage = finding.evidence?.coverage || (finding as any).documentationCoverage || 0;

    if (!filePath) {
      return {
        findingId: finding.id,
        verified: false,
        evidence: 'No file path provided in finding',
        adjustedConfidence: 0.3,
        mitigationsFound: ['Missing file path in finding data'],
        challengerAgent: this.id
      };
    }

    // Step 1: Verify it is actually a hub by checking import count in ArangoDB
    try {
      const cursor = await this.db.query(
        `LET target = (
           FOR entity IN code_entities
             FILTER (entity.repoId == @repoId OR entity.repository == @repoId)
             FILTER entity.filePath == @filePath OR entity.name == @filePath
             LIMIT 1
             RETURN entity
         )
         LET importers = (
           FOR entity IN code_entities
             FILTER (entity.repoId == @repoId OR entity.repository == @repoId)
             FILTER POSITION(entity.dependencies || [], @filePath) OR POSITION(entity.imports || [], @filePath)
             RETURN 1
         )
         RETURN { found: LENGTH(target) > 0, actualImportCount: LENGTH(importers) }`,
        { repoId, filePath }
      );
      const result = await cursor.all();

      if (result.length > 0 && result[0].found) {
        const actualImportCount = result[0].actualImportCount;
        evidence.push(`DB shows ${actualImportCount} importers for ${filePath} (claimed: ${claimedImportCount})`);

        if (actualImportCount < 3) {
          mitigations.push(
            `File has only ${actualImportCount} importers, below hub threshold of 3`
          );
          verified = false;
        }

        // Check if import count is significantly different
        if (Math.abs(actualImportCount - claimedImportCount) > claimedImportCount * 0.5) {
          mitigations.push(
            `Import count mismatch: actual=${actualImportCount}, claimed=${claimedImportCount}`
          );
        }
      } else {
        evidence.push(`File ${filePath} not found in code_entities`);
      }
    } catch {
      evidence.push('Could not query code_entities for hub verification');
    }

    // Step 2: Verify documentation coverage by reading actual file content
    const fileContent = this.findFileContent(sourceFiles, filePath);
    if (fileContent) {
      const actualCoverage = this.measureDocCoverage(fileContent);
      evidence.push(
        `Measured doc coverage: ${Math.round(actualCoverage * 100)}% (claimed: ${Math.round(claimedCoverage * 100)}%)`
      );

      // If actual coverage is significantly higher than claimed, it may be a false positive
      if (actualCoverage > 0.5 && claimedCoverage < 0.5) {
        mitigations.push(
          `Actual documentation coverage (${Math.round(actualCoverage * 100)}%) exceeds 50% threshold`
        );
        verified = false;
      }
    } else {
      evidence.push(`Source file ${filePath} not available for direct measurement`);
    }

    return {
      findingId: finding.id,
      verified,
      evidence: evidence.join('; '),
      adjustedConfidence: verified ? 0.9 : 0.4,
      adjustedSeverity: verified ? finding.severity : 'low',
      mitigationsFound: mitigations,
      challengerAgent: this.id
    };
  }

  private async verifyExportsFinding(
    finding: Finding,
    sourceFiles: Map<string, string>
  ): Promise<VerificationResult> {
    const mitigations: string[] = [];
    const evidence: string[] = [];
    let verified = true;

    const claimedTotal = finding.evidence?.totalExports || 0;
    const claimedUndocumented = finding.evidence?.undocumentedExports || 0;

    // Sample source files to verify export documentation claims
    let sampledExports = 0;
    let sampledDocumented = 0;
    let filesChecked = 0;

    for (const [path, content] of sourceFiles.entries()) {
      if (filesChecked >= 20) break; // Sample up to 20 files
      if (!path.match(/\.(ts|tsx|js|jsx)$/) || path.includes('node_modules')) continue;

      filesChecked++;
      const exports = this.countExports(content);
      const documented = this.countDocumentedExports(content);
      sampledExports += exports;
      sampledDocumented += documented;
    }

    if (filesChecked > 0) {
      const sampledCoverage = sampledExports > 0 ? sampledDocumented / sampledExports : 1;
      const claimedCoverage = claimedTotal > 0
        ? (claimedTotal - claimedUndocumented) / claimedTotal
        : 1;

      evidence.push(
        `Sampled ${filesChecked} files: ${sampledDocumented}/${sampledExports} exports documented ` +
        `(${Math.round(sampledCoverage * 100)}%). Claimed: ${Math.round(claimedCoverage * 100)}%`
      );

      // If sample shows significantly different coverage, flag it
      if (Math.abs(sampledCoverage - claimedCoverage) > 0.3) {
        mitigations.push(
          `Sample coverage (${Math.round(sampledCoverage * 100)}%) differs significantly ` +
          `from claimed (${Math.round(claimedCoverage * 100)}%)`
        );
        if (sampledCoverage > claimedCoverage + 0.3) {
          verified = false; // Coverage is better than claimed
        }
      }
    } else {
      evidence.push('No source files available for export verification');
    }

    return {
      findingId: finding.id,
      verified,
      evidence: evidence.join('; '),
      adjustedConfidence: verified ? 0.85 : 0.45,
      mitigationsFound: mitigations,
      challengerAgent: this.id
    };
  }

  private async verifyCoverageFinding(
    finding: Finding,
    sourceFiles: Map<string, string>
  ): Promise<VerificationResult> {
    const mitigations: string[] = [];
    const evidence: string[] = [];
    let verified = true;

    const claimedCoverage = finding.evidence?.coveragePercent || 0;

    // Sample files to check documentation presence
    let totalFiles = 0;
    let documentedFiles = 0;

    for (const [path, content] of sourceFiles.entries()) {
      if (!path.match(/\.(ts|tsx|js|jsx|py)$/) || path.includes('node_modules')) continue;
      totalFiles++;
      if (this.hasDocumentation(content)) {
        documentedFiles++;
      }
    }

    if (totalFiles > 0) {
      const measuredCoverage = Math.round((documentedFiles / totalFiles) * 100);
      evidence.push(
        `Sampled ${totalFiles} files: ${documentedFiles} have docs (${measuredCoverage}%). Claimed: ${claimedCoverage}%`
      );

      if (measuredCoverage > claimedCoverage + 20) {
        mitigations.push(
          `Measured coverage (${measuredCoverage}%) significantly higher than claimed (${claimedCoverage}%)`
        );
        verified = false;
      }
    } else {
      evidence.push('No source files available for coverage measurement');
    }

    return {
      findingId: finding.id,
      verified,
      evidence: evidence.join('; '),
      adjustedConfidence: verified ? 0.88 : 0.45,
      mitigationsFound: mitigations,
      challengerAgent: this.id
    };
  }

  private genericVerification(finding: Finding): VerificationResult {
    return {
      findingId: finding.id,
      verified: true,
      evidence: 'No specific verification logic for this finding type; passed through',
      adjustedConfidence: Math.min(finding.confidence || 0.5, 0.7),
      mitigationsFound: [],
      challengerAgent: this.id
    };
  }

  // =====================================================
  // SOURCE CODE ANALYSIS HELPERS
  // =====================================================

  private findFileContent(sourceFiles: Map<string, string>, filePath: string): string | null {
    // Try exact match first
    if (sourceFiles.has(filePath)) return sourceFiles.get(filePath)!;

    // Try suffix match
    for (const [path, content] of sourceFiles.entries()) {
      if (path.endsWith(filePath) || filePath.endsWith(path)) return content;
    }

    return null;
  }

  private measureDocCoverage(content: string): number {
    const lines = content.split('\n');
    const totalFunctions = this.countExports(content);
    if (totalFunctions === 0) return 1; // No exports = fully covered

    const documented = this.countDocumentedExports(content);
    return totalFunctions > 0 ? documented / totalFunctions : 0;
  }

  private countExports(content: string): number {
    const exportPatterns = [
      /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+/g,
      /export\s+\{[^}]+\}/g,
      /module\.exports/g
    ];

    let count = 0;
    for (const pattern of exportPatterns) {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  }

  private countDocumentedExports(content: string): number {
    // Count exports that have JSDoc (/** ... */) or docstrings immediately before them
    const jsdocExportPattern = /\/\*\*[\s\S]*?\*\/\s*\n\s*export\s+/g;
    const matches = content.match(jsdocExportPattern);
    return matches ? matches.length : 0;
  }

  private hasDocumentation(content: string): boolean {
    // Check for any JSDoc comments, Python docstrings, or module-level comments
    return /\/\*\*[\s\S]*?\*\//.test(content)
      || /"""[\s\S]*?"""/.test(content)
      || /'''[\s\S]*?'''/.test(content);
  }

  // =====================================================
  // RECOMMENDATION GENERATORS
  // =====================================================

  private generateChallengerRecommendations(
    results: VerificationResult[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const falsePositives = results.filter(v => !v.verified);

    if (falsePositives.length > 0) {
      recommendations.push({
        id: `doc_qual_challenge_fp_${Date.now()}`,
        type: 'finding_correction',
        priority: 'medium',
        title: `${falsePositives.length} doc coverage findings flagged as inaccurate`,
        description:
          `${falsePositives.length} of ${results.length} documentation coverage findings ` +
          `could not be verified against actual source code and should be reviewed.`,
        impact: 'Prevents acting on inaccurate documentation coverage data',
        effort: 'low',
        implementation: falsePositives.map(fp =>
          `Review finding ${fp.findingId}: ${fp.mitigationsFound.join(', ')}`
        ),
        relatedFindings: falsePositives.map(fp => fp.findingId),
        estimatedValue: 70
      });
    }

    return recommendations;
  }

  // =====================================================
  // HELPERS
  // =====================================================

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
      metrics: { error: error instanceof Error ? error.message : String(error) }
    };
  }

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const relevant = ['documentation', 'coverage', 'verify', 'quality', 'challenge', 'jsdoc'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.qualityImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Doc quality verification supports this proposal. Coverage claims have been validated.'
      : 'Doc quality verification found inaccuracies in coverage claims.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['documentation', 'coverage', 'quality', 'jsdoc', 'verification'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}
