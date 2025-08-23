// 🔗 Enhanced Agent Communication Bus - A2A Pattern Integration
// Integrating A2A Framework communication patterns into our existing system

export interface A2AMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'broadcast' | 'status';
  payload: any;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentStatus {
  agentId: string;
  status: 'active' | 'busy' | 'idle' | 'error';
  capabilities: string[];
  currentTasks: number;
  lastSeen: string;
}

export class A2ACommunicationBus {
  private agents: Map<string, AgentStatus> = new Map();
  private messageQueue: A2AMessage[] = [];
  private messageHandlers: Map<string, Function> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    console.log('📡 A2A Communication Bus initialized');
  }

  // ===== AGENT REGISTRATION =====

  async registerAgent(agentId: string, capabilities: string[]): Promise<void> {
    const agentStatus: AgentStatus = {
      agentId,
      status: 'active',
      capabilities,
      currentTasks: 0,
      lastSeen: new Date().toISOString()
    };

    this.agents.set(agentId, agentStatus);
    console.log(`🤖 Agent registered: ${agentId} (${capabilities.join(', ')})`);
    
    // Broadcast agent registration
    this.broadcast('agent_registered', { agentId, capabilities });
  }

  async unregisterAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
    console.log(`🚫 Agent unregistered: ${agentId}`);
    
    // Broadcast agent removal
    this.broadcast('agent_unregistered', { agentId });
  }

  // ===== MESSAGE HANDLING =====

  async sendMessage(message: Omit<A2AMessage, 'id' | 'timestamp'>): Promise<string> {
    const fullMessage: A2AMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString()
    };

    // Add to queue for processing
    this.messageQueue.push(fullMessage);
    
    // Process immediately if handler exists
    const handler = this.messageHandlers.get(message.to);
    if (handler) {
      try {
        await handler(fullMessage);
      } catch (error) {
        console.error(`❌ Message handling error for ${message.to}:`, error);
      }
    }

    return fullMessage.id;
  }

  registerMessageHandler(agentId: string, handler: (message: A2AMessage) => Promise<void>): void {
    this.messageHandlers.set(agentId, handler);
  }

  // ===== BROADCASTING =====

  broadcast(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType) || [];
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`❌ Broadcast listener error for ${eventType}:`, error);
      }
    }
  }

  addEventListener(eventType: string, listener: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  // ===== STATUS & MONITORING =====

  getAgentStatus(): any {
    return {
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'active').length,
      busyAgents: Array.from(this.agents.values()).filter(a => a.status === 'busy').length,
      messageQueueSize: this.messageQueue.length,
      registeredAgents: Array.from(this.agents.keys())
    };
  }

  updateAgentStatus(agentId: string, status: Partial<AgentStatus>): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      Object.assign(agent, status, { lastSeen: new Date().toISOString() });
    }
  }

  // ===== COORDINATION HELPERS =====

  async findAgentsWithCapability(capability: string): Promise<string[]> {
    return Array.from(this.agents.values())
      .filter(agent => agent.capabilities.includes(capability) && agent.status === 'active')
      .map(agent => agent.agentId);
  }

  async getAvailableAgent(capabilities: string[]): Promise<string | null> {
    const availableAgents = Array.from(this.agents.values())
      .filter(agent => 
        agent.status === 'active' && 
        capabilities.some(cap => agent.capabilities.includes(cap))
      )
      .sort((a, b) => a.currentTasks - b.currentTasks);

    return availableAgents.length > 0 ? availableAgents[0].agentId : null;
  }
}

export default A2ACommunicationBus;
