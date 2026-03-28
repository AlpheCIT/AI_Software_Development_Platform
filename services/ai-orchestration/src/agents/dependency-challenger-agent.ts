// =====================================================
// DEPENDENCY CHALLENGER AGENT - DEBATE TRIAD ROLE: CHALLENGER
// =====================================================
// Verifies dependency analysis findings from the existing
// DependencyAnalysisAgent (acting as analyzer). Reads actual
// manifest files and ArangoDB data to confirm or refute claims
// about outdated packages, vulnerabilities, and circular deps.

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
// DEPENDENCY CHALLENGER AGENT
// =====================================================

export class DependencyChallengerAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'dependency_challenger';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database) {
    const capabilities: A2ACapabilities = {
      methods: [
        'verify_dependency_findings',
        'check_versions',
        'validate_vulnerabilities'
      ],
      domains: [A2AAgentDomain.DEPENDENCY],
      maxConcurrentRequests: 3,
      supportedProtocolVersion: '1.0',
      features: [
        'dependency_verification',
        'version_checking',
        'vulnerability_validation'
      ]
    };

    super(
      'DependencyChallengerAgent',
      A2AAgentDomain.DEPENDENCY,
      capabilities,
      7,
      communicationBus
    );

    this.db = db;
    console.log('🔍 DependencyChallengerAgent: Initialized with ArangoDB connection');
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`🔍 DependencyChallengerAgent: Verifying dependency findings for ${request.type}`);
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

      // Parse manifest files from source
      const manifests = this.parseManifestFiles(sourceFiles);

      // Verify each finding
      const verificationResults: VerificationResult[] = [];
      const verifiedFindings: Finding[] = [];

      for (const finding of findingsToVerify) {
        const result = await this.verifyDependencyFinding(finding, manifests, repoId);
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
      console.error('DependencyChallengerAgent: Verification failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // MANIFEST PARSING
  // =====================================================

  private parseManifestFiles(sourceFiles: Map<string, string>): {
    packageJson: any | null;
    requirementsTxt: string[];
  } {
    let packageJson: any | null = null;
    const requirementsTxt: string[] = [];

    for (const [path, content] of sourceFiles.entries()) {
      if (path.endsWith('package.json') && !path.includes('node_modules')) {
        try {
          packageJson = JSON.parse(content);
        } catch { /* skip invalid */ }
      }
      if (path.endsWith('requirements.txt')) {
        requirementsTxt.push(...content.split('\n').filter(l => l.trim() && !l.startsWith('#')));
      }
    }

    return { packageJson, requirementsTxt };
  }

  // =====================================================
  // FINDING VERIFICATION
  // =====================================================

  private async verifyDependencyFinding(
    finding: Finding,
    manifests: { packageJson: any | null; requirementsTxt: string[] },
    repoId: string
  ): Promise<VerificationResult> {
    switch (finding.type) {
      case 'vulnerable_package':
      case 'vulnerable_dependencies':
        return this.verifyVulnerabilityFinding(finding, manifests, repoId);
      case 'outdated_dependencies':
        return this.verifyOutdatedFinding(finding, manifests);
      case 'circular_dependencies':
        return this.verifyCircularDependencyFinding(finding, repoId);
      default:
        return this.genericVerification(finding);
    }
  }

  private async verifyVulnerabilityFinding(
    finding: Finding,
    manifests: { packageJson: any | null; requirementsTxt: string[] },
    repoId: string
  ): Promise<VerificationResult> {
    const mitigations: string[] = [];
    const evidence: string[] = [];
    let verified = true;

    const pkgName = (finding as any).packageName || finding.evidence?.package?.name;
    const claimedVersion = (finding as any).currentVersion || finding.evidence?.package?.version;

    if (pkgName && manifests.packageJson) {
      const allDeps = {
        ...(manifests.packageJson.dependencies || {}),
        ...(manifests.packageJson.devDependencies || {})
      };
      const actualVersionSpec = allDeps[pkgName];

      if (!actualVersionSpec) {
        mitigations.push(`Package ${pkgName} not found in package.json dependencies`);
        verified = false;
        evidence.push(`${pkgName} is not a direct dependency; may be transitive`);
      } else {
        evidence.push(`${pkgName} found in package.json with spec "${actualVersionSpec}"`);

        // Verify the claimed version matches what is in the manifest
        if (claimedVersion && !actualVersionSpec.includes(claimedVersion.replace(/[^0-9.]/g, ''))) {
          mitigations.push(
            `Claimed version ${claimedVersion} does not match manifest spec ${actualVersionSpec}`
          );
        }
      }
    } else if (pkgName) {
      evidence.push('No package.json available for cross-reference');
    }

    // Cross-check with ArangoDB dependency_health
    try {
      const cursor = await this.db.query(
        `FOR h IN dependency_health
           FILTER (h.repoId == @repoId OR h.repository == @repoId)
           FILTER h.packageName == @pkgName OR h.name == @pkgName
           RETURN h`,
        { repoId, pkgName: pkgName || '' }
      );
      const records = await cursor.all();
      if (records.length > 0) {
        const rec = records[0];
        const dbVulnCount = rec.vulnerabilityCount || rec.vulnerabilities?.length || 0;
        evidence.push(`DB confirms ${dbVulnCount} vulnerabilities for ${pkgName}`);
        if (dbVulnCount === 0) {
          mitigations.push('DB record shows 0 vulnerabilities; finding may be stale');
          verified = false;
        }
      }
    } catch { /* collection may not exist */ }

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

  private async verifyOutdatedFinding(
    finding: Finding,
    manifests: { packageJson: any | null; requirementsTxt: string[] }
  ): Promise<VerificationResult> {
    const mitigations: string[] = [];
    const evidence: string[] = [];
    let verified = true;

    const offenders = finding.evidence?.worstOffenders || [];

    if (manifests.packageJson && offenders.length > 0) {
      const allDeps = {
        ...(manifests.packageJson.dependencies || {}),
        ...(manifests.packageJson.devDependencies || {})
      };

      let confirmedCount = 0;
      for (const pkg of offenders.slice(0, 5)) {
        const spec = allDeps[pkg.name];
        if (spec) {
          confirmedCount++;
          evidence.push(`${pkg.name}: manifest has "${spec}", claimed current="${pkg.current}"`);
        } else {
          mitigations.push(`${pkg.name} not found as direct dependency`);
        }
      }

      if (confirmedCount < offenders.length * 0.5) {
        verified = false;
        mitigations.push('Less than half of claimed outdated packages are direct dependencies');
      }
    } else {
      evidence.push('No package.json available or no specific packages listed');
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

  private async verifyCircularDependencyFinding(
    finding: Finding,
    repoId: string
  ): Promise<VerificationResult> {
    const mitigations: string[] = [];
    const evidence: string[] = [];
    let verified = true;

    const cycles = finding.evidence?.cycles || [];

    if (cycles.length === 0) {
      evidence.push('No specific cycle paths provided to verify');
      return {
        findingId: finding.id,
        verified: true,
        evidence: evidence.join('; '),
        adjustedConfidence: 0.6,
        mitigationsFound: mitigations,
        challengerAgent: this.id
      };
    }

    // Verify at least the first cycle by checking import relationships in code_entities
    try {
      const firstCycle: string[] = cycles[0] || [];
      if (firstCycle.length >= 2) {
        const cursor = await this.db.query(
          `FOR entity IN code_entities
             FILTER (entity.repoId == @repoId OR entity.repository == @repoId)
             FILTER entity.filePath IN @cyclePaths OR entity.name IN @cyclePaths
             RETURN { name: entity.name, filePath: entity.filePath, imports: entity.imports || [], dependencies: entity.dependencies || [] }`,
          { repoId, cyclePaths: firstCycle }
        );
        const entities = await cursor.all();

        if (entities.length >= 2) {
          // Check if the import chain is real
          let chainValid = true;
          for (let i = 0; i < firstCycle.length - 1; i++) {
            const current = entities.find(
              (e: any) => e.name === firstCycle[i] || e.filePath === firstCycle[i]
            );
            if (!current) {
              chainValid = false;
              mitigations.push(`Module "${firstCycle[i]}" not found in code_entities`);
              break;
            }
            const next = firstCycle[i + 1];
            const importsNext = (current.imports || []).concat(current.dependencies || [])
              .some((imp: string) => imp.includes(next));
            if (!importsNext) {
              chainValid = false;
              mitigations.push(`No import from "${firstCycle[i]}" to "${next}" found`);
            }
          }

          verified = chainValid;
          evidence.push(`Verified cycle chain: ${firstCycle.join(' -> ')}: ${chainValid ? 'confirmed' : 'not confirmed'}`);
        } else {
          mitigations.push('Could not find enough entities to verify the cycle');
          verified = false;
        }
      }
    } catch {
      evidence.push('Could not query code_entities for cycle verification');
    }

    return {
      findingId: finding.id,
      verified,
      evidence: evidence.join('; '),
      adjustedConfidence: verified ? 0.85 : 0.4,
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
  // RECOMMENDATION GENERATORS
  // =====================================================

  private generateChallengerRecommendations(
    results: VerificationResult[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const falsePositives = results.filter(v => !v.verified);

    if (falsePositives.length > 0) {
      recommendations.push({
        id: `dep_challenge_fp_${Date.now()}`,
        type: 'finding_correction',
        priority: 'medium',
        title: `${falsePositives.length} dependency findings flagged as false positives`,
        description:
          `${falsePositives.length} of ${results.length} findings could not be verified ` +
          `against actual manifest files and should be reviewed or removed.`,
        impact: 'Prevents acting on inaccurate dependency information',
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
    const relevant = ['dependency', 'verify', 'vulnerability', 'outdated', 'circular', 'challenge'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.dependencyImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Dependency verification supports this proposal. Findings have been validated.'
      : 'Dependency verification found inaccuracies. Some findings may be false positives.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['dependency', 'vulnerability', 'package', 'version', 'npm'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}
