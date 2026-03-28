// =====================================================
// SECURITY SYNTHESIZER AGENT - REPORT GENERATION
// =====================================================
// Debate triad role: SYNTHESIZER
// Receives verified findings from the SecurityChallengerAgent,
// ranks them by severity and confidence, and produces an
// actionable security report with debate metrics.

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
// SECURITY SYNTHESIZER AGENT
// =====================================================

export class SecuritySynthesizerAgent extends EnhancedBaseA2AAgent {

  constructor(communicationBus: A2ACommunicationBus) {
    const capabilities: A2ACapabilities = {
      methods: [
        'synthesize_security_report',
        'rank_findings',
        'produce_recommendations'
      ],
      domains: [A2AAgentDomain.SECURITY],
      maxConcurrentRequests: 3,
      supportedProtocolVersion: '1.0',
      features: [
        'report_synthesis',
        'finding_ranking',
        'actionable_recommendations',
        'debate_synthesizer_role'
      ]
    };

    super('SecuritySynthesizerAgent', A2AAgentDomain.SECURITY, capabilities, 7, communicationBus);
  }

  // =====================================================
  // MAIN ANALYSIS ENTRY POINT
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`[SecuritySynthesizer] Synthesizing security report`);
    const startTime = Date.now();

    try {
      const verifiedFindings: Finding[] = request.parameters?.verifiedFindings ?? [];
      const debateRounds: any = request.parameters?.debateRounds ?? {};
      const falsePositives: Finding[] = request.parameters?.falsePositives ?? [];

      // Totals for debate metrics
      const totalProposed = (debateRounds.totalProposed as number) ?? verifiedFindings.length + falsePositives.length;
      const totalVerified = verifiedFindings.length;
      const totalFalsePositives = falsePositives.length;

      console.log(`[SecuritySynthesizer] ${totalProposed} proposed, ${totalVerified} verified, ${totalFalsePositives} false positives`);

      // Step 1: Sort by severity then confidence
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const sortedFindings = [...verifiedFindings].sort((a, b) => {
        const sevDiff = (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5);
        if (sevDiff !== 0) return sevDiff;
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      });

      // Step 2: Generate actionable recommendations
      const recommendations: Recommendation[] = sortedFindings.map((finding, index) => {
        return this.buildActionableRecommendation(finding, index + 1);
      });

      // Step 3: Add a summary recommendation with debate metrics
      recommendations.push({
        id: `synth_summary_${uuidv4().slice(0, 8)}`,
        type: 'security_summary',
        priority: sortedFindings.some(f => f.severity === 'critical') ? 'critical' : 'high',
        title: 'Security Debate Summary',
        description: [
          `Debate analysis complete.`,
          `${totalProposed} findings proposed by analyzer.`,
          `${totalVerified} findings verified by challenger.`,
          `${totalFalsePositives} false positives caught and removed.`,
          totalFalsePositives > 0
            ? `False-positive rate: ${((totalFalsePositives / totalProposed) * 100).toFixed(1)}%`
            : 'No false positives detected.'
        ].join(' '),
        impact: `${totalVerified} actionable security issues remain after verification`,
        effort: 'low',
        implementation: [
          'Address critical findings first',
          'Review high-severity findings within the current sprint',
          'Schedule medium/low findings for upcoming sprints'
        ],
        relatedFindings: sortedFindings.map(f => f.id),
        estimatedValue: this.calculateOverallSecurityValue(sortedFindings)
      });

      // Step 4: Compute overall confidence as weighted average
      const overallConfidence = sortedFindings.length > 0
        ? sortedFindings.reduce((sum, f) => sum + (f.confidence ?? 0), 0) / sortedFindings.length
        : 0.5;

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: overallConfidence,
        findings: sortedFindings,
        recommendations,
        metrics: {
          totalProposed,
          totalVerified,
          totalFalsePositives,
          falsePositiveRate: totalProposed > 0 ? totalFalsePositives / totalProposed : 0,
          criticalFindings: sortedFindings.filter(f => f.severity === 'critical').length,
          highFindings: sortedFindings.filter(f => f.severity === 'high').length,
          mediumFindings: sortedFindings.filter(f => f.severity === 'medium').length,
          lowFindings: sortedFindings.filter(f => f.severity === 'low').length,
          securityScore: this.calculateSecurityScore(sortedFindings)
        },
        businessImpact: this.generateBusinessImpact(sortedFindings, request.businessContext),
        rawData: {
          debateMetrics: {
            totalProposed,
            totalVerified,
            totalFalsePositives,
            verificationRate: totalProposed > 0 ? totalVerified / totalProposed : 0
          }
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[SecuritySynthesizer] Synthesis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // RECOMMENDATION BUILDER
  // =====================================================

  private buildActionableRecommendation(finding: Finding, rank: number): Recommendation {
    const priorityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
      info: 'low'
    };

    const location = finding.location;
    const fileRef = location ? `${location.file}:${location.line}` : 'unknown location';

    const implementation: string[] = [];

    // Add specific fix guidance based on finding type
    if (finding.type === 'sql_injection') {
      implementation.push(`In ${fileRef}: replace string interpolation with parameterized query`);
      implementation.push('Use query builder or ORM bind parameters');
    } else if (finding.type === 'cross_site_scripting') {
      implementation.push(`In ${fileRef}: replace innerHTML/dangerouslySetInnerHTML with safe alternatives`);
      implementation.push('Add DOMPurify sanitization if HTML rendering is required');
    } else if (finding.type === 'hardcoded_credentials') {
      implementation.push(`In ${fileRef}: move secret to environment variable or secret manager`);
      implementation.push('Rotate the exposed credential immediately');
    } else if (finding.type === 'missing_authentication') {
      implementation.push(`In ${fileRef}: add authentication middleware to route handler`);
      implementation.push('Document if endpoint is intentionally public');
    } else {
      implementation.push(`In ${fileRef}: review and remediate the identified issue`);
    }

    // Add verification evidence if available
    if (finding.verificationEvidence) {
      implementation.push(`Challenger note: ${finding.verificationEvidence}`);
    }

    return {
      id: `synth_rec_${uuidv4().slice(0, 8)}`,
      type: 'security_remediation',
      priority: priorityMap[finding.severity] ?? 'medium',
      title: `#${rank}: ${finding.title}`,
      description: `${finding.description} (confidence: ${((finding.confidence ?? 0) * 100).toFixed(0)}%, verified by debate)`,
      impact: `${finding.severity} severity issue at ${fileRef}`,
      effort: finding.severity === 'critical' || finding.severity === 'high' ? 'medium' : 'low',
      implementation,
      relatedFindings: [finding.id],
      estimatedValue: Math.round((finding.confidence ?? 0.5) * 100)
    };
  }

  // =====================================================
  // SCORING
  // =====================================================

  private calculateSecurityScore(findings: Finding[]): number {
    if (findings.length === 0) return 95;
    const weights: Record<string, number> = { critical: 50, high: 30, medium: 15, low: 5, info: 1 };
    const total = findings.reduce((sum, f) => sum + (weights[f.severity] || 5), 0);
    return Math.max(10, 100 - Math.min(total, 90));
  }

  private calculateOverallSecurityValue(findings: Finding[]): number {
    if (findings.length === 0) return 100;
    const avgConfidence = findings.reduce((s, f) => s + (f.confidence ?? 0.5), 0) / findings.length;
    return Math.round(avgConfidence * 100);
  }

  // =====================================================
  // UTILITIES
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
      metrics: { error: error instanceof Error ? error.message : String(error) } as any
    };
  }

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const relevant = ['security', 'synthesis', 'report', 'debate'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.securityImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Synthesizer supports this proposal based on verified findings.'
      : 'Synthesizer has concerns based on the security report.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['security', 'vulnerability', 'report', 'synthesis'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { SecuritySynthesizerAgent };
