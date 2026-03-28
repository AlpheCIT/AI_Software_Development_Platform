// =====================================================
// PERFORMANCE ANALYZER AGENT - REAL PATTERN ANALYSIS
// =====================================================
// Debate triad role: ANALYZER
// Scans source files for performance anti-patterns using
// regex and structural analysis. Findings are unverified
// until the challenger reviews them.

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
import { LLMClient } from '../llm/llm-client.js';
import { performanceAnalyzerPrompt } from '../llm/prompts.js';
import { PerformanceAnalysisSchema } from '../llm/schemas.js';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// PERFORMANCE-SPECIFIC INTERFACES
// =====================================================

interface PerformanceFinding extends Finding {
  executionTime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  bottleneckType: 'cpu' | 'memory' | 'io' | 'network' | 'database' | 'algorithm';
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  scalabilityImpact: number;
  optimizationPotential: number;
  resourceWaste: number;
}

// =====================================================
// PERFORMANCE ANALYZER AGENT
// =====================================================

export class EnhancedPerformanceExpertAgent extends EnhancedBaseA2AAgent {
  private performanceKnowledge: Map<string, any> = new Map();

  constructor(communicationBus: A2ACommunicationBus, llmClient?: LLMClient | null) {
    const capabilities: A2ACapabilities = {
      methods: [
        'analyze_performance_bottlenecks',
        'assess_scalability',
        'optimize_algorithms',
        'analyze_memory_usage',
        'comprehensive_performance_analysis'
      ],
      domains: [A2AAgentDomain.PERFORMANCE],
      maxConcurrentRequests: 5,
      supportedProtocolVersion: '1.0',
      features: [
        'bottleneck_detection',
        'scalability_analysis',
        'optimization_recommendations',
        'memory_analysis',
        'debate_analyzer_role'
      ]
    };

    super('PerformanceAnalyzerAgent', A2AAgentDomain.PERFORMANCE, capabilities, 7, communicationBus, llmClient);
    this.initializePerformanceKnowledge();
  }

  // =====================================================
  // MAIN ANALYSIS ENTRY POINT
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`[PerformanceAnalyzer] Analyzing ${request.type}`);
    const startTime = Date.now();

    try {
      const sourceFiles = this.resolveSourceFiles(request);

      if (sourceFiles.size === 0) {
        console.warn('[PerformanceAnalyzer] No source files provided');
        return this.createEmptyResult(request, 'No source files available for analysis');
      }

      console.log(`[PerformanceAnalyzer] Scanning ${sourceFiles.size} file(s)`);

      // Step 1: Run regex pre-filter to identify candidate locations (fast scan)
      const regexFindings: PerformanceFinding[] = [];
      for (const [filePath, fileContent] of sourceFiles) {
        if (!this.isCodeFile(filePath)) continue;
        const fileFindings = this.analyzeFile(filePath, fileContent);
        regexFindings.push(...fileFindings);
      }

      console.log(`[PerformanceAnalyzer] Regex pre-filter found ${regexFindings.length} candidate(s)`);

      let findings: PerformanceFinding[] = [];

      // Step 2: If LLM is available, use it for deeper analysis
      if (this.hasLLM()) {
        try {
          const candidates = regexFindings.map(f => ({
            file: f.location?.file || '',
            line: f.location?.line || 0,
            pattern: f.type
          }));

          const prompt = performanceAnalyzerPrompt({
            files: sourceFiles,
            candidates: candidates.length > 0 ? candidates : undefined
          });

          console.log(`[PerformanceAnalyzer] Calling LLM for deep analysis...`);
          const llmResult = await this.callLLM(prompt.system, prompt.user, {
            jsonSchema: PerformanceAnalysisSchema
          });

          if (llmResult && llmResult.findings && Array.isArray(llmResult.findings)) {
            console.log(`[PerformanceAnalyzer] LLM returned ${llmResult.findings.length} finding(s)`);

            for (const llmFinding of llmResult.findings) {
              findings.push(this.buildPerformanceFinding({
                type: llmFinding.type || 'other',
                severity: llmFinding.severity || 'medium',
                title: llmFinding.title || 'Performance Issue',
                description: llmFinding.description || llmFinding.evidence || '',
                filePath: llmFinding.file || '',
                line: llmFinding.line || 0,
                originalLine: '',
                bottleneckType: this.mapLLMTypeToBottleneck(llmFinding.type),
                impactLevel: llmFinding.severity === 'critical' ? 'critical' : llmFinding.severity === 'high' ? 'high' : 'medium',
                scalabilityImpact: llmFinding.severity === 'critical' ? 9 : llmFinding.severity === 'high' ? 7 : 5,
                optimizationPotential: llmFinding.confidence ? Math.round(llmFinding.confidence * 100) : 60,
                resourceWaste: llmFinding.severity === 'critical' ? 70 : llmFinding.severity === 'high' ? 50 : 30,
                confidence: llmFinding.confidence ?? 0.7
              }));
              // Override verification method to 'llm'
              findings[findings.length - 1].verificationMethod = 'llm';
              findings[findings.length - 1].evidence = {
                ...findings[findings.length - 1].evidence,
                detectionMethod: 'llm',
                llmEvidence: llmFinding.evidence,
                llmRemediation: llmFinding.remediation,
                llmEstimatedImpact: llmFinding.estimatedImpact
              };
            }
          } else {
            console.warn('[PerformanceAnalyzer] LLM returned no findings, falling back to regex');
            findings = regexFindings;
          }
        } catch (llmError) {
          console.error('[PerformanceAnalyzer] LLM analysis failed, falling back to regex:', llmError);
          findings = regexFindings.map(f => ({
            ...f,
            confidence: Math.min(f.confidence, 0.5),
            verificationMethod: 'regex' as const
          }));
        }
      } else {
        // No LLM available -- use regex findings with lower confidence
        console.log('[PerformanceAnalyzer] No LLM available, using regex-only findings');
        findings = regexFindings.map(f => ({
          ...f,
          confidence: Math.max(0.3, Math.min(f.confidence, 0.5)),
          verificationMethod: 'regex' as const
        }));
      }

      const recommendations: Recommendation[] = [];
      for (const finding of findings) {
        recommendations.push(this.createPerformanceRecommendation(finding, request.businessContext));
      }

      const performanceScore = this.calculatePerformanceScore(findings);
      const optimizationPotential = this.calculateOptimizationPotential(findings);

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: findings.length > 0 ? (this.hasLLM() ? 0.85 : 0.5) : 0.5,
        findings: findings as Finding[],
        recommendations,
        metrics: {
          performanceScore,
          optimizationPotential,
          bottleneckCount: findings.length,
          criticalBottlenecks: findings.filter(f => f.severity === 'critical').length,
          highImpactIssues: findings.filter(f => f.impactLevel === 'high' || f.impactLevel === 'critical').length,
          filesScanned: sourceFiles.size,
          analysisMethod: this.hasLLM() ? 'llm+regex' : 'regex-only',
          regexCandidates: regexFindings.length
        },
        businessImpact: this.generateBusinessImpact(findings, request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[PerformanceAnalyzer] Analysis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // LLM HELPER METHODS
  // =====================================================

  private mapLLMTypeToBottleneck(llmType: string): PerformanceFinding['bottleneckType'] {
    const map: Record<string, PerformanceFinding['bottleneckType']> = {
      n_plus_one: 'database',
      synchronous_io: 'io',
      memory_leak: 'memory',
      excessive_complexity: 'algorithm',
      missing_index: 'database',
      unbounded_query: 'database',
      blocking_event_loop: 'cpu',
      unnecessary_computation: 'cpu',
      missing_caching: 'network',
      inefficient_algorithm: 'algorithm',
      resource_exhaustion: 'memory'
    };
    return map[llmType] ?? 'algorithm';
  }

  // =====================================================
  // PER-FILE ANALYSIS
  // =====================================================

  private analyzeFile(filePath: string, content: string): PerformanceFinding[] {
    const findings: PerformanceFinding[] = [];
    const lines = content.split('\n');

    this.detectNestedLoops(filePath, lines, findings);
    this.detectStringConcatInLoops(filePath, lines, findings);
    this.detectSyncIO(filePath, lines, findings);
    this.detectMissingAwait(filePath, lines, content, findings);

    return findings;
  }

  // =====================================================
  // BOTTLENECK DETECTORS
  // =====================================================

  /**
   * Detect nested loops by tracking brace depth inside loop constructs.
   * When we find a for/while, we track its brace scope. If another
   * for/while appears inside that scope, it is nested.
   */
  private detectNestedLoops(
    filePath: string,
    lines: string[],
    findings: PerformanceFinding[]
  ): void {
    const loopPattern = /\b(for|while)\s*\(/;
    let outerLoopLine: number | null = null;
    let braceDepthAtOuterLoop = 0;
    let braceDepth = 0;
    let inOuterLoop = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track brace depth
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') {
          braceDepth--;
          // Check if we exited the outer loop scope
          if (inOuterLoop && braceDepth < braceDepthAtOuterLoop) {
            inOuterLoop = false;
            outerLoopLine = null;
          }
        }
      }

      if (loopPattern.test(line)) {
        if (inOuterLoop) {
          // This is a nested loop
          findings.push(this.buildPerformanceFinding({
            type: 'nested_loop',
            severity: 'high',
            title: 'Nested Loop - O(n^2) or Worse Complexity',
            description: `Nested loop detected. Outer loop starts at line ${outerLoopLine}, inner loop at line ${i + 1}. This can cause quadratic or worse performance with large datasets.`,
            filePath,
            line: i + 1,
            originalLine: line,
            bottleneckType: 'algorithm',
            impactLevel: 'high',
            scalabilityImpact: 8,
            optimizationPotential: 75,
            resourceWaste: 60,
            confidence: 0.7
          }));
        } else {
          // Start tracking an outer loop
          inOuterLoop = true;
          outerLoopLine = i + 1;
          braceDepthAtOuterLoop = braceDepth;
        }
      }
    }
  }

  /**
   * Detect string concatenation inside loop bodies.
   * Look for += or + with a string context inside for/while blocks.
   */
  private detectStringConcatInLoops(
    filePath: string,
    lines: string[],
    findings: PerformanceFinding[]
  ): void {
    const loopPattern = /\b(for|while)\s*\(/;
    const concatPattern = /\+\s*=\s*['"`]|\+\s*=\s*\w|['"]\s*\+\s*\w|\w\s*\+\s*['"]/;
    let insideLoop = false;
    let loopBraceDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track brace depth
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') {
          braceDepth--;
          if (insideLoop && braceDepth < loopBraceDepth) {
            insideLoop = false;
          }
        }
      }

      if (loopPattern.test(line)) {
        insideLoop = true;
        loopBraceDepth = braceDepth;
      }

      if (insideLoop && concatPattern.test(line)) {
        findings.push(this.buildPerformanceFinding({
          type: 'string_concat_in_loop',
          severity: 'medium',
          title: 'String Concatenation in Loop',
          description: 'String concatenation or += detected inside a loop body. This causes repeated memory allocation. Use Array.push() + join(), template literals, or a StringBuilder pattern instead.',
          filePath,
          line: i + 1,
          originalLine: line,
          bottleneckType: 'memory',
          impactLevel: 'medium',
          scalabilityImpact: 6,
          optimizationPotential: 80,
          resourceWaste: 45,
          confidence: 0.6
        }));
      }
    }
  }

  /**
   * Detect synchronous I/O calls (readFileSync, writeFileSync, execSync, etc.)
   */
  private detectSyncIO(
    filePath: string,
    lines: string[],
    findings: PerformanceFinding[]
  ): void {
    const syncIOPattern = /\b(readFileSync|writeFileSync|appendFileSync|existsSync|mkdirSync|statSync|readdirSync|execSync|spawnSync|accessSync)\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(syncIOPattern);
      if (match) {
        findings.push(this.buildPerformanceFinding({
          type: 'sync_io',
          severity: 'medium',
          title: `Synchronous I/O Call: ${match[1]}`,
          description: `Synchronous I/O function '${match[1]}' blocks the event loop. In request handlers or hot paths, this degrades throughput and responsiveness.`,
          filePath,
          line: i + 1,
          originalLine: line,
          bottleneckType: 'io',
          impactLevel: 'medium',
          scalabilityImpact: 7,
          optimizationPotential: 70,
          resourceWaste: 50,
          confidence: 0.8
        }));
      }
    }
  }

  /**
   * Detect missing await on async operations.
   * Look for fetch() or .query() calls inside async functions
   * where the same line lacks 'await'.
   */
  private detectMissingAwait(
    filePath: string,
    lines: string[],
    fullContent: string,
    findings: PerformanceFinding[]
  ): void {
    const asyncCallPattern = /\b(fetch|\.query|\.findOne|\.findMany|\.create|\.update|\.delete|\.save|\.remove|\.execute)\s*\(/;
    let inAsyncFunction = false;
    let asyncBraceDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') {
          braceDepth--;
          if (inAsyncFunction && braceDepth < asyncBraceDepth) {
            inAsyncFunction = false;
          }
        }
      }

      if (/\basync\b/.test(line)) {
        inAsyncFunction = true;
        asyncBraceDepth = braceDepth;
      }

      if (inAsyncFunction && asyncCallPattern.test(line)) {
        // Check if await is on the same line
        if (!/\bawait\b/.test(line)) {
          // Also check if the result is assigned to a variable (might be intentional fire-and-forget)
          const isAssigned = /\b(const|let|var)\s+\w+\s*=/.test(line) || /\breturn\b/.test(line);
          // Lower confidence if it looks like intentional fire-and-forget
          const confidence = isAssigned ? 0.5 : 0.6;

          findings.push(this.buildPerformanceFinding({
            type: 'missing_await',
            severity: 'medium',
            title: 'Potentially Missing await on Async Call',
            description: `An async operation is called without 'await' on the same line inside an async function. This may lead to unhandled promise rejections or race conditions.`,
            filePath,
            line: i + 1,
            originalLine: line,
            bottleneckType: 'algorithm',
            impactLevel: 'medium',
            scalabilityImpact: 5,
            optimizationPotential: 40,
            resourceWaste: 30,
            confidence
          }));
        }
      }
    }
  }

  // =====================================================
  // FINDING BUILDER
  // =====================================================

  private buildPerformanceFinding(params: {
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    filePath: string;
    line: number;
    originalLine: string;
    bottleneckType: PerformanceFinding['bottleneckType'];
    impactLevel: PerformanceFinding['impactLevel'];
    scalabilityImpact: number;
    optimizationPotential: number;
    resourceWaste: number;
    confidence: number;
  }): PerformanceFinding {
    return {
      id: `${params.type}_${uuidv4().slice(0, 8)}`,
      type: params.type,
      severity: params.severity,
      title: params.title,
      description: params.description,
      location: {
        file: params.filePath,
        line: params.line
      },
      evidence: {
        pattern: params.type,
        matchedLine: params.originalLine.trim(),
        detectionMethod: 'regex'
      },
      confidence: params.confidence,
      verificationStatus: 'unverified',
      verificationMethod: 'regex',
      bottleneckType: params.bottleneckType,
      impactLevel: params.impactLevel,
      scalabilityImpact: params.scalabilityImpact,
      optimizationPotential: params.optimizationPotential,
      resourceWaste: params.resourceWaste
    };
  }

  // =====================================================
  // RECOMMENDATION GENERATOR
  // =====================================================

  private createPerformanceRecommendation(finding: PerformanceFinding, businessContext?: BusinessContext): Recommendation {
    const priorityMap = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'low' } as const;

    return {
      id: `perf_rec_${uuidv4().slice(0, 8)}`,
      type: 'performance_optimization',
      priority: priorityMap[finding.severity],
      title: `Optimize: ${finding.title}`,
      description: `Fix ${finding.type} in ${finding.location?.file}:${finding.location?.line} -- ${finding.description}`,
      impact: this.getPerformanceImpactDescription(finding.type),
      effort: finding.severity === 'critical' || finding.severity === 'high' ? 'medium' : 'low',
      implementation: this.getOptimizationSteps(finding.type),
      relatedFindings: [finding.id],
      estimatedValue: Math.round(finding.optimizationPotential),
      businessJustification: businessContext?.criticality === 'critical'
        ? `Critical system -- addressing this ${finding.impactLevel} impact performance issue is mandatory.`
        : `Improves user experience and reduces operational costs.`
    };
  }

  private getPerformanceImpactDescription(findingType: string): string {
    const impacts: Record<string, string> = {
      nested_loop: 'High -- Exponential performance degradation with data growth',
      string_concat_in_loop: 'Medium -- Repeated memory allocation and GC pressure in loops',
      sync_io: 'Medium-High -- Event loop blocking degrades throughput for all concurrent users',
      missing_await: 'Medium -- Potential race conditions and unhandled promise rejections'
    };
    return impacts[findingType] || 'Performance improvement opportunity identified';
  }

  private getOptimizationSteps(findingType: string): string[] {
    const steps: Record<string, string[]> = {
      nested_loop: [
        'Consider using a Map/Set for O(1) lookups instead of inner loop',
        'Evaluate if data can be pre-indexed or sorted',
        'Use array methods like .find() or .includes() with indexed data',
        'Add performance benchmarks to verify improvement'
      ],
      string_concat_in_loop: [
        'Replace string += with Array.push() followed by .join("")',
        'Use template literals for fixed patterns',
        'Consider a streaming approach for very large outputs'
      ],
      sync_io: [
        'Replace with async equivalent (e.g., readFile instead of readFileSync)',
        'If startup-only, document that sync usage is intentional',
        'Use fs/promises for modern async file operations'
      ],
      missing_await: [
        'Add await before the async call',
        'If fire-and-forget is intentional, add void keyword and .catch() handler',
        'Wrap in try/catch to handle potential rejections'
      ]
    };
    return steps[findingType] || ['Analyze and optimize the identified performance issue'];
  }

  // =====================================================
  // SCORING
  // =====================================================

  private calculatePerformanceScore(findings: PerformanceFinding[]): number {
    if (findings.length === 0) return 90;
    const weights: Record<string, number> = { critical: 40, high: 30, medium: 20, low: 10, info: 2 };
    const total = findings.reduce((sum, f) => sum + (weights[f.severity] || 10), 0);
    return Math.max(10, 100 - Math.min(total, 90));
  }

  private calculateOptimizationPotential(findings: PerformanceFinding[]): number {
    if (findings.length === 0) return 0;
    return findings.reduce((sum, f) => sum + f.optimizationPotential, 0) / findings.length;
  }

  // =====================================================
  // UTILITIES
  // =====================================================

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.java', '.go', '.rb', '.rs', '.cs'];
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }

  private resolveSourceFiles(request: AnalysisRequest): Map<string, string> {
    if (request.sourceFiles && request.sourceFiles.size > 0) return request.sourceFiles;
    const paramFiles = request.parameters?.sourceFiles;
    if (paramFiles) {
      if (paramFiles instanceof Map) return paramFiles;
      if (typeof paramFiles === 'object') {
        const map = new Map<string, string>();
        for (const [k, v] of Object.entries(paramFiles)) {
          if (typeof v === 'string') map.set(k, v);
        }
        return map;
      }
    }
    return new Map();
  }

  private createEmptyResult(request: AnalysisRequest, reason: string): AnalysisResult {
    return {
      requestId: request.id,
      agentId: this.id,
      domain: this.domain,
      timestamp: Date.now(),
      status: 'success',
      confidence: 0.3,
      findings: [],
      recommendations: [],
      metrics: { performanceScore: 100, bottleneckCount: 0, note: reason } as any
    };
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
      metrics: { error: error instanceof Error ? error.message : String(error) } as any
    };
  }

  private initializePerformanceKnowledge(): void {
    console.log(`[PerformanceAnalyzer] Initialized performance knowledge base`);
  }

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const performanceRelated = ['performance', 'optimization', 'scalability', 'bottleneck', 'latency'];
    const contextString = JSON.stringify(context).toLowerCase();
    return performanceRelated.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.performanceImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Performance analysis indicates this change will improve system efficiency.'
      : 'Performance concerns identified. This proposal may negatively impact system performance.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const performanceTopics = ['performance', 'optimization', 'bottleneck', 'scalability'];
    return performanceTopics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { PerformanceFinding };
