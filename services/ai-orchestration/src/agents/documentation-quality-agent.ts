// =====================================================
// DOCUMENTATION QUALITY AGENT - ArangoDB-DRIVEN ANALYSIS
// =====================================================
// Analyzes documentation coverage and quality by querying
// ingested repository data stored in ArangoDB collections.

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

interface DocumentationFinding extends Finding {
  filePath: string;
  importCount: number;
  documentationCoverage: number;
  exportedSymbols: number;
  documentedSymbols: number;
}

interface CoverageStats {
  totalFiles: number;
  documentedFiles: number;
  totalExports: number;
  documentedExports: number;
  overallCoverage: number;
  hubFilesWithoutDocs: Array<{
    filePath: string;
    importCount: number;
    coverage: number;
    exportedSymbols: number;
  }>;
  undocumentedExportCount: number;
}

// =====================================================
// DOCUMENTATION QUALITY AGENT
// =====================================================

export class DocumentationQualityAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'documentation_quality_001';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database) {
    const capabilities: A2ACapabilities = {
      methods: [
        'analyze_documentation_coverage',
        'assess_doc_quality',
        'identify_undocumented_hubs',
        'documentation_quality_analysis'
      ],
      domains: [A2AAgentDomain.QUALITY],
      maxConcurrentRequests: 5,
      supportedProtocolVersion: '1.0',
      features: [
        'documentation_analysis',
        'doc_coverage',
        'doc_quality_scoring'
      ]
    };

    super(
      'DocumentationQualityAgent',
      A2AAgentDomain.QUALITY,
      capabilities,
      6,
      communicationBus
    );

    this.db = db;
    console.log('📝 DocumentationQualityAgent: Initialized with ArangoDB connection');
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`📝 DocumentationQualityAgent: Analyzing ${request.type}`);
    const startTime = Date.now();

    try {
      const repoId = request.repoId || request.entityKey;
      if (!repoId) {
        return this.createErrorResult(request, new Error('repoId or entityKey is required'));
      }

      console.log(`🔍 Performing documentation quality analysis for repo: ${repoId}`);

      // Phase 1: Gather coverage stats from ArangoDB
      const coverageStats = await this.gatherCoverageStats(repoId);

      // Phase 2: Produce findings
      const findings: DocumentationFinding[] = [];
      findings.push(...this.generateHubFileFindings(coverageStats));
      findings.push(...this.generateExportFindings(coverageStats));
      findings.push(...this.generateOverallCoverageFindings(coverageStats));

      // Phase 3: Produce recommendations
      const recommendations: Recommendation[] = [];
      recommendations.push(...this.generateRecommendations(findings, coverageStats));

      const docScore = Math.round(coverageStats.overallCoverage * 100);

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: coverageStats.totalFiles > 0 ? 0.88 : 0.5,
        findings: findings as Finding[],
        recommendations,
        metrics: {
          documentationScore: docScore,
          totalFiles: coverageStats.totalFiles,
          documentedFiles: coverageStats.documentedFiles,
          overallCoverage: coverageStats.overallCoverage,
          undocumentedHubFiles: coverageStats.hubFilesWithoutDocs.length,
          undocumentedExports: coverageStats.undocumentedExportCount
        },
        businessImpact: this.generateBusinessImpact(findings as Finding[], request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ DocumentationQualityAgent: Analysis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // DATA GATHERING (AQL QUERIES)
  // =====================================================

  private async gatherCoverageStats(repoId: string): Promise<CoverageStats> {
    // Query 1: Get documentation coverage records for the repo
    let docCoverageRecords: any[] = [];
    try {
      const docCursor = await this.db.query(
        `FOR doc IN documentation_coverage
           FILTER doc.repoId == @repoId OR doc.repository == @repoId
           RETURN doc`,
        { repoId }
      );
      docCoverageRecords = await docCursor.all();
    } catch {
      console.warn('📝 documentation_coverage collection not available, falling back to code_entities');
    }

    // Query 2: Get code entities with import/dependency counts (hub detection)
    let codeEntities: any[] = [];
    try {
      const entityCursor = await this.db.query(
        `FOR entity IN code_entities
           FILTER entity.repoId == @repoId OR entity.repository == @repoId
           LET importCount = LENGTH(
             FOR dep IN code_entities
               FILTER dep.repoId == @repoId
               FILTER POSITION(dep.dependencies, entity.filePath) OR POSITION(dep.imports, entity.filePath)
               RETURN 1
           )
           RETURN MERGE(entity, { importCount: importCount })`,
        { repoId }
      );
      codeEntities = await entityCursor.all();
    } catch {
      console.warn('📝 code_entities query failed, using documentation_coverage only');
    }

    // Build coverage map from documentation_coverage collection
    const coverageMap = new Map<string, any>();
    for (const rec of docCoverageRecords) {
      coverageMap.set(rec.filePath || rec._key, rec);
    }

    // Cross-reference: find hub files without documentation
    const hubFilesWithoutDocs: CoverageStats['hubFilesWithoutDocs'] = [];
    const HUB_IMPORT_THRESHOLD = 3;

    for (const entity of codeEntities) {
      const importCount = entity.importCount || 0;
      if (importCount >= HUB_IMPORT_THRESHOLD) {
        const covRecord = coverageMap.get(entity.filePath || entity._key);
        const coverage = covRecord?.coverage ?? entity.documentationCoverage ?? 0;
        const exportedSymbols = entity.exportedSymbols?.length || entity.exportCount || 0;

        if (coverage < 0.5) {
          hubFilesWithoutDocs.push({
            filePath: entity.filePath || entity.name || entity._key,
            importCount,
            coverage,
            exportedSymbols
          });
        }
      }
    }

    // Sort hub files by import count descending (most-imported first)
    hubFilesWithoutDocs.sort((a, b) => b.importCount - a.importCount);

    // Calculate overall stats
    const totalFiles = codeEntities.length || docCoverageRecords.length || 0;
    const documentedFiles = docCoverageRecords.filter(r => (r.coverage || 0) > 0).length
      || codeEntities.filter(e => (e.documentationCoverage || 0) > 0).length;

    const totalExports = codeEntities.reduce((sum, e) =>
      sum + (e.exportedSymbols?.length || e.exportCount || 0), 0);
    const documentedExports = codeEntities.reduce((sum, e) =>
      sum + (e.documentedExportCount || 0), 0);

    const overallCoverage = totalFiles > 0 ? documentedFiles / totalFiles : 0;
    const undocumentedExportCount = totalExports - documentedExports;

    return {
      totalFiles,
      documentedFiles,
      totalExports,
      documentedExports,
      overallCoverage,
      hubFilesWithoutDocs,
      undocumentedExportCount
    };
  }

  // =====================================================
  // FINDING GENERATORS
  // =====================================================

  private generateHubFileFindings(stats: CoverageStats): DocumentationFinding[] {
    return stats.hubFilesWithoutDocs.slice(0, 10).map(hub => ({
      id: `doc_hub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'undocumented_hub_file',
      severity: hub.importCount >= 8 ? 'critical' as const : 'high' as const,
      title: `Hub file ${hub.filePath} (imported by ${hub.importCount} files) has ${Math.round(hub.coverage * 100)}% documentation coverage`,
      description:
        `${hub.filePath} is a high-traffic module imported by ${hub.importCount} other files ` +
        `but has only ${Math.round(hub.coverage * 100)}% documentation coverage. ` +
        `Undocumented hub files increase onboarding time and raise the risk of misuse.`,
      location: { file: hub.filePath },
      evidence: {
        importCount: hub.importCount,
        coverage: hub.coverage,
        exportedSymbols: hub.exportedSymbols
      },
      confidence: 0.92,
      filePath: hub.filePath,
      importCount: hub.importCount,
      documentationCoverage: hub.coverage,
      exportedSymbols: hub.exportedSymbols,
      documentedSymbols: Math.round(hub.exportedSymbols * hub.coverage)
    }));
  }

  private generateExportFindings(stats: CoverageStats): DocumentationFinding[] {
    const findings: DocumentationFinding[] = [];

    if (stats.undocumentedExportCount > 0) {
      findings.push({
        id: `doc_exports_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'undocumented_exports',
        severity: stats.undocumentedExportCount > 20 ? 'high' : 'medium',
        title: `${stats.undocumentedExportCount} exported functions lack JSDoc documentation`,
        description:
          `Out of ${stats.totalExports} total exports, ${stats.undocumentedExportCount} ` +
          `are missing JSDoc comments. Public API surfaces should be documented to ensure ` +
          `correct usage across the codebase.`,
        location: { file: 'repository-wide' },
        evidence: {
          totalExports: stats.totalExports,
          documentedExports: stats.documentedExports,
          undocumentedExports: stats.undocumentedExportCount
        },
        confidence: 0.85,
        filePath: 'repository-wide',
        importCount: 0,
        documentationCoverage: stats.totalExports > 0
          ? stats.documentedExports / stats.totalExports
          : 0,
        exportedSymbols: stats.totalExports,
        documentedSymbols: stats.documentedExports
      });
    }

    return findings;
  }

  private generateOverallCoverageFindings(stats: CoverageStats): DocumentationFinding[] {
    const findings: DocumentationFinding[] = [];
    const coveragePct = Math.round(stats.overallCoverage * 100);
    const COVERAGE_THRESHOLD = 50;

    if (coveragePct < COVERAGE_THRESHOLD) {
      findings.push({
        id: `doc_coverage_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'low_documentation_coverage',
        severity: coveragePct < 20 ? 'high' : 'medium',
        title: `Overall documentation coverage is ${coveragePct}% (below ${COVERAGE_THRESHOLD}% threshold)`,
        description:
          `Only ${stats.documentedFiles} of ${stats.totalFiles} files have documentation. ` +
          `A coverage target of at least ${COVERAGE_THRESHOLD}% is recommended for ` +
          `maintainability and onboarding efficiency.`,
        location: { file: 'repository-wide' },
        evidence: {
          totalFiles: stats.totalFiles,
          documentedFiles: stats.documentedFiles,
          coveragePercent: coveragePct,
          threshold: COVERAGE_THRESHOLD
        },
        confidence: 0.9,
        filePath: 'repository-wide',
        importCount: 0,
        documentationCoverage: stats.overallCoverage,
        exportedSymbols: stats.totalExports,
        documentedSymbols: stats.documentedExports
      });
    }

    return findings;
  }

  // =====================================================
  // RECOMMENDATION GENERATORS
  // =====================================================

  private generateRecommendations(
    findings: DocumentationFinding[],
    stats: CoverageStats
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const findingIds = findings.map(f => f.id);

    // Recommendation 1: Document hub files first
    if (stats.hubFilesWithoutDocs.length > 0) {
      const topHubs = stats.hubFilesWithoutDocs.slice(0, 10);
      recommendations.push({
        id: `doc_rec_hubs_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'documentation_improvement',
        priority: 'high',
        title: 'Add JSDoc to the top most-imported undocumented files first',
        description:
          `Focus documentation efforts on the ${topHubs.length} most-imported files ` +
          `that currently lack documentation. These files have the highest impact because ` +
          `they are used across multiple modules.`,
        impact: `Improves understanding for ${topHubs.reduce((s, h) => s + h.importCount, 0)} downstream import sites`,
        effort: topHubs.length > 5 ? 'high' : 'medium',
        implementation: [
          ...topHubs.map(h => `Add JSDoc to ${h.filePath} (imported by ${h.importCount} files)`),
          'Include @param, @returns, and @example tags for public functions',
          'Document complex type definitions and interfaces'
        ],
        relatedFindings: findingIds.filter(id => id.includes('hub')),
        estimatedValue: 90,
        businessJustification:
          'Documenting high-traffic modules reduces onboarding time and prevents misuse of shared APIs.'
      });
    }

    // Recommendation 2: Set up automated enforcement
    recommendations.push({
      id: `doc_rec_lint_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'process_improvement',
      priority: 'medium',
      title: 'Set up eslint-plugin-jsdoc to enforce documentation on new code',
      description:
        'Prevent documentation debt from growing by requiring JSDoc on all new ' +
        'exported functions and classes via an ESLint rule.',
      impact: 'Prevents new undocumented code from entering the codebase',
      effort: 'low',
      implementation: [
        'Install eslint-plugin-jsdoc as a dev dependency',
        'Add "jsdoc/require-jsdoc" rule targeting exported functions and classes',
        'Configure CI to fail on documentation linting errors',
        'Start with warn level and escalate to error after initial cleanup sprint'
      ],
      relatedFindings: findingIds,
      estimatedValue: 80,
      businessJustification:
        'Automated enforcement prevents documentation debt from accumulating without ongoing manual effort.'
    });

    // Recommendation 3: Coverage improvement roadmap (if low overall coverage)
    if (stats.overallCoverage < 0.5) {
      recommendations.push({
        id: `doc_rec_roadmap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'documentation_improvement',
        priority: stats.overallCoverage < 0.2 ? 'high' : 'medium',
        title: `Create a documentation improvement roadmap to reach 50% coverage`,
        description:
          `Current coverage is ${Math.round(stats.overallCoverage * 100)}%. ` +
          `A phased plan prioritising hub files and public APIs will yield the highest ROI.`,
        impact: `Raises documentation coverage from ${Math.round(stats.overallCoverage * 100)}% toward 50%+`,
        effort: 'high',
        implementation: [
          'Week 1-2: Document top 10 most-imported files',
          'Week 3-4: Document all exported public APIs',
          'Week 5-6: Add README files to each major module directory',
          'Ongoing: Enforce documentation via CI linting rules'
        ],
        relatedFindings: findingIds.filter(id => id.includes('coverage')),
        estimatedValue: 85,
        businessJustification:
          'Systematic documentation improvement reduces onboarding time from weeks to days and decreases support burden.',
        timeline: {
          immediate: ['Document top 5 hub files'],
          shortTerm: ['Reach 30% coverage, enable lint rules'],
          longTerm: ['Reach 50%+ coverage, full API documentation'],
          estimatedDuration: '6-8 weeks'
        }
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
    const relevant = ['documentation', 'quality', 'coverage', 'jsdoc', 'readme'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.qualityImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Documentation quality analysis supports this proposal as it improves code comprehensibility.'
      : 'Documentation quality concerns identified. This proposal may reduce documentation coverage.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['documentation', 'quality', 'coverage', 'jsdoc', 'api_surface'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { DocumentationFinding };
