// 🧭 Code Navigation Agent - Inspired by A2A Framework
// Advanced code traversal and function call tracing capabilities

import { Database } from 'arangojs';
import { A2ACommunicationBus } from '../communication/a2a-communication-bus.js';

export interface NavigationResult {
  entityId: string;
  pathTrace: NavigationPath[];
  totalDepth: number;
  confidenceScore: number;
  relationshipTypes: string[];
  findings: NavigationFinding[];
  recommendations: NavigationRecommendation[];
}

export interface NavigationPath {
  step: number;
  fromEntity: string;
  toEntity: string;
  relationshipType: string;
  confidence: number;
  metadata?: any;
}

export interface NavigationFinding {
  type: 'circular_dependency' | 'dead_end' | 'high_coupling' | 'bottleneck' | 'orphaned_code';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedEntities: string[];
  evidence: string;
}

export interface NavigationRecommendation {
  category: 'Refactoring' | 'Architecture' | 'Performance' | 'Maintainability';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  implementation_effort: 'LOW' | 'MEDIUM' | 'HIGH';
  expected_benefit: string;
}

export class CodeNavigationAgent {
  private db: Database;
  private communicationBus: A2ACommunicationBus;
  private agentId: string;
  private capabilities: string[];

  constructor(communicationBus: A2ACommunicationBus) {
    this.communicationBus = communicationBus;
    this.agentId = 'navigation_agent_001';
    this.capabilities = [
      'code_traversal',
      'function_call_tracing',
      'dependency_path_finding',
      'circular_dependency_detection',
      'code_coupling_analysis',
      'orphaned_code_detection'
    ];

    // Initialize database connection
    this.db = new Database({
      url: process.env.ARANGO_URL || 'http://192.168.1.82:8529',
      databaseName: process.env.ARANGO_DATABASE || 'ARANGO_AISDP_DB',
      auth: {
        username: process.env.ARANGO_USER || 'root',
        password: process.env.ARANGO_PASSWORD || ''
      }
    });
  }

  async initialize(): Promise<void> {
    console.log(`🧭 Initializing Code Navigation Agent ${this.agentId}...`);
    
    // Register with communication bus
    await this.communicationBus.registerAgent(this.agentId, this.capabilities);
    
    // Set up message handler
    this.communicationBus.registerMessageHandler(this.agentId, this.handleMessage.bind(this));
    
    console.log(`✅ Code Navigation Agent initialized`);
  }

  // ===== MAIN NAVIGATION METHODS =====

  async traceFunctionCalls(
    entityKey: string, 
    options: {
      maxDepth?: number;
      confidenceThreshold?: number;
      relationshipTypes?: string[];
      includeInbound?: boolean;
    } = {}
  ): Promise<NavigationResult> {
    
    console.log(`🧭 Tracing function calls from entity: ${entityKey}`);
    
    const startTime = Date.now();
    const maxDepth = options.maxDepth || 5;
    const confidenceThreshold = options.confidenceThreshold || 0.8;
    const relationshipTypes = options.relationshipTypes || ['calls', 'depends_on', 'imports'];
    const includeInbound = options.includeInbound || false;

    try {
      // Update agent status
      this.communicationBus.updateAgentStatus(this.agentId, { 
        status: 'busy', 
        currentTasks: 1 
      });

      // Perform the navigation
      const pathTrace = await this.performCodeTraversal(
        entityKey, 
        maxDepth, 
        confidenceThreshold, 
        relationshipTypes,
        includeInbound
      );

      // Analyze findings
      const findings = await this.analyzeNavigationFindings(pathTrace);
      const recommendations = await this.generateNavigationRecommendations(findings);

      // Calculate overall confidence
      const confidenceScore = this.calculateOverallConfidence(pathTrace);

      const result: NavigationResult = {
        entityId: entityKey,
        pathTrace: pathTrace,
        totalDepth: Math.max(...pathTrace.map(p => p.step), 0),
        confidenceScore: confidenceScore,
        relationshipTypes: relationshipTypes,
        findings: findings,
        recommendations: recommendations
      };

      // Update agent status
      this.communicationBus.updateAgentStatus(this.agentId, { 
        status: 'active', 
        currentTasks: 0 
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ Function call tracing completed in ${processingTime}ms`);
      console.log(`   Paths found: ${pathTrace.length}`);
      console.log(`   Max depth reached: ${result.totalDepth}`);
      console.log(`   Findings: ${findings.length}`);

      return result;

    } catch (error) {
      this.communicationBus.updateAgentStatus(this.agentId, { 
        status: 'error', 
        currentTasks: 0 
      });
      console.error(`❌ Function call tracing failed:`, error);
      throw error;
    }
  }

  private async performCodeTraversal(
    startEntity: string,
    maxDepth: number,
    confidenceThreshold: number,
    relationshipTypes: string[],
    includeInbound: boolean
  ): Promise<NavigationPath[]> {

    const paths: NavigationPath[] = [];
    const visited = new Set<string>();
    const queue: { entity: string; depth: number; path: NavigationPath[] }[] = [
      { entity: startEntity, depth: 0, path: [] }
    ];

    console.log(`🔍 Starting traversal from ${startEntity} (max depth: ${maxDepth})`);

    try {
      while (queue.length > 0) {
        const { entity, depth, path } = queue.shift()!;

        if (depth >= maxDepth || visited.has(entity)) {
          continue;
        }

        visited.add(entity);

        // Get outbound relationships
        const outboundQuery = `
          FOR v, e IN 1..1 OUTBOUND @startEntity calls, depends_on, imports
            FILTER e.confidence >= @threshold OR e.confidence == null
            FILTER e.relationship_type IN @relationshipTypes OR @relationshipTypes == []
            RETURN {
              toEntity: v._key,
              relationshipType: e.relationship_type || "calls",
              confidence: e.confidence || 0.8,
              metadata: e
            }
        `;

        const result = await this.db.query(outboundQuery, {
          startEntity: `code_entities/${entity}`,
          threshold: confidenceThreshold,
          relationshipTypes: relationshipTypes.length > 0 ? relationshipTypes : ['calls', 'depends_on', 'imports']
        });

        const relationships = await result.all();

        for (const rel of relationships) {
          const newPath: NavigationPath = {
            step: depth + 1,
            fromEntity: entity,
            toEntity: rel.toEntity,
            relationshipType: rel.relationshipType,
            confidence: rel.confidence,
            metadata: rel.metadata
          };

          paths.push(newPath);

          // Add to queue for further traversal
          if (depth + 1 < maxDepth) {
            queue.push({
              entity: rel.toEntity,
              depth: depth + 1,
              path: [...path, newPath]
            });
          }
        }

        // Get inbound relationships if requested
        if (includeInbound) {
          const inboundQuery = `
            FOR v, e IN 1..1 INBOUND @startEntity calls, depends_on, imports
              FILTER e.confidence >= @threshold OR e.confidence == null
              FILTER e.relationship_type IN @relationshipTypes OR @relationshipTypes == []
              RETURN {
                fromEntity: v._key,
                relationshipType: e.relationship_type || "calls",
                confidence: e.confidence || 0.8,
                metadata: e
              }
          `;

          const inboundResult = await this.db.query(inboundQuery, {
            startEntity: `code_entities/${entity}`,
            threshold: confidenceThreshold,
            relationshipTypes: relationshipTypes.length > 0 ? relationshipTypes : ['calls', 'depends_on', 'imports']
          });

          const inboundRelationships = await inboundResult.all();

          for (const rel of inboundRelationships) {
            const newPath: NavigationPath = {
              step: depth + 1,
              fromEntity: rel.fromEntity,
              toEntity: entity,
              relationshipType: rel.relationshipType,
              confidence: rel.confidence,
              metadata: rel.metadata
            };

            paths.push(newPath);
          }
        }
      }

      console.log(`   Found ${paths.length} relationship paths`);
      return paths;

    } catch (error) {
      console.error(`❌ Code traversal failed:`, error);
      return paths; // Return partial results
    }
  }

  // ===== ANALYSIS METHODS =====

  private async analyzeNavigationFindings(paths: NavigationPath[]): Promise<NavigationFinding[]> {
    const findings: NavigationFinding[] = [];

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(paths);
    findings.push(...circularDependencies);

    // Detect high coupling
    const highCoupling = this.detectHighCoupling(paths);
    findings.push(...highCoupling);

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(paths);
    findings.push(...bottlenecks);

    // Detect dead ends
    const deadEnds = this.detectDeadEnds(paths);
    findings.push(...deadEnds);

    return findings;
  }

  private detectCircularDependencies(paths: NavigationPath[]): NavigationFinding[] {
    const findings: NavigationFinding[] = [];
    const pathsByEntity = new Map<string, NavigationPath[]>();

    // Group paths by entity
    for (const path of paths) {
      if (!pathsByEntity.has(path.fromEntity)) {
        pathsByEntity.set(path.fromEntity, []);
      }
      pathsByEntity.get(path.fromEntity)!.push(path);
    }

    // Look for cycles
    for (const [entity, entityPaths] of pathsByEntity) {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      if (this.hasCycle(entity, entityPaths, pathsByEntity, visited, recursionStack)) {
        findings.push({
          type: 'circular_dependency',
          description: `Circular dependency detected involving entity: ${entity}`,
          severity: 'HIGH',
          affectedEntities: [entity],
          evidence: `Entity ${entity} has circular references in its call graph`
        });
      }
    }

    return findings;
  }

  private detectHighCoupling(paths: NavigationPath[]): NavigationFinding[] {
    const findings: NavigationFinding[] = [];
    const couplingCounts = new Map<string, number>();

    // Count relationships per entity
    for (const path of paths) {
      couplingCounts.set(path.fromEntity, (couplingCounts.get(path.fromEntity) || 0) + 1);
      couplingCounts.set(path.toEntity, (couplingCounts.get(path.toEntity) || 0) + 1);
    }

    // Find highly coupled entities (threshold: >10 relationships)
    for (const [entity, count] of couplingCounts) {
      if (count > 10) {
        findings.push({
          type: 'high_coupling',
          description: `Entity ${entity} has high coupling with ${count} relationships`,
          severity: count > 20 ? 'CRITICAL' : 'HIGH',
          affectedEntities: [entity],
          evidence: `Entity participates in ${count} relationships, indicating tight coupling`
        });
      }
    }

    return findings;
  }

  private detectBottlenecks(paths: NavigationPath[]): NavigationFinding[] {
    const findings: NavigationFinding[] = [];
    const throughputCounts = new Map<string, number>();

    // Count how many paths pass through each entity
    for (const path of paths) {
      throughputCounts.set(path.fromEntity, (throughputCounts.get(path.fromEntity) || 0) + 1);
      throughputCounts.set(path.toEntity, (throughputCounts.get(path.toEntity) || 0) + 1);
    }

    // Find bottlenecks (entities with high throughput)
    const avgThroughput = Array.from(throughputCounts.values()).reduce((a, b) => a + b, 0) / throughputCounts.size;
    const threshold = avgThroughput * 2; // 2x average

    for (const [entity, count] of throughputCounts) {
      if (count > threshold && count > 5) {
        findings.push({
          type: 'bottleneck',
          description: `Entity ${entity} appears to be a bottleneck with ${count} path traversals`,
          severity: count > threshold * 2 ? 'CRITICAL' : 'MEDIUM',
          affectedEntities: [entity],
          evidence: `Entity appears in ${count} paths (${(count / avgThroughput).toFixed(1)}x average)`
        });
      }
    }

    return findings;
  }

  private detectDeadEnds(paths: NavigationPath[]): NavigationFinding[] {
    const findings: NavigationFinding[] = [];
    const outgoingCounts = new Map<string, number>();
    const incomingCounts = new Map<string, number>();

    // Count outgoing and incoming relationships
    for (const path of paths) {
      outgoingCounts.set(path.fromEntity, (outgoingCounts.get(path.fromEntity) || 0) + 1);
      incomingCounts.set(path.toEntity, (incomingCounts.get(path.toEntity) || 0) + 1);
    }

    // Find entities with incoming but no outgoing relationships (potential dead ends)
    for (const [entity, incomingCount] of incomingCounts) {
      const outgoingCount = outgoingCounts.get(entity) || 0;
      
      if (incomingCount > 0 && outgoingCount === 0) {
        findings.push({
          type: 'dead_end',
          description: `Entity ${entity} appears to be a dead end (${incomingCount} incoming, 0 outgoing)`,
          severity: 'LOW',
          affectedEntities: [entity],
          evidence: `Entity receives ${incomingCount} calls but makes no outgoing calls`
        });
      }
    }

    return findings;
  }

  private hasCycle(
    entity: string,
    entityPaths: NavigationPath[],
    allPaths: Map<string, NavigationPath[]>,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(entity);
    recursionStack.add(entity);

    for (const path of entityPaths) {
      const nextEntity = path.toEntity;
      
      if (!visited.has(nextEntity)) {
        const nextPaths = allPaths.get(nextEntity) || [];
        if (this.hasCycle(nextEntity, nextPaths, allPaths, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(nextEntity)) {
        return true; // Cycle detected
      }
    }

    recursionStack.delete(entity);
    return false;
  }

  // ===== RECOMMENDATION GENERATION =====

  private async generateNavigationRecommendations(findings: NavigationFinding[]): Promise<NavigationRecommendation[]> {
    const recommendations: NavigationRecommendation[] = [];

    for (const finding of findings) {
      switch (finding.type) {
        case 'circular_dependency':
          recommendations.push({
            category: 'Architecture',
            priority: 'HIGH',
            title: 'Resolve Circular Dependencies',
            description: 'Break circular dependencies through dependency injection or interface abstraction',
            implementation_effort: 'MEDIUM',
            expected_benefit: 'Improved modularity and reduced coupling'
          });
          break;

        case 'high_coupling':
          recommendations.push({
            category: 'Refactoring',
            priority: 'MEDIUM',
            title: 'Reduce Coupling',
            description: 'Extract common functionality and reduce direct dependencies',
            implementation_effort: 'MEDIUM',
            expected_benefit: 'Better maintainability and testability'
          });
          break;

        case 'bottleneck':
          recommendations.push({
            category: 'Performance',
            priority: 'HIGH',
            title: 'Address Performance Bottleneck',
            description: 'Optimize or parallelize frequently accessed code paths',
            implementation_effort: 'HIGH',
            expected_benefit: 'Improved system performance and scalability'
          });
          break;

        case 'dead_end':
          recommendations.push({
            category: 'Maintainability',
            priority: 'LOW',
            title: 'Review Dead End Code',
            description: 'Verify if dead end code is intentional or can be refactored',
            implementation_effort: 'LOW',
            expected_benefit: 'Cleaner codebase and better understanding'
          });
          break;
      }
    }

    return recommendations;
  }

  // ===== UTILITY METHODS =====

  private calculateOverallConfidence(paths: NavigationPath[]): number {
    if (paths.length === 0) return 0;

    const totalConfidence = paths.reduce((sum, path) => sum + path.confidence, 0);
    return totalConfidence / paths.length;
  }

  // ===== MESSAGE HANDLING =====

  private async handleMessage(message: any): Promise<void> {
    console.log(`📨 Navigation Agent received message: ${message.type}`);
    
    try {
      switch (message.type) {
        case 'request':
          if (message.payload.action === 'trace_function_calls') {
            const result = await this.traceFunctionCalls(
              message.payload.entityKey,
              message.payload.options
            );
            
            // Send response back
            await this.communicationBus.sendMessage({
              from: this.agentId,
              to: message.from,
              type: 'response',
              payload: result,
              priority: 'medium'
            });
          }
          break;

        case 'status':
          // Handle status requests
          break;
      }
    } catch (error) {
      console.error(`❌ Error handling message:`, error);
      
      // Send error response
      await this.communicationBus.sendMessage({
        from: this.agentId,
        to: message.from,
        type: 'response',
        payload: { error: error.message },
        priority: 'high'
      });
    }
  }

  // ===== PUBLIC API =====

  getId(): string {
    return this.agentId;
  }

  getCapabilities(): string[] {
    return this.capabilities;
  }

  async shutdown(): Promise<void> {
    console.log(`🛑 Shutting down Navigation Agent ${this.agentId}...`);
    await this.communicationBus.unregisterAgent(this.agentId);
    console.log(`✅ Navigation Agent shutdown complete`);
  }
}

export default CodeNavigationAgent;
