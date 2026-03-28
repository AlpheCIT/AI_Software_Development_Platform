// =====================================================
// ENHANCED AI ORCHESTRATION SERVICE - MAIN ENTRY POINT
// =====================================================
// Complete AI orchestration system incorporating CCI Framework, A2A Protocol, and Agent Coordination

import fastify, { FastifyInstance } from 'fastify';
import { Database } from 'arangojs';
import { 
  A2ACommunicationBus, 
  A2AAgentDomain, 
  A2APriority,
  A2AContext 
} from './communication/a2a-protocol.js';
import { AgentCoordinationHub } from './orchestrator/agent-coordination-hub.js';
import { EnhancedSecurityExpertAgent } from './agents/enhanced-security-agent.js';
import { EnhancedPerformanceExpertAgent } from './agents/enhanced-performance-agent.js';
import { DocumentationQualityAgent } from './agents/documentation-quality-agent.js';
import { DependencyAnalysisAgent } from './agents/dependency-analysis-agent.js';
import { DependencyIntelligenceAgent } from './agents/dependency-intelligence-agent.js';
import { SecurityChallengerAgent } from './agents/security-challenger-agent.js';
import { SecuritySynthesizerAgent } from './agents/security-synthesizer-agent.js';
import { PerformanceChallengerAgent } from './agents/performance-challenger-agent.js';
import { PerformanceSynthesizerAgent } from './agents/performance-synthesizer-agent.js';
import { DocumentationDrafterAgent } from './agents/documentation-drafter-agent.js';
import { DocumentationChallengerAgent } from './agents/documentation-challenger-agent.js';
import { DocumentationSynthesizerAgent } from './agents/documentation-synthesizer-agent.js';
import { DependencyChallengerAgent } from './agents/dependency-challenger-agent.js';
import { DependencySynthesizerAgent } from './agents/dependency-synthesizer-agent.js';
import { DocQualityChallengerAgent } from './agents/doc-quality-challenger-agent.js';
import { AutoRemediationAgent } from './agents/auto-remediation-agent.js';
import { SourceCodeProvider } from './services/source-code-provider.js';
import { getDebateConfig } from './config/debate-registry.js';

interface OrchestrationConfig {
  port: number;
  database: {
    url: string;
    name: string;
    username: string;
    password: string;
  };
  agents: {
    maxConcurrent: number;
    timeout: number;
  };
}

interface AnalysisRequestBody {
  entityKey: string;
  analysisType?: string;
  repoId?: string;
  branchId?: string;
  coordinationType?: 'parallel' | 'sequential' | 'consensus' | 'competitive' | 'debate';
  domains?: A2AAgentDomain[];
  parameters?: Record<string, any>;
  businessContext?: {
    domain: string;
    criticality: 'low' | 'medium' | 'high' | 'critical';
    userImpact: string;
    revenueImpact?: number;
    complianceRequirements?: string[];
  };
  timeout?: number;
  priority?: A2APriority;
}

export class EnhancedAIOrchestrationService {
  private app: FastifyInstance;
  private db: Database;
  private communicationBus: A2ACommunicationBus;
  private coordinationHub: AgentCoordinationHub;
  private agents: Map<string, any> = new Map();
  private sourceCodeProvider: SourceCodeProvider;
  private isInitialized: boolean = false;
  private config: OrchestrationConfig;

  constructor(config: OrchestrationConfig) {
    this.config = config;
    this.app = fastify({ 
      logger: { level: 'info' },
      requestTimeout: 60000
    });
    
    this.initializeDatabase();
    this.initializeCommunicationBus();
    this.setupRoutes();
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  private initializeDatabase(): void {
    this.db = new Database({
      url: this.config.database.url,
      databaseName: this.config.database.name,
      auth: {
        username: this.config.database.username,
        password: this.config.database.password
      }
    });
  }

  private initializeCommunicationBus(): void {
    this.communicationBus = new A2ACommunicationBus();
    this.coordinationHub = new AgentCoordinationHub(this.communicationBus);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.communicationBus.on('agent_registered', (data) => {
      console.log(`📱 Agent registered: ${data.name} (${data.agentId})`);
    });

    this.communicationBus.on('message_routed', (message) => {
      console.log(`📨 Message routed: ${message.type} from ${message.fromAgent}`);
    });

    this.coordinationHub.on('coordination_completed', (result) => {
      console.log(`🤝 Coordination completed: ${result.coordinationId} (${result.status})`);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ AI Orchestration Service already initialized');
      return;
    }

    console.log('🔧 Initializing Enhanced AI Orchestration Service...');

    try {
      await this.testDatabaseConnection();
      console.log('✅ Database connection established');

      await this.initializeAgents();
      console.log('✅ AI Agents initialized');

      await this.createCollections();
      console.log('✅ Database collections verified');

      this.isInitialized = true;
      console.log('🎉 Enhanced AI Orchestration Service fully initialized!');

    } catch (error) {
      console.error('❌ Failed to initialize AI Orchestration Service:', error);
      throw error;
    }
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      const info = await this.db.get();
      console.log(`🗄️ Connected to ArangoDB: ${info.name} (version ${info.version})`);
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  private async initializeAgents(): Promise<void> {
    console.log('🤖 Initializing AI agents...');

    const securityAgent = new EnhancedSecurityExpertAgent(this.communicationBus);
    await securityAgent.initialize();
    this.agents.set('security', securityAgent);
    console.log('🔒 Security Expert Agent initialized');

    const performanceAgent = new EnhancedPerformanceExpertAgent(this.communicationBus);
    await performanceAgent.initialize();
    this.agents.set('performance', performanceAgent);
    console.log('⚡ Performance Expert Agent initialized');

    const documentationQualityAgent = new DocumentationQualityAgent(this.communicationBus, this.db);
    await documentationQualityAgent.initialize();
    this.agents.set('documentation_quality', documentationQualityAgent);
    console.log('📝 Documentation Quality Agent initialized');

    const dependencyAnalysisAgent = new DependencyAnalysisAgent(this.communicationBus, this.db);
    await dependencyAnalysisAgent.initialize();
    this.agents.set('dependency_analysis', dependencyAnalysisAgent);
    console.log('📦 Dependency Analysis Agent initialized');

    const dependencyIntelligenceAgent = new DependencyIntelligenceAgent(this.communicationBus, this.db);
    await dependencyIntelligenceAgent.initialize();
    this.agents.set('dependency_intelligence', dependencyIntelligenceAgent);
    console.log('🔬 Dependency Intelligence Agent initialized');

    // Security debate triad (challenger + synthesizer)
    const secChallenger = new SecurityChallengerAgent(this.communicationBus);
    await secChallenger.initialize();
    this.agents.set('security_challenger', secChallenger);
    console.log('🔒 Security Challenger Agent initialized');

    const secSynthesizer = new SecuritySynthesizerAgent(this.communicationBus);
    await secSynthesizer.initialize();
    this.agents.set('security_synthesizer', secSynthesizer);
    console.log('🔒 Security Synthesizer Agent initialized');

    // Performance debate triad (challenger + synthesizer)
    const perfChallenger = new PerformanceChallengerAgent(this.communicationBus);
    await perfChallenger.initialize();
    this.agents.set('performance_challenger', perfChallenger);
    console.log('⚡ Performance Challenger Agent initialized');

    const perfSynthesizer = new PerformanceSynthesizerAgent(this.communicationBus);
    await perfSynthesizer.initialize();
    this.agents.set('performance_synthesizer', perfSynthesizer);
    console.log('⚡ Performance Synthesizer Agent initialized');

    // Documentation writer debate triad
    const docDrafter = new DocumentationDrafterAgent(this.communicationBus, this.db);
    await docDrafter.initialize();
    this.agents.set('doc_drafter', docDrafter);
    console.log('📝 Documentation Drafter Agent initialized');

    const docChallenger = new DocumentationChallengerAgent(this.communicationBus, this.db);
    await docChallenger.initialize();
    this.agents.set('doc_challenger', docChallenger);
    console.log('📝 Documentation Challenger Agent initialized');

    const docSynthesizer = new DocumentationSynthesizerAgent(this.communicationBus, this.db);
    await docSynthesizer.initialize();
    this.agents.set('doc_synthesizer', docSynthesizer);
    console.log('📝 Documentation Synthesizer Agent initialized');

    // Dependency debate triad (challenger + synthesizer)
    const depChallenger = new DependencyChallengerAgent(this.communicationBus, this.db);
    await depChallenger.initialize();
    this.agents.set('dependency_challenger', depChallenger);
    console.log('📦 Dependency Challenger Agent initialized');

    const depSynthesizer = new DependencySynthesizerAgent(this.communicationBus, this.db);
    await depSynthesizer.initialize();
    this.agents.set('dependency_synthesizer', depSynthesizer);
    console.log('📦 Dependency Synthesizer Agent initialized');

    // Doc quality challenger
    const dqChallenger = new DocQualityChallengerAgent(this.communicationBus, this.db);
    await dqChallenger.initialize();
    this.agents.set('doc_quality_challenger', dqChallenger);
    console.log('📋 Doc Quality Challenger Agent initialized');

    // Auto-remediation agent -- generates actual code fixes for verified findings
    const autoRemediation = new AutoRemediationAgent(this.communicationBus);
    await autoRemediation.initialize();
    this.agents.set('auto_remediation', autoRemediation);
    console.log('🔧 Auto-Remediation Agent initialized');

    // Initialize SourceCodeProvider for debate agents
    this.sourceCodeProvider = new SourceCodeProvider(this.db);
    console.log('📂 SourceCodeProvider initialized');

    console.log(`✅ ${this.agents.size} AI agents successfully initialized`);
  }

  private async createCollections(): Promise<void> {
    const collections = [
      'code_entities',
      'doc_agent_analyses',
      'doc_agent_collaborations',
      'doc_coordination_history',
      'doc_security_findings',
      'doc_performance_findings'
    ];

    for (const collectionName of collections) {
      try {
        const collection = this.db.collection(collectionName);
        const exists = await collection.exists();
        
        if (!exists) {
          await collection.create();
          console.log(`✅ Created collection: ${collectionName}`);
        }
      } catch (error) {
        console.log(`⚠️ Collection ${collectionName} might already exist`);
      }
    }
  }

  // =====================================================
  // API ROUTES
  // =====================================================

  private setupRoutes(): void {
    this.app.get('/health', async (request, reply) => {
      const health = await this.getHealthStatus();
      return { status: 'healthy', ...health };
    });

    this.app.get('/info', async (request, reply) => {
      return this.getServiceInfo();
    });

    this.app.get('/agents', async (request, reply) => {
      return this.getAgentStatus();
    });

    this.app.get('/agents/capabilities', async (request, reply) => {
      return this.getAgentCapabilities();
    });

    this.app.post<{ Body: AnalysisRequestBody }>('/analyze/comprehensive', async (request, reply) => {
      try {
        const result = await this.performComprehensiveAnalysis(request.body);
        return { success: true, result };
      } catch (error) {
        reply.code(500);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Analysis failed' 
        };
      }
    });

    this.app.post<{ Body: AnalysisRequestBody }>('/analyze/security', async (request, reply) => {
      try {
        const result = await this.performSecurityAnalysis(request.body);
        return { success: true, result };
      } catch (error) {
        reply.code(500);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Security analysis failed' 
        };
      }
    });

    this.app.post<{ Body: AnalysisRequestBody }>('/analyze/performance', async (request, reply) => {
      try {
        const result = await this.performPerformanceAnalysis(request.body);
        return { success: true, result };
      } catch (error) {
        reply.code(500);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Performance analysis failed' 
        };
      }
    });

    this.app.post<{ Body: AnalysisRequestBody }>('/collaborate', async (request, reply) => {
      try {
        const result = await this.orchestrateAgentCollaboration(request.body);
        return { success: true, result };
      } catch (error) {
        reply.code(500);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Collaboration failed' 
        };
      }
    });

    // Documentation generation via debate triad
    this.app.post('/generate/documentation', async (request, reply) => {
      try {
        const { repositoryId } = request.body as { repositoryId: string };
        const sourceFiles = await this.sourceCodeProvider.getAllFilesForRepo(repositoryId);
        const debateConfig = getDebateConfig('documentation');

        const result = await this.coordinationHub.requestComprehensiveAnalysis(repositoryId, {
          coordinationType: 'debate',
          targetAgents: ['doc_drafter', 'doc_challenger', 'doc_synthesizer'],
          timeout: 120000,
          sourceFiles,
          debateConfig,
          enableVerification: true
        } as any);

        return {
          success: true,
          repositoryId,
          documentation: result.combinedResult,
          debate_metrics: result.coordinationMetrics,
          quality_score: result.qualityMetrics
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Documentation generation failed'
        };
      }
    });

    // Auto-remediation: takes verified findings and returns code patches
    this.app.post('/remediate', async (request, reply) => {
      try {
        const { verifiedFindings, sourceFiles } = request.body as {
          verifiedFindings: any[];
          sourceFiles?: Record<string, string>;
        };

        if (!verifiedFindings || verifiedFindings.length === 0) {
          reply.code(400);
          return { success: false, error: 'verifiedFindings array is required' };
        }

        const remediationAgent = this.agents.get('auto_remediation');
        if (!remediationAgent) {
          reply.code(503);
          return { success: false, error: 'Auto-remediation agent is not available' };
        }

        const result = await this.coordinationHub.requestComprehensiveAnalysis('remediation', {
          coordinationType: 'parallel',
          targetAgents: ['auto_remediation'],
          analysisType: 'generate_fixes',
          timeout: 30000,
          sourceFiles: sourceFiles ? new Map(Object.entries(sourceFiles)) : new Map(),
          parameters: { verifiedFindings, sourceFiles: sourceFiles || {} }
        } as any);

        const patches = result.combinedResult?.rawData?.patches || [];

        return {
          success: true,
          patches,
          summary: {
            totalFindings: verifiedFindings.length,
            patchesGenerated: patches.length,
            breakingChanges: patches.filter((p: any) => p.breakingChange).length
          }
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Remediation failed'
        };
      }
    });

    this.app.get('/coordination/history', async (request, reply) => {
      const history = this.coordinationHub.getCoordinationHistory(50);
      return { coordination_history: history };
    });

    this.app.get('/metrics', async (request, reply) => {
      return this.getSystemMetrics();
    });

    this.app.post('/demo/run', async (request, reply) => {
      try {
        const demoResult = await this.runDemo();
        return { success: true, demo: demoResult };
      } catch (error) {
        reply.code(500);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Demo failed' 
        };
      }
    });
  }

  // =====================================================
  // ANALYSIS ORCHESTRATION
  // =====================================================

  async performComprehensiveAnalysis(requestBody: AnalysisRequestBody): Promise<any> {
    const { entityKey, coordinationType = 'debate', domains, businessContext, timeout = 60000 } = requestBody;

    console.log(`🧠 Starting comprehensive analysis for entity: ${entityKey}`);

    // Pre-fetch source files for debate agents
    const sourceFiles = entityKey
      ? await this.sourceCodeProvider.getFilesForEntity(entityKey, entityKey)
      : new Map<string, string>();

    const targetAgents = domains || [A2AAgentDomain.SECURITY, A2AAgentDomain.PERFORMANCE];
    const agentIds = targetAgents.flatMap(domain => {
      switch (domain) {
        case A2AAgentDomain.SECURITY: return ['security', 'dependency_intelligence', 'security_challenger', 'security_synthesizer'];
        case A2AAgentDomain.PERFORMANCE: return ['performance', 'performance_challenger', 'performance_synthesizer'];
        case A2AAgentDomain.QUALITY: return ['documentation_quality', 'doc_drafter', 'doc_challenger', 'doc_synthesizer', 'doc_quality_challenger'];
        case A2AAgentDomain.DEPENDENCY: return ['dependency_analysis', 'dependency_challenger', 'dependency_synthesizer'];
        default: return [];
      }
    });

    // Determine debate config from first domain
    const primaryDomain = targetAgents[0]?.toLowerCase() || 'security';
    const debateConfig = getDebateConfig(primaryDomain);

    const result = await this.coordinationHub.requestComprehensiveAnalysis(entityKey, {
      coordinationType,
      targetAgents: agentIds,
      businessContext,
      timeout,
      sourceFiles,
      debateConfig,
      enableVerification: true
    } as any);

    return {
      coordination_id: result.coordinationId,
      status: result.status,
      duration: result.duration,
      participant_count: result.participantCount,
      consensus_achieved: result.consensusAchieved,
      combined_result: result.combinedResult,
      quality_metrics: result.qualityMetrics,
      business_impact: result.businessImpact
    };
  }

  async performSecurityAnalysis(requestBody: AnalysisRequestBody): Promise<any> {
    const { entityKey, businessContext, timeout = 30000 } = requestBody;
    
    console.log(`🔒 Starting security analysis for entity: ${entityKey}`);

    const result = await this.coordinationHub.requestComprehensiveAnalysis(entityKey, {
      coordinationType: 'parallel',
      targetAgents: ['security'],
      analysisType: 'comprehensive_security_analysis',
      businessContext,
      timeout
    });

    return {
      security_analysis: result.combinedResult,
      findings: result.combinedResult?.findings || [],
      recommendations: result.combinedResult?.recommendations || [],
      security_score: result.combinedResult?.metrics?.securityScore || 0,
      threat_level: result.combinedResult?.metrics?.threatLevel || 0
    };
  }

  async performPerformanceAnalysis(requestBody: AnalysisRequestBody): Promise<any> {
    const { entityKey, businessContext, timeout = 30000 } = requestBody;
    
    console.log(`⚡ Starting performance analysis for entity: ${entityKey}`);

    const result = await this.coordinationHub.requestComprehensiveAnalysis(entityKey, {
      coordinationType: 'parallel',
      targetAgents: ['performance'],
      analysisType: 'comprehensive_performance_analysis',
      businessContext,
      timeout
    });

    return {
      performance_analysis: result.combinedResult,
      findings: result.combinedResult?.findings || [],
      recommendations: result.combinedResult?.recommendations || [],
      performance_score: result.combinedResult?.metrics?.performanceScore || 0,
      optimization_potential: result.combinedResult?.metrics?.optimizationPotential || 0
    };
  }

  async orchestrateAgentCollaboration(requestBody: AnalysisRequestBody): Promise<any> {
    const { entityKey, coordinationType = 'consensus', domains, businessContext, timeout = 45000 } = requestBody;
    
    console.log(`🤝 Starting agent collaboration for entity: ${entityKey}`);

    const targetAgents = domains || [A2AAgentDomain.SECURITY, A2AAgentDomain.PERFORMANCE];
    const agentIds = targetAgents.flatMap(domain => {
      switch (domain) {
        case A2AAgentDomain.SECURITY: return ['security', 'dependency_intelligence'];
        case A2AAgentDomain.PERFORMANCE: return ['performance'];
        case A2AAgentDomain.QUALITY: return ['documentation_quality'];
        case A2AAgentDomain.DEPENDENCY: return ['dependency_analysis'];
        default: return [];
      }
    });

    const result = await this.coordinationHub.requestComprehensiveAnalysis(entityKey, {
      coordinationType,
      targetAgents: agentIds,
      businessContext,
      timeout
    });

    return {
      collaboration_id: result.coordinationId,
      consensus_achieved: result.consensusAchieved,
      participating_agents: agentIds,
      unified_findings: result.combinedResult?.findings || [],
      unified_recommendations: result.combinedResult?.recommendations || [],
      collaboration_metrics: result.coordinationMetrics,
      business_impact: result.businessImpact
    };
  }

  // =====================================================
  // STATUS & MONITORING
  // =====================================================

  private async getHealthStatus(): Promise<any> {
    const communicationHealth = await this.communicationBus.performHealthCheck();
    const coordinationStatus = this.coordinationHub.getCoordinationStatus();
    
    return {
      service: 'healthy',
      database: 'connected',
      communication_bus: communicationHealth,
      coordination_hub: coordinationStatus,
      agents: this.getAgentHealthStatus()
    };
  }

  private getServiceInfo(): any {
    return {
      service: 'Enhanced AI Orchestration Service',
      version: '2.0.0',
      framework: 'CCI Framework + A2A Protocol Compatible',
      initialized: this.isInitialized,
      capabilities: [
        'multi_agent_analysis',
        'agent_coordination',
        'consensus_building',
        'debate_verification',
        'business_impact_analysis',
        'comprehensive_security_analysis',
        'comprehensive_performance_analysis',
        'real_time_collaboration',
        'quality_assessment',
        'documentation_generation',
        'false_positive_elimination'
      ],
      supported_domains: [
        A2AAgentDomain.SECURITY,
        A2AAgentDomain.PERFORMANCE,
        A2AAgentDomain.QUALITY,
        A2AAgentDomain.DEPENDENCY,
        A2AAgentDomain.COORDINATION
      ]
    };
  }

  private getAgentStatus(): any {
    const agentStatus: Record<string, any> = {};
    
    for (const [name, agent] of this.agents) {
      agentStatus[name] = agent.getStatus();
    }
    
    return {
      total_agents: this.agents.size,
      agents: agentStatus,
      communication_status: this.communicationBus.getAgentStatus()
    };
  }

  private getAgentCapabilities(): any {
    const capabilities: Record<string, any> = {};
    
    for (const [name, agent] of this.agents) {
      capabilities[name] = {
        domain: agent.domain,
        capabilities: agent.capabilities,
        status: agent.status
      };
    }
    
    return capabilities;
  }

  private getAgentHealthStatus(): Record<string, string> {
    const health: Record<string, string> = {};
    
    for (const [name, agent] of this.agents) {
      health[name] = agent.status;
    }
    
    return health;
  }

  private getSystemMetrics(): any {
    const communicationMetrics = this.communicationBus.getSystemMetrics();
    const coordinationMetrics = this.coordinationHub.getCoordinationStatus();
    
    return {
      communication_bus: communicationMetrics,
      coordination_hub: coordinationMetrics,
      agents: {
        total: this.agents.size,
        active: Array.from(this.agents.values()).filter(agent => agent.status === 'active').length
      },
      system: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        node_version: process.version
      }
    };
  }

  // =====================================================
  // DEMO FUNCTIONALITY
  // =====================================================

  async runDemo(): Promise<any> {
    console.log('🎪 Running Enhanced AI Orchestration Demo...');

    const demoResults = [];

    // Demo 1: Security Analysis
    console.log('🔒 Demo 1: Security Analysis');
    try {
      const securityDemo = await this.performSecurityAnalysis({
        entityKey: 'demo_entity_security',
        businessContext: {
          domain: 'web_application',
          criticality: 'high',
          userImpact: 'Customer authentication system'
        }
      });
      demoResults.push({ 
        type: 'security', 
        status: 'success', 
        findings: securityDemo.findings.length,
        security_score: securityDemo.security_score
      });
    } catch (error) {
      demoResults.push({ type: 'security', status: 'error', error: (error as Error).message });
    }

    // Demo 2: Performance Analysis
    console.log('⚡ Demo 2: Performance Analysis');
    try {
      const performanceDemo = await this.performPerformanceAnalysis({
        entityKey: 'demo_entity_performance',
        businessContext: {
          domain: 'data_processing',
          criticality: 'medium',
          userImpact: 'Report generation system'
        }
      });
      demoResults.push({ 
        type: 'performance', 
        status: 'success', 
        findings: performanceDemo.findings.length,
        performance_score: performanceDemo.performance_score
      });
    } catch (error) {
      demoResults.push({ type: 'performance', status: 'error', error: (error as Error).message });
    }

    // Demo 3: Agent Collaboration
    console.log('🤝 Demo 3: Agent Collaboration');
    try {
      const collaborationDemo = await this.orchestrateAgentCollaboration({
        entityKey: 'demo_entity_collaboration',
        coordinationType: 'consensus',
        domains: [A2AAgentDomain.SECURITY, A2AAgentDomain.PERFORMANCE],
        businessContext: {
          domain: 'payment_processing',
          criticality: 'critical',
          userImpact: 'Customer payment processing'
        }
      });
      demoResults.push({ 
        type: 'collaboration', 
        status: 'success', 
        consensus_achieved: collaborationDemo.consensus_achieved,
        agents: collaborationDemo.participating_agents.length
      });
    } catch (error) {
      demoResults.push({ type: 'collaboration', status: 'error', error: (error as Error).message });
    }

    console.log('✅ Enhanced AI Orchestration Demo completed');

    return {
      demo_type: 'Enhanced AI Orchestration Framework',
      timestamp: new Date().toISOString(),
      results: demoResults,
      summary: {
        total_demos: demoResults.length,
        successful: demoResults.filter(r => r.status === 'success').length,
        failed: demoResults.filter(r => r.status === 'error').length
      },
      capabilities_demonstrated: [
        'Multi-agent security analysis',
        'Performance bottleneck detection',
        'Agent consensus building',
        'Business impact assessment',
        'Real-time coordination'
      ]
    };
  }

  // =====================================================
  // SERVER STARTUP
  // =====================================================

  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await this.app.listen({ port: this.config.port, host: '0.0.0.0' });
      
      console.log('🚀 ENHANCED AI ORCHESTRATION SERVICE STARTED');
      console.log('=' .repeat(70));
      console.log(`🌐 Server running on port ${this.config.port}`);
      console.log(`🔗 Health check: http://localhost:${this.config.port}/health`);
      console.log(`📚 Service info: http://localhost:${this.config.port}/info`);
      console.log(`🤖 Agent status: http://localhost:${this.config.port}/agents`);
      console.log(`🎪 Run demo: POST http://localhost:${this.config.port}/demo/run`);
      console.log('=' .repeat(70));
      console.log('🧠 Enhanced AI Orchestration Features:');
      console.log('   🔒 Advanced Security Analysis');
      console.log('   ⚡ Performance Optimization');
      console.log('   🤝 Multi-Agent Collaboration');
      console.log('   🗳️ Consensus Building');
      console.log('   📊 Business Impact Analysis');
      console.log('   📱 A2A Communication Protocol');
      console.log('   🎯 Quality Assessment');
      console.log('   🔄 Real-time Coordination');
      console.log('=' .repeat(70));
      
    } catch (error) {
      console.error('❌ Failed to start Enhanced AI Orchestration Service:', error);
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Enhanced AI Orchestration Service...');
    
    // Shutdown agents
    const shutdownPromises = Array.from(this.agents.values())
      .map(agent => agent.shutdown());
    
    await Promise.all(shutdownPromises);
    
    await this.app.close();
    console.log('✅ Enhanced AI Orchestration Service shutdown complete');
  }
}

// =====================================================
// STARTUP CONFIGURATION AND EXECUTION
// =====================================================

async function startEnhancedAIOrchestrationService(): Promise<void> {
  const config: OrchestrationConfig = {
    port: parseInt(process.env.AI_ORCHESTRATION_PORT || '8003'),
    database: {
      url: process.env.ARANGO_URL || 'http://192.168.1.82:8529',
      name: process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB',
      username: process.env.ARANGO_USER || 'root',
      password: process.env.ARANGO_PASSWORD || ''
    },
    agents: {
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_AGENTS || '10'),
      timeout: parseInt(process.env.AGENT_TIMEOUT || '30000')
    }
  };

  if (!config.database.password) {
    console.warn('WARNING: ARANGO_PASSWORD not set in environment. Set it in .env file.');
  }

  const service = new EnhancedAIOrchestrationService(config);

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    await service.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    await service.shutdown();
    process.exit(0);
  });

  await service.start();
}

// Start service if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startEnhancedAIOrchestrationService().catch(error => {
    console.error('💥 Failed to start Enhanced AI Orchestration Service:', error);
    process.exit(1);
  });
}

export { EnhancedAIOrchestrationService, OrchestrationConfig, AnalysisRequestBody };
