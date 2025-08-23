// =====================================================
// BASE A2A AGENT WITH ENHANCED CAPABILITIES
// =====================================================
// Enhanced base class for all AI agents in the coordination system

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  IA2AAgent, 
  A2AMessage, 
  A2AMessageType, 
  A2AAgentDomain, 
  A2APriority, 
  A2ACapabilities, 
  A2AContext, 
  A2AError,
  A2ACommunicationBus 
} from '../communication/a2a-protocol.js';

// =====================================================
// ENHANCED ANALYSIS INTERFACES
// =====================================================

export interface AnalysisRequest {
  id: string;
  type: string;
  entityKey?: string;
  repoId?: string;
  branchId?: string;
  context: A2AContext;
  parameters: Record<string, any>;
  collaborationMode?: 'solo' | 'collaborative' | 'consensus';
  timeout?: number;
  businessContext?: BusinessContext;
  priority?: A2APriority;
}

export interface AnalysisResult {
  requestId: string;
  agentId: string;
  domain: A2AAgentDomain;
  timestamp: number;
  status: 'success' | 'partial' | 'failed';
  confidence: number;
  findings: Finding[];
  recommendations: Recommendation[];
  metrics: Record<string, number>;
  collaborationData?: CollaborationData;
  businessImpact?: BusinessImpact;
  rawData?: any;
  executionTime?: number;
}

export interface Finding {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location?: CodeLocation;
  evidence: Record<string, any>;
  relatedFindings?: string[];
  businessRelevance?: BusinessRelevance;
  confidence: number;
  impact?: ImpactAssessment;
}

export interface Recommendation {
  id: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  implementation: string[];
  relatedFindings: string[];
  estimatedValue: number;
  businessJustification?: string;
  technicalDetails?: TechnicalDetails;
  timeline?: Timeline;
}

export interface CodeLocation {
  file: string;
  line?: number;
  column?: number;
  function?: string;
  class?: string;
  module?: string;
}

export interface CollaborationData {
  collaborationId: string;
  collaborators: string[];
  consensusAchieved?: boolean;
  conflictResolution?: string;
  combinedConfidence: number;
  votingResults?: VotingResults;
  collaborationMetrics?: CollaborationMetrics;
}

export interface BusinessContext {
  domain: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  userImpact: string;
  revenueImpact?: number;
  complianceRequirements?: string[];
  stakeholders?: string[];
}

export interface BusinessImpact {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  revenueRisk: number;
  operationalRisk: number;
  complianceRisk: number;
  strategicImportance: number;
  timeToImpact: string;
}

export interface BusinessRelevance {
  processImpact: string;
  userExperience: string;
  businessValue: number;
  strategicAlignment: number;
}

export interface ImpactAssessment {
  technical: 'low' | 'medium' | 'high';
  business: 'low' | 'medium' | 'high';
  security: 'low' | 'medium' | 'high';
  performance: 'low' | 'medium' | 'high';
  scalability?: 'low' | 'medium' | 'high';
}

export interface TechnicalDetails {
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  prerequisites: string[];
  risks: string[];
  alternatives: string[];
}

export interface Timeline {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
  estimatedDuration: string;
}

export interface VotingResults {
  totalVotes: number;
  consensus: boolean;
  agreement: number;
  dissenting: VotingPosition[];
}

export interface VotingPosition {
  agentId: string;
  vote: boolean;
  reasoning: string;
  confidence: number;
}

export interface CollaborationMetrics {
  totalAgents: number;
  responseTime: number;
  consensusIterations: number;
  conflictResolutionTime: number;
}

// =====================================================
// PERFORMANCE AND LEARNING SYSTEMS
// =====================================================

class PerformanceMetrics {
  private requestCount = 0;
  private totalResponseTime = 0;
  private errorCount = 0;
  private successCount = 0;
  private messagesSent = 0;
  private messagesReceived = 0;

  recordOutgoingMessage(message: A2AMessage): void {
    this.messagesSent++;
  }

  recordIncomingMessage(message: A2AMessage): void {
    this.messagesReceived++;
  }

  recordRequestCompletion(duration: number): void {
    this.requestCount++;
    this.totalResponseTime += duration;
    this.successCount++;
  }

  recordError(): void {
    this.errorCount++;
  }

  getMetrics(): Record<string, number> {
    return {
      requestCount: this.requestCount,
      averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      successRate: this.requestCount > 0 ? this.successCount / this.requestCount : 0,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived
    };
  }
}

interface LearningEvent {
  type: string;
  success: boolean;
  context: A2AContext;
  duration: number;
  confidence: number;
  timestamp?: number;
}

class LearningSystem {
  private interactions: LearningEvent[] = [];
  private patterns: Map<string, any> = new Map();

  async recordInteraction(event: LearningEvent): Promise<void> {
    event.timestamp = Date.now();
    this.interactions.push(event);
    
    // Keep only last 1000 interactions
    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }
    
    await this.updatePatterns(event);
  }

  private async updatePatterns(event: LearningEvent): Promise<void> {
    const contextKey = `${event.type}_${event.context.sessionId}`;
    
    if (!this.patterns.has(contextKey)) {
      this.patterns.set(contextKey, {
        successCount: 0,
        totalCount: 0,
        averageConfidence: 0,
        averageDuration: 0
      });
    }
    
    const pattern = this.patterns.get(contextKey)!;
    pattern.totalCount++;
    
    if (event.success) {
      pattern.successCount++;
    }
    
    pattern.averageConfidence = (pattern.averageConfidence * (pattern.totalCount - 1) + event.confidence) / pattern.totalCount;
    pattern.averageDuration = (pattern.averageDuration * (pattern.totalCount - 1) + event.duration) / pattern.totalCount;
  }

  getSuccessRate(contextType: string): number {
    const relevantPatterns = Array.from(this.patterns.entries())
      .filter(([key]) => key.startsWith(contextType));
    
    if (relevantPatterns.length === 0) return 0.5; // Default
    
    const totalSuccess = relevantPatterns.reduce((sum, [, pattern]) => sum + pattern.successCount, 0);
    const totalCount = relevantPatterns.reduce((sum, [, pattern]) => sum + pattern.totalCount, 0);
    
    return totalCount > 0 ? totalSuccess / totalCount : 0.5;
  }
}

// =====================================================
// ENHANCED BASE A2A AGENT
// =====================================================

export abstract class EnhancedBaseA2AAgent extends EventEmitter implements IA2AAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly domain: A2AAgentDomain;
  public readonly capabilities: A2ACapabilities;
  public readonly priority: number;
  public status: 'active' | 'idle' | 'busy' | 'offline' | 'error' = 'idle';

  protected communicationBus: A2ACommunicationBus;
  protected pendingRequests: Map<string, Promise<A2AMessage>> = new Map();
  protected collaborations: Map<string, CollaborationSession> = new Map();
  protected knowledgeBase: Map<string, any> = new Map();
  protected performanceMetrics: PerformanceMetrics = new PerformanceMetrics();
  protected learningSystem: LearningSystem = new LearningSystem();

  constructor(
    name: string,
    domain: A2AAgentDomain,
    capabilities: A2ACapabilities,
    priority: number = 5,
    communicationBus: A2ACommunicationBus
  ) {
    super();
    
    this.id = `${domain}_agent_${uuidv4().slice(0, 8)}`;
    this.name = name;
    this.domain = domain;
    this.capabilities = capabilities;
    this.priority = priority;
    this.communicationBus = communicationBus;

    this.setupEventHandlers();
    this.initializeAgentSystems();
  }

  // =====================================================
  // A2A COMMUNICATION IMPLEMENTATION
  // =====================================================

  async sendMessage(message: A2AMessage): Promise<void> {
    console.log(`📤 ${this.name}: Sending ${message.type} message`);
    this.performanceMetrics.recordOutgoingMessage(message);
    await this.communicationBus.routeMessage(message);
  }

  async receiveMessage(message: A2AMessage): Promise<A2AMessage | null> {
    console.log(`📥 ${this.name}: Received ${message.type} from ${message.fromAgent}`);
    this.performanceMetrics.recordIncomingMessage(message);
    
    try {
      switch (message.type) {
        case A2AMessageType.REQUEST:
          return await this.handleRequest(message);
        
        case A2AMessageType.COLLABORATION_REQUEST:
          await this.handleCollaborationRequest(message);
          return null;
        
        case A2AMessageType.CONSENSUS_VOTE:
          await this.handleConsensusVote(message);
          return null;
        
        case A2AMessageType.KNOWLEDGE_SHARE:
          await this.handleKnowledgeShare(message);
          return null;
        
        case A2AMessageType.NOTIFICATION:
          await this.handleNotification(message);
          return null;
        
        default:
          console.warn(`⚠️ ${this.name}: Unknown message type ${message.type}`);
          return null;
      }
    } catch (error) {
      console.error(`❌ ${this.name}: Error processing message:`, error);
      this.performanceMetrics.recordError();
      
      if (message.type === A2AMessageType.REQUEST) {
        return this.createErrorResponse(message, {
          code: 500,
          message: 'Internal agent error',
          details: { error: error instanceof Error ? error.message : String(error) },
          retryable: false
        });
      }
      
      return null;
    }
  }

  async handleRequest(request: A2AMessage): Promise<A2AMessage> {
    this.status = 'busy';
    const startTime = Date.now();
    
    try {
      const analysisRequest: AnalysisRequest = {
        id: request.id,
        type: request.payload.method,
        entityKey: request.payload.params?.entityKey,
        repoId: request.payload.params?.repoId,
        branchId: request.payload.params?.branchId,
        context: request.payload.context || { 
          conversationId: request.id, 
          sessionId: `session_${Date.now()}` 
        },
        parameters: request.payload.params || {},
        collaborationMode: request.payload.params?.collaborationMode || 'solo',
        timeout: request.payload.params?.timeout,
        businessContext: request.payload.params?.businessContext,
        priority: request.priority
      };

      const result = await this.performAnalysis(analysisRequest);
      result.executionTime = Date.now() - startTime;
      
      // Learn from this interaction
      await this.learningSystem.recordInteraction({
        type: 'analysis_request',
        success: result.status === 'success',
        context: analysisRequest.context,
        duration: result.executionTime,
        confidence: result.confidence
      });
      
      return this.createSuccessResponse(request, result);
    } finally {
      this.status = 'idle';
      this.performanceMetrics.recordRequestCompletion(Date.now() - startTime);
    }
  }

  async broadcastCapabilities(): Promise<void> {
    const message: A2AMessage = {
      id: uuidv4(),
      type: A2AMessageType.BROADCAST,
      fromAgent: this.id,
      domain: this.domain,
      priority: A2APriority.NORMAL,
      timestamp: Date.now(),
      payload: {
        method: 'capabilities_broadcast',
        data: {
          agentId: this.id,
          name: this.name,
          domain: this.domain,
          capabilities: this.capabilities,
          status: this.status,
          performanceMetrics: this.performanceMetrics.getMetrics()
        }
      },
      metadata: { capabilities: true }
    };

    await this.sendMessage(message);
  }

  // =====================================================
  // COLLABORATION METHODS
  // =====================================================

  async requestCollaboration(agents: string[], context: A2AContext): Promise<string> {
    const collaborationId = await this.communicationBus.initiateCollaboration(
      this.id,
      agents,
      context,
      context.collaborationMode || 'parallel'
    );

    console.log(`🤝 ${this.name}: Requested collaboration ${collaborationId} with ${agents.join(', ')}`);
    return collaborationId;
  }

  async joinCollaboration(collaborationId: string): Promise<void> {
    const session: CollaborationSession = {
      id: collaborationId,
      participants: [],
      messages: [],
      startTime: Date.now(),
      status: 'active'
    };

    this.collaborations.set(collaborationId, session);
    console.log(`🤝 ${this.name}: Joined collaboration ${collaborationId}`);
  }

  async voteOnConsensus(proposalId: string, vote: boolean, reasoning?: string): Promise<void> {
    const voteMessage: A2AMessage = {
      id: uuidv4(),
      type: A2AMessageType.CONSENSUS_VOTE,
      fromAgent: this.id,
      domain: this.domain,
      priority: A2APriority.HIGH,
      timestamp: Date.now(),
      correlationId: proposalId,
      payload: {
        method: 'consensus_vote_response',
        params: { vote, reasoning, proposalId }
      },
      metadata: { consensus: true }
    };

    await this.sendMessage(voteMessage);
    console.log(`🗳️ ${this.name}: Voted ${vote} on proposal ${proposalId}`);
  }

  // =====================================================
  // ENHANCED COLLABORATION HANDLERS
  // =====================================================

  private async handleCollaborationRequest(message: A2AMessage): Promise<void> {
    const collaborationId = message.correlationId!;
    const context = message.payload.params?.context;

    // Enhanced decision logic based on learning system
    if (await this.shouldJoinCollaboration(context)) {
      await this.joinCollaboration(collaborationId);
      
      // Send acceptance with performance metrics
      const response: A2AMessage = {
        id: uuidv4(),
        type: A2AMessageType.RESPONSE,
        fromAgent: this.id,
        toAgent: message.fromAgent,
        domain: this.domain,
        priority: A2APriority.NORMAL,
        timestamp: Date.now(),
        correlationId: collaborationId,
        payload: {
          method: 'collaboration_accepted',
          result: { 
            accepted: true, 
            agentId: this.id,
            capabilities: this.capabilities,
            performanceMetrics: this.performanceMetrics.getMetrics()
          }
        },
        metadata: {}
      };

      await this.sendMessage(response);
    }
  }

  private async handleConsensusVote(message: A2AMessage): Promise<void> {
    const proposal = message.payload.params?.proposal;
    const proposalId = message.payload.params?.proposalId;
    
    if (!proposal || !proposalId) return;

    // Enhanced evaluation using learning system
    const vote = await this.evaluateProposal(proposal);
    const reasoning = await this.generateVoteReasoning(proposal, vote);
    
    await this.voteOnConsensus(proposalId, vote, reasoning);
  }

  private async handleKnowledgeShare(message: A2AMessage): Promise<void> {
    const knowledge = message.payload.data;
    const sourceAgent = message.fromAgent;
    
    if (knowledge && this.shouldAcceptKnowledge(knowledge, sourceAgent)) {
      this.knowledgeBase.set(knowledge.key || uuidv4(), {
        ...knowledge,
        source: sourceAgent,
        timestamp: Date.now(),
        relevanceScore: this.calculateKnowledgeRelevance(knowledge)
      });
      
      console.log(`🧠 ${this.name}: Received knowledge from ${sourceAgent}`);
    }
  }

  private async handleNotification(message: A2AMessage): Promise<void> {
    // Enhanced notification handling
    switch (message.payload.method) {
      case 'agent_joined':
        console.log(`👋 ${this.name}: New agent ${message.payload.data?.agentName} joined`);
        break;
      case 'agent_left':
        console.log(`👋 ${this.name}: Agent ${message.payload.data?.agentId} left`);
        break;
      case 'performance_alert':
        await this.handlePerformanceAlert(message.payload.data);
        break;
      default:
        console.log(`📢 ${this.name}: Notification: ${message.payload.method}`);
    }
  }

  // =====================================================
  // ABSTRACT METHODS - IMPLEMENTED BY DOMAIN AGENTS
  // =====================================================

  protected abstract performAnalysis(request: AnalysisRequest): Promise<AnalysisResult>;
  protected abstract shouldJoinCollaboration(context: A2AContext): Promise<boolean>;
  protected abstract evaluateProposal(proposal: any): Promise<boolean>;
  protected abstract generateVoteReasoning(proposal: any, vote: boolean): Promise<string>;
  protected abstract shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean;

  // =====================================================
  // ENHANCED KNOWLEDGE SHARING
  // =====================================================

  async shareKnowledge(knowledge: any, targetAgents?: string[]): Promise<void> {
    const enhancedKnowledge = {
      ...knowledge,
      sourceAgent: this.id,
      domain: this.domain,
      confidence: knowledge.confidence || 0.8,
      relevanceScore: this.calculateKnowledgeRelevance(knowledge),
      timestamp: Date.now()
    };

    const message: A2AMessage = {
      id: uuidv4(),
      type: A2AMessageType.KNOWLEDGE_SHARE,
      fromAgent: this.id,
      domain: this.domain,
      priority: A2APriority.NORMAL,
      timestamp: Date.now(),
      payload: {
        method: 'knowledge_share',
        data: enhancedKnowledge
      },
      metadata: { knowledgeShare: true }
    };

    if (targetAgents && targetAgents.length > 0) {
      for (const agentId of targetAgents) {
        await this.sendMessage({ ...message, toAgent: agentId });
      }
    } else {
      await this.sendMessage(message);
    }

    console.log(`🧠 ${this.name}: Shared knowledge with ${targetAgents?.join(', ') || 'all agents'}`);
  }

  protected getRelevantKnowledge(topic: string): any[] {
    return Array.from(this.knowledgeBase.values())
      .filter(k => k.topic === topic || k.tags?.includes(topic))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 10); // Top 10 most relevant
  }

  private calculateKnowledgeRelevance(knowledge: any): number {
    // Enhanced relevance calculation based on domain alignment
    let relevance = 0.5; // Base relevance
    
    if (knowledge.domain === this.domain) relevance += 0.3;
    if (knowledge.confidence > 0.8) relevance += 0.2;
    if (knowledge.timestamp && (Date.now() - knowledge.timestamp) < 86400000) relevance += 0.1; // Recent
    
    return Math.min(relevance, 1.0);
  }

  // =====================================================
  // ENHANCED BUSINESS INTELLIGENCE
  // =====================================================

  protected generateBusinessImpact(findings: Finding[], context?: BusinessContext): BusinessImpact {
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');
    
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalFindings.length > 0) overallRisk = 'critical';
    else if (highFindings.length > 2) overallRisk = 'high';
    else if (findings.length > 5) overallRisk = 'medium';
    
    const revenueRisk = this.calculateRevenueRisk(findings, context);
    const operationalRisk = this.calculateOperationalRisk(findings);
    const complianceRisk = this.calculateComplianceRisk(findings, context);
    const strategicImportance = context?.criticality === 'critical' ? 9 : 5;
    
    return {
      overallRisk,
      revenueRisk,
      operationalRisk,
      complianceRisk,
      strategicImportance,
      timeToImpact: this.estimateTimeToImpact(findings)
    };
  }

  private calculateRevenueRisk(findings: Finding[], context?: BusinessContext): number {
    if (!context?.revenueImpact) return 0;
    
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const riskMultiplier = Math.min(criticalCount * 0.1 + 0.1, 0.5);
    
    return context.revenueImpact * riskMultiplier;
  }

  private calculateOperationalRisk(findings: Finding[]): number {
    const weights = { critical: 0.4, high: 0.3, medium: 0.2, low: 0.1, info: 0.05 };
    return findings.reduce((risk, finding) => {
      return risk + (weights[finding.severity] || 0);
    }, 0);
  }

  private calculateComplianceRisk(findings: Finding[], context?: BusinessContext): number {
    if (!context?.complianceRequirements?.length) return 0;
    
    const complianceRelatedFindings = findings.filter(f => 
      f.type.includes('compliance') || 
      f.type.includes('security') ||
      f.type.includes('audit')
    );
    
    return Math.min(complianceRelatedFindings.length * 0.2, 1.0);
  }

  private estimateTimeToImpact(findings: Finding[]): string {
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    if (criticalFindings.length > 0) return 'Immediate';
    
    const highFindings = findings.filter(f => f.severity === 'high');
    if (highFindings.length > 0) return '1-30 days';
    
    return '30+ days';
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  private createSuccessResponse(request: A2AMessage, result: AnalysisResult): A2AMessage {
    return {
      id: uuidv4(),
      type: A2AMessageType.RESPONSE,
      fromAgent: this.id,
      toAgent: request.fromAgent,
      domain: this.domain,
      priority: request.priority,
      timestamp: Date.now(),
      correlationId: request.id,
      payload: {
        method: `${request.payload.method}_response`,
        result: {
          ...result,
          agentMetrics: this.performanceMetrics.getMetrics()
        }
      },
      metadata: { success: true }
    };
  }

  private createErrorResponse(request: A2AMessage, error: A2AError): A2AMessage {
    return {
      id: uuidv4(),
      type: A2AMessageType.ERROR,
      fromAgent: this.id,
      toAgent: request.fromAgent,
      domain: this.domain,
      priority: A2APriority.HIGH,
      timestamp: Date.now(),
      correlationId: request.id,
      payload: {
        method: `${request.payload.method}_error`,
        error
      },
      metadata: { error: true }
    };
  }

  private async handlePerformanceAlert(alertData: any): Promise<void> {
    console.log(`📊 ${this.name}: Performance alert received:`, alertData);
    // Implement performance optimization if needed
  }

  private setupEventHandlers(): void {
    this.on('message_received', this.receiveMessage.bind(this));
    
    this.on('error', (error) => {
      console.error(`❌ ${this.name}: Agent error:`, error);
      this.status = 'error';
      this.performanceMetrics.recordError();
    });
  }

  private initializeAgentSystems(): void {
    // Initialize agent-specific systems
    console.log(`🤖 ${this.name}: Initializing agent systems...`);
  }

  // =====================================================
  // LIFECYCLE METHODS
  // =====================================================

  async initialize(): Promise<void> {
    console.log(`🚀 ${this.name}: Initializing enhanced agent`);
    
    this.communicationBus.registerAgent(this);
    await this.broadcastCapabilities();
    
    this.status = 'active';
    console.log(`✅ ${this.name}: Enhanced agent initialized and ready`);
  }

  async shutdown(): Promise<void> {
    console.log(`🛑 ${this.name}: Shutting down enhanced agent`);
    
    this.status = 'offline';
    
    for (const collaboration of this.collaborations.values()) {
      collaboration.status = 'completed';
    }
    
    this.communicationBus.unregisterAgent(this.id);
    console.log(`✅ ${this.name}: Enhanced agent shutdown complete`);
  }

  // =====================================================
  // STATUS & MONITORING
  // =====================================================

  getStatus(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      status: this.status,
      capabilities: this.capabilities,
      activeCollaborations: this.collaborations.size,
      knowledgeBaseSize: this.knowledgeBase.size,
      pendingRequests: this.pendingRequests.size,
      performanceMetrics: this.performanceMetrics.getMetrics(),
      learningMetrics: {
        totalInteractions: this.learningSystem.getSuccessRate('analysis_request'),
        successRate: this.learningSystem.getSuccessRate('analysis_request')
      }
    };
  }
}

// =====================================================
// SUPPORTING INTERFACES
// =====================================================

interface CollaborationSession {
  id: string;
  participants: string[];
  messages: A2AMessage[];
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed';
}

export { EnhancedBaseA2AAgent };
