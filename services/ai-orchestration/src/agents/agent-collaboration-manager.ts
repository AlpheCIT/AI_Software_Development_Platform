      // Calculate security score (inverse of risk score)
      const criticalVulns = securityAnalysis.vulnerability_assessment?.critical_vulnerabilities?.length || 0;
      const mediumVulns = securityAnalysis.vulnerability_assessment?.medium_vulnerabilities?.length || 0;
      const lowVulns = securityAnalysis.vulnerability_assessment?.low_vulnerabilities?.length || 0;
      
      assessment.security_score = Math.max(0, 100 - (criticalVulns * 30) - (mediumVulns * 10) - (lowVulns * 2));
      
      if (securityAnalysis.threat_analysis?.threat_level) {
        assessment.risk_level = securityAnalysis.threat_analysis.threat_level;
      }
    }

    if (performanceAnalysis) {
      assessment.performance_score = performanceAnalysis.performance_assessment?.overall_performance_score || 0;
    }

    // Calculate overall health
    const avgScore = (assessment.security_score + assessment.performance_score) / 2;
    if (avgScore >= 80) assessment.overall_health = 'EXCELLENT';
    else if (avgScore >= 65) assessment.overall_health = 'GOOD';
    else if (avgScore >= 50) assessment.overall_health = 'FAIR';
    else assessment.overall_health = 'POOR';

    // Count total recommendations
    const securityRecsCount = securityAnalysis?.security_recommendations?.length || 0;
    const performanceRecsCount = performanceAnalysis?.performance_recommendations?.length || 0;
    assessment.recommendations_count = securityRecsCount + performanceRecsCount;

    return assessment;
  }

  private identifyCriticalIssues(securityAnalysis: any, performanceAnalysis: any): any[] {
    const criticalIssues = [];

    // Critical security issues
    if (securityAnalysis?.vulnerability_assessment?.critical_vulnerabilities) {
      for (const vuln of securityAnalysis.vulnerability_assessment.critical_vulnerabilities) {
        criticalIssues.push({
          type: 'SECURITY',
          severity: 'CRITICAL',
          title: vuln.type,
          description: vuln.description,
          impact: 'High security risk - immediate attention required',
          source_agent: 'security_expert_001'
        });
      }
    }

    // Critical performance issues
    if (performanceAnalysis?.performance_assessment?.bottlenecks) {
      const criticalBottlenecks = performanceAnalysis.performance_assessment.bottlenecks.filter(
        (b: any) => b.severity === 'CRITICAL'
      );
      
      for (const bottleneck of criticalBottlenecks) {
        criticalIssues.push({
          type: 'PERFORMANCE',
          severity: 'CRITICAL',
          title: bottleneck.description,
          description: bottleneck.optimization_strategy,
          impact: 'Severe performance degradation - affects user experience',
          source_agent: 'performance_expert_001'
        });
      }
    }

    return criticalIssues.slice(0, 5); // Top 5 critical issues
  }

  private identifyImprovementOpportunities(securityAnalysis: any, performanceAnalysis: any): any[] {
    const opportunities = [];

    // Security improvement opportunities
    if (securityAnalysis?.security_recommendations) {
      const highPrioritySecRecs = securityAnalysis.security_recommendations.filter(
        (rec: any) => rec.priority === 'HIGH'
      );
      
      for (const rec of highPrioritySecRecs.slice(0, 3)) {
        opportunities.push({
          category: 'Security Enhancement',
          title: rec.title,
          description: rec.description,
          expected_benefit: 'Improved security posture and compliance',
          effort_required: rec.implementation_effort,
          source_agent: 'security_expert_001'
        });
      }
    }

    // Performance improvement opportunities
    if (performanceAnalysis?.performance_assessment?.optimization_opportunities) {
      const highPriorityPerfOpts = performanceAnalysis.performance_assessment.optimization_opportunities.filter(
        (opt: any) => opt.priority === 'HIGH'
      );
      
      for (const opt of highPriorityPerfOpts.slice(0, 3)) {
        opportunities.push({
          category: 'Performance Optimization',
          title: opt.title,
          description: opt.description,
          expected_benefit: opt.estimated_improvement,
          effort_required: opt.implementation_complexity,
          source_agent: 'performance_expert_001'
        });
      }
    }

    return opportunities;
  }

  private generateBusinessImpactSummary(securityAnalysis: any, performanceAnalysis: any): any {
    const businessImpact = {
      risk_factors: [],
      cost_implications: [],
      user_experience_impact: [],
      compliance_considerations: [],
      competitive_advantages: []
    };

    // Security business impact
    if (securityAnalysis) {
      if (securityAnalysis.threat_analysis?.threat_level === 'CRITICAL' || securityAnalysis.threat_analysis?.threat_level === 'HIGH') {
        businessImpact.risk_factors.push('High security risk may lead to data breaches and regulatory penalties');
        businessImpact.cost_implications.push('Potential costs from security incidents and compliance violations');
      }

      if (securityAnalysis.compliance_assessment?.violations?.length > 0) {
        businessImpact.compliance_considerations.push('Security compliance violations may affect business partnerships');
      }
    }

    // Performance business impact
    if (performanceAnalysis) {
      const performanceScore = performanceAnalysis.performance_assessment?.overall_performance_score || 0;
      
      if (performanceScore < 50) {
        businessImpact.user_experience_impact.push('Poor performance may lead to user churn and reduced engagement');
        businessImpact.cost_implications.push('Higher infrastructure costs due to inefficient resource usage');
      }

      if (performanceAnalysis.scalability_assessment?.scaling_recommendations?.length > 0) {
        businessImpact.competitive_advantages.push('Performance optimization can provide competitive edge');
      }
    }

    return businessImpact;
  }

  private generateImplementationRoadmap(securityAnalysis: any, performanceAnalysis: any): any {
    const roadmap = {
      immediate_actions: [], // 0-2 weeks
      short_term_goals: [],  // 2-8 weeks
      long_term_objectives: [] // 2+ months
    };

    // Immediate actions (critical issues)
    if (securityAnalysis?.vulnerability_assessment?.critical_vulnerabilities?.length > 0) {
      roadmap.immediate_actions.push({
        action: 'Address critical security vulnerabilities',
        timeline: '1-2 weeks',
        priority: 'CRITICAL',
        resources_needed: 'Security team, immediate code fixes'
      });
    }

    if (performanceAnalysis?.performance_assessment?.bottlenecks?.some((b: any) => b.severity === 'CRITICAL')) {
      roadmap.immediate_actions.push({
        action: 'Fix critical performance bottlenecks',
        timeline: '1-2 weeks',
        priority: 'CRITICAL',
        resources_needed: 'Development team, performance monitoring tools'
      });
    }

    // Short-term goals
    const highPrioritySecRecs = securityAnalysis?.security_recommendations?.filter(
      (rec: any) => rec.priority === 'HIGH'
    ) || [];

    const highPriorityPerfRecs = performanceAnalysis?.performance_recommendations?.filter(
      (rec: any) => rec.priority === 'HIGH'
    ) || [];

    for (const rec of [...highPrioritySecRecs, ...highPriorityPerfRecs].slice(0, 4)) {
      roadmap.short_term_goals.push({
        action: rec.title,
        timeline: '2-6 weeks',
        priority: 'HIGH',
        resources_needed: this.mapImplementationEffortToResources(rec.implementation_effort)
      });
    }

    // Long-term objectives
    roadmap.long_term_objectives.push({
      action: 'Implement comprehensive monitoring and alerting',
      timeline: '2-3 months',
      priority: 'MEDIUM',
      resources_needed: 'DevOps team, monitoring infrastructure'
    });

    roadmap.long_term_objectives.push({
      action: 'Establish security and performance review processes',
      timeline: '3-6 months',
      priority: 'MEDIUM',
      resources_needed: 'Process documentation, team training'
    });

    return roadmap;
  }

  // ===== UTILITY METHODS =====

  private calculateContributionWeight(agent: any): number {
    // Weight based on agent confidence and expertise breadth
    const confidence = agent.getConfidence();
    const expertiseCount = agent.getExpertise().length;
    
    return confidence * (1 + (expertiseCount * 0.1));
  }

  private calculateCoordinationOverhead(totalTime: number, analysisResults: any): number {
    // Calculate time spent on coordination vs actual analysis
    const actualAnalysisTime = Object.values(analysisResults)
      .filter((result: any) => result.processing_time)
      .reduce((sum: number, result: any) => sum + result.processing_time, 0);

    return Math.max(0, totalTime - actualAnalysisTime);
  }

  private extractOverallPriority(analysis: any): string {
    // Extract overall priority from analysis recommendations
    if (!analysis) return 'UNKNOWN';

    const recommendations = analysis.security_recommendations || analysis.performance_recommendations || [];
    
    if (recommendations.some((rec: any) => rec.priority === 'CRITICAL')) return 'CRITICAL';
    if (recommendations.some((rec: any) => rec.priority === 'HIGH')) return 'HIGH';
    if (recommendations.some((rec: any) => rec.priority === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  private countRecommendationConflicts(securityAnalysis: any, performanceAnalysis: any): number {
    // Simple conflict detection - in practice, this would be more sophisticated
    let conflicts = 0;

    const securityRecs = securityAnalysis?.security_recommendations || [];
    const performanceRecs = performanceAnalysis?.performance_recommendations || [];

    // Check for encryption vs performance conflicts
    const hasEncryptionRec = securityRecs.some((rec: any) => 
      rec.title?.toLowerCase().includes('encrypt')
    );
    const hasPerformanceOptRec = performanceRecs.some((rec: any) => 
      rec.title?.toLowerCase().includes('optim')
    );

    if (hasEncryptionRec && hasPerformanceOptRec) conflicts++;

    return conflicts;
  }

  private mapImplementationEffortToResources(effort: string): string {
    switch (effort) {
      case 'LOW': return '1-2 developers, 1 week';
      case 'MEDIUM': return '2-3 developers, 2-4 weeks';
      case 'HIGH': return '3-5 developers, 4-8 weeks, architecture review';
      default: return '2-3 developers, 2-4 weeks';
    }
  }

  // ===== DATABASE OPERATIONS =====

  private async storeCollaborationResult(result: CollaborationResult): Promise<void> {
    try {
      const collaborationDoc = {
        collaboration_id: result.collaboration_id,
        entity_id: result.entity_id,
        participating_agents: result.participating_agents,
        analysis_results: result.analysis_results,
        consensus_analysis: result.consensus_analysis,
        collaboration_metadata: result.collaboration_metadata,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      await this.db.collection('doc_agent_collaborations').save(collaborationDoc);
      console.log(`✅ Collaboration result stored: ${result.collaboration_id}`);
    } catch (error) {
      console.error(`❌ Failed to store collaboration result:`, error);
    }
  }

  // ===== PUBLIC API METHODS =====

  async getAvailableAgents(): Promise<string[]> {
    return Array.from(this.agents.keys());
  }

  async getAgentCapabilities(): Promise<any> {
    const capabilities: any = {};
    
    for (const [agentType, agent] of this.agents) {
      capabilities[agentType] = {
        agent_id: agent.getId(),
        expertise: agent.getExpertise(),
        capabilities: agent.getCapabilities(),
        confidence: agent.getConfidence()
      };
    }

    return capabilities;
  }

  async getCollaborationHistory(entityId?: string): Promise<CollaborationResult[]> {
    try {
      let query = `FOR collab IN doc_agent_collaborations`;
      let bindVars: any = {};

      if (entityId) {
        query += ` FILTER collab.entity_id == @entityId`;
        bindVars.entityId = entityId;
      }

      query += ` SORT collab.created_at DESC LIMIT 10 RETURN collab`;

      const result = await this.db.query(query, bindVars);
      return await result.all();
    } catch (error) {
      console.error(`❌ Failed to get collaboration history:`, error);
      return [];
    }
  }

  async getCollaborationMetrics(): Promise<any> {
    try {
      const metricsQuery = `
        FOR collab IN doc_agent_collaborations
          COLLECT 
            agent_count = LENGTH(collab.participating_agents),
            consensus_level = ROUND(collab.consensus_analysis.consensus_level, 2)
          AGGREGATE 
            total_collaborations = LENGTH(collab),
            avg_processing_time = AVG(collab.collaboration_metadata.total_processing_time_ms),
            avg_confidence = AVG(collab.consensus_analysis.overall_confidence)
          RETURN {
            agent_count: agent_count,
            consensus_level: consensus_level,
            total_collaborations: total_collaborations,
            avg_processing_time_ms: avg_processing_time,
            avg_confidence_score: avg_confidence
          }
      `;

      const result = await this.db.query(metricsQuery);
      return await result.all();
    } catch (error) {
      console.error(`❌ Failed to get collaboration metrics:`, error);
      return [];
    }
  }

  // ===== CCI FRAMEWORK COMPATIBILITY METHODS =====

  getId(): string {
    return 'agent_collaboration_manager_001';
  }

  getActiveCollaborations(): Map<string, CollaborationResult> {
    return this.activeCollaborations;
  }

  getRegisteredAgents(): Map<string, any> {
    return this.agents;
  }

  async registerAgent(agentType: string, agent: any): Promise<void> {
    console.log(`🔧 Registering agent: ${agentType}`);
    
    if (typeof agent.initialize === 'function') {
      await agent.initialize();
    }
    
    this.agents.set(agentType, agent);
    console.log(`✅ Agent registered: ${agentType} (${agent.getId()})`);
  }

  async unregisterAgent(agentType: string): Promise<void> {
    console.log(`🔧 Unregistering agent: ${agentType}`);
    
    const agent = this.agents.get(agentType);
    if (agent && typeof agent.shutdown === 'function') {
      await agent.shutdown();
    }
    
    this.agents.delete(agentType);
    console.log(`✅ Agent unregistered: ${agentType}`);
  }

  getFrameworkStatus(): any {
    return {
      manager_id: this.getId(),
      registered_agents: this.getAvailableAgents(),
      active_collaborations: this.activeCollaborations.size,
      collaboration_capabilities: [
        'multi_agent_analysis',
        'consensus_building',
        'conflict_resolution',
        'unified_recommendations',
        'business_impact_analysis'
      ]
    };
  }
}

export default AgentCollaborationManager;
