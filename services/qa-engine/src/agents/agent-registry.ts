/**
 * Agent Registry — Central registry of ALL agents in the QA pipeline.
 *
 * Each agent declares:
 *   - What it does (name, description, category)
 *   - Which pipeline track it belongs to (qa-tests, intelligence, behavioral)
 *   - What repository characteristics it requires (languages, frameworks, patterns)
 *   - When it should be excluded
 *   - How to invoke it (an async function receiving AgentContext)
 *   - Execution constraints (priority, dependencies, parallelism, timeout)
 *
 * The registry is a flat array. The dynamic-router selects a subset based on
 * the repository profile, and the pipeline-executor runs them respecting
 * priority groups, dependency ordering, and parallelism rules.
 */

// ---------------------------------------------------------------------------
// Imports — existing agent implementations
// ---------------------------------------------------------------------------
import { businessContextAnalyzerNode } from './nodes/business-context-analyzer.js';
import { codeQualityArchitectNode } from './nodes/product-intelligence/code-quality-architect.js';
import { selfHealerNode } from './nodes/self-healer.js';
import { apiValidatorNode } from './nodes/api-validator.js';
import { coverageAuditorNode } from './nodes/coverage-auditor.js';
import { uiUxAnalystNode } from './nodes/ui-ux-analyst.js';
import { behavioralAnalystNode } from './nodes/behavioral-analyst.js';
import { gherkinWriterNode } from './nodes/gherkin-writer.js';
import { changeTrackerNode } from './nodes/change-tracker.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Conditions that a repository must satisfy for an agent to be eligible.
 * All specified conditions must be met (logical AND). An empty object
 * means the agent is always eligible.
 */
export interface AgentRequirements {
  /** Repository must contain files in at least one of these languages */
  hasLanguages?: string[];
  /** Repository must use at least one of these frameworks */
  hasFrameworks?: string[];
  /** Repository must exhibit at least one of these patterns (e.g. 'api-routes', 'dockerfile') */
  hasPatterns?: string[];
  /** Repository must have at least this many code files */
  minFiles?: number;
}

/**
 * The universal context object passed to every agent invocation.
 * Contains everything an agent could need — agents pick what they use.
 */
export interface AgentContext {
  /** In-memory array of code files with path & content */
  codeFiles: any[];
  /** Parsed code entities (functions, classes, imports, etc.) */
  codeEntities: any[];
  /** The repository URL being analyzed */
  repoUrl: string;
  /** Unique identifier for this pipeline run */
  runId: string;
  /** ArangoDB repository document _key */
  repositoryId: string;
  /** ArangoDB client (optional — not all runs have DB access) */
  dbClient?: any;
  /** Event emitter for real-time progress updates (Socket.IO / EventEmitter) */
  eventPublisher?: any;
  /** Business context produced by the business-context agent (when available) */
  businessContext?: any;
  /** Results from agents that ran earlier in this pipeline execution */
  previousResults: Record<string, any>;
}

/**
 * Full definition of a registered agent. This is the unit of work the
 * pipeline-executor schedules and runs.
 */
export interface AgentDefinition {
  /** Unique identifier (kebab-case, e.g. 'self-healer') */
  id: string;
  /** Human-readable name */
  name: string;
  /** One-sentence description of what this agent does */
  description: string;
  /** Pipeline track: qa-tests (test generation), intelligence (code insights), behavioral (BDD/Gherkin) */
  track: 'qa-tests' | 'intelligence' | 'behavioral';
  /** Grouping category for UI display */
  category: string;
  /** Conditions required for this agent to be selected */
  requires: AgentRequirements;
  /** Conditions that exclude this agent even if requires are met */
  excludeWhen?: { appTypes?: string[]; missingPatterns?: string[] };
  /** The function to call when this agent runs */
  invoke: (context: AgentContext) => Promise<any>;
  /** Priority level — lower numbers run first (0 = first, 50 = last) */
  priority: number;
  /** IDs of agents that must complete before this one can start */
  dependsOn?: string[];
  /** Whether this agent is safe to run in parallel with other agents at the same priority level */
  parallel?: boolean;
  /** Maximum milliseconds before the agent is forcibly timed out */
  timeout: number;
  /** If true, failure does not abort the pipeline */
  optional: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a stub invoke function for agents that are registered but not
 * yet implemented. Returns a marker result so the pipeline knows it was
 * a no-op.
 */
function createStubAgent(
  id: string,
  name: string,
  description: string,
): (ctx: AgentContext) => Promise<any> {
  return async (ctx: AgentContext) => {
    console.log(`[${name}] Agent not yet implemented — stub returning empty result`);
    ctx.eventPublisher?.emit('qa:agent.completed', {
      runId: ctx.runId,
      agent: id,
      result: { stub: true },
    });
    return {
      stub: true,
      agentId: id,
      message: `${name} is registered but not yet implemented`,
    };
  };
}

/**
 * Wraps an existing agent function that uses the legacy positional-argument
 * signature (codeFiles, codeEntities, repoUrl, runId, dbClient?, eventPublisher?)
 * into the unified AgentContext interface.
 */
function wrapExistingAgent(
  agentFn: (
    codeFiles: any[],
    codeEntities: any[],
    repoUrl: string,
    runId: string,
    dbClient?: any,
    eventPublisher?: any,
  ) => Promise<any>,
): (ctx: AgentContext) => Promise<any> {
  return async (ctx: AgentContext) => {
    return agentFn(
      ctx.codeFiles,
      ctx.codeEntities,
      ctx.repoUrl,
      ctx.runId,
      ctx.dbClient,
      ctx.eventPublisher,
    );
  };
}

/**
 * Wraps agents that take a "previousResult" as their first positional arg
 * (e.g. gherkin-writer takes behavioralSpecs, change-tracker takes currentSpecs).
 * The caller specifies which previousResults key to pull from.
 */
function wrapDependentAgent(
  agentFn: (
    previousResult: any,
    repoUrl: string,
    runId: string,
    dbClient?: any,
    eventPublisher?: any,
  ) => Promise<any>,
  dependencyKey: string,
): (ctx: AgentContext) => Promise<any> {
  return async (ctx: AgentContext) => {
    const depResult = ctx.previousResults[dependencyKey] ?? {};
    return agentFn(depResult, ctx.repoUrl, ctx.runId, ctx.dbClient, ctx.eventPublisher);
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * The master agent registry. Add new agents here.
 *
 * Priority groups:
 *   0  — Foundation (must run first, e.g. business-context)
 *  10  — Core analysis (code-quality, static analysis)
 *  20  — Specialized validators (self-healer, api-validator, coverage, ui-ux)
 *  30  — Behavioral analysis (behavioral-analyst, fullstack-auditor)
 *  40  — Dependent agents (gherkin-writer, change-tracker — need prior results)
 *  50  — Infrastructure & language-specific (docker, ci-cd, language quality)
 *  60  — Security & data (dependency-security, data-privacy, auth)
 *  70  — Documentation generators
 *  80  — Performance analysis
 *  90  — Architecture analysis (monorepo, microservices)
 * 100  — Meta / coverage tracking
 */
export const agentRegistry: AgentDefinition[] = [
  // =========================================================================
  // PRIORITY 0 — Foundation
  // =========================================================================
  {
    id: 'business-context',
    name: 'Business Context Analyzer',
    description: 'Discovers application type, business domains, critical user flows, and tech stack',
    track: 'intelligence',
    category: 'foundation',
    requires: {},
    invoke: wrapExistingAgent(businessContextAnalyzerNode),
    priority: 0,
    parallel: false,
    timeout: 120_000,
    optional: false,
  },

  // =========================================================================
  // PRIORITY 10 — Core Analysis
  // =========================================================================
  {
    id: 'code-quality',
    name: 'Code Quality Architect',
    description: 'Audits code quality, detects anti-patterns, suggests refactoring opportunities',
    track: 'intelligence',
    category: 'quality',
    requires: { minFiles: 3 },
    invoke: wrapExistingAgent(codeQualityArchitectNode),
    priority: 10,
    dependsOn: ['business-context'],
    parallel: true,
    timeout: 180_000,
    optional: false,
  },

  // =========================================================================
  // PRIORITY 20 — Specialized Validators
  // =========================================================================
  {
    id: 'self-healer',
    name: 'Self Healer',
    description: 'Detects cross-file type mismatches, broken imports, env var issues, and config inconsistencies',
    track: 'intelligence',
    category: 'quality',
    requires: { minFiles: 2 },
    invoke: wrapExistingAgent(selfHealerNode),
    priority: 20,
    dependsOn: ['business-context'],
    parallel: true,
    timeout: 180_000,
    optional: false,
  },
  {
    id: 'api-validator',
    name: 'API Validator',
    description: 'Discovers API endpoints and validates error handling, auth, CORS, rate limiting, and schemas',
    track: 'intelligence',
    category: 'api',
    requires: { hasPatterns: ['api-routes'] },
    invoke: wrapExistingAgent(apiValidatorNode),
    priority: 20,
    dependsOn: ['business-context'],
    parallel: true,
    timeout: 180_000,
    optional: false,
  },
  {
    id: 'coverage-auditor',
    name: 'Coverage Auditor',
    description: 'Cross-references backend endpoints with frontend API calls to find coverage gaps',
    track: 'intelligence',
    category: 'coverage',
    requires: { hasPatterns: ['api-routes'] },
    invoke: wrapExistingAgent(coverageAuditorNode),
    priority: 20,
    dependsOn: ['business-context'],
    parallel: true,
    timeout: 180_000,
    optional: false,
  },
  {
    id: 'ui-ux-analyst',
    name: 'UI/UX Analyst',
    description: 'Audits frontend components for accessibility, usability, responsiveness, and design consistency',
    track: 'intelligence',
    category: 'ui',
    requires: { hasPatterns: ['frontend-components'] },
    invoke: wrapExistingAgent(uiUxAnalystNode),
    priority: 20,
    dependsOn: ['business-context'],
    parallel: true,
    timeout: 180_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 30 — Behavioral Analysis
  // =========================================================================
  {
    id: 'behavioral-analyst',
    name: 'Behavioral Analyst',
    description: 'Generates behavioral specifications and fullstack audit via DSPy pipeline',
    track: 'behavioral',
    category: 'behavioral',
    requires: { minFiles: 5 },
    invoke: wrapExistingAgent(behavioralAnalystNode),
    priority: 30,
    dependsOn: ['business-context'],
    parallel: true,
    timeout: 300_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 40 — Dependent Agents (need prior results)
  // =========================================================================
  {
    id: 'gherkin-writer',
    name: 'Gherkin Writer',
    description: 'Converts behavioral specifications into Gherkin feature files',
    track: 'behavioral',
    category: 'behavioral',
    requires: {},
    invoke: wrapDependentAgent(gherkinWriterNode, 'behavioral-analyst'),
    priority: 40,
    dependsOn: ['behavioral-analyst'],
    parallel: true,
    timeout: 180_000,
    optional: true,
  },
  {
    id: 'change-tracker',
    name: 'Change Tracker',
    description: 'Detects specification drift by comparing current behavioral specs with previous run',
    track: 'behavioral',
    category: 'behavioral',
    requires: {},
    invoke: wrapDependentAgent(changeTrackerNode, 'behavioral-analyst'),
    priority: 40,
    dependsOn: ['behavioral-analyst'],
    parallel: true,
    timeout: 180_000,
    optional: true,
  },
  {
    id: 'fullstack-auditor',
    name: 'Fullstack Auditor',
    description: 'Validates frontend-backend integration points and data flow consistency',
    track: 'intelligence',
    category: 'coverage',
    requires: { hasPatterns: ['api-routes', 'frontend-components'] },
    invoke: async (ctx: AgentContext) => {
      // fullstack-auditor is part of the behavioral-analyst DSPy pipeline;
      // its results are embedded in the behavioral-analyst output
      const baResult = ctx.previousResults['behavioral-analyst'];
      if (baResult?.fullstackAudit) {
        return baResult.fullstackAudit;
      }
      console.log('[FullstackAuditor] No behavioral-analyst fullstack audit available — skipping');
      return { stub: true, message: 'Fullstack audit is produced by behavioral-analyst DSPy pipeline' };
    },
    priority: 50,
    dependsOn: ['behavioral-analyst'],
    parallel: true,
    timeout: 10_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 50 — Infrastructure & DevOps (STUBS)
  // =========================================================================
  {
    id: 'docker-analyzer',
    name: 'Docker Analyzer',
    description: 'Audits Dockerfiles for best practices, security, layer optimization, and multi-stage builds',
    track: 'intelligence',
    category: 'infrastructure',
    requires: { hasPatterns: ['dockerfile'] },
    invoke: createStubAgent('docker-analyzer', 'Docker Analyzer', 'Audits Dockerfiles'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'cicd-analyzer',
    name: 'CI/CD Analyzer',
    description: 'Analyzes CI/CD pipeline configurations for best practices, security, and efficiency',
    track: 'intelligence',
    category: 'infrastructure',
    requires: { hasPatterns: ['ci-cd'] },
    invoke: createStubAgent('cicd-analyzer', 'CI/CD Analyzer', 'Analyzes CI/CD pipelines'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'infrastructure-as-code',
    name: 'Infrastructure as Code Analyzer',
    description: 'Validates Terraform, CloudFormation, and Kubernetes manifests for correctness and security',
    track: 'intelligence',
    category: 'infrastructure',
    requires: { hasPatterns: ['terraform', 'kubernetes'] },
    invoke: createStubAgent('infrastructure-as-code', 'IaC Analyzer', 'Validates IaC configs'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 50 — Language-Specific Quality (STUBS)
  // =========================================================================
  {
    id: 'python-quality',
    name: 'Python Quality Analyzer',
    description: 'Python-specific linting, type checking, and best practice analysis',
    track: 'intelligence',
    category: 'language-quality',
    requires: { hasLanguages: ['python'] },
    invoke: createStubAgent('python-quality', 'Python Quality', 'Python-specific analysis'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'java-quality',
    name: 'Java Quality Analyzer',
    description: 'Java-specific analysis including Spring patterns, dependency injection, and Maven/Gradle configs',
    track: 'intelligence',
    category: 'language-quality',
    requires: { hasLanguages: ['java'] },
    invoke: createStubAgent('java-quality', 'Java Quality', 'Java-specific analysis'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'go-quality',
    name: 'Go Quality Analyzer',
    description: 'Go-specific analysis including goroutine patterns, error handling, and module structure',
    track: 'intelligence',
    category: 'language-quality',
    requires: { hasLanguages: ['go'] },
    invoke: createStubAgent('go-quality', 'Go Quality', 'Go-specific analysis'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'rust-quality',
    name: 'Rust Quality Analyzer',
    description: 'Rust-specific analysis including ownership patterns, unsafe blocks, and Cargo configs',
    track: 'intelligence',
    category: 'language-quality',
    requires: { hasLanguages: ['rust'] },
    invoke: createStubAgent('rust-quality', 'Rust Quality', 'Rust-specific analysis'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 50 — Protocol-Specific Validators (STUBS)
  // =========================================================================
  {
    id: 'graphql-validator',
    name: 'GraphQL Validator',
    description: 'Validates GraphQL schemas, resolvers, N+1 queries, and type coverage',
    track: 'intelligence',
    category: 'api',
    requires: { hasPatterns: ['graphql'] },
    invoke: createStubAgent('graphql-validator', 'GraphQL Validator', 'Validates GraphQL schemas'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'websocket-analyzer',
    name: 'WebSocket Analyzer',
    description: 'Analyzes WebSocket implementations for proper connection handling, reconnection, and security',
    track: 'intelligence',
    category: 'api',
    requires: { hasPatterns: ['websocket'] },
    invoke: createStubAgent('websocket-analyzer', 'WebSocket Analyzer', 'Analyzes WebSocket implementations'),
    priority: 50,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 60 — Security & Data (STUBS)
  // =========================================================================
  {
    id: 'database-analyzer',
    name: 'Database Analyzer',
    description: 'Analyzes database schemas, queries, migrations, and indexing strategies',
    track: 'intelligence',
    category: 'data',
    requires: { hasPatterns: ['database'] },
    invoke: createStubAgent('database-analyzer', 'Database Analyzer', 'Analyzes database schemas'),
    priority: 60,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'data-privacy',
    name: 'Data Privacy Analyzer',
    description: 'Scans for PII exposure, GDPR compliance, data retention policies, and encryption gaps',
    track: 'intelligence',
    category: 'security',
    requires: { minFiles: 5 },
    invoke: createStubAgent('data-privacy', 'Data Privacy', 'Scans for PII exposure'),
    priority: 60,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'dependency-security',
    name: 'Dependency Security Analyzer',
    description: 'Checks dependencies for known CVEs, license issues, and supply chain risks',
    track: 'intelligence',
    category: 'security',
    requires: { minFiles: 1 },
    invoke: createStubAgent('dependency-security', 'Dependency Security', 'Checks for CVEs'),
    priority: 60,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'auth-deep-dive',
    name: 'Auth Deep Dive',
    description: 'Deep analysis of authentication and authorization implementations, session management, and RBAC',
    track: 'intelligence',
    category: 'security',
    requires: { hasPatterns: ['api-routes'] },
    invoke: createStubAgent('auth-deep-dive', 'Auth Deep Dive', 'Deep auth analysis'),
    priority: 60,
    dependsOn: ['api-validator'],
    parallel: true,
    timeout: 120_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 70 — Documentation Generators (STUBS)
  // =========================================================================
  {
    id: 'api-docs-generator',
    name: 'API Docs Generator',
    description: 'Generates OpenAPI/Swagger documentation from discovered API endpoints',
    track: 'intelligence',
    category: 'documentation',
    requires: { hasPatterns: ['api-routes'] },
    invoke: createStubAgent('api-docs-generator', 'API Docs Generator', 'Generates API docs'),
    priority: 70,
    dependsOn: ['api-validator'],
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'readme-generator',
    name: 'README Generator',
    description: 'Generates comprehensive README documentation from codebase analysis',
    track: 'intelligence',
    category: 'documentation',
    requires: { minFiles: 3 },
    invoke: createStubAgent('readme-generator', 'README Generator', 'Generates README'),
    priority: 70,
    dependsOn: ['business-context', 'code-quality'],
    parallel: true,
    timeout: 120_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 80 — Performance Analysis (STUBS)
  // =========================================================================
  {
    id: 'performance-profiler',
    name: 'Performance Profiler',
    description: 'Identifies performance bottlenecks, memory leaks, and optimization opportunities',
    track: 'intelligence',
    category: 'performance',
    requires: { minFiles: 5 },
    invoke: createStubAgent('performance-profiler', 'Performance Profiler', 'Profiles performance'),
    priority: 80,
    parallel: true,
    timeout: 180_000,
    optional: true,
  },
  {
    id: 'frontend-performance',
    name: 'Frontend Performance Analyzer',
    description: 'Analyzes bundle size, render performance, lazy loading, and Core Web Vitals impact',
    track: 'intelligence',
    category: 'performance',
    requires: { hasPatterns: ['frontend-components'] },
    invoke: createStubAgent('frontend-performance', 'Frontend Performance', 'Analyzes frontend perf'),
    priority: 80,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 90 — Architecture Analysis (STUBS)
  // =========================================================================
  {
    id: 'monorepo-analyzer',
    name: 'Monorepo Analyzer',
    description: 'Analyzes monorepo structure, workspace dependencies, and build graph optimization',
    track: 'intelligence',
    category: 'architecture',
    requires: { hasPatterns: ['monorepo'] },
    invoke: createStubAgent('monorepo-analyzer', 'Monorepo Analyzer', 'Analyzes monorepo structure'),
    priority: 90,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
  {
    id: 'microservices-analyzer',
    name: 'Microservices Analyzer',
    description: 'Analyzes service boundaries, inter-service communication, and distributed system patterns',
    track: 'intelligence',
    category: 'architecture',
    requires: { hasPatterns: ['docker-compose'] },
    invoke: createStubAgent('microservices-analyzer', 'Microservices Analyzer', 'Analyzes service boundaries'),
    priority: 90,
    parallel: true,
    timeout: 180_000,
    optional: true,
  },

  // =========================================================================
  // PRIORITY 100 — Meta / Coverage Tracking (STUBS)
  // =========================================================================
  {
    id: 'test-coverage-analyst',
    name: 'Test Coverage Analyst',
    description: 'Analyzes existing test coverage, identifies untested critical paths, and suggests test priorities',
    track: 'qa-tests',
    category: 'coverage',
    requires: { hasPatterns: ['test-files'] },
    invoke: createStubAgent('test-coverage-analyst', 'Test Coverage Analyst', 'Analyzes test coverage'),
    priority: 100,
    parallel: true,
    timeout: 120_000,
    optional: true,
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Find an agent definition by id */
export function getAgent(id: string): AgentDefinition | undefined {
  return agentRegistry.find(a => a.id === id);
}

/** Get all agents belonging to a specific track */
export function getAgentsByTrack(track: AgentDefinition['track']): AgentDefinition[] {
  return agentRegistry.filter(a => a.track === track);
}

/** Get all agents in a specific category */
export function getAgentsByCategory(category: string): AgentDefinition[] {
  return agentRegistry.filter(a => a.category === category);
}

/** Get all stub (not yet implemented) agents */
export function getStubAgents(): AgentDefinition[] {
  // Stub agents are identified by the fact their invoke function name includes "stub"
  // or we can check by running a quick test — but simpler: maintain a list
  const stubIds = new Set([
    'docker-analyzer', 'cicd-analyzer', 'infrastructure-as-code',
    'python-quality', 'java-quality', 'go-quality', 'rust-quality',
    'graphql-validator', 'websocket-analyzer',
    'database-analyzer', 'data-privacy', 'dependency-security', 'auth-deep-dive',
    'api-docs-generator', 'readme-generator',
    'performance-profiler', 'frontend-performance',
    'test-coverage-analyst',
    'monorepo-analyzer', 'microservices-analyzer',
  ]);
  return agentRegistry.filter(a => stubIds.has(a.id));
}

/** Get all implemented (non-stub) agents */
export function getImplementedAgents(): AgentDefinition[] {
  const stubs = new Set(getStubAgents().map(a => a.id));
  return agentRegistry.filter(a => !stubs.has(a.id));
}
