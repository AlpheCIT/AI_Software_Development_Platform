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

      const [roadmap, research, priorities, codeQuality] = await Promise.all([
        dbClient.getDocument('qa_product_roadmaps', `roadmap_${runId}`).catch(() => null),
        dbClient.getDocument('qa_research_insights', `research_${runId}`).catch(() => null),
        dbClient.getDocument('qa_product_priorities', `priorities_${runId}`).catch(() => null),
        dbClient.getDocument('qa_code_quality_reports', `quality_${runId}`).catch(() => null),
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
        priorities: priorities?.priorities || [],
        summary: {
          appDomain: roadmap?.appDomain || 'Unknown',
          totalFeatures: roadmap?.totalFeatures || 0,
          criticalGaps: roadmap?.criticalGaps?.length || 0,
          gameChangerTrends: research?.gameChangerCount || 0,
          monopolyStrategies: research?.monopolyStrategies?.length || 0,
          combinedPriorities: priorities?.priorities?.length || 0,
          codeHealthScore: codeQuality?.overallHealth?.score || null,
          codeHealthGrade: codeQuality?.overallHealth?.grade || null,
          totalFindings: codeQuality?.totalFindings || 0,
        },
      });
    } catch (error: any) {
      console.error('Error getting product intelligence:', error);
      res.status(500).json({ error: 'Internal server error' });
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
