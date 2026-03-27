import { productManagerNode, ProductRoadmap } from './product-manager';
import { researchAssistantNode, ResearchInsights } from './research-assistant';
import { codeQualityArchitectNode, CodeQualityReport } from './code-quality-architect';
import { selfHealerNode, SelfHealingReport } from '../self-healer';
import { apiValidatorNode, APIValidationReport } from '../api-validator';
import { coverageAuditorNode, CoverageAuditReport } from '../coverage-auditor';
import { uiUxAnalystNode, UIAuditReport } from '../ui-ux-analyst';
import { QA_COLLECTIONS } from '../../../graph/collections';

export interface ProductIntelligenceResult {
  roadmap: ProductRoadmap;
  research: ResearchInsights;
  codeQuality: CodeQualityReport;
  selfHealing?: SelfHealingReport;
  apiValidation?: APIValidationReport;
  coverageAudit?: CoverageAuditReport;
  uiAudit?: UIAuditReport;
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

  // Step 1: Code Quality Architect runs FIRST so PM gets the health score
  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'code-quality-architect',
    progress: 0,
    message: 'Code Quality Architect auditing codebase for smells, duplication, and refactoring...',
  });

  const codeQuality = await codeQualityArchitectNode(
    codeFiles,
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
    codeFiles,
    codeEntities,
    repoUrl,
    runId,
    dbClient,
    eventPublisher
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
    codeFiles,
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
    try { selfHealing = await selfHealerNode(codeFiles, codeEntities, repoUrl, runId, dbClient, eventPublisher); } catch (e: any) { console.error('[SelfHealer] Failed:', e.message); }
    try { apiValidation = await apiValidatorNode(codeFiles, codeEntities, repoUrl, runId, dbClient, eventPublisher); } catch (e: any) { console.error('[APIValidator] Failed:', e.message); }
    try { coverageAudit = await coverageAuditorNode(codeFiles, codeEntities, repoUrl, runId, dbClient, eventPublisher); } catch (e: any) { console.error('[CoverageAuditor] Failed:', e.message); }
    try { uiAudit = await uiUxAnalystNode(codeFiles, codeEntities, repoUrl, runId, dbClient, eventPublisher); } catch (e: any) { console.error('[UIUXAnalyst] Failed:', e.message); }
  } catch (error: any) {
    console.error('[ProductIntelligence] New agents failed:', error.message);
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

  return { roadmap, research, codeQuality, selfHealing, apiValidation, coverageAudit, uiAudit, combinedPriorities };
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
