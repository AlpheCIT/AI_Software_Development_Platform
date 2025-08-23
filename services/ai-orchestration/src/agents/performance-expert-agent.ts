      factors.push({
        factor: 'Database Dependencies',
        impact: 'MEDIUM',
        description: 'Database operations may become bottlenecks under high load',
        mitigation_strategy: 'Implement connection pooling and query optimization'
      });
    }

    if (/memory|cache/.test(code) && this.hasMemoryLeakPatterns(code)) {
      factors.push({
        factor: 'Memory Management',
        impact: 'HIGH',
        description: 'Memory leaks will degrade performance over time',
        mitigation_strategy: 'Implement proper cleanup and garbage collection'
      });
    }

    return factors;
  }

  private predictScalabilityBottlenecks(code: string): string[] {
    const predictions = [];

    if (this.hasNestedLoops(code)) {
      predictions.push('Performance will degrade quadratically with data size');
    }

    if (this.hasNPlusOneQueries(code)) {
      predictions.push('Database will become overwhelmed with high user counts');
    }

    if (this.hasSyncIOOperations(code)) {
      predictions.push('Thread blocking will limit concurrent request handling');
    }

    if (!(/async|await|Promise/.test(code)) && /http|api/.test(code)) {
      predictions.push('Synchronous processing will limit throughput');
    }

    return predictions;
  }

  private generateScalingRecommendations(code: string): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];

    if (this.hasCachingOpportunity(code)) {
      recommendations.push({
        type: 'CACHING',
        description: 'Implement multi-level caching strategy',
        expected_benefit: '50-80% reduction in database load',
        implementation_effort: 'MEDIUM'
      });
    }

    if (this.hasAsyncOpportunity(code)) {
      recommendations.push({
        type: 'OPTIMIZATION',
        description: 'Convert to asynchronous processing',
        expected_benefit: '3-5x improvement in concurrent request handling',
        implementation_effort: 'MEDIUM'
      });
    }

    if (/database|query/.test(code)) {
      recommendations.push({
        type: 'HORIZONTAL',
        description: 'Implement database sharding or read replicas',
        expected_benefit: 'Linear scaling with database load',
        implementation_effort: 'HIGH'
      });
    }

    if (this.hasAlgorithmOptimizationOpportunity(code)) {
      recommendations.push({
        type: 'OPTIMIZATION',
        description: 'Optimize core algorithms before scaling infrastructure',
        expected_benefit: '10-100x performance improvement',
        implementation_effort: 'HIGH'
      });
    }

    return recommendations;
  }

  // ===== PERFORMANCE ASSESSMENT =====

  private async performPerformanceAssessment(entity: any): Promise<any> {
    const bottlenecks = await this.identifyBottlenecks(entity._key);
    const optimizationOpportunities = await this.suggestOptimizations(entity._key);
    
    // Calculate scores
    const overallPerformanceScore = this.calculatePerformanceScore(entity);
    const resourceEfficiencyScore = this.calculateResourceEfficiencyScore(entity);

    return {
      bottlenecks: bottlenecks,
      optimization_opportunities: optimizationOpportunities,
      overall_performance_score: overallPerformanceScore,
      resource_efficiency_score: resourceEfficiencyScore
    };
  }

  private calculatePerformanceScore(entity: any): number {
    const code = entity.source_code || '';
    let score = 100;

    // Deduct points for performance issues
    if (this.hasNestedLoops(code)) score -= 25;
    if (this.hasUnoptimizedRecursion(code)) score -= 20;
    if (this.hasSyncIOOperations(code)) score -= 30;
    if (this.hasNPlusOneQueries(code)) score -= 35;
    if (this.hasMemoryLeakPatterns(code)) score -= 20;
    if (this.lacksRequestCaching(code)) score -= 15;

    return Math.max(0, score);
  }

  private calculateResourceEfficiencyScore(entity: any): number {
    const code = entity.source_code || '';
    let score = 100;

    // Deduct points for resource inefficiency
    if (this.hasObjectCreationInLoops(code)) score -= 20;
    if (this.hasMemoryLeakPatterns(code)) score -= 25;
    if (this.hasMultipleAPICalls(code)) score -= 15;
    if (this.hasSequentialIOOperations(code)) score -= 20;
    if (!this.hasCachingOpportunity(code)) score += 10; // Bonus if already optimized

    return Math.max(0, score);
  }

  // ===== PERFORMANCE RECOMMENDATIONS =====

  private async generatePerformanceRecommendations(entity: any): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];
    const code = entity.source_code || '';

    // Algorithm optimization recommendations
    if (this.hasAlgorithmOptimizationOpportunity(code)) {
      recommendations.push({
        category: 'Algorithm Optimization',
        priority: 'CRITICAL',
        title: 'Optimize Core Algorithms',
        description: 'Replace inefficient algorithms with optimized implementations',
        implementation_effort: 'HIGH',
        expected_improvement: '70-95% performance improvement',
        business_justification: 'Fundamental performance gains that scale with usage'
      });
    }

    // Caching recommendations
    if (this.hasCachingOpportunity(code)) {
      recommendations.push({
        category: 'Caching Strategy',
        priority: 'HIGH',
        title: 'Implement Intelligent Caching',
        description: 'Add multi-level caching for frequently accessed data',
        implementation_effort: 'MEDIUM',
        expected_improvement: '50-80% response time improvement',
        business_justification: 'Improved user experience and reduced infrastructure costs'
      });
    }

    // Async processing recommendations
    if (this.hasAsyncOpportunity(code)) {
      recommendations.push({
        category: 'Asynchronous Processing',
        priority: 'HIGH',
        title: 'Convert to Async Architecture',
        description: 'Implement non-blocking asynchronous operations',
        implementation_effort: 'MEDIUM',
        expected_improvement: '3-5x throughput increase',
        business_justification: 'Better scalability and resource utilization'
      });
    }

    // Database optimization recommendations
    if (this.hasDatabaseOptimizationOpportunity(code)) {
      recommendations.push({
        category: 'Database Performance',
        priority: 'HIGH',
        title: 'Optimize Database Operations',
        description: 'Implement query optimization, indexing, and connection pooling',
        implementation_effort: 'MEDIUM',
        expected_improvement: '60-90% database performance improvement',
        business_justification: 'Reduced database costs and improved application responsiveness'
      });
    }

    // Memory optimization recommendations
    if (this.hasMemoryOptimizationOpportunity(code)) {
      recommendations.push({
        category: 'Memory Management',
        priority: 'MEDIUM',
        title: 'Optimize Memory Usage',
        description: 'Implement efficient memory management patterns',
        implementation_effort: 'MEDIUM',
        expected_improvement: '30-50% memory usage reduction',
        business_justification: 'Lower hosting costs and improved application stability'
      });
    }

    // Monitoring recommendations
    if (!(/monitor|metrics|performance/.test(code))) {
      recommendations.push({
        category: 'Performance Monitoring',
        priority: 'MEDIUM',
        title: 'Add Performance Monitoring',
        description: 'Implement comprehensive performance tracking and alerting',
        implementation_effort: 'LOW',
        expected_improvement: 'Early detection of performance issues',
        business_justification: 'Proactive performance management and faster issue resolution'
      });
    }

    return recommendations;
  }

  // ===== DATABASE OPERATIONS =====

  private async getEntityDetails(entityId: string): Promise<any> {
    try {
      const query = `
        FOR entity IN code_entities
          FILTER entity._key == @entityId
          RETURN entity
      `;
      
      const result = await this.db.query(query, { entityId });
      return await result.next();
    } catch (error) {
      console.error(`❌ Failed to get entity details:`, error);
      return null;
    }
  }

  private async storeAnalysisResults(entityId: string, results: PerformanceAnalysisResult): Promise<void> {
    try {
      const analysisDoc = {
        entity_id: entityId,
        agent_id: this.agentId,
        analysis_type: 'performance_analysis',
        results: results,
        confidence_score: this.confidence,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      await this.db.collection('doc_agent_analyses').save(analysisDoc);
      console.log(`✅ Performance analysis results stored for entity ${entityId}`);
    } catch (error) {
      console.error(`❌ Failed to store analysis results:`, error);
    }
  }

  // ===== AGENT INTERFACE METHODS (CCI Framework Compatibility) =====

  getId(): string {
    return this.agentId;
  }

  getExpertise(): string[] {
    return this.expertise;
  }

  getConfidence(): number {
    return this.confidence;
  }

  async initialize(): Promise<void> {
    console.log(`⚡ Initializing Performance Expert Agent ${this.agentId}...`);
    this.confidence = 0.82; // High confidence in performance analysis
    console.log(`✅ Performance Expert Agent initialized with confidence: ${this.confidence}`);
  }

  async processEntity(entityId: string): Promise<any> {
    return await this.analyzePerformance(entityId);
  }

  getCapabilities(): string[] {
    return [
      'bottleneck_identification',
      'optimization_recommendations',
      'resource_usage_analysis',
      'scalability_assessment',
      'algorithm_optimization',
      'performance_scoring'
    ];
  }

  // ===== PUBLIC API METHODS =====

  async analyzeResourceUtilization(entityId: string): Promise<any> {
    const entity = await this.getEntityDetails(entityId);
    if (!entity) return null;

    return await this.analyzeResourceUsage(entity);
  }

  async getOptimizationPlan(entityId: string): Promise<any> {
    const entity = await this.getEntityDetails(entityId);
    if (!entity) return null;

    const bottlenecks = await this.identifyBottlenecks(entityId);
    const optimizations = await this.suggestOptimizations(entityId);
    const recommendations = await this.generatePerformanceRecommendations(entity);

    return {
      entity_id: entityId,
      current_performance_score: this.calculatePerformanceScore(entity),
      bottlenecks: bottlenecks,
      optimization_opportunities: optimizations,
      recommendations: recommendations,
      implementation_priority: this.prioritizeOptimizations(bottlenecks, optimizations),
      estimated_timeline: this.estimateImplementationTimeline(optimizations)
    };
  }

  private prioritizeOptimizations(bottlenecks: PerformanceBottleneck[], optimizations: OptimizationOpportunity[]): any[] {
    const combined = [
      ...bottlenecks.map(b => ({ ...b, source: 'bottleneck' })),
      ...optimizations.map(o => ({ ...o, source: 'optimization' }))
    ];

    return combined
      .sort((a, b) => {
        const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
               (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
      })
      .slice(0, 10); // Top 10 priorities
  }

  private estimateImplementationTimeline(optimizations: OptimizationOpportunity[]): string {
    const complexityHours = {
      'LOW': 8,
      'MEDIUM': 24,
      'HIGH': 72
    };

    const totalHours = optimizations.reduce((sum, opt) => {
      return sum + (complexityHours[opt.implementation_complexity] || 24);
    }, 0);

    if (totalHours <= 40) return '1 week';
    if (totalHours <= 120) return '2-3 weeks';
    if (totalHours <= 240) return '1-2 months';
    return '2+ months';
  }
}

export default PerformanceExpertAgent;
