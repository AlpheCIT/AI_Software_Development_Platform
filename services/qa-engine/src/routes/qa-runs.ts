import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { runQAPipeline } from '../agents/graph';
import { QARunConfig } from '../agents/state';
import { QA_COLLECTIONS } from '../graph/collections';
import { qaConfig } from '../config';

export function createQARunsRouter(dbClient: any, eventPublisher?: any) {
  const router = Router();

  // Active runs tracking
  const activeRuns = new Map<string, { status: string; startedAt: string; promise?: Promise<any> }>();

  /**
   * POST /qa/run
   * Start a new QA run against a repository
   */
  router.post('/run', async (req: Request, res: Response) => {
    try {
      const {
        repoUrl,
        branch = 'main',
        credentials,
        config: userConfig = {},
      } = req.body;

      if (!repoUrl) {
        return res.status(400).json({ error: 'repoUrl is required' });
      }

      const runId = uuidv4();

      // Build repository ID (consistent with ingestion engine)
      const repositoryId = `repo_${Buffer.from(`${repoUrl}:${branch}`).toString('base64url').substring(0, 32)}`;

      const runConfig: QARunConfig = {
        repoUrl,
        branch,
        repositoryId,
        credentials,
        testTypes: userConfig.testTypes || ['unit', 'e2e'],
        maxTests: Math.min(userConfig.maxTests || 20, qaConfig.qa.maxTestsPerRun),
        baseUrl: userConfig.baseUrl,
        apiBaseUrl: userConfig.apiBaseUrl,
        testTimeoutMs: userConfig.timeout || qaConfig.qa.testTimeoutMs,
      };

      // Check if repo is ingested
      let repoExists = false;
      try {
        const repos = await dbClient.query(
          `FOR r IN repositories FILTER r._key == @repoId LIMIT 1 RETURN r`,
          { repoId: repositoryId }
        );
        repoExists = repos.length > 0;
      } catch {
        // repositories collection might not exist yet
      }

      // Track the run
      activeRuns.set(runId, { status: 'running', startedAt: new Date().toISOString() });

      // Return immediately
      res.status(202).json({
        runId,
        repositoryId,
        status: 'started',
        repoIngested: repoExists,
        message: repoExists
          ? 'QA run started against existing repository data'
          : 'Repository not yet ingested. QA run will analyze available data.',
        endpoints: {
          status: `/qa/runs/${runId}`,
          results: `/qa/results/${runId}`,
        },
      });

      // Start the QA pipeline asynchronously
      const pipelinePromise = runQAPipeline(runId, runConfig, { dbClient, eventPublisher })
        .then(result => {
          activeRuns.set(runId, {
            status: 'completed',
            startedAt: activeRuns.get(runId)?.startedAt || '',
          });
          console.log(`[QA Run ${runId}] Completed - ${result.generatedTests.length} tests, mutation score: ${result.mutationResult?.score ?? 'N/A'}%`);
        })
        .catch(error => {
          activeRuns.set(runId, {
            status: 'failed',
            startedAt: activeRuns.get(runId)?.startedAt || '',
          });
          console.error(`[QA Run ${runId}] Failed:`, error.message);
        });

      activeRuns.get(runId)!.promise = pipelinePromise;

    } catch (error: any) {
      console.error('Error starting QA run:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /qa/runs/:runId
   * Get status of a QA run
   */
  router.get('/runs/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;

      // Check active runs first
      const active = activeRuns.get(runId);
      if (active) {
        return res.json({
          runId,
          status: active.status,
          startedAt: active.startedAt,
        });
      }

      // Check ArangoDB
      const run = await dbClient.getDocument(QA_COLLECTIONS.RUNS, runId);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      res.json(run);
    } catch (error: any) {
      console.error('Error getting run status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /qa/results/:runId
   * Get full results of a QA run
   */
  router.get('/results/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;

      // Get run record
      const run = await dbClient.getDocument(QA_COLLECTIONS.RUNS, runId);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      // Get test cases
      const testCases = await dbClient.query(
        `FOR tc IN ${QA_COLLECTIONS.TEST_CASES}
           FILTER tc.repositoryId == @repoId
           SORT tc.createdAt DESC
           RETURN tc`,
        { repoId: run.repositoryId }
      );

      // Get test executions
      const executions = await dbClient.query(
        `FOR te IN ${QA_COLLECTIONS.TEST_EXECUTIONS}
           FILTER te.runId == @runId
           RETURN te`,
        { runId }
      );

      // Get failures
      const failures = await dbClient.query(
        `FOR f IN ${QA_COLLECTIONS.FAILURES}
           FILTER f.runId == @runId
           RETURN f`,
        { runId }
      );

      // Get mutation results
      let mutations = null;
      try {
        mutations = await dbClient.getDocument(QA_COLLECTIONS.MUTATIONS, `mutation_${runId}`);
      } catch { /* might not exist */ }

      res.json({
        run,
        testCases,
        executions,
        failures,
        mutations,
        summary: {
          totalTests: testCases.length,
          executed: executions.length,
          passed: executions.filter((e: any) => e.status === 'passed').length,
          failed: executions.filter((e: any) => e.status === 'failed').length,
          skipped: executions.filter((e: any) => e.status === 'skipped').length,
          mutationScore: mutations?.score ?? null,
          failureCount: failures.length,
        },
      });
    } catch (error: any) {
      console.error('Error getting results:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /qa/runs
   * List all QA runs
   */
  router.get('/runs', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const runs = await dbClient.query(
        `FOR r IN ${QA_COLLECTIONS.RUNS}
           SORT r.startedAt DESC
           LIMIT @limit
           RETURN r`,
        { limit }
      );
      res.json({ runs, total: runs.length });
    } catch (error: any) {
      // Collection might not exist yet
      res.json({ runs: [], total: 0 });
    }
  });

  /**
   * GET /qa/conversations/:runId
   * Get all agent conversations for a run
   */
  router.get('/conversations/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const agent = req.query.agent as string | undefined;

      let query = `FOR c IN ${QA_COLLECTIONS.AGENT_CONVERSATIONS}
                     FILTER c.runId == @runId`;
      const bindVars: any = { runId };

      if (agent) {
        query += ` FILTER c.agent == @agent`;
        bindVars.agent = agent;
      }

      query += ` SORT c.timestamp ASC RETURN c`;

      const conversations = await dbClient.query(query, bindVars);
      res.json({ conversations, total: conversations.length });
    } catch (error: any) {
      res.json({ conversations: [], total: 0 });
    }
  });

  /**
   * GET /qa/freshness/:repositoryId
   * Check if the analyzed commit is still up-to-date with the remote
   */
  router.get('/freshness/:repositoryId', async (req: Request, res: Response) => {
    try {
      const { repositoryId } = req.params;

      // Get the latest run for this repository
      const runs = await dbClient.query(
        `FOR r IN ${QA_COLLECTIONS.RUNS}
           FILTER r.repositoryId == @repoId
           SORT r.startedAt DESC
           LIMIT 1
           RETURN r`,
        { repoId: repositoryId }
      );

      if (!runs || runs.length === 0) {
        return res.status(404).json({ error: 'No runs found for this repository' });
      }

      const latestRun = runs[0];
      const lastAnalyzedCommit = latestRun.commitSha || null;
      const lastAnalyzedDate = latestRun.commitDate || latestRun.completedAt || null;
      const repoUrl = latestRun.repoUrl;
      const branch = latestRun.branch || 'main';

      // If no commit SHA was stored, we cannot compare
      if (!lastAnalyzedCommit) {
        return res.json({
          repositoryId,
          lastAnalyzedCommit: null,
          lastAnalyzedDate,
          lastAnalyzedMessage: latestRun.commitMessage || null,
          remoteHeadCommit: null,
          isStale: 'unknown',
          commitsBehind: null,
          reason: 'No commit SHA recorded in the latest run',
        });
      }

      // Try to check the remote for the latest commit
      let remoteHeadCommit: string | null = null;
      let isStale: boolean | 'unknown' = 'unknown';
      let commitsBehind: number | null = null;

      try {
        const lsRemoteOutput = execSync(
          `git ls-remote ${repoUrl} refs/heads/${branch}`,
          { encoding: 'utf-8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();

        if (lsRemoteOutput) {
          // Output format: "<sha>\trefs/heads/<branch>"
          remoteHeadCommit = lsRemoteOutput.split('\t')[0];
          isStale = remoteHeadCommit !== lastAnalyzedCommit;

          // Estimate commits behind (rough: 1 if different, 0 if same)
          // Accurate count would require cloning; we provide an estimate
          if (isStale) {
            commitsBehind = 1; // Minimum estimate — at least 1 commit behind
          } else {
            commitsBehind = 0;
          }
        }
      } catch (gitErr: any) {
        console.warn(`[Freshness] Could not check remote for ${repoUrl}: ${gitErr.message}`);
        isStale = 'unknown';
      }

      res.json({
        repositoryId,
        lastAnalyzedCommit,
        lastAnalyzedDate,
        lastAnalyzedMessage: latestRun.commitMessage || null,
        remoteHeadCommit,
        isStale,
        commitsBehind,
      });
    } catch (error: any) {
      console.error('Error checking freshness:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
