// =====================================================
// DEPENDENCY SYNTHESIZER AGENT - DEBATE TRIAD ROLE: SYNTHESIZER
// =====================================================
// Produces a final dependency health report from verified
// findings. Sorts issues by urgency, generates actionable
// update commands, and includes debate metrics.

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
import { Database } from 'arangojs';

// =====================================================
// URGENCY TIERS
// =====================================================

type UrgencyTier = 'immediate' | 'this_sprint' | 'backlog';

interface PrioritizedFinding {
  finding: Finding;
  tier: UrgencyTier;
  sortOrder: number;
}

// =====================================================
// DEPENDENCY SYNTHESIZER AGENT
// =====================================================

export class DependencySynthesizerAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'dependency_synthesizer';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database) {
    const capabilities: A2ACapabilities = {
      methods: [
        'synthesize_dependency_report',
        'rank_issues',
        'produce_action_plan'
      ],
      domains: [A2AAgentDomain.DEPENDENCY],
      maxConcurrentRequests: 3,
      supportedProtocolVersion: '1.0',
      features: [
        'dependency_synthesis',
        'issue_ranking',
        'action_plan_generation'
      ]
    };

    super(
      'DependencySynthesizerAgent',
      A2AAgentDomain.DEPENDENCY,
      capabilities,
      7,
      communicationBus
    );

    this.db = db;
    console.log('📊 DependencySynthesizerAgent: Initialized with ArangoDB connection');
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`📊 DependencySynthesizerAgent: Synthesizing dependency report for ${request.type}`);
    const startTime = Date.now();

    try {
      const repoId = request.repoId || request.entityKey;
      if (!repoId) {
        return this.createErrorResult(request, new Error('repoId or entityKey is required'));
      }

      const verifiedFindings: Finding[] = request.parameters.verifiedFindings || [];
      const debateRounds: number = request.parameters.debateRounds || 1;

      if (verifiedFindings.length === 0) {
        return this.createErrorResult(request, new Error('verifiedFindings is required'));
      }

      // Phase 1: Prioritize findings by urgency
      const prioritized = this.prioritizeFindings(verifiedFindings);

      // Phase 2: Generate actionable recommendations per tier
      const recommendations = this.generateActionPlan(prioritized);

      // Phase 3: Build summary finding
      const debateMetrics = this.calculateDebateMetrics(verifiedFindings, debateRounds);
      const summaryFinding = this.buildSummaryFinding(prioritized, debateMetrics);

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: debateMetrics.averageConfidence,
        findings: [summaryFinding, ...verifiedFindings],
        recommendations,
        metrics: {
          totalVerifiedFindings: verifiedFindings.length,
          immediateIssues: prioritized.filter(p => p.tier === 'immediate').length,
          sprintIssues: prioritized.filter(p => p.tier === 'this_sprint').length,
          backlogIssues: prioritized.filter(p => p.tier === 'backlog').length,
          debateRounds,
          falsePositivesRemoved: verifiedFindings.filter(f => f.verificationStatus === 'false_positive').length,
          averageConfidence: debateMetrics.averageConfidence
        },
        businessImpact: this.generateBusinessImpact(verifiedFindings, request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('DependencySynthesizerAgent: Synthesis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // PRIORITIZATION
  // =====================================================

  private prioritizeFindings(findings: Finding[]): PrioritizedFinding[] {
    // Only include verified or unverified findings, not false positives
    const validFindings = findings.filter(f => f.verificationStatus !== 'false_positive');

    return validFindings.map(finding => {
      const tier = this.assignTier(finding);
      const sortOrder = this.calculateSortOrder(finding, tier);
      return { finding, tier, sortOrder };
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private assignTier(finding: Finding): UrgencyTier {
    // Critical vulnerabilities => immediate
    if (finding.type === 'vulnerable_package' && finding.severity === 'critical') {
      return 'immediate';
    }
    if (finding.type === 'vulnerable_dependencies' && finding.severity === 'critical') {
      return 'immediate';
    }

    // High-severity vulnerabilities or severely outdated => this sprint
    if (finding.type === 'vulnerable_package' || finding.type === 'vulnerable_dependencies') {
      return 'this_sprint';
    }
    if (finding.type === 'outdated_dependencies' && finding.severity === 'high') {
      return 'this_sprint';
    }

    // Circular dependencies => this sprint (architectural)
    if (finding.type === 'circular_dependencies') {
      return 'this_sprint';
    }

    // Everything else => backlog
    return 'backlog';
  }

  private calculateSortOrder(finding: Finding, tier: UrgencyTier): number {
    const tierWeight = { immediate: 0, this_sprint: 100, backlog: 200 };
    const severityWeight = { critical: 0, high: 10, medium: 20, low: 30, info: 40 };
    return tierWeight[tier] + (severityWeight[finding.severity] || 50);
  }

  // =====================================================
  // ACTION PLAN GENERATION
  // =====================================================

  private generateActionPlan(prioritized: PrioritizedFinding[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Immediate actions (security)
    const immediate = prioritized.filter(p => p.tier === 'immediate');
    if (immediate.length > 0) {
      recommendations.push({
        id: `dep_synth_immediate_${Date.now()}`,
        type: 'dependency_security',
        priority: 'critical',
        title: `Immediate: ${immediate.length} critical security issues`,
        description:
          `${immediate.length} dependency issues require immediate attention due to ` +
          `critical security vulnerabilities.`,
        impact: 'Eliminates critical security exposure in the dependency tree',
        effort: immediate.length > 5 ? 'high' : 'medium',
        implementation: this.generateUpdateCommands(immediate),
        relatedFindings: immediate.map(p => p.finding.id),
        estimatedValue: 100,
        businessJustification: 'Critical vulnerabilities pose immediate security risk.',
        timeline: {
          immediate: this.generateUpdateCommands(immediate).slice(0, 3),
          shortTerm: ['Run full test suite after updates', 'Deploy patched version'],
          longTerm: ['Add npm audit to CI pipeline'],
          estimatedDuration: '1-2 days'
        }
      });
    }

    // This sprint actions (major updates + circular deps)
    const sprint = prioritized.filter(p => p.tier === 'this_sprint');
    if (sprint.length > 0) {
      const vulnSprint = sprint.filter(p =>
        p.finding.type === 'vulnerable_package' || p.finding.type === 'vulnerable_dependencies'
      );
      const circularSprint = sprint.filter(p => p.finding.type === 'circular_dependencies');
      const outdatedSprint = sprint.filter(p => p.finding.type === 'outdated_dependencies');

      if (vulnSprint.length > 0 || outdatedSprint.length > 0) {
        recommendations.push({
          id: `dep_synth_sprint_updates_${Date.now()}`,
          type: 'dependency_maintenance',
          priority: 'high',
          title: `This Sprint: Update ${vulnSprint.length + outdatedSprint.length} packages`,
          description:
            `${vulnSprint.length} packages with non-critical vulnerabilities and ` +
            `${outdatedSprint.length} severely outdated packages should be updated this sprint.`,
          impact: 'Reduces vulnerability surface and catches up on major version updates',
          effort: 'high',
          implementation: this.generateUpdateCommands([...vulnSprint, ...outdatedSprint]),
          relatedFindings: [...vulnSprint, ...outdatedSprint].map(p => p.finding.id),
          estimatedValue: 85,
          timeline: {
            immediate: ['Create feature branch for dependency updates'],
            shortTerm: this.generateUpdateCommands([...vulnSprint, ...outdatedSprint]).slice(0, 5),
            longTerm: ['Run full regression tests', 'Merge and deploy'],
            estimatedDuration: '3-5 days'
          }
        });
      }

      if (circularSprint.length > 0) {
        recommendations.push({
          id: `dep_synth_sprint_cycles_${Date.now()}`,
          type: 'architecture_improvement',
          priority: 'high',
          title: `This Sprint: Resolve ${circularSprint.length} circular dependency issues`,
          description:
            `Circular dependencies should be broken to improve modularity and testability.`,
          impact: 'Improves code maintainability and reduces coupling',
          effort: 'high',
          implementation: [
            'Identify shared types/interfaces and extract to a common module',
            'Use dependency inversion to break direct circular references',
            'Add eslint-plugin-import no-cycle rule to prevent new cycles',
            'Consider barrel file reorganization for affected modules'
          ],
          relatedFindings: circularSprint.map(p => p.finding.id),
          estimatedValue: 80,
          timeline: {
            immediate: ['Map out the cycle graph'],
            shortTerm: ['Extract shared interfaces', 'Apply dependency inversion'],
            longTerm: ['Enable no-cycle lint rule in CI'],
            estimatedDuration: '3-5 days'
          }
        });
      }
    }

    // Backlog actions (minor updates)
    const backlog = prioritized.filter(p => p.tier === 'backlog');
    if (backlog.length > 0) {
      recommendations.push({
        id: `dep_synth_backlog_${Date.now()}`,
        type: 'dependency_maintenance',
        priority: 'low',
        title: `Backlog: ${backlog.length} minor dependency updates`,
        description:
          `${backlog.length} lower-priority dependency issues can be addressed in the backlog.`,
        impact: 'Keeps dependency tree healthy over time',
        effort: 'low',
        implementation: [
          'Consider enabling Renovate or Dependabot for automated PRs',
          ...this.generateUpdateCommands(backlog).slice(0, 3)
        ],
        relatedFindings: backlog.map(p => p.finding.id),
        estimatedValue: 50,
        timeline: {
          immediate: [],
          shortTerm: ['Set up automated dependency update tooling'],
          longTerm: ['Address remaining updates incrementally'],
          estimatedDuration: '1-2 weeks'
        }
      });
    }

    return recommendations;
  }

  private generateUpdateCommands(items: PrioritizedFinding[]): string[] {
    const commands: string[] = [];

    for (const item of items) {
      const finding = item.finding;
      const pkgName = (finding as any).packageName || finding.evidence?.package?.name;
      const latestVersion = (finding as any).latestVersion || finding.evidence?.package?.latestVersion;

      if (pkgName && latestVersion) {
        commands.push(`npm update ${pkgName}@${latestVersion}`);
      } else if (pkgName) {
        commands.push(`npm update ${pkgName}`);
      }

      // For vulnerability summary findings, suggest npm audit fix
      if (finding.type === 'vulnerable_dependencies') {
        commands.push('npm audit fix');
      }
    }

    // Deduplicate
    return [...new Set(commands)];
  }

  // =====================================================
  // DEBATE METRICS
  // =====================================================

  private calculateDebateMetrics(
    findings: Finding[],
    debateRounds: number
  ): {
    averageConfidence: number;
    verifiedCount: number;
    falsePositiveCount: number;
  } {
    const confidences = findings.map(f => f.confidence || 0.5);
    const averageConfidence = confidences.length > 0
      ? confidences.reduce((s, c) => s + c, 0) / confidences.length
      : 0.5;

    return {
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      verifiedCount: findings.filter(f => f.verificationStatus === 'verified').length,
      falsePositiveCount: findings.filter(f => f.verificationStatus === 'false_positive').length
    };
  }

  private buildSummaryFinding(
    prioritized: PrioritizedFinding[],
    metrics: { averageConfidence: number; verifiedCount: number; falsePositiveCount: number }
  ): Finding {
    const immediate = prioritized.filter(p => p.tier === 'immediate').length;
    const sprint = prioritized.filter(p => p.tier === 'this_sprint').length;
    const backlog = prioritized.filter(p => p.tier === 'backlog').length;

    return {
      id: `dep_synth_summary_${Date.now()}`,
      type: 'dependency_health_report',
      severity: immediate > 0 ? 'critical' : sprint > 0 ? 'high' : 'medium',
      title: 'Dependency Health Report',
      description:
        `Dependency analysis complete. ${prioritized.length} verified issues found: ` +
        `${immediate} immediate, ${sprint} this-sprint, ${backlog} backlog. ` +
        `${metrics.falsePositiveCount} false positives were removed during debate. ` +
        `Average confidence: ${Math.round(metrics.averageConfidence * 100)}%.`,
      evidence: {
        immediate,
        thisSprint: sprint,
        backlog,
        falsePositivesRemoved: metrics.falsePositiveCount,
        averageConfidence: metrics.averageConfidence
      },
      confidence: metrics.averageConfidence,
      verificationStatus: 'verified',
      verificationMethod: 'debate'
    };
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
    const relevant = ['dependency', 'synthesize', 'report', 'action_plan', 'health'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.dependencyImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Dependency synthesis supports this proposal. Action plan is ready.'
      : 'Dependency synthesis found issues. Further debate rounds recommended.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['dependency', 'vulnerability', 'package', 'update', 'health'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}
