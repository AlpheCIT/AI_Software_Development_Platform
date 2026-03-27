import { StateGraph, END } from '@langchain/langgraph';
import { QAAgentState, QARunConfig, createInitialState } from './state';
import { testStrategistNode } from './nodes/test-strategist';
import { testGeneratorNode } from './nodes/test-generator';
import { criticNode } from './nodes/critic';
import { executorNode } from './nodes/executor';
import { mutationVerifierNode } from './nodes/mutation-verifier';
import { repoIngesterNode } from './nodes/repo-ingester';
import { runProductIntelligencePipeline } from './nodes/product-intelligence/pipeline';
import { extractLearnings } from './nodes/learning-extractor';
import { QA_COLLECTIONS } from '../graph/collections';

interface QAGraphDependencies {
  dbClient: any;
  eventPublisher?: any;
}

function createQAGraph(deps: QAGraphDependencies) {
  const { dbClient, eventPublisher } = deps;

  const graph = new StateGraph<QAAgentState>({
    channels: {
      runId: { value: (a: string, b?: string) => b ?? a, default: () => '' },
      config: { value: (a: any, b?: any) => b ?? a, default: () => ({}) },
      codeFiles: { value: (a: any[], b?: any[]) => b ?? a, default: () => [] },
      codeEntities: { value: (a: any[], b?: any[]) => b ?? a, default: () => [] },
      ingestionSource: { value: (a: string, b?: string) => b ?? a, default: () => 'pending' },
      commitSha: { value: (a: any, b?: any) => b ?? a, default: () => undefined },
      commitMessage: { value: (a: any, b?: any) => b ?? a, default: () => undefined },
      commitDate: { value: (a: any, b?: any) => b ?? a, default: () => undefined },
      strategy: { value: (a: any, b?: any) => b ?? a, default: () => null },
      generatedTests: { value: (a: any[], b?: any[]) => b ?? a, default: () => [] },
      criticFeedback: { value: (a: any[], b?: any[]) => b ?? a, default: () => [] },
      testResults: { value: (a: any[], b?: any[]) => b ?? a, default: () => [] },
      mutationResult: { value: (a: any, b?: any) => b ?? a, default: () => null },
      currentAgent: { value: (a: string, b?: string) => b ?? a, default: () => 'strategist' },
      iteration: { value: (a: number, b?: number) => b ?? a, default: () => 0 },
      maxIterations: { value: (a: number, b?: number) => b ?? a, default: () => 3 },
      shouldLoop: { value: (a: boolean, b?: boolean) => b ?? a, default: () => false },
      status: { value: (a: string, b?: string) => b ?? a, default: () => 'running' },
      errors: { value: (a: string[], b?: string[]) => b ?? a, default: () => [] },
      startedAt: { value: (a: string, b?: string) => b ?? a, default: () => new Date().toISOString() },
      completedAt: { value: (a: any, b?: any) => b ?? a, default: () => undefined },
    },
  });

  // Add nodes — repo_ingester runs first to populate codeFiles / codeEntities
  graph.addNode('repo_ingester', async (state: QAAgentState) => {
    return repoIngesterNode(state, dbClient, eventPublisher);
  });

  graph.addNode('strategist', async (state: QAAgentState) => {
    return testStrategistNode(state, dbClient, eventPublisher);
  });

  graph.addNode('generator', async (state: QAAgentState) => {
    return testGeneratorNode(state, dbClient, eventPublisher);
  });

  graph.addNode('critic', async (state: QAAgentState) => {
    return criticNode(state, dbClient, eventPublisher);
  });

  graph.addNode('executor', async (state: QAAgentState) => {
    return executorNode(state, eventPublisher);
  });

  graph.addNode('mutation_verifier', async (state: QAAgentState) => {
    return mutationVerifierNode(state, dbClient, eventPublisher);
  });

  // Store results in ArangoDB
  graph.addNode('persist_results', async (state: QAAgentState) => {
    console.log(`[Persist] Storing results for run ${state.runId}`);

    // Store the run record
    await dbClient.upsertDocument(QA_COLLECTIONS.RUNS, {
      _key: state.runId,
      repositoryId: state.config.repositoryId,
      repoUrl: state.config.repoUrl,
      branch: state.config.branch,
      status: state.status,
      testsGenerated: state.generatedTests.length,
      testsExecuted: state.testResults.length,
      testsPassed: state.testResults.filter((r: any) => r.status === 'passed').length,
      testsFailed: state.testResults.filter((r: any) => r.status === 'failed').length,
      mutationScore: state.mutationResult?.score ?? null,
      iterations: state.iteration + 1,
      commitSha: state.commitSha,
      commitMessage: state.commitMessage,
      commitDate: state.commitDate,
      startedAt: state.startedAt,
      completedAt: state.completedAt || new Date().toISOString(),
    });

    // Store test suite
    const suiteKey = `suite_${state.runId}`;
    await dbClient.upsertDocument(QA_COLLECTIONS.TEST_SUITES, {
      _key: suiteKey,
      repositoryId: state.config.repositoryId,
      strategy: state.strategy,
      riskScore: state.strategy?.priorityScore ?? 0,
      testCaseCount: state.generatedTests.length,
      createdAt: state.startedAt,
    });

    // Store each test case
    for (const test of state.generatedTests) {
      await dbClient.upsertDocument(QA_COLLECTIONS.TEST_CASES, {
        _key: test.id,
        repositoryId: state.config.repositoryId,
        name: test.name,
        type: test.type,
        targetFile: test.targetFile,
        targetFunction: test.targetFunction,
        code: test.code,
        description: test.description,
        confidence: test.confidence,
        iteration: test.iteration,
        mutationScore: state.mutationResult?.score ?? null,
        createdAt: new Date().toISOString(),
      });
    }

    // Store test executions
    for (const result of state.testResults) {
      const execKey = `exec_${state.runId}_${result.testId}`;
      await dbClient.upsertDocument(QA_COLLECTIONS.TEST_EXECUTIONS, {
        _key: execKey,
        testCaseId: result.testId,
        runId: state.runId,
        status: result.status,
        duration: result.duration,
        error: result.error,
        executedAt: new Date().toISOString(),
      });

      // Store failures
      if (result.status === 'failed' && result.error) {
        const failKey = `fail_${state.runId}_${result.testId}`;
        await dbClient.upsertDocument(QA_COLLECTIONS.FAILURES, {
          _key: failKey,
          executionId: execKey,
          testCaseId: result.testId,
          runId: state.runId,
          category: 'test_failure',
          error: result.error,
          stackTrace: result.stackTrace,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Store mutation results
    if (state.mutationResult) {
      await dbClient.upsertDocument(QA_COLLECTIONS.MUTATIONS, {
        _key: `mutation_${state.runId}`,
        runId: state.runId,
        repositoryId: state.config.repositoryId,
        totalMutants: state.mutationResult.totalMutants,
        killed: state.mutationResult.killed,
        survived: state.mutationResult.survived,
        score: state.mutationResult.score,
        survivors: state.mutationResult.survivors,
        createdAt: new Date().toISOString(),
      });
    }

    // Store wiki data (file list + entities snapshot for the wiki endpoint)
    if (state.codeFiles.length > 0) {
      await dbClient.upsertDocument(QA_COLLECTIONS.WIKI_DATA, {
        _key: `wiki_${state.runId}`,
        runId: state.runId,
        repositoryId: state.config.repositoryId,
        files: state.codeFiles.map((f: any) => ({
          path: f.path,
          language: f.language,
          size: f.size,
        })),
        entities: state.codeEntities.map((e: any) => ({
          name: e.name,
          type: e.type,
          file: e.file,
          signature: e.signature,
        })),
        createdAt: new Date().toISOString(),
      });
      console.log(`[Persist] Stored wiki data: ${state.codeFiles.length} files, ${state.codeEntities.length} entities`);
    }

    console.log(`[Persist] Stored ${state.generatedTests.length} tests, ${state.testResults.length} results`);
    return {};
  });

  // Product Intelligence: PM + Research Assistant run after QA results are stored
  graph.addNode('product_intelligence', async (state: QAAgentState) => {
    console.log(`[ProductIntelligence] Starting PM + Research analysis for ${state.config.repoUrl}`);
    try {
      const result = await runProductIntelligencePipeline(
        state.codeFiles,
        state.codeEntities,
        state.config.repoUrl,
        state.config.repositoryId,
        state.runId,
        dbClient,
        eventPublisher
      );
      console.log(`[ProductIntelligence] Complete — ${result.combinedPriorities.length} priorities identified`);

      // Extract learnings from this run for the "AI learns over time" feature
      await extractLearnings(state.runId, state.config.repositoryId, {
        codeQuality: result.codeQuality,
        testResults: state.testResults,
        mutationResult: state.mutationResult,
        criticFeedback: state.criticFeedback,
      }, dbClient);
    } catch (error: any) {
      console.error(`[ProductIntelligence] Failed:`, error.message);
      // Non-fatal — QA results are already persisted
    }
    return {};
  });

  // Define edges — ingester is the first node
  graph.setEntryPoint('repo_ingester');

  graph.addEdge('repo_ingester', 'strategist');
  graph.addEdge('strategist', 'generator');

  graph.addEdge('generator', 'critic');

  // Critic decides: loop back to generator or proceed to executor
  graph.addConditionalEdges('critic', (state: QAAgentState) => {
    if (state.shouldLoop && state.currentAgent === 'generator') {
      return 'generator';
    }
    return 'executor';
  });

  graph.addEdge('executor', 'mutation_verifier');

  // Mutation verifier decides: loop back to generator or finish
  graph.addConditionalEdges('mutation_verifier', (state: QAAgentState) => {
    if (state.shouldLoop && state.currentAgent === 'generator') {
      return 'generator';
    }
    return 'persist_results';
  });

  // After QA persists, run Product Intelligence
  graph.addEdge('persist_results', 'product_intelligence');
  graph.addEdge('product_intelligence', END);

  return graph.compile();
}

export async function runQAPipeline(
  runId: string,
  config: QARunConfig,
  deps: QAGraphDependencies
): Promise<QAAgentState> {
  const compiledGraph = createQAGraph(deps);
  const initialState = createInitialState(runId, config);

  console.log(`[QA Pipeline] Starting run ${runId} for ${config.repoUrl}`);

  deps.eventPublisher?.emit('qa:run.started', {
    runId,
    repoUrl: config.repoUrl,
    config,
  });

  try {
    const finalState = await compiledGraph.invoke(initialState);

    deps.eventPublisher?.emit('qa:run.completed', {
      runId,
      summary: {
        testsGenerated: finalState.generatedTests.length,
        testsPassed: finalState.testResults.filter((r: any) => r.status === 'passed').length,
        testsFailed: finalState.testResults.filter((r: any) => r.status === 'failed').length,
        mutationScore: finalState.mutationResult?.score ?? null,
        iterations: finalState.iteration + 1,
        status: finalState.status,
      },
    });

    return finalState as QAAgentState;
  } catch (error: any) {
    console.error(`[QA Pipeline] Run ${runId} failed:`, error);

    deps.eventPublisher?.emit('qa:run.failed', {
      runId,
      error: error.message,
    });

    throw error;
  }
}
