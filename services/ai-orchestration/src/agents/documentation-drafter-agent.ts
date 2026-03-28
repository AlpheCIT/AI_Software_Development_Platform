// =====================================================
// DOCUMENTATION DRAFTER AGENT - DEBATE TRIAD ROLE: ANALYZER
// =====================================================
// Generates end-user documentation from source code and
// ArangoDB-ingested metadata (API endpoints, frameworks,
// dependencies). Output is passed to the challenger for
// verification before the synthesizer produces final docs.
// Supports LLM-powered generation when an llmClient is provided.

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
import { LLMClient } from '../llm/llm-client.js';
import { docDrafterPrompt } from '../llm/prompts.js';
import { DocumentationDrafterSchema } from '../llm/schemas.js';

// =====================================================
// DOMAIN-SPECIFIC INTERFACES
// =====================================================

interface DocumentationSection {
  sectionName: string;
  content: string;
  sourceEvidence: string[];
  completeness: number;
}

interface IngestionData {
  apiEndpoints: any[];
  frameworkUsage: any[];
  externalDependencies: any[];
  codeEntities: any[];
}

// =====================================================
// DOCUMENTATION DRAFTER AGENT
// =====================================================

export class DocumentationDrafterAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'doc_drafter';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database, llmClient?: LLMClient | null) {
    const capabilities: A2ACapabilities = {
      methods: [
        'draft_documentation',
        'extract_api_docs',
        'generate_user_guide'
      ],
      domains: [A2AAgentDomain.QUALITY],
      maxConcurrentRequests: 3,
      supportedProtocolVersion: '1.0',
      features: [
        'documentation_drafting',
        'api_extraction',
        'user_guide_generation'
      ]
    };

    super(
      'DocumentationDrafterAgent',
      A2AAgentDomain.QUALITY,
      capabilities,
      6,
      communicationBus,
      llmClient
    );

    this.db = db;
    console.log('DocumentationDrafterAgent: Initialized with ArangoDB connection' +
      (this.hasLLM() ? ' and LLM client' : ' (template mode)'));
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`DocumentationDrafterAgent: Drafting documentation for ${request.type}`);
    const startTime = Date.now();

    try {
      const repoId = request.repoId || request.entityKey;
      if (!repoId) {
        return this.createErrorResult(request, new Error('repoId or entityKey is required'));
      }

      const sourceFiles: Map<string, string> = request.sourceFiles
        || request.parameters.sourceFiles
        || new Map<string, string>();

      // Phase 1: Gather ingestion data from ArangoDB
      const ingestionData = await this.gatherIngestionData(repoId);

      // Phase 2: Generate documentation sections as findings
      let findings: Finding[];

      if (this.hasLLM()) {
        findings = await this.draftWithLLM(ingestionData, sourceFiles);
      } else {
        findings = this.draftWithTemplates(ingestionData, sourceFiles);
      }

      // Phase 3: Recommendations for the synthesizer
      const recommendations: Recommendation[] = this.generateDraftRecommendations(findings, ingestionData);

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: this.hasLLM() ? 0.85 : 0.75,
        findings,
        recommendations,
        metrics: {
          sectionsGenerated: findings.length,
          apiEndpointsDocumented: ingestionData.apiEndpoints.length,
          frameworksDetected: ingestionData.frameworkUsage.length,
          dependenciesListed: ingestionData.externalDependencies.length,
          llmPowered: this.hasLLM() ? 1 : 0
        },
        businessImpact: this.generateBusinessImpact(findings, request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('DocumentationDrafterAgent: Analysis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // LLM-POWERED DRAFTING
  // =====================================================

  private async draftWithLLM(
    data: IngestionData,
    sourceFiles: Map<string, string>
  ): Promise<Finding[]> {
    console.log('DocumentationDrafterAgent: Using LLM for documentation generation');

    // Build context strings for the LLM
    const frameworkInfo = data.frameworkUsage.length > 0
      ? data.frameworkUsage.map(fw => `${fw.name || fw.framework || fw._key} ${fw.version || ''}`).join('\n')
      : 'No frameworks detected';

    const apiEndpoints = data.apiEndpoints.length > 0
      ? data.apiEndpoints.map(ep =>
        `${(ep.method || 'GET').toUpperCase()} ${ep.path || ep.route || '/unknown'} - ${ep.description || 'No description'}`
      ).join('\n')
      : 'No API endpoints detected';

    const dependencies = data.externalDependencies.slice(0, 30)
      .map(d => `${d.name || d.packageName || d._key}: ${d.version || 'unknown'}`)
      .join('\n') || 'No dependencies detected';

    // Build a source file summary (key files, not full content)
    const sourceFilesSummary = this.buildSourceFilesSummary(sourceFiles, data);

    const prompt = docDrafterPrompt({
      frameworkInfo,
      apiEndpoints,
      dependencies,
      sourceFilesSummary
    });

    const llmResult = await this.callLLM(prompt.system, prompt.user, {
      jsonSchema: DocumentationDrafterSchema,
      maxTokens: 8192,
      temperature: 0.2
    });

    if (llmResult && llmResult.sections) {
      return llmResult.sections.map((section: any) => ({
        id: `doc_section_${section.sectionName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        type: 'documentation_section',
        severity: 'info' as const,
        title: section.sectionName,
        description: section.content,
        evidence: {
          sectionName: section.sectionName,
          sourceEvidence: section.sourceEvidence || [],
          completeness: section.completeness || 0.8
        },
        confidence: 0.85,
        verificationStatus: 'unverified' as const,
        verificationMethod: 'llm' as const
      }));
    }

    // Fallback to template if LLM returns null
    console.warn('DocumentationDrafterAgent: LLM returned no result, falling back to templates');
    return this.draftWithTemplates(data, sourceFiles);
  }

  private buildSourceFilesSummary(
    sourceFiles: Map<string, string>,
    data: IngestionData
  ): string {
    const parts: string[] = [];
    let charCount = 0;
    const maxChars = 30000;

    // Include package.json first
    for (const [path, content] of sourceFiles.entries()) {
      if (path.endsWith('package.json')) {
        const block = `--- ${path} ---\n${content}\n`;
        parts.push(block);
        charCount += block.length;
        break;
      }
    }

    // Include key config files
    for (const [path, content] of sourceFiles.entries()) {
      if (charCount >= maxChars) break;
      if (
        path.includes('.env') ||
        path.match(/config\.(ts|js|json)$/) ||
        path.endsWith('tsconfig.json') ||
        path.endsWith('README.md')
      ) {
        const block = `--- ${path} ---\n${content.slice(0, 2000)}\n`;
        parts.push(block);
        charCount += block.length;
      }
    }

    // Include entry point files
    for (const [path, content] of sourceFiles.entries()) {
      if (charCount >= maxChars) break;
      if (
        path.match(/\/(index|main|app|server)\.(ts|js|tsx|jsx)$/) ||
        path.match(/\/routes?\.(ts|js)$/)
      ) {
        const block = `--- ${path} ---\n${content.slice(0, 3000)}\n`;
        parts.push(block);
        charCount += block.length;
      }
    }

    return parts.join('\n') || 'No source files available';
  }

  // =====================================================
  // TEMPLATE-BASED DRAFTING (FALLBACK)
  // =====================================================

  private draftWithTemplates(
    data: IngestionData,
    sourceFiles: Map<string, string>
  ): Finding[] {
    const findings: Finding[] = [];
    findings.push(this.draftGettingStartedSection(data, sourceFiles));
    findings.push(this.draftApiReferenceSection(data));
    findings.push(this.draftArchitectureSection(data, sourceFiles));
    findings.push(this.draftConfigurationSection(data, sourceFiles));
    return findings;
  }

  // =====================================================
  // DATA GATHERING (AQL QUERIES)
  // =====================================================

  private async gatherIngestionData(repoId: string): Promise<IngestionData> {
    const data: IngestionData = {
      apiEndpoints: [],
      frameworkUsage: [],
      externalDependencies: [],
      codeEntities: []
    };

    // Query api_endpoints collection
    try {
      const cursor = await this.db.query(
        `FOR ep IN api_endpoints
           FILTER ep.repoId == @repoId OR ep.repository == @repoId
           RETURN ep`,
        { repoId }
      );
      data.apiEndpoints = await cursor.all();
    } catch {
      console.warn('DocumentationDrafterAgent: api_endpoints collection not available');
    }

    // Query framework_usage collection
    try {
      const cursor = await this.db.query(
        `FOR fw IN framework_usage
           FILTER fw.repoId == @repoId OR fw.repository == @repoId
           RETURN fw`,
        { repoId }
      );
      data.frameworkUsage = await cursor.all();
    } catch {
      console.warn('DocumentationDrafterAgent: framework_usage collection not available');
    }

    // Query external_dependencies collection
    try {
      const cursor = await this.db.query(
        `FOR dep IN external_dependencies
           FILTER dep.repoId == @repoId OR dep.repository == @repoId
           RETURN dep`,
        { repoId }
      );
      data.externalDependencies = await cursor.all();
    } catch {
      console.warn('DocumentationDrafterAgent: external_dependencies collection not available');
    }

    // Query code_entities for structure overview
    try {
      const cursor = await this.db.query(
        `FOR entity IN code_entities
           FILTER entity.repoId == @repoId OR entity.repository == @repoId
           SORT entity.filePath ASC
           LIMIT 200
           RETURN { filePath: entity.filePath, type: entity.type, name: entity.name, exports: entity.exportedSymbols }`,
        { repoId }
      );
      data.codeEntities = await cursor.all();
    } catch {
      console.warn('DocumentationDrafterAgent: code_entities query failed');
    }

    return data;
  }

  // =====================================================
  // SECTION DRAFTERS (TEMPLATE-BASED)
  // =====================================================

  private draftGettingStartedSection(
    data: IngestionData,
    sourceFiles: Map<string, string>
  ): Finding {
    const frameworks = data.frameworkUsage.map(fw => fw.name || fw.framework || fw._key);
    const deps = data.externalDependencies.slice(0, 10);
    const depNames = deps.map(d => d.name || d.packageName || d._key);

    // Look for package.json scripts
    let scripts: Record<string, string> = {};
    for (const [path, content] of Array.from(sourceFiles.entries())) {
      if (path.endsWith('package.json')) {
        try {
          const pkg = JSON.parse(content);
          scripts = pkg.scripts || {};
        } catch { /* skip invalid JSON */ }
        break;
      }
    }

    const lines: string[] = ['## Getting Started', ''];
    lines.push('### Prerequisites');
    if (frameworks.length > 0) {
      lines.push(`This project uses: ${frameworks.join(', ')}.`);
    }
    lines.push('');
    lines.push('### Installation');
    lines.push('```bash');
    lines.push(scripts.install ? `npm run install` : 'npm install');
    lines.push('```');
    lines.push('');
    if (Object.keys(scripts).length > 0) {
      lines.push('### Available Scripts');
      for (const [name, cmd] of Object.entries(scripts)) {
        lines.push(`- \`npm run ${name}\` - ${cmd}`);
      }
    }
    if (depNames.length > 0) {
      lines.push('');
      lines.push('### Key Dependencies');
      lines.push(depNames.map(n => `- ${n}`).join('\n'));
    }

    const content = lines.join('\n');
    const evidence: string[] = [];
    if (frameworks.length > 0) evidence.push(`Frameworks detected: ${frameworks.join(', ')}`);
    if (Object.keys(scripts).length > 0) evidence.push(`Scripts found: ${Object.keys(scripts).join(', ')}`);

    return {
      id: `doc_section_getting_started_${Date.now()}`,
      type: 'documentation_section',
      severity: 'info',
      title: 'Getting Started',
      description: content,
      evidence: { sectionName: 'Getting Started', sourceEvidence: evidence, completeness: frameworks.length > 0 ? 0.8 : 0.5 },
      confidence: 0.7,
      verificationStatus: 'unverified',
      verificationMethod: 'template'
    };
  }

  private draftApiReferenceSection(data: IngestionData): Finding {
    const lines: string[] = ['## API Reference', ''];

    if (data.apiEndpoints.length === 0) {
      lines.push('No API endpoints were detected during ingestion.');
    } else {
      // Group endpoints by resource
      const grouped = new Map<string, any[]>();
      for (const ep of data.apiEndpoints) {
        const resource = ep.resource || ep.basePath || ep.path?.split('/')[1] || 'general';
        if (!grouped.has(resource)) grouped.set(resource, []);
        grouped.get(resource)!.push(ep);
      }

      for (const [resource, endpoints] of Array.from(grouped)) {
        lines.push(`### ${resource}`);
        for (const ep of endpoints) {
          const method = (ep.method || 'GET').toUpperCase();
          const path = ep.path || ep.route || '/unknown';
          lines.push(`- **${method}** \`${path}\``);
          if (ep.description) lines.push(`  ${ep.description}`);
          if (ep.parameters && ep.parameters.length > 0) {
            lines.push(`  Parameters: ${ep.parameters.map((p: any) => p.name || p).join(', ')}`);
          }
        }
        lines.push('');
      }
    }

    const content = lines.join('\n');

    return {
      id: `doc_section_api_reference_${Date.now()}`,
      type: 'documentation_section',
      severity: 'info',
      title: 'API Reference',
      description: content,
      evidence: {
        sectionName: 'API Reference',
        sourceEvidence: [`${data.apiEndpoints.length} endpoints detected`],
        completeness: data.apiEndpoints.length > 0 ? 0.75 : 0.2
      },
      confidence: data.apiEndpoints.length > 0 ? 0.8 : 0.4,
      verificationStatus: 'unverified',
      verificationMethod: 'template'
    };
  }

  private draftArchitectureSection(
    data: IngestionData,
    sourceFiles: Map<string, string>
  ): Finding {
    const lines: string[] = ['## Architecture Overview', ''];

    // Determine top-level directories from code entities
    const topDirs = new Set<string>();
    for (const entity of data.codeEntities) {
      const fp = entity.filePath || '';
      const parts = fp.split('/');
      if (parts.length > 1) topDirs.add(parts[0]);
    }

    if (topDirs.size > 0) {
      lines.push('### Project Structure');
      for (const dir of Array.from(topDirs).sort()) {
        lines.push(`- \`${dir}/\``);
      }
      lines.push('');
    }

    // Frameworks
    if (data.frameworkUsage.length > 0) {
      lines.push('### Frameworks & Libraries');
      for (const fw of data.frameworkUsage) {
        const name = fw.name || fw.framework || fw._key;
        const version = fw.version || '';
        lines.push(`- **${name}** ${version}`.trim());
      }
      lines.push('');
    }

    // File type breakdown
    const typeCounts = new Map<string, number>();
    for (const entity of data.codeEntities) {
      const ext = (entity.filePath || '').split('.').pop() || 'unknown';
      typeCounts.set(ext, (typeCounts.get(ext) || 0) + 1);
    }
    if (typeCounts.size > 0) {
      lines.push('### File Type Distribution');
      const sorted = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
      for (const [ext, count] of sorted.slice(0, 10)) {
        lines.push(`- \`.${ext}\`: ${count} files`);
      }
    }

    const content = lines.join('\n');

    return {
      id: `doc_section_architecture_${Date.now()}`,
      type: 'documentation_section',
      severity: 'info',
      title: 'Architecture Overview',
      description: content,
      evidence: {
        sectionName: 'Architecture Overview',
        sourceEvidence: [
          `${topDirs.size} top-level directories`,
          `${data.frameworkUsage.length} frameworks detected`,
          `${data.codeEntities.length} code entities analyzed`
        ],
        completeness: data.codeEntities.length > 0 ? 0.7 : 0.3
      },
      confidence: 0.7,
      verificationStatus: 'unverified',
      verificationMethod: 'template'
    };
  }

  private draftConfigurationSection(
    data: IngestionData,
    sourceFiles: Map<string, string>
  ): Finding {
    const lines: string[] = ['## Configuration', ''];

    // Detect .env patterns from source files
    const envVars: string[] = [];
    const configFiles: string[] = [];
    for (const [path, content] of Array.from(sourceFiles.entries())) {
      if (path.includes('.env') && !path.includes('node_modules')) {
        configFiles.push(path);
        const varMatches = content.match(/^[A-Z_][A-Z0-9_]+=.*/gm);
        if (varMatches) {
          envVars.push(...varMatches.map(m => m.split('=')[0]));
        }
      }
      if (path.match(/config\.(ts|js|json)$/) || path.includes('/config/')) {
        configFiles.push(path);
      }
    }

    if (envVars.length > 0) {
      lines.push('### Environment Variables');
      const unique = Array.from(new Set(envVars)).sort();
      for (const v of unique.slice(0, 30)) {
        lines.push(`- \`${v}\``);
      }
      lines.push('');
    }

    if (configFiles.length > 0) {
      lines.push('### Configuration Files');
      for (const cf of Array.from(new Set(configFiles)).sort()) {
        lines.push(`- \`${cf}\``);
      }
    }

    if (envVars.length === 0 && configFiles.length === 0) {
      lines.push('No configuration files or environment variables were detected.');
    }

    const content = lines.join('\n');

    return {
      id: `doc_section_configuration_${Date.now()}`,
      type: 'documentation_section',
      severity: 'info',
      title: 'Configuration',
      description: content,
      evidence: {
        sectionName: 'Configuration',
        sourceEvidence: [
          `${envVars.length} environment variables detected`,
          `${configFiles.length} configuration files found`
        ],
        completeness: envVars.length > 0 ? 0.7 : 0.3
      },
      confidence: envVars.length > 0 ? 0.75 : 0.4,
      verificationStatus: 'unverified',
      verificationMethod: 'template'
    };
  }

  // =====================================================
  // RECOMMENDATION GENERATORS
  // =====================================================

  private generateDraftRecommendations(
    findings: Finding[],
    data: IngestionData
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const findingIds = findings.map(f => f.id);

    recommendations.push({
      id: `doc_draft_rec_${Date.now()}`,
      type: 'documentation_draft',
      priority: 'medium',
      title: 'Documentation draft generated - send to challenger for verification',
      description:
        `${findings.length} documentation sections have been drafted from ingestion data. ` +
        `These should be verified against actual source code before publication.`,
      impact: 'Provides initial documentation covering key project aspects',
      effort: 'low',
      implementation: [
        'Pass findings to DocumentationChallengerAgent for accuracy verification',
        'Address any gaps or inaccuracies identified by the challenger',
        'Send verified sections to DocumentationSynthesizerAgent for final formatting'
      ],
      relatedFindings: findingIds,
      estimatedValue: 75
    });

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
      metrics: { errorOccurred: 1 }
    };
  }

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const relevant = ['documentation', 'draft', 'api_docs', 'user_guide', 'readme'];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.documentationImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Documentation drafting supports this proposal as it improves project documentation.'
      : 'Documentation concerns identified. This proposal may reduce documentation quality.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = ['documentation', 'api', 'framework', 'configuration', 'architecture'];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}
