import { Router, Request, Response } from 'express';

/**
 * Wiki Router — serves auto-generated repository documentation
 * built from repo-ingester data, code quality reports, and test results.
 *
 * GET /qa/wiki/:runId   — full wiki payload for a given QA run
 * GET /qa/wiki          — list available wiki snapshots
 */
export function createWikiRouter(dbClient: any) {
  const router = Router();

  // ── GET /qa/wiki/:runId ──────────────────────────────────────────────────

  router.get('/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;

      // 1. Fetch the QA run to get repositoryId + meta
      const run = await dbClient.getDocument('qa_runs', runId).catch(() => null);
      if (!run) {
        return res.status(404).json({
          error: 'QA run not found',
          message: 'No run exists with that ID. Run a QA analysis first.',
        });
      }

      const repositoryId = run.repositoryId;

      // 2. Try to load persisted wiki data first (fast path)
      const wikiDoc = await dbClient
        .getDocument('qa_wiki_data', `wiki_${runId}`)
        .catch(() => null);

      // 3. Fetch code quality report
      const codeQuality = await dbClient
        .getDocument('qa_code_quality_reports', `quality_${runId}`)
        .catch(() => null);

      // 4. Fetch test cases for this repository
      let testCases: any[] = [];
      try {
        testCases = await dbClient.query(
          `FOR tc IN qa_test_cases
             FILTER tc.repositoryId == @repoId
             RETURN { name: tc.name, targetFile: tc.targetFile, type: tc.type }`,
          { repoId: repositoryId },
        );
      } catch {
        // collection may not exist
      }

      // 5. Build file list — prefer wiki doc, fall back to code_files collection
      let files: any[] = [];
      let entities: any[] = [];

      if (wikiDoc) {
        files = wikiDoc.files || [];
        entities = wikiDoc.entities || [];
      } else {
        // Fallback: query code_files / code_entities if they exist
        try {
          files = await dbClient.query(
            `FOR f IN code_files
               FILTER f.repositoryId == @repoId
               LIMIT 500
               RETURN { path: f.path, language: f.language, size: f.size }`,
            { repoId: repositoryId },
          );
        } catch { /* collection may not exist */ }

        try {
          entities = await dbClient.query(
            `FOR e IN code_entities
               FILTER e.repositoryId == @repoId
               LIMIT 2000
               RETURN { name: e.name, type: e.type, file: e.filePath, signature: e.signature }`,
            { repoId: repositoryId },
          );
        } catch { /* collection may not exist */ }
      }

      // 6. Build per-file enrichment (entity counts, test counts, smells)
      const entityCountByFile: Record<string, number> = {};
      for (const e of entities) {
        entityCountByFile[e.file] = (entityCountByFile[e.file] || 0) + 1;
      }

      const testCountByFile: Record<string, number> = {};
      for (const tc of testCases) {
        if (tc.targetFile) {
          testCountByFile[tc.targetFile] = (testCountByFile[tc.targetFile] || 0) + 1;
        }
      }

      // Code smells by file
      const smellsByFile: Record<string, any[]> = {};
      if (codeQuality?.codeSmells) {
        for (const smell of codeQuality.codeSmells) {
          if (!smellsByFile[smell.file]) smellsByFile[smell.file] = [];
          smellsByFile[smell.file].push({
            type: smell.type,
            severity: smell.severity,
            message: smell.message,
            line: smell.line,
          });
        }
      }

      // Dead code items by file
      const deadCodeByFile: Record<string, number> = {};
      if (codeQuality?.deadCode) {
        for (const dc of codeQuality.deadCode) {
          deadCodeByFile[dc.file] = (deadCodeByFile[dc.file] || 0) + 1;
        }
      }

      // 7. Enrich files
      const enrichedFiles = files.map((f: any) => {
        const ec = entityCountByFile[f.path] || 0;
        const tc = testCountByFile[f.path] || 0;
        const smells = smellsByFile[f.path] || [];
        const hasTests = tc > 0;
        const hasDoc = f.language === 'markdown' || (f.path.toLowerCase().includes('readme'));
        const lineCount = f.size ? Math.round(f.size / 35) : 0; // rough estimate

        // Risk scoring: higher if many entities + no tests + smells
        let riskScore = 0;
        if (ec > 5 && !hasTests) riskScore += 40;
        else if (ec > 2 && !hasTests) riskScore += 20;
        riskScore += smells.length * 10;
        riskScore += (deadCodeByFile[f.path] || 0) * 5;
        if (riskScore > 100) riskScore = 100;

        return {
          path: f.path,
          language: f.language,
          lineCount,
          entityCount: ec,
          hasTests,
          testCount: tc,
          riskScore,
          hasDocumentation: hasDoc,
          smells,
        };
      });

      // 8. Documentation gaps
      const undocumentedFiles = enrichedFiles.filter(
        (f: any) => f.entityCount > 0 && !f.hasDocumentation && f.language !== 'json' && f.language !== 'yaml',
      );
      const documentedFiles = enrichedFiles.filter((f: any) => f.hasDocumentation);

      const totalCodeFiles = enrichedFiles.filter(
        (f: any) => f.language !== 'json' && f.language !== 'yaml' && f.language !== 'markdown',
      );
      const filesWithDocs = totalCodeFiles.filter((f: any) => f.hasDocumentation);
      const docCoverage = totalCodeFiles.length > 0
        ? Math.round((filesWithDocs.length / totalCodeFiles.length) * 100)
        : 0;

      const gaps = undocumentedFiles
        .filter((f: any) => f.entityCount >= 3)
        .sort((a: any, b: any) => b.entityCount - a.entityCount)
        .slice(0, 20)
        .map((f: any) => f.path);

      // 9. Summary
      const totalTODOs = codeQuality?.codeSmells?.filter(
        (s: any) => s.type === 'todo' || s.type === 'TODO' || s.message?.toLowerCase().includes('todo'),
      ).length || 0;

      const codeHealthScore = codeQuality?.overallHealth?.score ?? codeQuality?.summary?.overallScore ?? null;
      const codeHealthGrade = codeQuality?.overallHealth?.grade ?? gradeFromScore(codeHealthScore);

      const topUndocumented = enrichedFiles
        .filter((f: any) => !f.hasDocumentation && f.entityCount > 0)
        .sort((a: any, b: any) => b.entityCount - a.entityCount)
        .slice(0, 10)
        .map((f: any) => f.path);

      // 10. Send response
      res.json({
        repository: {
          url: run.repoUrl,
          branch: run.branch,
          totalFiles: files.length,
          totalEntities: entities.length,
          lastAnalyzed: run.completedAt || run.startedAt,
        },
        files: enrichedFiles,
        entities: entities.slice(0, 2000), // cap for payload size
        documentation: {
          documented: documentedFiles.length,
          undocumented: undocumentedFiles.length,
          coverage: `${docCoverage}%`,
          gaps,
        },
        summary: {
          topUndocumentedFiles: topUndocumented,
          totalTODOs,
          codeHealthGrade,
          codeHealthScore,
        },
      });
    } catch (error: any) {
      console.error('[Wiki] Error building wiki:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /qa/wiki ─────────────────────────────────────────────────────────

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const wikis = await dbClient.query(
        `FOR w IN qa_wiki_data
           SORT w.createdAt DESC
           LIMIT 20
           RETURN {
             runId: w.runId,
             repositoryId: w.repositoryId,
             totalFiles: LENGTH(w.files),
             totalEntities: LENGTH(w.entities),
             createdAt: w.createdAt
           }`,
      );
      res.json({ wikis });
    } catch {
      res.json({ wikis: [] });
    }
  });

  return router;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function gradeFromScore(score: number | null): string | null {
  if (score == null) return null;
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
