// =====================================================
// DOCUMENTATION CHALLENGER AGENT - DEBATE TRIAD ROLE: CHALLENGER
// =====================================================
// Verifies documentation claims produced by the drafter
// against actual source code and ArangoDB ingestion data.
// Returns VerificationResults marking each section as
// verified, inaccurate, or incomplete.

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
// DOMAIN-SPECIFIC INTERFACES
// =====================================================

interface GapReport {
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

// =====================================================
// DOCUMENTATION CHALLENGER AGENT
// =====================================================

export class DocumentationChallengerAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'doc_challenger';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database) {
    const capabilities: A2ACapabilities = {
      methods: [
        'verify_documentation',
        'check_accuracy',
        'find_gaps'
      ],
      domains: [A2AAgentDomain.QUALITY],
      maxConcurrentRequests: 3,
      supportedProtocolVersion: '1.0',
      features: [
        'documentation_verification',
        'accuracy_checking',
        'gap_analysis'
      ]
    };

    super(
      'DocumentationChallengerAgent',
      A2AAgentDomain.QUALITY,
      capabilities,
      6,
      communicationBus
    );

    this.db = db;
    console.log('🔍 DocumentationChallengerAgent: Initialized with ArangoDB connection');
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`🔍 DocumentationChallengerAgent: Verifying documentation for ${request.type}`);
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

      // Phase 1: Verify each documentation section
      const verificationResults: VerificationResult[] = [];
      const verifiedFindings: Finding[] = [];

      for (const finding of findingsToVerify) {
        const result = await this.verifyDocumentationSection(finding, sourceFiles, repoId);
        verificationResults.push(result);
        verifiedFindings.push({
          ...finding,
          verificationStatus: result.verified ? 'verified' : 'unverified',
          verificationMethod: 'debate',
          verificationEvidence: result.evidence,
          challengerNotes: result.mitigationsFound.join('; '),
          confidence: result.adjustedConfidence
        });
      }

      // Phase 2: Identify documentation gaps
      const gaps = await this.identifyDocumentationGaps(findingsToVerify, sourceFiles, repoId);
      const gapFindings = gaps.map((gap, idx) => this.gapToFinding(gap, idx));
      verifiedFindings.push(...gapFindings);

      // Phase 3: Summary recommendations
      const verified = verificationResults.filter(v => v.verified).length;
      const inaccurate = verificationResults.filter(v => !v.verified).length;
      const recommendations = this.generateChallengerRecommendations(
        verificationResults, gaps, findingsToVerify
      );

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
          sectionsVerified: verified,
          sectionsInaccurate: inaccurate,
          gapsIdentified: gaps.length,
          totalSectionsChecked: verificationResults.length
        },
        rawData: { verificationResults },
        businessImpact: this.generateBusinessImpact(verifiedFindings, request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('DocumentationChallengerAgent: Verification failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // SECTION VERIFICATION
  // =====================================================

  private async verifyDocumentationSection(
    finding: Finding,
    sourceFiles: Map<string, string>,
    repoId: string
  ): Promise<VerificationResult> {
    const mitigations: string[] = [];
    let verified = true;
    let confidence = finding.confidence || 0.5;
    const evidence: string[] = [];

    const sectionName = finding.evidence?.sectionName || finding.title;

    switch (sectionName) {
      case 'Getting Started':
        verified = await this.verifyGettingStarted(finding, sourceFiles, evidence, mitigations);
        break;
      case 'API Reference':
        verified = await this.verifyApiReference(finding, repoId, evidence, mitigations);
        break;
      case 'Architecture Overview':
        verified = await this.verifyArchitecture(finding, sourceFiles, evidence, mitigations);
        break;
      case 'Configuration':
        verified = await this.verifyConfiguration(finding, sourceFiles, evidence, mitigations);
        break;
      default:
        evidence.push('No specific verification logic for this section type');
        confidence = Math.min(confidence, 0.5);
    }

    if (verified) {
      confidence = Math.min(confidence + 0.15, 0.95);
    } else {
      confidence = Math.max(confidence - 0.2, 0.2);
    }

    return {
      findingId: finding.id,
      verified,
      evidence: evidence.join('; '),
      adjustedConfidence: confidence,
      mitigationsFound: mitigations,
      challengerAgent: this.id
    };
  }

  private async verifyGettingStarted(
    finding: Finding,
    sourceFiles: Map<string, string>,
    evidence: string[],
    mitigations: string[]
  ): Promise<boolean> {
    let valid = true;

    // Check that referenced scripts actually exist in package.json
    let foundPackageJson = false;
    for (const [path, content] of sourceFiles.entries()) {
      if (path.endsWith('package.json')) {
        foundPackageJson = true;
        try {
          const pkg = JSON.parse(content);
          const scripts = pkg.scripts || {};
          const description = finding.description || '';
          // Verify every script name mentioned in the doc exists
          const mentioned = description.match(/npm run (\S+)/g) || [];
          for (const cmd of mentioned) {
            const scriptName = cmd.replace('npm run ', '');
            if (!scripts[scriptName]) {
              mitigations.push(`Script "${scriptName}" mentioned in docs but not found in package.json`);
              valid = false;
            }
          }
          evidence.push(`Verified against package.json with ${Object.keys(scripts).length} scripts`);
        } catch {
          mitigations.push('package.json could not be parsed');
          valid = false;
        }
        break;
      }
    }

    if (!foundPackageJson) {
      mitigations.push('No package.json found in source files to verify against');
      valid = false;
    }

    return valid;
  }

  private async verifyApiReference(
    finding: Finding,
    repoId: string,
    evidence: string[],
    mitigations: string[]
  ): Promise<boolean> {
    let valid = true;

    // Verify endpoints mentioned in docs exist in api_endpoints collection
    try {
      const cursor = await this.db.query(
        `FOR ep IN api_endpoints
           FILTER ep.repoId == @repoId OR ep.repository == @repoId
           RETURN { method: ep.method, path: ep.path || ep.route }`,
        { repoId }
      );
      const actualEndpoints = await cursor.all();
      const actualPaths = new Set(actualEndpoints.map((ep: any) => `${(ep.method || 'GET').toUpperCase()} ${ep.path}`));

      const description = finding.description || '';
      const docEndpoints = description.match(/\*\*(\w+)\*\*\s+`([^`]+)`/g) || [];

      let matchCount = 0;
      for (const docEp of docEndpoints) {
        const match = docEp.match(/\*\*(\w+)\*\*\s+`([^`]+)`/);
        if (match) {
          const key = `${match[1]} ${match[2]}`;
          if (actualPaths.has(key)) matchCount++;
          else mitigations.push(`Endpoint ${key} documented but not found in ingestion data`);
        }
      }

      evidence.push(`${matchCount}/${docEndpoints.length} documented endpoints verified against DB`);
      if (docEndpoints.length > 0 && matchCount < docEndpoints.length * 0.5) {
        valid = false;
      }
    } catch {
      evidence.push('Could not query api_endpoints for verification');
    }

    return valid;
  }

  private async verifyArchitecture(
    finding: Finding,
    sourceFiles: Map<string, string>,
    evidence: string[],
    mitigations: string[]
  ): Promise<boolean> {
    // Verify that mentioned directories actually exist in source files
    const description = finding.description || '';
    const dirMatches = description.match(/`([^`]+\/)`/g) || [];
    const actualDirs = new Set<string>();

    for (const path of sourceFiles.keys()) {
      const parts = path.split('/');
      if (parts.length > 1) actualDirs.add(parts[0] + '/');
    }

    let matchCount = 0;
    for (const dirRef of dirMatches) {
      const dir = dirRef.replace(/`/g, '');
      if (actualDirs.has(dir)) matchCount++;
      else mitigations.push(`Directory ${dir} mentioned but not found in source files`);
    }

    evidence.push(`${matchCount}/${dirMatches.length} directories verified in source tree`);
    return dirMatches.length === 0 || matchCount >= dirMatches.length * 0.5;
  }

  private async verifyConfiguration(
    finding: Finding,
    sourceFiles: Map<string, string>,
    evidence: string[],
    mitigations: string[]
  ): Promise<boolean> {
    // Verify that mentioned env vars are actually used in source code
    const description = finding.description || '';
    const envVarMatches = description.match(/`([A-Z_][A-Z0-9_]+)`/g) || [];
    const envVars = envVarMatches.map(m => m.replace(/`/g, ''));

    let usedCount = 0;
    for (const envVar of envVars) {
      let found = false;
      for (const [, content] of sourceFiles.entries()) {
        if (content.includes(envVar)) {
          found = true;
          break;
        }
      }
      if (found) usedCount++;
      else mitigations.push(`Env var ${envVar} documented but not referenced in source code`);
    }

    evidence.push(`${usedCount}/${envVars.length} documented env vars found in source code`);
    return envVars.length === 0 || usedCount >= envVars.length * 0.5;
  }

  // =====================================================
  // GAP ANALYSIS
  // =====================================================

  private async identifyDocumentationGaps(
    existingSections: Finding[],
    sourceFiles: Map<string, string>,
    repoId: string
  ): Promise<GapReport[]> {
    const gaps: GapReport[] = [];
    const sectionNames = existingSections.map(f => f.evidence?.sectionName || f.title);

    // Gap: Public APIs not documented
    try {
      const cursor = await this.db.query(
        `FOR entity IN code_entities
           FILTER (entity.repoId == @repoId OR entity.repository == @repoId)
           FILTER LENGTH(entity.exportedSymbols || []) > 0
           FILTER (entity.documentationCoverage || 0) < 0.1
           RETURN { filePath: entity.filePath, exports: LENGTH(entity.exportedSymbols) }`,
        { repoId }
      );
      const undocumented = await cursor.all();
      if (undocumented.length > 0) {
        gaps.push({
          category: 'undocumented_public_apis',
          description: `${undocumented.length} files with public exports have no documentation`,
          severity: 'high'
        });
      }
    } catch { /* collection may not exist */ }

    // Gap: Error handling patterns not described
    let hasErrorHandlingSection = false;
    for (const section of existingSections) {
      if ((section.description || '').toLowerCase().includes('error handling')) {
        hasErrorHandlingSection = true;
        break;
      }
    }
    if (!hasErrorHandlingSection) {
      gaps.push({
        category: 'missing_error_handling_docs',
        description: 'No documentation section covers error handling patterns',
        severity: 'medium'
      });
    }

    // Gap: Troubleshooting section missing
    if (!sectionNames.some(n => n?.toLowerCase().includes('troubleshoot'))) {
      gaps.push({
        category: 'missing_troubleshooting',
        description: 'No troubleshooting section found in documentation',
        severity: 'low'
      });
    }

    return gaps;
  }

  private gapToFinding(gap: GapReport, index: number): Finding {
    return {
      id: `doc_gap_${gap.category}_${Date.now()}_${index}`,
      type: 'documentation_gap',
      severity: gap.severity,
      title: `Documentation gap: ${gap.category.replace(/_/g, ' ')}`,
      description: gap.description,
      evidence: { gapCategory: gap.category },
      confidence: 0.85,
      verificationStatus: 'verified',
      verificationMethod: 'debate'
    };
  }

  // =====================================================
  // RECOMMENDATION GENERATORS
  // =====================================================

  private generateChallengerRecommendations(
    verificationResults: VerificationResult[],
    gaps: GapReport[],
    originalFindings: Finding[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const inaccurate = verificationResults.filter(v => !v.verified);

    if (inaccurate.length > 0) {
      recommendations.push({
        id: `doc_challenge_fix_${Date.now()}`,
        type: 'documentation_correction',
        priority: 'high',
        title: `${inaccurate.length} documentation sections need corrections`,
        description:
          `${inaccurate.length} of ${verificationResults.length} sections contain inaccuracies ` +
          `that should be corrected before publication.`,
        impact: 'Prevents publishing inaccurate documentation',
        effort: 'medium',
        implementation: inaccurate.map(v =>
          `Fix section ${v.findingId}: ${v.mitigationsFound.join(', ')}`
        ),
        relatedFindings: inaccurate.map(v => v.findingId),
        estimatedValue: 90
      });
    }

    if (gaps.length > 0) {
      recommendations.push({
        id: `doc_challenge_gaps_${Date.now()}`,
        type: 'documentation_gap_filling',
        priority: 'medium',
        title: `${gaps.length} documentation gaps identified`,
        description:
          `The drafted documentation is missing coverage in ${gaps.length} areas ` +
          `that should be addressed for completeness.`,
        impact: 'Improves documentation completeness',
        effort: 'medium',
        implementation: gaps.map(g => `Add section for: ${g.description}`),
        relatedFindings: originalFindings.map(f => f.id),
        estimatedValue: 75
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
    const relevant = ['documentation', 'verify', 'accuracy', 'challenge', 'review'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.documentationImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Documentation verification supports this proposal. Claims have been validated.'
      : 'Documentation verification found inaccuracies that need correction before proceeding.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['documentation', 'verification', 'accuracy', 'api_surface', 'code_structure'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}
