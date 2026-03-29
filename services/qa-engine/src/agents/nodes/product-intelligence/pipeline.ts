import { productManagerNode, ProductRoadmap } from './product-manager';
import { researchAssistantNode, ResearchInsights } from './research-assistant';
import { codeQualityArchitectNode, CodeQualityReport } from './code-quality-architect';
import { selfHealerNode, SelfHealingReport } from '../self-healer';
import { apiValidatorNode, APIValidationReport } from '../api-validator';
import { coverageAuditorNode, CoverageAuditReport } from '../coverage-auditor';
import { uiUxAnalystNode, UIAuditReport } from '../ui-ux-analyst';
import { businessContextAnalyzerNode, BusinessContext } from '../business-context-analyzer';
import { QA_COLLECTIONS } from '../../../graph/collections';

export interface DspySecurityFinding {
  type: string;
  severity: string;
  line?: number;
  evidence: string;
  description: string;
  remediation: string;
  verified: boolean;
  confidence: number;
  verification_evidence: string;
  business_impact: string;
  priority: string;
  remediation_effort: string;
}

export interface ProductIntelligenceResult {
  businessContext?: BusinessContext;
  roadmap: ProductRoadmap;
  research: ResearchInsights;
  codeQuality: CodeQualityReport;
  selfHealing?: SelfHealingReport;
  apiValidation?: APIValidationReport;
  coverageAudit?: CoverageAuditReport;
  uiAudit?: UIAuditReport;
  dspySecurityFindings?: DspySecurityFinding[];
  combinedPriorities: CombinedPriority[];
}

export interface CombinedPriority {
  rank: number;
  title: string;
  source: 'product-manager' | 'research-assistant' | 'combined';
  description: string;
  impact: string;
  effort: string;
  category: string;
  monopolyPotential: boolean;
}

export async function runProductIntelligencePipeline(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  repositoryId: string,
  runId: string,
  dbClient: any,
  eventPublisher?: any
): Promise<ProductIntelligenceResult> {
  console.log(`[ProductIntelligence] Starting pipeline for ${repoUrl}`);

  // Step 0: Discover business context (runs first, lightweight single LLM call)
  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'business-context',
    progress: 0,
    message: 'Business Context Analyzer discovering application type and critical flows...',
  });

  const businessContext = await businessContextAnalyzerNode(
    codeFiles, codeEntities, repoUrl, runId, eventPublisher
  );

  // Build a context prompt string that all downstream agents can use
  const businessContextPrompt = businessContext && businessContext.appType !== 'Unknown' ? `
## Application Context
This is a ${businessContext.appType}.
Key domains: ${businessContext.businessDomains?.join(', ')}
Critical flows: ${businessContext.criticalFlows?.join('; ')}
Tech stack: ${businessContext.techStack?.join(', ')}

IMPORTANT: Tailor your analysis to this specific application type. Generic findings like "add optional chaining" are not useful. Focus on issues that affect the business-critical flows.
` : '';

  // Attach businessContextPrompt to codeFiles metadata so agents can access it
  // We pass it via a synthetic first entry that agents can detect
  const enrichedCodeFiles = businessContextPrompt
    ? [{ path: '__business_context__', language: 'metadata', size: 0, content: businessContextPrompt }, ...codeFiles]
    : codeFiles;

  // Step 1: Code Quality Architect runs FIRST so PM gets the health score
  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'code-quality-architect',
    progress: 0,
    message: 'Code Quality Architect auditing codebase for smells, duplication, and refactoring...',
  });

  const codeQuality = await codeQualityArchitectNode(
    enrichedCodeFiles,
    codeEntities,
    repoUrl,
    runId,
    dbClient,
    eventPublisher
  );

  // Step 2: Product Manager analyzes the codebase WITH code health context
  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'product-manager',
    progress: 0,
    message: `Product Manager analyzing codebase (Health: ${codeQuality?.overallHealth?.grade || 'N/A'}, ${codeQuality?.overallHealth?.score || 0}/100)...`,
  });

  const roadmap = await productManagerNode(
    enrichedCodeFiles,
    codeEntities,
    repoUrl,
    runId,
    dbClient,
    eventPublisher,
    codeQuality  // Pass code quality report so PM can factor in health score
  );

  // Step 3: Research Assistant takes the PM's analysis and researches trends
  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'research-assistant',
    progress: 0,
    message: 'Research Assistant investigating market trends and competitive landscape...',
  });

  const research = await researchAssistantNode(
    roadmap,
    enrichedCodeFiles,
    repoUrl,
    runId,
    dbClient,
    eventPublisher
  );

  // Step 4: Run new analysis agents
  // Uses throttled LLM calls — run sequentially to respect rate limits
  // The throttle system handles parallel limits internally
  let selfHealing: SelfHealingReport | undefined;
  let apiValidation: APIValidationReport | undefined;
  let coverageAudit: CoverageAuditReport | undefined;
  let uiAudit: UIAuditReport | undefined;

  try {
    // Run sequentially to avoid rate limit storms
    try { selfHealing = await selfHealerNode(enrichedCodeFiles, codeEntities, repoUrl, runId, dbClient, eventPublisher); } catch (e: any) { console.error('[SelfHealer] Failed:', e.message); }
    try { apiValidation = await apiValidatorNode(enrichedCodeFiles, codeEntities, repoUrl, runId, dbClient, eventPublisher); } catch (e: any) { console.error('[APIValidator] Failed:', e.message); }
    try { coverageAudit = await coverageAuditorNode(enrichedCodeFiles, codeEntities, repoUrl, runId, dbClient, eventPublisher); } catch (e: any) { console.error('[CoverageAuditor] Failed:', e.message); }
    try { uiAudit = await uiUxAnalystNode(enrichedCodeFiles, codeEntities, repoUrl, runId, dbClient, eventPublisher); } catch (e: any) { console.error('[UIUXAnalyst] Failed:', e.message); }
  } catch (error: any) {
    console.error('[ProductIntelligence] New agents failed:', error.message);
  }

  // Step 4b: Optional DSPy Visionary Agent deep security analysis
  // If the visionary-agent service is running on port 8010, call it for
  // multi-step verified security findings. This is additive — pipeline
  // continues normally if the service is unavailable.
  let dspySecurityFindings: DspySecurityFinding[] = [];
  try {
    const dspyResponse = await fetch('http://localhost:8010/analyze/security-deep-dive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_list: enrichedCodeFiles
          .filter(f => f.path !== '__business_context__')
          .map(f => f.path)
          .join('\n'),
        file_contents: Object.fromEntries(
          enrichedCodeFiles
            .filter(f => f.content && f.path !== '__business_context__')
            .slice(0, 50) // Limit files sent to DSPy
            .map(f => [f.path, f.content.substring(0, 10000)])
        ),
        business_context: businessContext?.summary || '',
      }),
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });

    if (dspyResponse.ok) {
      const dspyData = await dspyResponse.json() as { findings?: DspySecurityFinding[] };
      dspySecurityFindings = dspyData.findings || [];
      console.log(`[Pipeline] DSPy security deep dive: ${dspySecurityFindings.length} verified findings`);
    }
  } catch (err: any) {
    console.log(`[Pipeline] DSPy visionary agent not available (optional): ${err.message}`);
  }

  // Step 5: Combine and prioritize
  const combinedPriorities = buildCombinedPriorities(roadmap, research);

  // Step 6: Persist to ArangoDB
  await persistProductIntelligence(
    dbClient,
    repositoryId,
    runId,
    roadmap,
    research,
    codeQuality,
    combinedPriorities
  );

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'product-intelligence',
    result: {
      totalFeatures: combinedPriorities.length,
      monopolyStrategies: research.monopolyStrategies.length,
      gameChangerTrends: research.trendInsights.filter(t => t.relevance === 'game-changer').length,
      domain: roadmap.appDomain,
      codeHealthScore: codeQuality.overallHealth.score,
      codeHealthGrade: codeQuality.overallHealth.grade,
    },
  });

  // Persist new agent results
  if (selfHealing) {
    try {
      await dbClient.upsertDocument('qa_self_healing_reports', {
        _key: `selfheal_${runId}`,
        repositoryId, runId, ...selfHealing,
        createdAt: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  }
  if (apiValidation) {
    try {
      await dbClient.upsertDocument('qa_api_validation_reports', {
        _key: `apivalidation_${runId}`,
        repositoryId, runId, ...apiValidation,
        createdAt: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  }
  if (coverageAudit) {
    try {
      await dbClient.upsertDocument('qa_coverage_audit_reports', {
        _key: `coverage_${runId}`,
        repositoryId, runId, ...coverageAudit,
        createdAt: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  }

  if (uiAudit) {
    try {
      await dbClient.upsertDocument('qa_ui_audit_reports', {
        _key: `uiaudit_${runId}`,
        repositoryId, runId, ...uiAudit,
        createdAt: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  }

  // Persist DSPy verified security findings (high-confidence, multi-step verified)
  if (dspySecurityFindings.length > 0) {
    try {
      await dbClient.upsertDocument('qa_dspy_security_reports', {
        _key: `dspy_security_${runId}`,
        repositoryId,
        runId,
        findings: dspySecurityFindings,
        totalFindings: dspySecurityFindings.length,
        criticalCount: dspySecurityFindings.filter(f => f.priority === 'critical').length,
        highCount: dspySecurityFindings.filter(f => f.priority === 'high').length,
        averageConfidence: dspySecurityFindings.reduce((sum, f) => sum + (f.confidence || 0), 0) / dspySecurityFindings.length,
        source: 'dspy-visionary-agent',
        verificationMethod: 'multi-step-chain-of-thought',
        createdAt: new Date().toISOString(),
      });
      console.log(`[ProductIntelligence] Persisted ${dspySecurityFindings.length} DSPy-verified security findings`);
    } catch { /* non-fatal */ }
  }

  return { businessContext, roadmap, research, codeQuality, selfHealing, apiValidation, coverageAudit, uiAudit, dspySecurityFindings: dspySecurityFindings.length > 0 ? dspySecurityFindings : undefined, combinedPriorities };
}

function buildCombinedPriorities(
  roadmap: ProductRoadmap,
  research: ResearchInsights
): CombinedPriority[] {
  const priorities: CombinedPriority[] = [];
  let rank = 1;

  // Immediate PM features + game-changer trends get highest priority
  for (const feature of roadmap.roadmap.immediate) {
    // Check if any research insight amplifies this feature
    const matchingTrend = research.trendInsights.find(t =>
      t.relevance === 'game-changer' &&
      (feature.title.toLowerCase().includes(t.trend.toLowerCase().split(' ')[0]) ||
       feature.description.toLowerCase().includes(t.trend.toLowerCase().split(' ')[0]))
    );

    priorities.push({
      rank: rank++,
      title: feature.title,
      source: matchingTrend ? 'combined' : 'product-manager',
      description: feature.description + (matchingTrend
        ? ` [Amplified by trend: ${matchingTrend.trend}]`
        : ''),
      impact: feature.userImpact,
      effort: feature.effort,
      category: feature.competitiveAdvantage,
      monopolyPotential: feature.competitiveAdvantage === 'moat',
    });
  }

  // Game-changer research insights not already covered
  for (const trend of research.trendInsights.filter(t => t.relevance === 'game-changer')) {
    const alreadyCovered = priorities.some(p =>
      p.description.toLowerCase().includes(trend.trend.toLowerCase().split(' ')[0])
    );
    if (!alreadyCovered) {
      priorities.push({
        rank: rank++,
        title: `[TREND] ${trend.trend}`,
        source: 'research-assistant',
        description: `${trend.description}. Implementation: ${trend.implementationPath}`,
        impact: 'high',
        effort: trend.effort,
        category: trend.category,
        monopolyPotential: research.monopolyStrategies.some(s =>
          s.strategy.toLowerCase().includes(trend.trend.toLowerCase().split(' ')[0])
        ),
      });
    }
  }

  // Monopoly strategies
  for (const strategy of research.monopolyStrategies.filter(s => s.feasibility === 'high')) {
    priorities.push({
      rank: rank++,
      title: `[MOAT] ${strategy.strategy}`,
      source: 'research-assistant',
      description: `${strategy.description}. Type: ${strategy.type}. ${strategy.implementation}`,
      impact: 'high',
      effort: 'L',
      category: strategy.type,
      monopolyPotential: true,
    });
  }

  // Short-term PM features
  for (const feature of roadmap.roadmap.shortTerm) {
    priorities.push({
      rank: rank++,
      title: feature.title,
      source: 'product-manager',
      description: feature.description,
      impact: feature.userImpact,
      effort: feature.effort,
      category: feature.competitiveAdvantage,
      monopolyPotential: feature.competitiveAdvantage === 'moat',
    });
  }

  // Critical enhancements from research
  for (const enh of research.enhancementRecommendations.filter(e => e.priority === 'critical')) {
    priorities.push({
      rank: rank++,
      title: `[RESEARCH] ${enh.title}`,
      source: 'research-assistant',
      description: `${enh.description}. Based on: ${enh.basedOn}. Tech: ${enh.technologiesNeeded.join(', ')}`,
      impact: 'high',
      effort: 'M',
      category: 'enhancement',
      monopolyPotential: false,
    });
  }

  return priorities;
}

async function persistProductIntelligence(
  dbClient: any,
  repositoryId: string,
  runId: string,
  roadmap: ProductRoadmap,
  research: ResearchInsights,
  codeQuality: CodeQualityReport,
  priorities: CombinedPriority[]
): Promise<void> {
  try {
    // Store the product roadmap
    await dbClient.upsertDocument('qa_product_roadmaps', {
      _key: `roadmap_${runId}`,
      repositoryId,
      runId,
      appDomain: roadmap.appDomain,
      currentStrengths: roadmap.currentStrengths,
      criticalGaps: roadmap.criticalGaps,
      roadmap: roadmap.roadmap,
      competitiveAnalysis: roadmap.competitiveAnalysis,
      userPersonas: roadmap.userPersonas,
      totalFeatures:
        roadmap.roadmap.immediate.length +
        roadmap.roadmap.shortTerm.length +
        roadmap.roadmap.mediumTerm.length +
        roadmap.roadmap.longTerm.length,
      createdAt: new Date().toISOString(),
    });

    // Store research insights
    await dbClient.upsertDocument('qa_research_insights', {
      _key: `research_${runId}`,
      repositoryId,
      runId,
      domainAnalysis: research.domainAnalysis,
      trendInsights: research.trendInsights,
      competitorIntel: research.competitorIntel,
      monopolyStrategies: research.monopolyStrategies,
      enhancementRecommendations: research.enhancementRecommendations,
      gameChangerCount: research.trendInsights.filter(t => t.relevance === 'game-changer').length,
      createdAt: new Date().toISOString(),
    });

    // Store combined priorities
    await dbClient.upsertDocument('qa_product_priorities', {
      _key: `priorities_${runId}`,
      repositoryId,
      runId,
      priorities,
      monopolyCount: priorities.filter(p => p.monopolyPotential).length,
      createdAt: new Date().toISOString(),
    });

    // Store code quality report
    await dbClient.upsertDocument('qa_code_quality_reports', {
      _key: `quality_${runId}`,
      repositoryId,
      runId,
      overallHealth: codeQuality.overallHealth,
      codeSmells: codeQuality.codeSmells,
      duplicationHotspots: codeQuality.duplicationHotspots,
      complexityHotspots: codeQuality.complexityHotspots,
      architectureIssues: codeQuality.architectureIssues,
      refactoringRoadmap: codeQuality.refactoringRoadmap,
      consolidationOpportunities: codeQuality.consolidationOpportunities,
      deadCode: codeQuality.deadCode,
      bestPracticeViolations: codeQuality.bestPracticeViolations,
      totalFindings:
        codeQuality.codeSmells.length +
        codeQuality.duplicationHotspots.length +
        codeQuality.complexityHotspots.length +
        codeQuality.architectureIssues.length +
        codeQuality.deadCode.length +
        codeQuality.bestPracticeViolations.length,
      createdAt: new Date().toISOString(),
    });

    console.log(
      `[ProductIntelligence] Persisted roadmap + research + quality (${codeQuality.overallHealth.grade}) + ${priorities.length} priorities`
    );
  } catch (error: any) {
    console.error('[ProductIntelligence] Failed to persist:', error.message);
  }
}
