// =====================================================
// PERFORMANCE SYNTHESIZER AGENT - REPORT GENERATION
// =====================================================
// Debate triad role: SYNTHESIZER
// Receives verified performance findings from the
// PerformanceChallengerAgent, ranks them, and produces
// an actionable performance report with debate metrics.

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
import { performanceSynthesizerPrompt } from '../llm/prompts.js';
import { SynthesizerReportSchema } from '../llm/schemas.js';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// PERFORMANCE SYNTHESIZER AGENT
// =====================================================

export class PerformanceSynthesizerAgent extends EnhancedBaseA2AAgent {

  constructor(communicationBus: A2ACommunicationBus, llmClient?: LLMClient | null) {
    const capabilities: A2ACapabilities = {
      methods: [
        'synthesize_performance_report',
        'rank_findings',
        'produce_recommendations'
      ],
      domains: [A2AAgentDomain.PERFORMANCE],
      maxConcurrentRequests: 3,
      supportedProtocolVersion: '1.0',
      features: [
        'report_synthesis',
        'finding_ranking',
        'actionable_recommendations',
        'debate_synthesizer_role'
      ]
    };

    super('PerformanceSynthesizerAgent', A2AAgentDomain.PERFORMANCE, capabilities, 6, communicationBus, llmClient);
  }

  // =====================================================
  // MAIN ANALYSIS ENTRY POINT
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`[PerformanceSynthesizer] Synthesizing performance report`);
    const startTime = Date.now();

    try {
      const verifiedFindings: Finding[] = request.parameters?.verifiedFindings ?? [];
      const debateRounds: any = request.parameters?.debateRounds ?? {};
      const falsePositives: Finding[] = request.parameters?.falsePositives ?? [];

      const totalProposed = (debateRounds.totalProposed as number) ?? verifiedFindings.length + falsePositives.length;
      const totalVerified = verifiedFindings.length;
      const totalFalsePositives = falsePositives.length;

      console.log(`[PerformanceSynthesizer] ${totalProposed} proposed, ${totalVerified} verified, ${totalFalsePositives} false positives`);

      // Step 1: Filter to only confirmed findings
      const confirmedFindings = verifiedFindings.filter(f => f.verificationStatus !== 'false_positive');

      // Step 2: Sort by severity then confidence
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const sortedFindings = [...confirmedFindings].sort((a, b) => {
        const sevDiff = (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5);
        if (sevDiff !== 0) return sevDiff;
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      });

      // Step 3: Group findings by type for the report
      const findingsByType = new Map<string, Finding[]>();
      for (const f of sortedFindings) {
        const existing = findingsByType.get(f.type) ?? [];
        existing.push(f);
        findingsByType.set(f.type, existing);
      }

      // Step 4: Try LLM-based report generation
      let llmReport: any = null;
      if (this.hasLLM() && sortedFindings.length > 0) {
        try {
          const prompt = performanceSynthesizerPrompt({
            domain: 'performance',
            verifiedFindings: sortedFindings.map(f => ({
              id: f.id,
              type: f.type,
              severity: f.severity,
              title: f.title,
              description: f.description,
              file: f.location?.file,
              line: f.location?.line,
              confidence: f.confidence,
              verificationEvidence: f.verificationEvidence,
              challengerNotes: f.challengerNotes
            })),
            repoName: request.parameters?.repoName ?? request.repoId
          });

          console.log(`[PerformanceSynthesizer] Calling LLM for report generation...`);
          llmReport = await this.callLLM(prompt.system, prompt.user, {
            jsonSchema: SynthesizerReportSchema
          });

          if (llmReport) {
            console.log(`[PerformanceSynthesizer] LLM generated report with grade: ${llmReport.overallGrade}`);
          }
        } catch (llmError) {
          console.error('[PerformanceSynthesizer] LLM report generation failed, using code-based:', llmError);
          llmReport = null;
        }
      }

      // Step 5: Generate actionable recommendations
      const recommendations: Recommendation[] = sortedFindings.map((finding, index) => {
        return this.buildActionableRecommendation(finding, index + 1);
      });

      // Step 6: Add summary recommendation with debate metrics
      recommendations.push({
        id: `perf_synth_summary_${uuidv4().slice(0, 8)}`,
        type: 'performance_summary',
        priority: sortedFindings.some(f => f.severity === 'critical') ? 'critical' : 'high',
        title: 'Performance Debate Summary',
        description: llmReport?.executiveSummary || [
          `Debate analysis complete.`,
          `${totalProposed} findings proposed by analyzer.`,
          `${totalVerified} findings verified by challenger.`,
          `${totalFalsePositives} false positives caught and removed.`,
          totalFalsePositives > 0
            ? `False-positive rate: ${((totalFalsePositives / totalProposed) * 100).toFixed(1)}%`
            : 'No false positives detected.',
          `Finding types: ${Array.from(findingsByType.entries()).map(([t, fs]) => `${t}(${fs.length})`).join(', ') || 'none'}`
        ].join(' '),
        impact: `${totalVerified} actionable performance issues remain after verification`,
        effort: 'low',
        implementation: llmReport?.remediationPlan?.length > 0
          ? llmReport.remediationPlan.map((p: any) => `Phase ${p.phase}: ${p.title} - ${(p.actions || []).join(', ')}`)
          : [
            'Address critical/high-severity bottlenecks first -- they have the largest scalability impact',
            'Benchmark before and after each optimization to verify improvement',
            'Schedule medium/low severity findings for upcoming sprints',
            'Consider load testing after applying fixes to validate under production-like conditions'
          ],
        relatedFindings: sortedFindings.map(f => f.id),
        estimatedValue: this.calculateOverallOptimizationValue(sortedFindings)
      });

      // Step 7: Compute overall confidence
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
          performanceScore: this.calculatePerformanceScore(sortedFindings),
          averageOptimizationPotential: this.calculateAverageOptimizationPotential(sortedFindings),
          reportMethod: llmReport ? 'llm' : 'code-based'
        },
        businessImpact: this.generateBusinessImpact(sortedFindings, request.businessContext),
        rawData: {
          debateMetrics: {
            totalProposed,
            totalVerified,
            totalFalsePositives,
            verificationRate: totalProposed > 0 ? totalVerified / totalProposed : 0
          },
          findingsByType: Object.fromEntries(
            Array.from(findingsByType.entries()).map(([type, findings]) => [type, findings.length])
          ),
          llmReport: llmReport || null
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[PerformanceSynthesizer] Synthesis failed:', error);
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

    switch (finding.type) {
      case 'nested_loop':
        implementation.push(`In ${fileRef}: refactor nested loop to use Map/Set for O(1) inner lookup`);
        implementation.push('Pre-index data before the outer loop');
        implementation.push('Add benchmarks to verify O(n) improvement');
        break;
      case 'string_concat_in_loop':
        implementation.push(`In ${fileRef}: replace string concatenation with Array.push() + .join('')`);
        implementation.push('Consider streaming for very large outputs');
        break;
      case 'sync_io':
        implementation.push(`In ${fileRef}: replace synchronous I/O with async equivalent (fs/promises)`);
        implementation.push('If startup-only, add a comment documenting the intentional sync usage');
        break;
      case 'missing_await':
        implementation.push(`In ${fileRef}: add 'await' before the async call`);
        implementation.push('If fire-and-forget is intentional, use void and add .catch() handler');
        break;
      default:
        implementation.push(`In ${fileRef}: review and optimize the identified performance issue`);
    }

    if (finding.verificationEvidence) {
      implementation.push(`Challenger note: ${finding.verificationEvidence}`);
    }

    return {
      id: `perf_synth_rec_${uuidv4().slice(0, 8)}`,
      type: 'performance_optimization',
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

  private calculatePerformanceScore(findings: Finding[]): number {
    if (findings.length === 0) return 90;
    const weights: Record<string, number> = { critical: 40, high: 30, medium: 20, low: 10, info: 2 };
    const total = findings.reduce((sum, f) => sum + (weights[f.severity] || 10), 0);
    return Math.max(10, 100 - Math.min(total, 90));
  }

  private calculateAverageOptimizationPotential(findings: Finding[]): number {
    if (findings.length === 0) return 0;
    // Use evidence.optimizationPotential if available, otherwise estimate from severity
    const potentials = findings.map(f => {
      const fromEvidence = (f as any).optimizationPotential;
      if (typeof fromEvidence === 'number') return fromEvidence;
      const severityEstimate: Record<string, number> = { critical: 90, high: 75, medium: 50, low: 25, info: 10 };
      return severityEstimate[f.severity] ?? 50;
    });
    return potentials.reduce((a, b) => a + b, 0) / potentials.length;
  }

  private calculateOverallOptimizationValue(findings: Finding[]): number {
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
    const relevant = ['performance', 'optimization', 'synthesis', 'report', 'debate'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.performanceImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Performance synthesizer supports this proposal based on verified findings.'
      : 'Performance synthesizer has concerns based on the performance report.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['performance', 'optimization', 'report', 'synthesis'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { PerformanceSynthesizerAgent };
