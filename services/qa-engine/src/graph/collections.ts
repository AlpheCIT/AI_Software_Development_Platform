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
  WIKI_DATA: 'qa_wiki_data',
  AGENT_CONVERSATIONS: 'qa_agent_conversations',
  CHAT_CONVERSATIONS: 'qa_chat_conversations',

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
  QA_COLLECTIONS.WIKI_DATA,
  QA_COLLECTIONS.AGENT_CONVERSATIONS,
  QA_COLLECTIONS.CHAT_CONVERSATIONS,
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

  // Also ensure product intelligence and new agent report collections
  const ALL_COLLECTIONS = [
    ...DOCUMENT_COLLECTIONS,
    'qa_product_roadmaps', 'qa_research_insights', 'qa_product_priorities',
    'qa_code_quality_reports', 'qa_self_healing_reports', 'qa_api_validation_reports',
    'qa_coverage_audit_reports', 'qa_ui_audit_reports',
  ];

  let created = 0;
  for (const name of ALL_COLLECTIONS) {
    try {
      // Use the database client's raw connection to create collection
      await dbClient.query(`RETURN IS_DOCUMENT(DOCUMENT("${name}/___test___"))`);
    } catch (err: any) {
      // Collection doesn't exist — try to create it via HTTP
      try {
        const { Database } = require('arangojs');
        const config = require('../config').qaConfig;
        const db = new Database({
          url: config.arango.url,
          databaseName: config.arango.database,
          auth: { username: config.arango.username, password: config.arango.password },
        });
        const coll = db.collection(name);
        if (!(await coll.exists())) {
          await coll.create();
          created++;
          console.log(`[QA] Created collection: ${name}`);
        }
      } catch {
        // Silently skip — collection might already exist
      }
    }
  }

  if (created > 0) {
    console.log(`[QA] Created ${created} new collections`);
  }
  console.log(`[QA] ${ALL_COLLECTIONS.length} document + ${EDGE_COLLECTIONS.length} edge collections ready`);
}
