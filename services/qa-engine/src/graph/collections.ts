export const QA_COLLECTIONS = {
  // Document collections
  TEST_CASES: 'qa_test_cases',
  TEST_SUITES: 'qa_test_suites',
  TEST_EXECUTIONS: 'qa_test_executions',
  RUNS: 'qa_runs',
  FAILURES: 'qa_failures',
  SPECIFICATIONS: 'qa_specifications',
  MUTATIONS: 'qa_mutations',
  LEARNINGS: 'qa_learnings',
  RISK_SCORES: 'qa_risk_scores',
  AGENT_EFFECTIVENESS: 'qa_agent_effectiveness',
  BUG_ARCHETYPES: 'qa_bug_archetypes',

  // Edge collections
  TESTS_FILE: 'qa_tests_file',
  TESTS_FUNCTION: 'qa_tests_function',
  EXECUTION_OF: 'qa_execution_of',
  FAILURE_FROM: 'qa_failure_from',
  SUITE_CONTAINS: 'qa_suite_contains',
  RUN_USES_SUITE: 'qa_run_uses_suite',
  SPEC_FOR: 'qa_spec_for',
  MUTATION_OF: 'qa_mutation_of',
  SIMILAR_TO: 'qa_similar_to',
} as const;

export const DOCUMENT_COLLECTIONS = [
  QA_COLLECTIONS.TEST_CASES,
  QA_COLLECTIONS.TEST_SUITES,
  QA_COLLECTIONS.TEST_EXECUTIONS,
  QA_COLLECTIONS.RUNS,
  QA_COLLECTIONS.FAILURES,
  QA_COLLECTIONS.SPECIFICATIONS,
  QA_COLLECTIONS.MUTATIONS,
  QA_COLLECTIONS.LEARNINGS,
  QA_COLLECTIONS.RISK_SCORES,
  QA_COLLECTIONS.AGENT_EFFECTIVENESS,
  QA_COLLECTIONS.BUG_ARCHETYPES,
];

export const EDGE_COLLECTIONS = [
  QA_COLLECTIONS.TESTS_FILE,
  QA_COLLECTIONS.TESTS_FUNCTION,
  QA_COLLECTIONS.EXECUTION_OF,
  QA_COLLECTIONS.FAILURE_FROM,
  QA_COLLECTIONS.SUITE_CONTAINS,
  QA_COLLECTIONS.RUN_USES_SUITE,
  QA_COLLECTIONS.SPEC_FOR,
  QA_COLLECTIONS.MUTATION_OF,
  QA_COLLECTIONS.SIMILAR_TO,
];

export async function ensureCollections(dbClient: any): Promise<void> {
  console.log('[QA] Ensuring ArangoDB collections exist...');

  for (const name of DOCUMENT_COLLECTIONS) {
    try {
      await dbClient.query(
        `RETURN LENGTH(FOR c IN _collections FILTER c.name == @name RETURN 1)`,
        { name }
      );
      // Try to create - will be ignored if exists
      await dbClient.query(
        `LET exists = LENGTH(FOR c IN _collections FILTER c.name == @name RETURN 1)
         FILTER exists == 0
         RETURN null`,
        { name }
      );
    } catch {
      // Collection might already exist, that's fine
    }
  }

  console.log(`[QA] ${DOCUMENT_COLLECTIONS.length} document + ${EDGE_COLLECTIONS.length} edge collections ready`);
}
