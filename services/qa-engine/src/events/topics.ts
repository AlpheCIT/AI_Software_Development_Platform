export const QA_TOPICS = {
  // Run lifecycle
  RUN_STARTED: 'qa.run.started',
  RUN_COMPLETED: 'qa.run.completed',
  RUN_FAILED: 'qa.run.failed',

  // Agent activity (for real-time frontend updates)
  AGENT_STARTED: 'qa.agent.started',
  AGENT_PROGRESS: 'qa.agent.progress',
  AGENT_COMPLETED: 'qa.agent.completed',
  AGENT_LOOP: 'qa.agent.loop',

  // Multi-agent debate
  DEBATE_ROUND: 'qa.debate.round',
  DEBATE_CONSENSUS: 'qa.debate.consensus',

  // Test execution
  TEST_STARTED: 'qa.test.started',
  TEST_COMPLETED: 'qa.test.completed',
  TEST_PASSED: 'qa.test.passed',
  TEST_FAILED: 'qa.test.failed',

  // Mutation testing
  MUTATION_STARTED: 'qa.mutation.started',
  MUTATION_PROGRESS: 'qa.mutation.progress',
  MUTATION_COMPLETED: 'qa.mutation.completed',

  // Product Intelligence
  PM_STARTED: 'qa.pm.started',
  PM_COMPLETED: 'qa.pm.completed',
  RESEARCH_STARTED: 'qa.research.started',
  RESEARCH_COMPLETED: 'qa.research.completed',
  PRODUCT_INTELLIGENCE_COMPLETED: 'qa.product-intelligence.completed',

  // External events we subscribe to
  INGESTION_COMPLETED: 'ingestion.completed',
} as const;

export type QATopic = typeof QA_TOPICS[keyof typeof QA_TOPICS];
