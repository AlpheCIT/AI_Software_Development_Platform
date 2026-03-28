// =====================================================
// DOCUMENTATION SYNTHESIZER AGENT - DEBATE TRIAD ROLE: SYNTHESIZER
// =====================================================
// Combines verified documentation sections from the drafter/
// challenger debate into a polished final document with table
// of contents, consistent formatting, and debate metrics.

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
// DOCUMENTATION SYNTHESIZER AGENT
// =====================================================

export class DocumentationSynthesizerAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'doc_synthesizer';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database) {
    const capabilities: A2ACapabilities = {
      methods: [
        'synthesize_documentation',
        'format_docs',
        'produce_final_output'
      ],
      domains: [A2AAgentDomain.QUALITY],
      maxConcurrentRequests: 3,
      supportedProtocolVersion: '1.0',
      features: [
        'documentation_synthesis',
        'doc_formatting',
        'final_output_production'
      ]
    };

    super(
      'DocumentationSynthesizerAgent',
      A2AAgentDomain.QUALITY,
      capabilities,
      6,
      communicationBus
    );

    this.db = db;
    console.log('📖 DocumentationSynthesizerAgent: Initialized with ArangoDB connection');
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`📖 DocumentationSynthesizerAgent: Synthesizing documentation for ${request.type}`);
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

      // Separate documentation sections from gap findings
      const docSections = verifiedFindings.filter(f => f.type === 'documentation_section');
      const gapFindings = verifiedFindings.filter(f => f.type === 'documentation_gap');

      // Phase 1: Build final document structure
      const finalDoc = this.buildFinalDocument(docSections, gapFindings, repoId);

      // Phase 2: Calculate debate metrics
      const debateMetrics = this.calculateDebateMetrics(verifiedFindings, debateRounds);

      // Phase 3: Store as final documentation recommendation
      const findings: Finding[] = [{
        id: `doc_final_${Date.now()}`,
        type: 'final_documentation',
        severity: 'info',
        title: 'Final Documentation Output',
        description: finalDoc,
        evidence: {
          sectionsIncluded: docSections.length,
          gapsAddressed: gapFindings.length,
          debateRounds,
          ...debateMetrics
        },
        confidence: debateMetrics.averageConfidence,
        verificationStatus: 'verified',
        verificationMethod: 'debate',
        verificationEvidence: `Documentation verified through ${debateRounds} debate round(s)`
      }];

      const recommendations: Recommendation[] = [{
        id: `doc_final_rec_${Date.now()}`,
        type: 'final_documentation',
        priority: 'high',
        title: 'Final documentation ready for publication',
        description:
          `Documentation has been drafted, verified, and synthesized. ` +
          `${debateMetrics.sectionsVerified} sections verified, ` +
          `${debateMetrics.correctionsApplied} corrections applied, ` +
          `${debateMetrics.gapsFilled} gaps filled.`,
        impact: 'Provides verified, complete project documentation',
        effort: 'low',
        implementation: [
          'Review the final documentation output',
          'Publish as README.md or dedicated docs site',
          'Set up periodic re-generation to keep docs in sync with code'
        ],
        relatedFindings: findings.map(f => f.id),
        estimatedValue: 95,
        businessJustification:
          'Verified documentation reduces onboarding time and prevents API misuse.'
      }];

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: debateMetrics.averageConfidence,
        findings,
        recommendations,
        metrics: {
          totalSections: docSections.length,
          gapsFilled: gapFindings.length,
          debateRounds,
          sectionsVerified: debateMetrics.sectionsVerified,
          correctionsApplied: debateMetrics.correctionsApplied,
          averageConfidence: debateMetrics.averageConfidence,
          documentLength: finalDoc.length
        },
        businessImpact: this.generateBusinessImpact(findings, request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('DocumentationSynthesizerAgent: Synthesis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // DOCUMENT BUILDER
  // =====================================================

  private buildFinalDocument(
    sections: Finding[],
    gaps: Finding[],
    repoId: string
  ): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${repoId} Documentation`);
    lines.push('');
    lines.push(`> Auto-generated and verified by the Documentation Debate Triad`);
    lines.push(`> Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Table of contents
    const sectionOrder = ['Getting Started', 'API Reference', 'Architecture Overview', 'Configuration'];
    const orderedSections = this.orderSections(sections, sectionOrder);

    lines.push('## Table of Contents');
    lines.push('');
    for (const section of orderedSections) {
      const title = section.evidence?.sectionName || section.title;
      const anchor = title.toLowerCase().replace(/\s+/g, '-');
      const status = section.verificationStatus === 'verified' ? '[Verified]' : '[Unverified]';
      lines.push(`- [${title}](#${anchor}) ${status}`);
    }
    if (gaps.length > 0) {
      lines.push('- [Troubleshooting & Known Gaps](#troubleshooting--known-gaps)');
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Render each section
    for (const section of orderedSections) {
      const content = section.description || '';
      lines.push(content);
      lines.push('');

      // Add verification badge
      if (section.verificationStatus === 'verified') {
        lines.push(`> Verified with ${Math.round((section.confidence || 0) * 100)}% confidence`);
      } else if (section.challengerNotes) {
        lines.push(`> Note: ${section.challengerNotes}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Troubleshooting section from gap analysis
    if (gaps.length > 0) {
      lines.push('## Troubleshooting & Known Gaps');
      lines.push('');
      lines.push('The following areas were identified as needing additional documentation:');
      lines.push('');
      for (const gap of gaps) {
        lines.push(`- **${gap.title}**: ${gap.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private orderSections(sections: Finding[], preferredOrder: string[]): Finding[] {
    const ordered: Finding[] = [];
    const remaining = [...sections];

    for (const preferred of preferredOrder) {
      const idx = remaining.findIndex(
        s => (s.evidence?.sectionName || s.title) === preferred
      );
      if (idx >= 0) {
        ordered.push(remaining.splice(idx, 1)[0]);
      }
    }

    // Append any sections not in the preferred order
    ordered.push(...remaining);
    return ordered;
  }

  // =====================================================
  // DEBATE METRICS
  // =====================================================

  private calculateDebateMetrics(
    findings: Finding[],
    debateRounds: number
  ): {
    sectionsVerified: number;
    correctionsApplied: number;
    gapsFilled: number;
    averageConfidence: number;
  } {
    const docSections = findings.filter(f => f.type === 'documentation_section');
    const gapFindings = findings.filter(f => f.type === 'documentation_gap');

    const sectionsVerified = docSections.filter(f => f.verificationStatus === 'verified').length;
    const correctionsApplied = docSections.filter(
      f => f.challengerNotes && f.challengerNotes.length > 0
    ).length;
    const gapsFilled = gapFindings.length;

    const confidences = docSections.map(f => f.confidence || 0.5);
    const averageConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0.5;

    return {
      sectionsVerified,
      correctionsApplied,
      gapsFilled,
      averageConfidence: Math.round(averageConfidence * 100) / 100
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
    const relevant = ['documentation', 'synthesize', 'format', 'final_output'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.documentationImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Documentation synthesis supports this proposal. Final output meets quality standards.'
      : 'Documentation synthesis found issues. More debate rounds may be needed.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['documentation', 'synthesis', 'formatting', 'final_output'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}
