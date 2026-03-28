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
  IA2AAgent,
  DebateConfiguration,
  DebateRound,
  DebateResult
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
import { RunPersistenceService, AnalysisRunRecord, AnalysisFindingRecord } from '../services/run-persistence-service.js';
import { AILearningsService } from '../services/ai-learnings-service.js';

interface CoordinationRequest {
  id: string;
  type: 'parallel' | 'sequential' | 'consensus' | 'competitive' | 'debate';
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
  private runPersistence?: RunPersistenceService;
  private aiLearnings?: AILearningsService;

  constructor(communicationBus: A2ACommunicationBus) {
    super();
    this.communicationBus = communicationBus;
    this.setupEventHandlers();
    this.initializeQualityStandards();
  }

  /**
   * Attach persistence services after construction (allows lazy init).
   */
  setPersistenceServices(
    runPersistence: RunPersistenceService,
    aiLearnings: AILearningsService
  ): void {
    this.runPersistence = runPersistence;
    this.aiLearnings = aiLearnings;
    console.log('AgentCoordinationHub: persistence services attached');
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
        case 'debate':
          result = await this.executeDebateCoordination(session);
          break;
        default:
          throw new Error(`Unknown coordination type: ${request.type}`);
      }

      // Enhanced quality assessment
      result.qualityMetrics = this.assessCoordinationQuality(session, result);
      result.coordinationMetrics = this.calculateCoordinationMetrics(session);
      result.businessImpact = this.generateBusinessImpact(result);

      console.log(`AgentCoordinationHub: Coordination ${coordinationId} completed`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Quality Score: ${result.qualityMetrics.overallScore.toFixed(2)}`);
      console.log(`   Duration: ${result.duration}ms`);

      this.coordinationHistory.push(result);

      // Persist run + findings asynchronously (don't block return)
      this.persistCoordinationResult(result, request).catch(err =>
        console.warn('Failed to persist coordination result:', err.message)
      );

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
  // DEBATE COORDINATION (Multi-Round with Persistence)
  // =====================================================

  private async executeDebateCoordination(session: CoordinationSession): Promise<CoordinationResult> {
    const { request } = session;
    const debateConfig = request.parameters?.debateConfig as DebateConfiguration;
    const CONVERGENCE_THRESHOLD = 0.80;

    if (!debateConfig) {
      console.log(`No debate config found, falling back to sequential coordination`);
      return this.executeSequentialCoordination(session);
    }

    console.log(`Executing multi-round debate coordination: Analyzer -> Challenger -> [Rebuttal] -> Synthesizer`);

    const { analyzer: analyzerRole, challenger: challengerRole, synthesizer: synthesizerRole } = debateConfig.roles;
    const debateRounds: DebateRound[] = [];
    const sourceFiles = request.parameters?.sourceFiles;

    // === ROUND 1: Analyzer produces candidate findings ===
    const analyzerAgent = this.communicationBus.getAgent(analyzerRole);
    if (!analyzerAgent) {
      return {
        coordinationId: session.id,
        status: 'failed',
        results: session.results,
        duration: Date.now() - session.startTime,
        participantCount: 0
      };
    }

    const analyzerMessage: A2AMessage = {
      id: uuidv4(),
      type: A2AMessageType.REQUEST,
      fromAgent: 'coordination_hub',
      toAgent: analyzerRole,
      domain: A2AAgentDomain.COORDINATION,
      priority: request.priority,
      timestamp: Date.now(),
      correlationId: session.id,
      payload: {
        method: request.analysisType,
        params: {
          ...request.parameters,
          role: 'analyzer',
          instruction: 'Analyze the source code and produce candidate findings. Be thorough but know your findings will be verified.'
        }
      },
      metadata: { coordination: true, coordinationType: 'debate', debateRole: 'analyzer' }
    };

    await this.communicationBus.routeMessage(analyzerMessage);
    let analyzerResult: AnalysisResult;

    try {
      analyzerResult = await this.waitForAgentResponse(analyzerRole, session.id, request.timeout);
    } catch (error) {
      console.error(`Analyzer agent failed:`, error);
      return {
        coordinationId: session.id,
        status: 'failed',
        results: session.results,
        duration: Date.now() - session.startTime,
        participantCount: 0
      };
    }

    session.results.set(analyzerRole, analyzerResult);
    const candidateFindings = analyzerResult.findings || [];

    debateRounds.push({
      round: 1,
      role: 'analyzer',
      agentId: analyzerRole,
      findingsProposed: candidateFindings.length,
      timestamp: Date.now()
    });

    console.log(`Round 1 (Analyzer): ${candidateFindings.length} candidate findings proposed`);

    // === ROUND 2: Challenger verifies each finding ===
    const challengerAgent = this.communicationBus.getAgent(challengerRole);
    if (!challengerAgent) {
      console.log(`No challenger agent found, passing findings through unverified`);
      const combinedResult = this.combineAnalysisResults([analyzerResult], session.id, request.businessContext);
      return {
        coordinationId: session.id,
        status: 'success',
        results: session.results,
        combinedResult,
        duration: Date.now() - session.startTime,
        participantCount: 1
      };
    }

    const challengerMessage: A2AMessage = {
      id: uuidv4(),
      type: A2AMessageType.REQUEST,
      fromAgent: 'coordination_hub',
      toAgent: challengerRole,
      domain: A2AAgentDomain.COORDINATION,
      priority: request.priority,
      timestamp: Date.now(),
      correlationId: session.id,
      payload: {
        method: request.analysisType,
        params: {
          ...request.parameters,
          role: 'challenger',
          findingsToVerify: candidateFindings,
          sourceFiles: sourceFiles,
          instruction: 'Verify each finding by reading the actual source code. Check for mitigations, global middleware, and context. Mark each as verified or false_positive with evidence.'
        }
      },
      metadata: { coordination: true, coordinationType: 'debate', debateRole: 'challenger' }
    };

    await this.communicationBus.routeMessage(challengerMessage);
    let challengerResult: AnalysisResult;

    try {
      challengerResult = await this.waitForAgentResponse(challengerRole, session.id, request.timeout);
    } catch (error) {
      console.error(`Challenger agent failed, using unverified findings:`, error);
      const combinedResult = this.combineAnalysisResults([analyzerResult], session.id, request.businessContext);
      return {
        coordinationId: session.id,
        status: 'partial',
        results: session.results,
        combinedResult,
        duration: Date.now() - session.startTime,
        participantCount: 1
      };
    }

    session.results.set(challengerRole, challengerResult);
    const verificationResults = (challengerResult as any).rawData?.verificationResults || challengerResult.metrics?.verificationResults || [];

    // Partition findings into verified, rejected, and disputed
    const verifiedFindings: Finding[] = [];
    const rejectedFindings: Finding[] = [];
    const disputedFindings: Array<{ finding: Finding; objection: string }> = [];

    for (const f of candidateFindings) {
      const verification = Array.isArray(verificationResults)
        ? verificationResults.find((v: any) => v.findingId === f.id)
        : null;

      if (verification) {
        f.verificationStatus = verification.verified ? 'verified' : 'false_positive';
        f.verificationEvidence = verification.evidence;
        f.confidence = verification.adjustedConfidence ?? f.confidence;
        f.challengerNotes = verification.mitigationsFound?.join('; ') || '';
        if (verification.adjustedSeverity) f.severity = verification.adjustedSeverity;

        if (verification.verified) {
          verifiedFindings.push(f);
        } else if (verification.confidence !== undefined && verification.confidence < 0.6) {
          // Low-confidence rejection = disputed (challenger is not sure)
          disputedFindings.push({
            finding: f,
            objection: verification.evidence || verification.reason || 'Challenger uncertain'
          });
        } else {
          rejectedFindings.push(f);
        }
      } else {
        // No verification data -- treat as verified
        verifiedFindings.push(f);
      }
    }

    const falsePositivesRound2 = rejectedFindings.length;

    debateRounds.push({
      round: 2,
      role: 'challenger',
      agentId: challengerRole,
      findingsChallenged: candidateFindings.length,
      findingsVerified: verifiedFindings.length,
      falsePositivesFound: falsePositivesRound2 + disputedFindings.length,
      timestamp: Date.now()
    });

    console.log(`Round 2 (Challenger): ${verifiedFindings.length} verified, ${falsePositivesRound2} rejected, ${disputedFindings.length} disputed`);

    // === ROUND 3 (optional): Rebuttal if convergence below threshold ===
    const convergenceAfterRound2 = candidateFindings.length > 0
      ? verifiedFindings.length / candidateFindings.length
      : 1.0;

    let finalVerified = [...verifiedFindings];
    let totalFalsePositives = falsePositivesRound2;
    let totalRounds = 2;

    if (convergenceAfterRound2 < CONVERGENCE_THRESHOLD && disputedFindings.length > 0) {
      console.log(`Convergence ${(convergenceAfterRound2 * 100).toFixed(1)}% < ${(CONVERGENCE_THRESHOLD * 100)}% threshold -- initiating Round 3 rebuttal`);

      // Send disputed findings back to analyzer with challenger objections
      const rebuttalMessage: A2AMessage = {
        id: uuidv4(),
        type: A2AMessageType.REQUEST,
        fromAgent: 'coordination_hub',
        toAgent: analyzerRole,
        domain: A2AAgentDomain.COORDINATION,
        priority: request.priority,
        timestamp: Date.now(),
        correlationId: session.id,
        payload: {
          method: request.analysisType,
          params: {
            ...request.parameters,
            role: 'rebuttal',
            disputedFindings: disputedFindings.map(d => ({
              ...d.finding,
              challengerObjection: d.objection
            })),
            sourceFiles,
            instruction: 'The challenger disputed these findings. For each, either defend with stronger evidence or concede. Return only findings you can defend with concrete evidence.'
          }
        },
        metadata: { coordination: true, coordinationType: 'debate', debateRole: 'rebuttal' }
      };

      await this.communicationBus.routeMessage(rebuttalMessage);

      try {
        const rebuttalResult = await this.waitForAgentResponse(analyzerRole, session.id, request.timeout);
        session.results.set(`${analyzerRole}_rebuttal`, rebuttalResult);

        const defendedFindings = rebuttalResult.findings || [];
        const concededCount = disputedFindings.length - defendedFindings.length;

        // Add defended findings to the verified set
        for (const df of defendedFindings) {
          df.verificationStatus = 'defended';
          finalVerified.push(df);
        }

        totalFalsePositives += concededCount;

        debateRounds.push({
          round: 3,
          role: 'rebuttal',
          agentId: analyzerRole,
          findingsChallenged: disputedFindings.length,
          findingsVerified: defendedFindings.length,
          falsePositivesFound: concededCount,
          timestamp: Date.now()
        });

        console.log(`Round 3 (Rebuttal): ${defendedFindings.length} defended, ${concededCount} conceded`);
        totalRounds = 3;
      } catch (error) {
        console.warn(`Rebuttal round failed, proceeding without disputed findings:`, error);
        totalFalsePositives += disputedFindings.length;
      }
    } else if (disputedFindings.length > 0) {
      // Convergence is high enough -- treat disputed as rejected
      totalFalsePositives += disputedFindings.length;
      console.log(`Convergence ${(convergenceAfterRound2 * 100).toFixed(1)}% >= threshold -- skipping rebuttal, ${disputedFindings.length} disputed findings rejected`);
    }

    // === FINAL ROUND: Synthesizer produces final report ===
    const synthesizerAgent = this.communicationBus.getAgent(synthesizerRole);
    if (!synthesizerAgent) {
      console.log(`No synthesizer agent found, using debate-filtered results`);
      const filteredResult: AnalysisResult = {
        ...analyzerResult,
        findings: finalVerified
      };
      session.results.set('debate_combined', filteredResult);
      return {
        coordinationId: session.id,
        status: 'success',
        results: session.results,
        combinedResult: filteredResult,
        duration: Date.now() - session.startTime,
        participantCount: 2
      };
    }

    const convergenceFinal = candidateFindings.length > 0
      ? finalVerified.length / candidateFindings.length
      : 1.0;

    const synthesizerMessage: A2AMessage = {
      id: uuidv4(),
      type: A2AMessageType.REQUEST,
      fromAgent: 'coordination_hub',
      toAgent: synthesizerRole,
      domain: A2AAgentDomain.COORDINATION,
      priority: request.priority,
      timestamp: Date.now(),
      correlationId: session.id,
      payload: {
        method: request.analysisType,
        params: {
          ...request.parameters,
          role: 'synthesizer',
          verifiedFindings: finalVerified,
          debateRounds: debateRounds,
          falsePositiveRate: candidateFindings.length > 0 ? totalFalsePositives / candidateFindings.length : 0,
          convergenceScore: convergenceFinal,
          instruction: 'Produce a final report with only the verified findings. Rank by severity and confidence. Include debate metrics.'
        }
      },
      metadata: { coordination: true, coordinationType: 'debate', debateRole: 'synthesizer' }
    };

    await this.communicationBus.routeMessage(synthesizerMessage);
    let synthesizerResult: AnalysisResult;

    try {
      synthesizerResult = await this.waitForAgentResponse(synthesizerRole, session.id, request.timeout);
    } catch (error) {
      console.error(`Synthesizer agent failed, using debate-filtered results:`, error);
      const filteredResult: AnalysisResult = {
        ...analyzerResult,
        findings: finalVerified
      };
      return {
        coordinationId: session.id,
        status: 'partial',
        results: session.results,
        combinedResult: filteredResult,
        duration: Date.now() - session.startTime,
        participantCount: 2
      };
    }

    session.results.set(synthesizerRole, synthesizerResult);
    totalRounds++;

    debateRounds.push({
      round: totalRounds,
      role: 'synthesizer',
      agentId: synthesizerRole,
      findingsVerified: finalVerified.length,
      timestamp: Date.now()
    });

    console.log(`Round ${totalRounds} (Synthesizer): Final report produced with ${finalVerified.length} verified findings`);

    // Build debate result metadata
    const debateResult: DebateResult = {
      rounds: debateRounds,
      totalProposed: candidateFindings.length,
      totalVerified: finalVerified.length,
      totalFalsePositives: totalFalsePositives,
      falsePositiveRate: candidateFindings.length > 0 ? totalFalsePositives / candidateFindings.length : 0,
      consensusScore: convergenceFinal
    };

    const finalResult: AnalysisResult = {
      ...synthesizerResult,
      metrics: {
        ...synthesizerResult.metrics,
        debateResult
      },
      collaborationData: {
        collaborationId: session.id,
        collaborators: [analyzerRole, challengerRole, synthesizerRole],
        combinedConfidence: synthesizerResult.confidence,
        consensusAchieved: true
      }
    };

    session.results.set('debate_final', finalResult);

    return {
      coordinationId: session.id,
      status: 'success',
      results: session.results,
      combinedResult: finalResult,
      duration: Date.now() - session.startTime,
      participantCount: 3,
      consensusAchieved: true
    };
  }

  // =====================================================
  // PERSISTENCE HELPERS
  // =====================================================

  private async persistCoordinationResult(
    result: CoordinationResult,
    request: CoordinationRequest
  ): Promise<void> {
    if (!this.runPersistence) return;

    const findings = result.combinedResult?.findings || [];
    const debateResult = result.combinedResult?.metrics?.debateResult as DebateResult | undefined;

    // Count findings by severity
    const countBySeverity = (sev: string) => findings.filter((f: any) => f.severity === sev).length;
    const falsePositives = debateResult?.totalFalsePositives ?? 0;

    const runRecord: AnalysisRunRecord = {
      _key: result.coordinationId,
      repositoryId: request.parameters?.entityKey || request.parameters?.repositoryId || 'unknown',
      analysisType: request.analysisType || 'comprehensive',
      coordinationType: request.type,
      status: result.status === 'success' ? 'completed' : 'failed',
      startTime: new Date(Date.now() - result.duration).toISOString(),
      endTime: new Date().toISOString(),
      duration: result.duration,
      domains: request.targetAgents,
      participantAgents: result.combinedResult?.collaborationData?.collaborators || request.targetAgents,
      debateMetrics: debateResult ? {
        rounds: debateResult.rounds.length,
        convergenceScore: debateResult.consensusScore,
        falsePositivesEliminated: debateResult.totalFalsePositives,
        totalProposed: debateResult.totalProposed,
        totalVerified: debateResult.totalVerified
      } : undefined,
      findingsCount: {
        total: findings.length,
        critical: countBySeverity('critical'),
        high: countBySeverity('high'),
        medium: countBySeverity('medium'),
        low: countBySeverity('low'),
        info: countBySeverity('info'),
        falsePositives
      }
    };

    await this.runPersistence.saveRun(runRecord);

    // Save individual findings
    if (findings.length > 0) {
      const findingRecords: AnalysisFindingRecord[] = findings.map((f: any, idx: number) => ({
        _key: `${result.coordinationId}_f${idx}`,
        runId: result.coordinationId,
        repositoryId: runRecord.repositoryId,
        domain: f.domain || request.targetAgents[0] || 'unknown',
        type: f.type || 'unknown',
        severity: f.severity || 'info',
        title: f.title || f.description?.slice(0, 80) || 'Untitled finding',
        description: f.description || '',
        file: f.location?.file || f.file,
        line: f.location?.line || f.line,
        evidence: f.evidence || f.verificationEvidence,
        confidence: f.confidence || 0,
        verificationStatus: f.verificationStatus || 'unverified',
        verificationMethod: f.verificationMethod,
        challengerNotes: f.challengerNotes,
        remediation: f.remediation || f.recommendation,
        createdAt: new Date().toISOString()
      }));

      await this.runPersistence.saveFindings(findingRecords);

      // Extract learnings
      if (this.aiLearnings) {
        await this.aiLearnings.extractLearnings(runRecord, findingRecords);
      }
    }
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
