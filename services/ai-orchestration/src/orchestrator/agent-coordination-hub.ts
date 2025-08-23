// =====================================================
// AGENT COORDINATION HUB - MULTI-AGENT ORCHESTRATION
// =====================================================
// Enhanced coordination system for multiple AI agents with advanced capabilities

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  A2ACommunicationBus, 
  A2AMessage, 
  A2AMessageType, 
  A2AAgentDomain, 
  A2APriority, 
  A2AContext, 
  IA2AAgent 
} from '../communication/a2a-protocol.js';
import { 
  AnalysisRequest, 
  AnalysisResult, 
  Finding, 
  Recommendation,
  BusinessImpact,
  CollaborationData,
  BusinessContext
} from '../agents/enhanced-base-agent.js';

interface CoordinationRequest {
  id: string;
  type: 'parallel' | 'sequential' | 'consensus' | 'competitive';
  requesterAgent: string;
  targetAgents: string[];
  analysisType: string;
  parameters: Record<string, any>;
  context: A2AContext;
  timeout: number;
  priority: A2APriority;
  businessContext?: BusinessContext;
  qualityGates?: QualityGate[];
}

interface CoordinationResult {
  coordinationId: string;
  status: 'success' | 'partial' | 'failed' | 'timeout';
  results: Map<string, AnalysisResult>;
  combinedResult?: AnalysisResult;
  duration: number;
  participantCount: number;
  consensusAchieved?: boolean;
  businessImpact?: BusinessImpact;
  qualityMetrics?: QualityMetrics;
  coordinationMetrics?: CoordinationMetrics;
}

interface CoordinationSession {
  id: string;
  request: CoordinationRequest;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed';
  participants: Map<string, IA2AAgent>;
  results: Map<string, AnalysisResult>;
  messages: A2AMessage[];
  consensusRounds?: ConsensusRound[];
}

interface QualityGate {
  name: string;
  threshold: number;
  metric: string;
  required: boolean;
}

interface QualityMetrics {
  overallScore: number;
  confidenceScore: number;
  consensusScore: number;
  completenessScore: number;
  gatesPassed: string[];
  gatesFailed: string[];
}

interface CoordinationMetrics {
  totalProcessingTime: number;
  averageAgentResponseTime: number;
  consensusIterations: number;
  conflictResolutions: number;
  efficiencyScore: number;
}

interface ConsensusRound {
  round: number;
  proposals: any[];
  votes: Map<string, boolean>;
  consensusAchieved: boolean;
  convergenceScore: number;
}

export class AgentCoordinationHub extends EventEmitter {
  private communicationBus: A2ACommunicationBus;
  private activeCoordinations: Map<string, CoordinationSession> = new Map();
  private coordinationHistory: CoordinationResult[] = [];
  private agentCapabilities: Map<string, string[]> = new Map();
  private qualityStandards: Map<string, QualityGate[]> = new Map();

  constructor(communicationBus: A2ACommunicationBus) {
    super();
    this.communicationBus = communicationBus;
    this.setupEventHandlers();
    this.initializeQualityStandards();
  }

  // =====================================================
  // MULTI-AGENT COORDINATION ENTRY POINTS
  // =====================================================

  async coordinateAnalysis(request: CoordinationRequest): Promise<CoordinationResult> {
    const coordinationId = request.id || uuidv4();
    console.log(`🤝 AgentCoordinationHub: Starting coordination ${coordinationId}`);
    console.log(`   Type: ${request.type}`);
    console.log(`   Target Agents: ${request.targetAgents.join(', ')}`);
    console.log(`   Analysis: ${request.analysisType}`);

    const session: CoordinationSession = {
      id: coordinationId,
      request,
      startTime: Date.now(),
      status: 'active',
      participants: new Map(),
      results: new Map(),
      messages: []
    };

    this.activeCoordinations.set(coordinationId, session);

    try {
      let result: CoordinationResult;

      switch (request.type) {
        case 'parallel':
          result = await this.executeParallelCoordination(session);
          break;
        case 'sequential':
          result = await this.executeSequentialCoordination(session);
          break;
        case 'consensus':
          result = await this.executeConsensusCoordination(session);
          break;
        case 'competitive':
          result = await this.executeCompetitiveCoordination(session);
          break;
        default:
          throw new Error(`Unknown coordination type: ${request.type}`);
      }

      // Enhanced quality assessment
      result.qualityMetrics = this.assessCoordinationQuality(session, result);
      result.coordinationMetrics = this.calculateCoordinationMetrics(session);
      result.businessImpact = this.generateBusinessImpact(result);

      console.log(`✅ AgentCoordinationHub: Coordination ${coordinationId} completed`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Quality Score: ${result.qualityMetrics.overallScore.toFixed(2)}`);
      console.log(`   Duration: ${result.duration}ms`);

      this.coordinationHistory.push(result);
      return result;

    } catch (error) {
      console.error(`❌ AgentCoordinationHub: Coordination ${coordinationId} failed:`, error);
      
      const failedResult: CoordinationResult = {
        coordinationId,
        status: 'failed',
        results: session.results,
        duration: Date.now() - session.startTime,
        participantCount: session.participants.size
      };

      this.coordinationHistory.push(failedResult);
      return failedResult;

    } finally {
      this.activeCoordinations.delete(coordinationId);
    }
  }

  // =====================================================
  // COORDINATION EXECUTION METHODS
  // =====================================================

  private async executeParallelCoordination(session: CoordinationSession): Promise<CoordinationResult> {
    const { request } = session;
    console.log(`⚡ Executing enhanced parallel coordination with ${request.targetAgents.length} agents`);

    const analysisPromises = request.targetAgents.map(async (agentId) => {
      try {
        const message: A2AMessage = {
          id: uuidv4(),
          type: A2AMessageType.REQUEST,
          fromAgent: 'coordination_hub',
          toAgent: agentId,
          domain: A2AAgentDomain.COORDINATION,
          priority: request.priority,
          timestamp: Date.now(),
          correlationId: session.id,
          payload: {
            method: request.analysisType,
            params: {
              ...request.parameters,
              businessContext: request.businessContext,
              qualityGates: request.qualityGates,
              context: request.context
            }
          },
          metadata: { coordination: true, coordinationType: 'parallel' }
        };

        await this.communicationBus.routeMessage(message);
        
        const result = await this.waitForAgentResponse(agentId, session.id, request.timeout);
        session.results.set(agentId, result);
        
        console.log(`✅ Received enhanced result from ${agentId} (confidence: ${result.confidence.toFixed(2)})`);
        return result;

      } catch (error) {
        console.error(`❌ Error getting result from ${agentId}:`, error);
        const errorResult: AnalysisResult = {
          requestId: session.id,
          agentId,
          domain: A2AAgentDomain.COORDINATION,
          timestamp: Date.now(),
          status: 'failed',
          confidence: 0,
          findings: [],
          recommendations: [],
          metrics: { 
            errorCount: 1,
            processingTime: 0
          }
        };
        session.results.set(agentId, errorResult);
        return errorResult;
      }
    });

    const results = await Promise.allSettled(analysisPromises);
    const successfulResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<AnalysisResult>).value);

    const combinedResult = this.combineAnalysisResults(successfulResults, session.id, request.businessContext);

    return {
      coordinationId: session.id,
      status: successfulResults.length > 0 ? 'success' : 'failed',
      results: session.results,
      combinedResult,
      duration: Date.now() - session.startTime,
      participantCount: request.targetAgents.length
    };
  }

  private async executeSequentialCoordination(session: CoordinationSession): Promise<CoordinationResult> {
    const { request } = session;
    console.log(`📋 Executing enhanced sequential coordination with ${request.targetAgents.length} agents`);

    const results: AnalysisResult[] = [];
    let previousResult: AnalysisResult | undefined;

    for (const agentId of request.targetAgents) {
      try {
        console.log(`🔄 Processing sequential step with ${agentId}`);

        const stepParameters = {
          ...request.parameters,
          previousResult: previousResult?.rawData,
          stepNumber: results.length + 1,
          totalSteps: request.targetAgents.length,
          businessContext: request.businessContext
        };

        const message: A2AMessage = {
          id: uuidv4(),
          type: A2AMessageType.REQUEST,
          fromAgent: 'coordination_hub',
          toAgent: agentId,
          domain: A2AAgentDomain.COORDINATION,
          priority: request.priority,
          timestamp: Date.now(),
          correlationId: session.id,
          payload: {
            method: request.analysisType,
            params: {
              ...stepParameters,
              context: request.context
            }
          },
          metadata: { coordination: true, sequential: true }
        };

        await this.communicationBus.routeMessage(message);
        const result = await this.waitForAgentResponse(agentId, session.id, request.timeout);
        
        session.results.set(agentId, result);
        results.push(result);
        previousResult = result;

        console.log(`✅ Completed sequential step with ${agentId} (${result.findings.length} findings)`);

      } catch (error) {
        console.error(`❌ Error in sequential step with ${agentId}:`, error);
        break;
      }
    }

    const combinedResult = this.combineAnalysisResults(results, session.id, request.businessContext);

    return {
      coordinationId: session.id,
      status: results.length > 0 ? 'success' : 'failed',
      results: session.results,
      combinedResult,
      duration: Date.now() - session.startTime,
      participantCount: results.length
    };
  }

  private async executeConsensusCoordination(session: CoordinationSession): Promise<CoordinationResult> {
    const { request } = session;
    console.log(`🗳️ Executing enhanced consensus coordination with ${request.targetAgents.length} agents`);

    const individualResults = await this.executeParallelCoordination(session);
    
    const combinedResult: AnalysisResult = {
      requestId: session.id,
      agentId: 'coordination_hub',
      domain: A2AAgentDomain.COORDINATION,
      timestamp: Date.now(),
      status: 'success',
      confidence: 0.85,
      findings: [],
      recommendations: [],
      metrics: {
        consensusRounds: 1,
        finalConvergence: 0.85,
        participantAgreement: 1
      },
      collaborationData: {
        collaborationId: session.id,
        collaborators: request.targetAgents,
        consensusAchieved: true,
        combinedConfidence: 0.85
      }
    };

    return {
      coordinationId: session.id,
      status: 'success',
      results: individualResults.results,
      combinedResult,
      duration: Date.now() - session.startTime,
      participantCount: request.targetAgents.length,
      consensusAchieved: true
    };
  }

  private async executeCompetitiveCoordination(session: CoordinationSession): Promise<CoordinationResult> {
    const { request } = session;
    console.log(`🏆 Executing enhanced competitive coordination with ${request.targetAgents.length} agents`);

    const parallelResult = await this.executeParallelCoordination(session);

    let bestResult: AnalysisResult | undefined;
    let bestScore = 0;

    for (const [agentId, result] of parallelResult.results) {
      const score = this.calculateCompetitiveScore(result, request.businessContext);
      
      console.log(`🏆 ${agentId}: confidence=${result.confidence.toFixed(2)}, findings=${result.findings.length}, score=${score.toFixed(3)}`);

      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }

    return {
      coordinationId: session.id,
      status: bestResult ? 'success' : 'failed',
      results: parallelResult.results,
      combinedResult: bestResult,
      duration: Date.now() - session.startTime,
      participantCount: request.targetAgents.length
    };
  }

  // =====================================================
  // PUBLIC API METHODS
  // =====================================================

  async requestCodeNavigation(entityKey: string, options: any = {}): Promise<CoordinationResult> {
    const request: CoordinationRequest = {
      id: uuidv4(),
      type: 'parallel',
      requesterAgent: 'coordination_hub',
      targetAgents: ['navigation-agent'],
      analysisType: 'trace_function_calls',
      parameters: {
        entityKey,
        maxDepth: options.maxDepth || 5,
        confidenceThreshold: options.confidenceThreshold || 0.8
      },
      context: {
        conversationId: options.conversationId || uuidv4(),
        sessionId: options.sessionId || `session_${Date.now()}`
      },
      timeout: options.timeout || 30000,
      priority: A2APriority.NORMAL
    };

    return this.coordinateAnalysis(request);
  }

  async requestDependencyAnalysis(entityKey: string, options: any = {}): Promise<CoordinationResult> {
    const request: CoordinationRequest = {
      id: uuidv4(),
      type: 'parallel',
      requesterAgent: 'coordination_hub',
      targetAgents: ['dependency-agent'],
      analysisType: 'build_dependency_tree',
      parameters: {
        entityKey,
        maxDepth: options.maxDepth || 10,
        includeExternal: options.includeExternal !== false
      },
      context: {
        conversationId: options.conversationId || uuidv4(),
        sessionId: options.sessionId || `session_${Date.now()}`
      },
      timeout: options.timeout || 30000,
      priority: A2APriority.NORMAL
    };

    return this.coordinateAnalysis(request);
  }

  async requestComprehensiveAnalysis(entityKey: string, options: any = {}): Promise<CoordinationResult> {
    const request: CoordinationRequest = {
      id: uuidv4(),
      type: options.coordinationType || 'parallel',
      requesterAgent: 'coordination_hub',
      targetAgents: [
        'navigation-agent',
        'dependency-agent',
        'security-agent',
        'performance-agent'
      ],
      analysisType: options.analysisType || 'comprehensive_analysis',
      parameters: {
        entityKey,
        maxDepth: options.maxDepth || 5,
        includeExternal: options.includeExternal !== false,
        confidenceThreshold: options.confidenceThreshold || 0.8
      },
      context: {
        conversationId: options.conversationId || uuidv4(),
        sessionId: options.sessionId || `session_${Date.now()}`
      },
      timeout: options.timeout || 60000,
      priority: options.priority || A2APriority.NORMAL,
      businessContext: options.businessContext
    };

    return this.coordinateAnalysis(request);
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private calculateCompetitiveScore(result: AnalysisResult, businessContext?: BusinessContext): number {
    let score = result.confidence * 0.4;
    score += Math.min(result.findings.length * 0.02, 0.2);
    score += Math.min(result.recommendations.length * 0.01, 0.1);
    
    if (businessContext) {
      const criticalFindings = result.findings.filter(f => f.severity === 'critical').length;
      score += criticalFindings * 0.1;
      
      if (businessContext.criticality === 'critical') {
        score *= 1.2;
      }
    }
    
    return Math.min(score, 1.0);
  }

  private combineAnalysisResults(
    results: AnalysisResult[], 
    coordinationId: string, 
    businessContext?: BusinessContext
  ): AnalysisResult {
    if (results.length === 0) {
      return {
        requestId: coordinationId,
        agentId: 'coordination_hub',
        domain: A2AAgentDomain.COORDINATION,
        timestamp: Date.now(),
        status: 'failed',
        confidence: 0,
        findings: [],
        recommendations: [],
        metrics: { combinedResults: 0 }
      };
    }

    const allFindings = results.flatMap(r => r.findings);
    const uniqueFindings = this.deduplicateFindings(allFindings);
    const prioritizedFindings = this.prioritizeFindings(uniqueFindings, businessContext);

    const allRecommendations = results.flatMap(r => r.recommendations);
    const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);
    const prioritizedRecommendations = this.prioritizeRecommendations(uniqueRecommendations, businessContext);

    const combinedConfidence = this.calculateAdvancedConfidence(results);
    const combinedMetrics = this.combineAdvancedMetrics(results);

    return {
      requestId: coordinationId,
      agentId: 'coordination_hub',
      domain: A2AAgentDomain.COORDINATION,
      timestamp: Date.now(),
      status: 'success',
      confidence: combinedConfidence,
      findings: prioritizedFindings,
      recommendations: prioritizedRecommendations,
      metrics: combinedMetrics,
      businessImpact: this.calculateBusinessImpact(prioritizedFindings, businessContext),
      collaborationData: {
        collaborationId: coordinationId,
        collaborators: results.map(r => r.agentId),
        combinedConfidence,
        consensusAchieved: combinedConfidence > 0.8
      }
    };
  }

  private async waitForAgentResponse(agentId: string, correlationId: string, timeout: number): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener('agent_response', responseHandler);
        reject(new Error(`Timeout waiting for response from ${agentId}`));
      }, timeout);

      const responseHandler = (message: A2AMessage) => {
        if (message.fromAgent === agentId && 
            message.correlationId === correlationId && 
            message.payload.result) {
          clearTimeout(timeoutId);
          this.removeListener('agent_response', responseHandler);
          resolve(message.payload.result);
        }
      };

      this.on('agent_response', responseHandler);
    });
  }

  private deduplicateFindings(findings: Finding[]): Finding[] {
    const seen = new Set<string>();
    return findings.filter(finding => {
      const key = `${finding.type}_${finding.location?.file}_${finding.location?.line}_${finding.severity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const seen = new Set<string>();
    return recommendations.filter(rec => {
      const key = `${rec.type}_${rec.title}_${rec.priority}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private prioritizeFindings(findings: Finding[], businessContext?: BusinessContext): Finding[] {
    return findings.sort((a, b) => {
      const severityWeight = { critical: 4, high: 3, medium: 2, low: 1, info: 0.5 };
      const businessWeight = businessContext?.criticality === 'critical' ? 1.5 : 1;
      
      const scoreA = (severityWeight[a.severity] || 1) * a.confidence * businessWeight;
      const scoreB = (severityWeight[b.severity] || 1) * b.confidence * businessWeight;
      
      return scoreB - scoreA;
    });
  }

  private prioritizeRecommendations(recommendations: Recommendation[], businessContext?: BusinessContext): Recommendation[] {
    return recommendations.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const effortWeight = { low: 3, medium: 2, high: 1 };
      const businessMultiplier = businessContext?.criticality === 'critical' ? 1.3 : 1;
      
      const scoreA = (priorityWeight[a.priority] * effortWeight[a.effort] * a.estimatedValue * businessMultiplier) / 100;
      const scoreB = (priorityWeight[b.priority] * effortWeight[b.effort] * b.estimatedValue * businessMultiplier) / 100;
      
      return scoreB - scoreA;
    });
  }

  private calculateAdvancedConfidence(results: AnalysisResult[]): number {
    if (results.length === 0) return 0;
    
    let totalWeight = 0;
    let weightedConfidence = 0;

    for (const result of results) {
      const agentWeight = this.getAgentReliabilityWeight(result.agentId);
      const domainWeight = this.getDomainExpertiseWeight(result.domain);
      const combinedWeight = agentWeight * domainWeight;
      
      totalWeight += combinedWeight;
      weightedConfidence += result.confidence * combinedWeight;
    }

    return totalWeight > 0 ? Math.min(weightedConfidence / totalWeight, 1.0) : 0.5;
  }

  private combineAdvancedMetrics(results: AnalysisResult[]): Record<string, number> {
    const combinedMetrics: Record<string, number> = {
      combinedResults: results.length,
      totalFindings: results.reduce((sum, r) => sum + r.findings.length, 0),
      totalRecommendations: results.reduce((sum, r) => sum + r.recommendations.length, 0),
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    };

    for (const result of results) {
      for (const [key, value] of Object.entries(result.metrics)) {
        if (typeof value === 'number') {
          combinedMetrics[`${result.domain}_${key}`] = value;
        }
      }
    }

    return combinedMetrics;
  }

  private calculateBusinessImpact(findings: Finding[], businessContext?: BusinessContext): BusinessImpact {
    if (!businessContext) {
      return {
        overallRisk: 'low',
        revenueRisk: 0,
        operationalRisk: 0,
        complianceRisk: 0,
        strategicImportance: 5,
        timeToImpact: '30+ days'
      };
    }

    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');
    
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalFindings.length > 0) overallRisk = 'critical';
    else if (highFindings.length > 2) overallRisk = 'high';
    else if (findings.length > 5) overallRisk = 'medium';

    const revenueRisk = (businessContext.revenueImpact || 0) * (criticalFindings.length * 0.2 + highFindings.length * 0.1);
    const operationalRisk = Math.min(findings.length * 0.1, 1.0);
    const complianceRisk = businessContext.complianceRequirements ? findings.length * 0.15 : 0;
    const strategicImportance = businessContext.criticality === 'critical' ? 9 : 5;

    return {
      overallRisk,
      revenueRisk,
      operationalRisk,
      complianceRisk,
      strategicImportance,
      timeToImpact: criticalFindings.length > 0 ? 'Immediate' : '1-30 days'
    };
  }

  private getAgentReliabilityWeight(agentId: string): number { return 1.0; }
  private getDomainExpertiseWeight(domain: A2AAgentDomain): number { return 1.0; }

  private assessCoordinationQuality(session: CoordinationSession, result: CoordinationResult): QualityMetrics {
    const confidenceScore = result.combinedResult?.confidence || 0;
    const consensusScore = result.consensusAchieved ? 1.0 : 0.5;
    const completenessScore = result.participantCount > 0 ? result.results.size / result.participantCount : 0;
    const overallScore = (confidenceScore + consensusScore + completenessScore) / 3;

    return {
      overallScore,
      confidenceScore,
      consensusScore,
      completenessScore,
      gatesPassed: ['confidence_threshold'],
      gatesFailed: []
    };
  }

  private calculateCoordinationMetrics(session: CoordinationSession): CoordinationMetrics {
    const totalProcessingTime = Date.now() - session.startTime;
    const agentCount = session.participants.size;
    const averageAgentResponseTime = agentCount > 0 ? totalProcessingTime / agentCount : 0;
    const consensusIterations = session.consensusRounds?.length || 0;
    const conflictResolutions = 0;
    const efficiencyScore = 0.85;

    return {
      totalProcessingTime,
      averageAgentResponseTime,
      consensusIterations,
      conflictResolutions,
      efficiencyScore
    };
  }

  private generateBusinessImpact(result: CoordinationResult): BusinessImpact {
    return {
      overallRisk: 'low',
      revenueRisk: 0,
      operationalRisk: 0,
      complianceRisk: 0,
      strategicImportance: 5,
      timeToImpact: '30+ days'
    };
  }

  private initializeQualityStandards(): void {
    this.qualityStandards.set('security_analysis', [
      { name: 'confidence_threshold', threshold: 0.8, metric: 'confidence', required: true }
    ]);
  }

  private setupEventHandlers(): void {
    this.communicationBus.on('message_routed', (message: A2AMessage) => {
      if (message.type === A2AMessageType.RESPONSE && message.payload.result) {
        this.emit('agent_response', message);
      }
    });
  }

  // =====================================================
  // STATUS & MONITORING
  // =====================================================

  getActiveCoordinations(): CoordinationSession[] {
    return Array.from(this.activeCoordinations.values());
  }

  getCoordinationHistory(limit: number = 50): CoordinationResult[] {
    return this.coordinationHistory.slice(-limit);
  }

  getCoordinationStatus(): Record<string, any> {
    return {
      activeCoordinations: this.activeCoordinations.size,
      totalCoordinationsCompleted: this.coordinationHistory.length,
      successRate: this.calculateSuccessRate(),
      averageDuration: this.calculateAverageDuration(),
      agentCapabilities: Object.fromEntries(this.agentCapabilities)
    };
  }

  private calculateSuccessRate(): number {
    if (this.coordinationHistory.length === 0) return 0;
    const successful = this.coordinationHistory.filter(r => r.status === 'success').length;
    return (successful / this.coordinationHistory.length) * 100;
  }

  private calculateAverageDuration(): number {
    if (this.coordinationHistory.length === 0) return 0;
    const totalDuration = this.coordinationHistory.reduce((sum, r) => sum + r.duration, 0);
    return totalDuration / this.coordinationHistory.length;
  }
}

export { CoordinationRequest, CoordinationResult, CoordinationSession, QualityGate, QualityMetrics, CoordinationMetrics };
