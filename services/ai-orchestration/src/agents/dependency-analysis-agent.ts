// =====================================================
// DEPENDENCY ANALYSIS AGENT - ArangoDB-DRIVEN ANALYSIS
// =====================================================
// Analyses external dependencies, detects circular imports,
// and identifies outdated or vulnerable packages by querying
// data stored in ArangoDB from the ingestion pipeline.

import {
  EnhancedBaseA2AAgent,
  AnalysisRequest,
  AnalysisResult,
  Finding,
  Recommendation,
  BusinessContext
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

interface DependencyFinding extends Finding {
  packageName?: string;
  currentVersion?: string;
  latestVersion?: string;
  vulnerabilityCount?: number;
  cyclePath?: string[];
}

interface DependencyStats {
  totalDependencies: number;
  directDependencies: number;
  devDependencies: number;
  vulnerablePackages: Array<{
    name: string;
    version: string;
    vulnerabilities: number;
    highestSeverity: string;
  }>;
  outdatedPackages: Array<{
    name: string;
    currentVersion: string;
    latestVersion: string;
    majorVersionsBehind: number;
  }>;
  circularDependencies: string[][];
}

// =====================================================
// DEPENDENCY ANALYSIS AGENT
// =====================================================

export class DependencyAnalysisAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'dependency_analysis_001';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database) {
    const capabilities: A2ACapabilities = {
      methods: [
        'analyze_dependencies',
        'detect_circular_dependencies',
        'assess_dependency_health',
        'dependency_analysis'
      ],
      domains: [A2AAgentDomain.DEPENDENCY],
      maxConcurrentRequests: 5,
      supportedProtocolVersion: '1.0',
      features: [
        'dependency_analysis',
        'cycle_detection',
        'dependency_health'
      ]
    };

    super(
      'DependencyAnalysisAgent',
      A2AAgentDomain.DEPENDENCY,
      capabilities,
      7,
      communicationBus
    );

    this.db = db;
    console.log('📦 DependencyAnalysisAgent: Initialized with ArangoDB connection');
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`📦 DependencyAnalysisAgent: Analyzing ${request.type}`);
    const startTime = Date.now();

    try {
      const repoId = request.repoId || request.entityKey;
      if (!repoId) {
        return this.createErrorResult(request, new Error('repoId or entityKey is required'));
      }

      console.log(`🔍 Performing dependency analysis for repo: ${repoId}`);

      // Phase 1: Gather dependency data from ArangoDB
      const stats = await this.gatherDependencyStats(repoId);

      // Phase 2: Produce findings
      const findings: DependencyFinding[] = [];
      findings.push(...this.generateVulnerabilityFindings(stats));
      findings.push(...this.generateCircularDependencyFindings(stats));
      findings.push(...this.generateOutdatedFindings(stats));

      // Phase 3: Produce recommendations
      const recommendations: Recommendation[] = [];
      recommendations.push(...this.generateRecommendations(findings, stats));

      const healthScore = this.calculateDependencyHealthScore(stats);

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: stats.totalDependencies > 0 ? 0.87 : 0.5,
        findings: findings as Finding[],
        recommendations,
        metrics: {
          dependencyHealthScore: healthScore,
          totalDependencies: stats.totalDependencies,
          vulnerablePackages: stats.vulnerablePackages.length,
          outdatedPackages: stats.outdatedPackages.length,
          circularDependencyCycles: stats.circularDependencies.length
        },
        businessImpact: this.generateBusinessImpact(findings as Finding[], request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ DependencyAnalysisAgent: Analysis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // DATA GATHERING (AQL QUERIES)
  // =====================================================

  private async gatherDependencyStats(repoId: string): Promise<DependencyStats> {
    // Query 1: Get external dependencies for the repo
    let externalDeps: any[] = [];
    try {
      const depCursor = await this.db.query(
        `FOR dep IN external_dependencies
           FILTER dep.repoId == @repoId OR dep.repository == @repoId
           RETURN dep`,
        { repoId }
      );
      externalDeps = await depCursor.all();
    } catch {
      console.warn('📦 external_dependencies collection not available');
    }

    // Query 2: Get dependency health records (outdated / vulnerable)
    let healthRecords: any[] = [];
    try {
      const healthCursor = await this.db.query(
        `FOR h IN dependency_health
           FILTER h.repoId == @repoId OR h.repository == @repoId
           RETURN h`,
        { repoId }
      );
      healthRecords = await healthCursor.all();
    } catch {
      console.warn('📦 dependency_health collection not available');
    }

    // Query 3: Detect circular dependencies using graph traversal
    const circularDependencies = await this.detectCircularDependencies(repoId);

    // Build vulnerable packages list
    const vulnerablePackages = healthRecords
      .filter(h => (h.vulnerabilityCount || h.vulnerabilities?.length || 0) > 0)
      .map(h => ({
        name: h.packageName || h.name || h._key,
        version: h.currentVersion || h.version || 'unknown',
        vulnerabilities: h.vulnerabilityCount || h.vulnerabilities?.length || 0,
        highestSeverity: h.highestSeverity || h.maxSeverity || 'unknown'
      }));

    // Build outdated packages list
    const outdatedPackages = healthRecords
      .filter(h => (h.majorVersionsBehind || 0) > 0)
      .map(h => ({
        name: h.packageName || h.name || h._key,
        currentVersion: h.currentVersion || h.version || 'unknown',
        latestVersion: h.latestVersion || 'unknown',
        majorVersionsBehind: h.majorVersionsBehind || 0
      }))
      .sort((a, b) => b.majorVersionsBehind - a.majorVersionsBehind);

    const directDeps = externalDeps.filter(d => d.type === 'production' || d.isDirect !== false);
    const devDeps = externalDeps.filter(d => d.type === 'dev' || d.isDev === true);

    return {
      totalDependencies: externalDeps.length,
      directDependencies: directDeps.length,
      devDependencies: devDeps.length,
      vulnerablePackages,
      outdatedPackages,
      circularDependencies
    };
  }

  private async detectCircularDependencies(repoId: string): Promise<string[][]> {
    const cycles: string[][] = [];

    try {
      // Use graph traversal to find cycles among code_entities
      const cycleCursor = await this.db.query(
        `FOR entity IN code_entities
           FILTER entity.repoId == @repoId OR entity.repository == @repoId
           FILTER entity.type == 'module' OR entity.type == 'file'
           FOR v, e, p IN 1..10 OUTBOUND entity
             GRAPH 'code_graph'
             PRUNE v._id == entity._id AND LENGTH(p.vertices) > 1
             OPTIONS { uniqueEdges: 'path' }
             FILTER v._id == entity._id AND LENGTH(p.vertices) > 2
             LIMIT 20
             RETURN UNIQUE(p.vertices[*].name)`,
        { repoId }
      );
      const rawCycles = await cycleCursor.all();
      cycles.push(...rawCycles.filter((c: string[]) => c.length > 1));
    } catch {
      // Graph may not exist or collection may differ; try a simpler heuristic
      try {
        const simpleCycleCursor = await this.db.query(
          `FOR entity IN code_entities
             FILTER entity.repoId == @repoId OR entity.repository == @repoId
             FILTER LENGTH(entity.circularDependencies || []) > 0
             RETURN entity.circularDependencies`,
          { repoId }
        );
        const stored = await simpleCycleCursor.all();
        for (const cycle of stored) {
          if (Array.isArray(cycle)) cycles.push(cycle);
        }
      } catch {
        console.warn('📦 Circular dependency detection: no graph or stored cycle data available');
      }
    }

    return cycles;
  }

  // =====================================================
  // FINDING GENERATORS
  // =====================================================

  private generateVulnerabilityFindings(stats: DependencyStats): DependencyFinding[] {
    const findings: DependencyFinding[] = [];

    if (stats.vulnerablePackages.length > 0) {
      // One summary finding for the count
      findings.push({
        id: `dep_vuln_summary_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'vulnerable_dependencies',
        severity: stats.vulnerablePackages.some(p => p.highestSeverity === 'critical')
          ? 'critical'
          : 'high',
        title: `${stats.vulnerablePackages.length} dependencies have known vulnerabilities`,
        description:
          `${stats.vulnerablePackages.length} packages in the dependency tree have known ` +
          `security vulnerabilities. These should be updated or replaced to reduce attack surface.`,
        location: { file: 'package.json' },
        evidence: {
          packages: stats.vulnerablePackages.slice(0, 10),
          totalVulnerabilities: stats.vulnerablePackages.reduce((s, p) => s + p.vulnerabilities, 0)
        },
        confidence: 0.93,
        vulnerabilityCount: stats.vulnerablePackages.reduce((s, p) => s + p.vulnerabilities, 0)
      });

      // Individual findings for the top critical/high packages
      for (const pkg of stats.vulnerablePackages.slice(0, 5)) {
        findings.push({
          id: `dep_vuln_${pkg.name}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: 'vulnerable_package',
          severity: pkg.highestSeverity === 'critical' ? 'critical' : 'high',
          title: `${pkg.name}@${pkg.version} has ${pkg.vulnerabilities} known vulnerabilities`,
          description:
            `Package ${pkg.name} at version ${pkg.version} has ${pkg.vulnerabilities} ` +
            `known vulnerabilities (highest severity: ${pkg.highestSeverity}).`,
          location: { file: 'package.json' },
          evidence: { package: pkg },
          confidence: 0.95,
          packageName: pkg.name,
          currentVersion: pkg.version,
          vulnerabilityCount: pkg.vulnerabilities
        });
      }
    }

    return findings;
  }

  private generateCircularDependencyFindings(stats: DependencyStats): DependencyFinding[] {
    const findings: DependencyFinding[] = [];

    if (stats.circularDependencies.length > 0) {
      findings.push({
        id: `dep_cycle_summary_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'circular_dependencies',
        severity: stats.circularDependencies.length > 5 ? 'high' : 'medium',
        title: `${stats.circularDependencies.length} circular dependency cycles detected`,
        description:
          `${stats.circularDependencies.length} circular dependency cycles were found in the ` +
          `codebase. Circular dependencies make refactoring harder and can cause runtime issues ` +
          `with module initialisation order.`,
        location: { file: 'repository-wide' },
        evidence: {
          cycleCount: stats.circularDependencies.length,
          cycles: stats.circularDependencies.slice(0, 5)
        },
        confidence: 0.88,
        cyclePath: stats.circularDependencies[0] || []
      });
    }

    return findings;
  }

  private generateOutdatedFindings(stats: DependencyStats): DependencyFinding[] {
    const findings: DependencyFinding[] = [];

    const severelyOutdated = stats.outdatedPackages.filter(p => p.majorVersionsBehind >= 2);
    if (severelyOutdated.length > 0) {
      findings.push({
        id: `dep_outdated_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'outdated_dependencies',
        severity: severelyOutdated.length > 15 ? 'high' : 'medium',
        title: `${severelyOutdated.length} packages are more than 2 major versions behind`,
        description:
          `${severelyOutdated.length} dependencies are significantly outdated (2+ major versions ` +
          `behind latest). Outdated packages miss security patches, performance improvements, ` +
          `and may lose community support.`,
        location: { file: 'package.json' },
        evidence: {
          outdatedCount: severelyOutdated.length,
          worstOffenders: severelyOutdated.slice(0, 10).map(p => ({
            name: p.name,
            current: p.currentVersion,
            latest: p.latestVersion,
            behind: p.majorVersionsBehind
          }))
        },
        confidence: 0.9
      });
    }

    return findings;
  }

  // =====================================================
  // RECOMMENDATION GENERATORS
  // =====================================================

  private generateRecommendations(
    findings: DependencyFinding[],
    stats: DependencyStats
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const findingIds = findings.map(f => f.id);

    // Recommendation 1: Address vulnerable dependencies immediately
    if (stats.vulnerablePackages.length > 0) {
      const criticalPkgs = stats.vulnerablePackages.filter(p => p.highestSeverity === 'critical');
      recommendations.push({
        id: `dep_rec_vuln_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'dependency_security',
        priority: criticalPkgs.length > 0 ? 'critical' : 'high',
        title: 'Update or replace vulnerable dependencies',
        description:
          `${stats.vulnerablePackages.length} packages have known vulnerabilities. ` +
          `Run \`npm audit fix\` for automatic patches, then manually update packages ` +
          `that require breaking-change upgrades.`,
        impact: `Eliminates ${stats.vulnerablePackages.reduce((s, p) => s + p.vulnerabilities, 0)} known vulnerabilities`,
        effort: stats.vulnerablePackages.length > 10 ? 'high' : 'medium',
        implementation: [
          'Run `npm audit` to get a detailed vulnerability report',
          'Run `npm audit fix` to auto-patch non-breaking updates',
          ...criticalPkgs.slice(0, 5).map(p =>
            `Manually upgrade ${p.name}@${p.version} (critical vulnerability)`),
          'For packages with no fix available, evaluate alternative libraries',
          'Add `npm audit` to CI pipeline to catch future vulnerabilities'
        ],
        relatedFindings: findingIds.filter(id => id.includes('vuln')),
        estimatedValue: 95,
        businessJustification:
          'Vulnerable dependencies are the most common attack vector for supply-chain attacks.'
      });
    }

    // Recommendation 2: Break circular dependency cycles
    if (stats.circularDependencies.length > 0) {
      recommendations.push({
        id: `dep_rec_cycles_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'architecture_improvement',
        priority: 'high',
        title: 'Refactor to eliminate circular dependency cycles',
        description:
          `${stats.circularDependencies.length} circular dependency cycles make the codebase ` +
          `harder to test, refactor, and reason about.`,
        impact: 'Improves modularity and reduces risk of initialisation-order bugs',
        effort: 'high',
        implementation: [
          'Identify the smallest cycle and extract shared types into a separate module',
          'Use dependency inversion (interfaces) to break direct circular references',
          'Consider using a barrel file pattern to reorganise exports',
          'Add a lint rule (e.g. eslint-plugin-import no-cycle) to prevent new cycles',
          'Track cycle count in CI metrics dashboard'
        ],
        relatedFindings: findingIds.filter(id => id.includes('cycle')),
        estimatedValue: 80,
        businessJustification:
          'Circular dependencies increase coupling and make it progressively harder to ship changes safely.'
      });
    }

    // Recommendation 3: Update outdated packages
    const severelyOutdated = stats.outdatedPackages.filter(p => p.majorVersionsBehind >= 2);
    if (severelyOutdated.length > 0) {
      recommendations.push({
        id: `dep_rec_outdated_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'dependency_maintenance',
        priority: 'medium',
        title: 'Create a dependency update plan for severely outdated packages',
        description:
          `${severelyOutdated.length} packages are 2+ major versions behind. ` +
          `Batch-update these in a controlled manner to avoid accumulated migration pain.`,
        impact: 'Access to security patches, performance improvements, and modern APIs',
        effort: 'high',
        implementation: [
          'Prioritise updates for packages with known vulnerabilities',
          ...severelyOutdated.slice(0, 5).map(p =>
            `Update ${p.name} from ${p.currentVersion} to ${p.latestVersion} (${p.majorVersionsBehind} major versions behind)`),
          'Create a separate branch for each major update to isolate risk',
          'Run full test suite after each major update before merging',
          'Consider using tools like npm-check-updates or Renovate for automated PRs'
        ],
        relatedFindings: findingIds.filter(id => id.includes('outdated')),
        estimatedValue: 70,
        businessJustification:
          'Staying current with dependencies reduces the cost and risk of future upgrades.',
        timeline: {
          immediate: ['Update packages with known vulnerabilities'],
          shortTerm: ['Update packages 3+ major versions behind'],
          longTerm: ['Set up automated dependency update tooling'],
          estimatedDuration: '2-4 weeks'
        }
      });
    }

    return recommendations;
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private calculateDependencyHealthScore(stats: DependencyStats): number {
    if (stats.totalDependencies === 0) return 90;

    let score = 100;

    // Deduct for vulnerabilities
    score -= Math.min(stats.vulnerablePackages.length * 8, 40);

    // Deduct for circular dependencies
    score -= Math.min(stats.circularDependencies.length * 5, 20);

    // Deduct for outdated packages
    const severelyOutdated = stats.outdatedPackages.filter(p => p.majorVersionsBehind >= 2);
    score -= Math.min(severelyOutdated.length * 2, 20);

    return Math.max(10, Math.round(score));
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
      metrics: { error: error instanceof Error ? error.message : String(error) }
    };
  }

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const relevant = ['dependency', 'package', 'npm', 'vulnerability', 'outdated', 'circular'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.dependencyImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Dependency analysis supports this proposal as it improves dependency health.'
      : 'Dependency concerns identified. This proposal may introduce risky or outdated dependencies.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['dependency', 'package', 'vulnerability', 'npm', 'supply_chain'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { DependencyFinding };
