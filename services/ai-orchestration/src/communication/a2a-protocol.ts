// =====================================================
// A2A (AGENT-TO-AGENT) COMMUNICATION PROTOCOL
// =====================================================
// Advanced communication protocol for AI agent coordination

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// CORE PROTOCOL INTERFACES
// =====================================================

export enum A2AMessageType {
  REQUEST = 'REQUEST',
  RESPONSE = 'RESPONSE',
  BROADCAST = 'BROADCAST',
  COLLABORATION_REQUEST = 'COLLABORATION_REQUEST',
  COLLABORATION_RESPONSE = 'COLLABORATION_RESPONSE',
  CONSENSUS_VOTE = 'CONSENSUS_VOTE',
  KNOWLEDGE_SHARE = 'KNOWLEDGE_SHARE',
  STATUS_UPDATE = 'STATUS_UPDATE',
  NOTIFICATION = 'NOTIFICATION',
  ERROR = 'ERROR'
}

export enum A2AAgentDomain {
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE',
  ARCHITECTURE = 'ARCHITECTURE',
  COORDINATION = 'COORDINATION',
  NAVIGATION = 'NAVIGATION',
  DEPENDENCY = 'DEPENDENCY',
  QUALITY = 'QUALITY',
  BUSINESS = 'BUSINESS'
}

export enum A2APriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  CRITICAL = 10
}

export interface A2AMessage {
  id: string;
  type: A2AMessageType;
  fromAgent: string;
  toAgent?: string; // undefined for broadcasts
  domain: A2AAgentDomain;
  priority: A2APriority;
  timestamp: number;
  correlationId?: string;
  payload: {
    method: string;
    params?: Record<string, any>;
    data?: any;
    result?: any;
    error?: A2AError;
  };
  metadata: Record<string, any>;
  timeout?: number;
}

export interface A2AContext {
  conversationId: string;
  sessionId: string;
  entityKey?: string;
  repoId?: string;
  branchId?: string;
  collaborationMode?: 'parallel' | 'sequential' | 'consensus' | 'competitive' | 'debate';
  businessContext?: Record<string, any>;
  technicalContext?: Record<string, any>;
}

export interface A2ACapabilities {
  methods: string[];
  domains: A2AAgentDomain[];
  maxConcurrentRequests: number;
  supportedProtocolVersion: string;
  features: string[];
}

export interface A2AError {
  code: number;
  message: string;
  details: Record<string, any>;
  retryable: boolean;
}

export interface IA2AAgent {
  readonly id: string;
  readonly name: string;
  readonly domain: A2AAgentDomain;
  readonly capabilities: A2ACapabilities;
  readonly priority: number;
  status: 'active' | 'idle' | 'busy' | 'offline' | 'error';

  sendMessage(message: A2AMessage): Promise<void>;
  receiveMessage(message: A2AMessage): Promise<A2AMessage | null>;
  broadcastCapabilities(): Promise<void>;
  requestCollaboration(agents: string[], context: A2AContext): Promise<string>;
  joinCollaboration(collaborationId: string): Promise<void>;
  voteOnConsensus(proposalId: string, vote: boolean, reasoning?: string): Promise<void>;
}

// =====================================================
// A2A COMMUNICATION BUS
// =====================================================

export class A2ACommunicationBus extends EventEmitter {
  private agents: Map<string, IA2AAgent> = new Map();
  private messageQueue: A2AMessage[] = [];
  private collaborations: Map<string, CollaborationSession> = new Map();
  private messageHistory: A2AMessage[] = [];
  private maxHistorySize = 10000;

  constructor() {
    super();
    this.setupMessageProcessor();
  }

  // =====================================================
  // AGENT MANAGEMENT
  // =====================================================

  registerAgent(agent: IA2AAgent): void {
    this.agents.set(agent.id, agent);
    console.log(`📱 A2A: Registered agent ${agent.name} (${agent.id})`);
    
    this.emit('agent_registered', {
      agentId: agent.id,
      name: agent.name,
      domain: agent.domain,
      capabilities: agent.capabilities
    });
  }

  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      console.log(`📱 A2A: Unregistered agent ${agent.name} (${agentId})`);
      
      this.emit('agent_unregistered', { agentId, name: agent.name });
    }
  }

  getAgent(agentId: string): IA2AAgent | undefined {
    return this.agents.get(agentId);
  }

  getAgentsByDomain(domain: A2AAgentDomain): IA2AAgent[] {
    return Array.from(this.agents.values()).filter(agent => agent.domain === domain);
  }

  getAllAgents(): IA2AAgent[] {
    return Array.from(this.agents.values());
  }

  // =====================================================
  // MESSAGE ROUTING
  // =====================================================

  async routeMessage(message: A2AMessage): Promise<void> {
    // Add to history
    this.addToHistory(message);

    console.log(`📱 A2A: Routing ${message.type} from ${message.fromAgent} to ${message.toAgent || 'ALL'}`);

    if (message.toAgent) {
      // Direct message
      await this.deliverToAgent(message, message.toAgent);
    } else {
      // Broadcast message
      await this.broadcast(message);
    }

    this.emit('message_routed', message);
  }

  private async deliverToAgent(message: A2AMessage, agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`📱 A2A: Agent ${agentId} not found for message delivery`);
      await this.sendErrorResponse(message, {
        code: 404,
        message: `Agent ${agentId} not found`,
        details: { agentId },
        retryable: false
      });
      return;
    }

    try {
      const response = await agent.receiveMessage(message);
      if (response) {
        await this.routeMessage(response);
      }
    } catch (error) {
      console.error(`📱 A2A: Error delivering message to ${agentId}:`, error);
      await this.sendErrorResponse(message, {
        code: 500,
        message: 'Message delivery failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        retryable: true
      });
    }
  }

  private async broadcast(message: A2AMessage): Promise<void> {
    const agents = Array.from(this.agents.values());
    const deliveryPromises = agents
      .filter(agent => agent.id !== message.fromAgent) // Don't send to self
      .map(agent => this.deliverToAgent(message, agent.id));

    await Promise.allSettled(deliveryPromises);
  }

  private async sendErrorResponse(originalMessage: A2AMessage, error: A2AError): Promise<void> {
    if (originalMessage.type === A2AMessageType.REQUEST) {
      const errorResponse: A2AMessage = {
        id: uuidv4(),
        type: A2AMessageType.ERROR,
        fromAgent: 'communication_bus',
        toAgent: originalMessage.fromAgent,
        domain: originalMessage.domain,
        priority: A2APriority.HIGH,
        timestamp: Date.now(),
        correlationId: originalMessage.id,
        payload: {
          method: 'error_response',
          error
        },
        metadata: { originalMessage: originalMessage.id }
      };

      await this.routeMessage(errorResponse);
    }
  }

  // =====================================================
  // COLLABORATION SUPPORT
  // =====================================================

  async initiateCollaboration(
    initiatorId: string,
    participants: string[],
    context: A2AContext,
    mode: 'parallel' | 'sequential' | 'consensus' | 'competitive' | 'debate' = 'parallel'
  ): Promise<string> {
    const collaborationId = uuidv4();
    
    const session: CollaborationSession = {
      id: collaborationId,
      initiator: initiatorId,
      participants: [initiatorId, ...participants],
      context: { ...context, collaborationMode: mode },
      status: 'initializing',
      startTime: Date.now(),
      messages: []
    };

    this.collaborations.set(collaborationId, session);

    // Send collaboration invitations
    const invitationMessage: A2AMessage = {
      id: uuidv4(),
      type: A2AMessageType.COLLABORATION_REQUEST,
      fromAgent: initiatorId,
      domain: A2AAgentDomain.COORDINATION,
      priority: A2APriority.HIGH,
      timestamp: Date.now(),
      correlationId: collaborationId,
      payload: {
        method: 'collaboration_invitation',
        params: {
          collaborationId,
          mode,
          context
        }
      },
      metadata: { collaboration: true }
    };

    for (const participantId of participants) {
      await this.routeMessage({ ...invitationMessage, toAgent: participantId });
    }

    session.status = 'active';
    console.log(`📱 A2A: Initiated collaboration ${collaborationId} with ${participants.length} participants`);

    return collaborationId;
  }

  getCollaboration(collaborationId: string): CollaborationSession | undefined {
    return this.collaborations.get(collaborationId);
  }

  async endCollaboration(collaborationId: string): Promise<void> {
    const session = this.collaborations.get(collaborationId);
    if (session) {
      session.status = 'completed';
      session.endTime = Date.now();
      
      console.log(`📱 A2A: Collaboration ${collaborationId} completed`);
      this.emit('collaboration_ended', session);
    }
  }

  // =====================================================
  // MESSAGE HISTORY & ANALYTICS
  // =====================================================

  private addToHistory(message: A2AMessage): void {
    this.messageHistory.push(message);
    
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  getMessageHistory(limit: number = 100): A2AMessage[] {
    return this.messageHistory.slice(-limit);
  }

  getMessagesByAgent(agentId: string, limit: number = 50): A2AMessage[] {
    return this.messageHistory
      .filter(msg => msg.fromAgent === agentId || msg.toAgent === agentId)
      .slice(-limit);
  }

  getMessagesByCorrelation(correlationId: string): A2AMessage[] {
    return this.messageHistory.filter(msg => msg.correlationId === correlationId);
  }

  // =====================================================
  // SYSTEM MONITORING
  // =====================================================

  getAgentStatus(): Record<string, any> {
    const agentStatus: Record<string, any> = {};
    
    for (const [id, agent] of this.agents) {
      agentStatus[id] = {
        name: agent.name,
        domain: agent.domain,
        status: agent.status,
        capabilities: agent.capabilities.methods.length,
        priority: agent.priority
      };
    }

    return agentStatus;
  }

  getSystemMetrics(): Record<string, any> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const recentMessages = this.messageHistory.filter(msg => msg.timestamp > oneHourAgo);
    
    return {
      totalAgents: this.agents.size,
      activeCollaborations: Array.from(this.collaborations.values())
        .filter(c => c.status === 'active').length,
      totalCollaborations: this.collaborations.size,
      messagesLastHour: recentMessages.length,
      messageTypesLastHour: this.groupMessagesByType(recentMessages),
      averageMessageLatency: this.calculateAverageLatency(recentMessages),
      systemUptime: now - this.startTime
    };
  }

  private startTime = Date.now();

  private groupMessagesByType(messages: A2AMessage[]): Record<string, number> {
    const typeGroups: Record<string, number> = {};
    
    for (const message of messages) {
      typeGroups[message.type] = (typeGroups[message.type] || 0) + 1;
    }
    
    return typeGroups;
  }

  private calculateAverageLatency(messages: A2AMessage[]): number {
    if (messages.length === 0) return 0;
    
    // For real latency calculation, we'd need response timestamps
    // For now, return a placeholder
    return 50; // milliseconds
  }

  // =====================================================
  // SETUP & UTILITIES
  // =====================================================

  private setupMessageProcessor(): void {
    // Process message queue every 10ms
    setInterval(() => {
      this.processMessageQueue();
    }, 10);
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    const message = this.messageQueue.shift();
    if (message) {
      this.routeMessage(message).catch(error => {
        console.error('📱 A2A: Error processing queued message:', error);
      });
    }
  }

  queueMessage(message: A2AMessage): void {
    this.messageQueue.push(message);
  }

  // =====================================================
  // HEALTH & DIAGNOSTICS
  // =====================================================

  async performHealthCheck(): Promise<Record<string, any>> {
    const agentHealth: Record<string, any> = {};
    
    for (const [id, agent] of this.agents) {
      agentHealth[id] = {
        status: agent.status,
        responsive: await this.pingAgent(agent)
      };
    }

    return {
      communicationBus: 'healthy',
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'active').length,
      agentHealth,
      messageQueueSize: this.messageQueue.length,
      collaborationsActive: Array.from(this.collaborations.values())
        .filter(c => c.status === 'active').length
    };
  }

  private async pingAgent(agent: IA2AAgent): Promise<boolean> {
    try {
      const pingMessage: A2AMessage = {
        id: uuidv4(),
        type: A2AMessageType.REQUEST,
        fromAgent: 'communication_bus',
        toAgent: agent.id,
        domain: agent.domain,
        priority: A2APriority.LOW,
        timestamp: Date.now(),
        payload: {
          method: 'ping'
        },
        metadata: { healthCheck: true },
        timeout: 5000
      };

      // In a real implementation, we'd wait for a response
      // For now, assume responsive if status is active
      return agent.status === 'active';
    } catch (error) {
      return false;
    }
  }
}

// =====================================================
// SUPPORTING INTERFACES
// =====================================================

interface CollaborationSession {
  id: string;
  initiator: string;
  participants: string[];
  context: A2AContext;
  status: 'initializing' | 'active' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  messages: A2AMessage[];
}

// Export utility functions
export function createA2AMessage(
  type: A2AMessageType,
  fromAgent: string,
  domain: A2AAgentDomain,
  payload: any,
  toAgent?: string,
  priority: A2APriority = A2APriority.NORMAL
): A2AMessage {
  return {
    id: uuidv4(),
    type,
    fromAgent,
    toAgent,
    domain,
    priority,
    timestamp: Date.now(),
    payload,
    metadata: {}
  };
}

// =====================================================
// DEBATE COORDINATION INTERFACES
// =====================================================

export interface DebateConfiguration {
  maxRounds: number;
  convergenceThreshold: number;
  roles: {
    analyzer: string;
    challenger: string;
    synthesizer: string;
  };
}

export interface DebateRound {
  round: number;
  role: 'analyzer' | 'challenger' | 'synthesizer';
  agentId: string;
  findingsProposed?: number;
  findingsChallenged?: number;
  findingsVerified?: number;
  falsePositivesFound?: number;
  timestamp: number;
}

export interface DebateResult {
  rounds: DebateRound[];
  totalProposed: number;
  totalVerified: number;
  totalFalsePositives: number;
  falsePositiveRate: number;
  consensusScore: number;
}

export function isValidA2AMessage(obj: any): obj is A2AMessage {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.fromAgent === 'string' &&
    Object.values(A2AMessageType).includes(obj.type) &&
    Object.values(A2AAgentDomain).includes(obj.domain) &&
    typeof obj.timestamp === 'number' &&
    obj.payload &&
    typeof obj.payload.method === 'string';
}
