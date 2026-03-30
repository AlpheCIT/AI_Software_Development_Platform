import { Router, Request, Response } from 'express';

export function createProductIntelligenceRouter(dbClient: any) {
  const router = Router();

  /**
   * GET /qa/product/:runId
   * Get product intelligence results for a QA run
   */
  router.get('/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;

      const [roadmap, research, priorities, codeQuality, selfHealing, apiValidation, coverageAudit, uiAudit, qaRun] = await Promise.all([
        dbClient.getDocument('qa_product_roadmaps', `roadmap_${runId}`).catch(() => null),
        dbClient.getDocument('qa_research_insights', `research_${runId}`).catch(() => null),
        dbClient.getDocument('qa_product_priorities', `priorities_${runId}`).catch(() => null),
        dbClient.getDocument('qa_code_quality_reports', `quality_${runId}`).catch(() => null),
        dbClient.getDocument('qa_self_healing_reports', `selfheal_${runId}`).catch(() => null),
        dbClient.getDocument('qa_api_validation_reports', `apivalidation_${runId}`).catch(() => null),
        dbClient.getDocument('qa_coverage_audit_reports', `coverage_${runId}`).catch(() => null),
        dbClient.getDocument('qa_ui_audit_reports', `uiaudit_${runId}`).catch(() => null),
        dbClient.getDocument('qa_runs', runId).catch(() => null),
      ]);

      if (!roadmap && !research) {
        return res.status(404).json({
          error: 'Product intelligence not yet available for this run',
          message: 'The PM and Research agents may still be running.',
        });
      }

      res.json({
        roadmap,
        research,
        codeQuality,
        selfHealing,
        apiValidation,
        coverageAudit,
        uiAudit,
        priorities: priorities?.priorities || [],
        selectedAgents: qaRun?.selectedAgents || [],
        skippedAgents: qaRun?.skippedAgents || [],
        repoProfile: qaRun?.repoProfile || null,
        executionLog: qaRun?.executionLog || [],
        summary: {
          appDomain: roadmap?.appDomain || 'Unknown',
          totalFeatures: roadmap?.totalFeatures || 0,
          criticalGaps: roadmap?.criticalGaps?.length || 0,
          gameChangerTrends: research?.gameChangerCount || 0,
          monopolyStrategies: research?.monopolyStrategies?.length || 0,
          combinedPriorities: priorities?.priorities?.length || 0,
          codeHealthScore: codeQuality?.overallHealth?.score ?? null,
          codeHealthGrade: codeQuality?.overallHealth?.grade ?? null,
          totalFindings: codeQuality?.totalFindings || 0,
          selfHealingScore: selfHealing?.healthScore ?? null,
          apiHealthScore: apiValidation?.apiHealthScore ?? null,
          coverageScore: coverageAudit?.coverageScore ?? null,
          accessibilityScore: uiAudit?.accessibilityScore ?? null,
          uxScore: uiAudit?.uxScore ?? null,
          unifiedHealthScore: qaRun?.unifiedHealthScore || null,
          selectedAgentCount: qaRun?.selectedAgents?.length ?? null,
          totalRegisteredAgents: qaRun?.selectedAgents && qaRun?.skippedAgents
            ? qaRun.selectedAgents.length + qaRun.skippedAgents.length
            : null,
        },
      });
    } catch (error: any) {
      console.error('Error getting product intelligence:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /qa/product/health-history/:repositoryId
   * Get health score trends across runs for a repository
   */
  router.get('/health-history/:repositoryId', async (req: Request, res: Response) => {
    try {
      const { repositoryId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      // Get all runs for this repo, sorted by date
      const runs = await dbClient.query(
        `FOR r IN qa_runs
           FILTER r.repositoryId == @repoId
           SORT r.startedAt ASC
           LIMIT @limit
           RETURN { runId: r._key, date: r.startedAt, mutationScore: r.mutationScore }`,
        { repoId: repositoryId, limit }
      );

      // For each run, fetch health scores from agent reports
      const history = await Promise.all(
        runs.map(async (run: any) => {
          const [cq, sh, av, ca, ui] = await Promise.all([
            dbClient.getDocument('qa_code_quality_reports', `quality_${run.runId}`).catch(() => null),
            dbClient.getDocument('qa_self_healing_reports', `selfheal_${run.runId}`).catch(() => null),
            dbClient.getDocument('qa_api_validation_reports', `apivalidation_${run.runId}`).catch(() => null),
            dbClient.getDocument('qa_coverage_audit_reports', `coverage_${run.runId}`).catch(() => null),
            dbClient.getDocument('qa_ui_audit_reports', `uiaudit_${run.runId}`).catch(() => null),
          ]);

          return {
            runId: run.runId,
            date: run.date,
            scores: {
              codeQuality: cq?.overallHealth?.score ?? null,
              selfHealing: sh?.healthScore ?? null,
              apiHealth: av?.apiHealthScore ?? null,
              coverage: ca?.coverageScore ?? null,
              accessibility: ui?.accessibilityScore ?? null,
              ux: ui?.uxScore ?? null,
              mutation: run.mutationScore ?? null,
            },
          };
        })
      );

      res.json({ repositoryId, history, total: history.length });
    } catch (error: any) {
      res.json({ repositoryId: req.params.repositoryId, history: [], total: 0 });
    }
  });

  /**
   * GET /qa/product
   * List all product intelligence reports
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const reports = await dbClient.query(
        `FOR r IN qa_product_roadmaps
           SORT r.createdAt DESC
           LIMIT 20
           RETURN {
             runId: r.runId,
             repositoryId: r.repositoryId,
             appDomain: r.appDomain,
             totalFeatures: r.totalFeatures,
             criticalGaps: LENGTH(r.criticalGaps),
             createdAt: r.createdAt
           }`
      );
      res.json({ reports });
    } catch {
      res.json({ reports: [] });
    }
  });

  return router;
}
