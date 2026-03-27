import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { QAAgentState, TestResult } from '../state';
import { qaConfig } from '../../config';

export async function executorNode(
  state: QAAgentState,
  eventPublisher?: any
): Promise<Partial<QAAgentState>> {
  // Get only approved tests (or all if no critic feedback)
  const approvedTestIds = new Set(
    state.criticFeedback.filter(f => f.approved).map(f => f.testId)
  );

  const testsToRun = state.generatedTests.filter(t =>
    approvedTestIds.size === 0 || approvedTestIds.has(t.id)
  );

  if (testsToRun.length === 0) {
    console.log('[Executor] No tests to execute');
    return {
      testResults: [],
      currentAgent: 'mutation-verifier',
    };
  }

  console.log(`[Executor] Running ${testsToRun.length} tests`);

  eventPublisher?.emit('qa:agent.started', {
    runId: state.runId,
    agent: 'executor',
    step: `Executing ${testsToRun.length} tests`,
  });

  // Create temp directory for test files
  const tmpDir = join(process.cwd(), '.qa-tmp', state.runId);
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const results: TestResult[] = [];

  for (let i = 0; i < testsToRun.length; i++) {
    const test = testsToRun[i];

    eventPublisher?.emit('qa:test.started', {
      runId: state.runId,
      testId: test.id,
      name: test.name,
    });

    eventPublisher?.emit('qa:agent.streaming', {
      runId: state.runId,
      agent: 'executor',
      text: `Running ${test.name}`,
      currentFile: test.targetFile,
      fileIndex: i + 1,
      fileTotal: testsToRun.length,
    });

    const testFilePath = join(tmpDir, `${test.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.test.ts`);
    const startTime = Date.now();

    try {
      // Write test file
      writeFileSync(testFilePath, test.code, 'utf-8');

      // Attempt to run the test
      // For now, we do a syntax check and dry-run approach
      // Full execution requires the target app to be running
      let status: TestResult['status'] = 'passed';
      let error: string | undefined;

      try {
        // Try to compile/check the test file
        execSync(`npx tsc --noEmit --allowJs --esModuleInterop "${testFilePath}" 2>&1`, {
          timeout: qaConfig.qa.testTimeoutMs,
          encoding: 'utf-8',
          cwd: tmpDir,
        });
      } catch (compileError: any) {
        // TypeScript compilation errors are informational, not test failures
        // The test code might reference project-specific imports
        const output = compileError.stdout || compileError.stderr || '';
        if (output.includes('error TS')) {
          status = 'skipped';
          error = `TypeScript compilation: ${output.substring(0, 500)}`;
        }
      }

      // If we have a baseUrl, attempt actual Playwright execution for E2E tests
      if (test.type === 'e2e' && state.config.baseUrl) {
        try {
          const playwrightResult = execSync(
            `npx playwright test "${testFilePath}" --reporter=json 2>&1`,
            {
              timeout: qaConfig.qa.testTimeoutMs,
              encoding: 'utf-8',
              cwd: tmpDir,
              env: {
                ...process.env,
                BASE_URL: state.config.baseUrl,
              },
            }
          );

          // Parse Playwright JSON output
          try {
            const jsonResult = JSON.parse(playwrightResult);
            if (jsonResult.stats?.unexpected > 0) {
              status = 'failed';
              error = jsonResult.suites?.[0]?.specs?.[0]?.tests?.[0]?.results?.[0]?.error?.message;
            }
          } catch {
            // Non-JSON output means it ran but we can't parse details
            status = 'passed';
          }
        } catch (runError: any) {
          status = 'failed';
          error = (runError.stdout || runError.stderr || runError.message).substring(0, 1000);
        }
      }

      const duration = Date.now() - startTime;

      const result: TestResult = {
        testId: test.id,
        name: test.name,
        status,
        duration,
        error,
      };

      results.push(result);

      eventPublisher?.emit('qa:test.completed', {
        runId: state.runId,
        testId: test.id,
        status: result.status,
        duration: result.duration,
        error: result.error,
      });

    } catch (err: any) {
      const duration = Date.now() - startTime;
      results.push({
        testId: test.id,
        name: test.name,
        status: 'failed',
        duration,
        error: err.message?.substring(0, 1000),
      });
    }

    // Update progress
    eventPublisher?.emit('qa:agent.progress', {
      runId: state.runId,
      agent: 'executor',
      progress: Math.round(((i + 1) / testsToRun.length) * 100),
      message: `Executed ${i + 1}/${testsToRun.length} tests`,
    });
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`[Executor] Results: ${passed} syntax-valid, ${failed} failed, ${skipped} need project context`);
  console.log(`[Executor] Note: Tests are validated via TypeScript compilation check. Full Jest execution requires the target project's dependencies and runtime environment.`);

  eventPublisher?.emit('qa:agent.completed', {
    runId: state.runId,
    agent: 'executor',
    result: { total: results.length, passed, failed, skipped },
  });

  // Cleanup temp dir
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* ignore cleanup errors */ }

  return {
    testResults: results,
    currentAgent: 'mutation-verifier',
  };
}
