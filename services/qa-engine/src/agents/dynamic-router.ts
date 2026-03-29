/**
 * Dynamic Router — Repository profiling and agent selection.
 *
 * The router is the bridge between raw code files and the agent registry.
 * It performs two jobs:
 *
 * 1. **Profile building**: Scans code files (or queries ArangoDB) to produce a
 *    RepoProfile — a normalized summary of what languages, frameworks, patterns,
 *    and architecture the repository uses.
 *
 * 2. **Agent selection**: Given the profile and the full agent registry, selects
 *    only the agents whose requirements are satisfied and whose exclusion
 *    conditions are not triggered. Optionally filters by pipeline track.
 *
 * The selected agents are then handed to the pipeline-executor for execution.
 */

import type { AgentDefinition, AgentRequirements } from './agent-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A normalized description of a repository's characteristics.
 * Used by selectAgents() to match agents to repos.
 */
export interface RepoProfile {
  /** Programming languages detected (lowercase, e.g. ['typescript', 'python']) */
  languages: string[];
  /** Frameworks detected (lowercase, e.g. ['react', 'express', 'fastify']) */
  frameworks: string[];
  /** Architectural/structural patterns detected (e.g. ['api-routes', 'dockerfile']) */
  patterns: string[];
  /** High-level application type (e.g. 'web-app', 'api-service', 'monorepo') */
  appType: string;
  /** Total number of code files */
  fileCount: number;
  /** Graph density metric from ArangoDB (0-1). 0 when not available. */
  graphDensity: number;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.pyw': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.h': 'cpp', '.hpp': 'cpp',
  '.c': 'c',
  '.swift': 'swift',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.scala': 'scala',
  '.dart': 'dart',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.sql': 'sql',
  '.sh': 'shell', '.bash': 'shell',
};

function detectLanguages(codeFiles: any[]): string[] {
  const langs = new Set<string>();
  for (const file of codeFiles) {
    const path: string = file.path || file.filePath || '';
    const ext = path.substring(path.lastIndexOf('.'));
    const lang = EXTENSION_TO_LANGUAGE[ext.toLowerCase()];
    if (lang) langs.add(lang);
  }
  return Array.from(langs);
}

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

interface FrameworkSignature {
  name: string;
  /** Check file content for these import/require patterns */
  importPatterns: RegExp[];
  /** Check file paths for these patterns */
  pathPatterns?: RegExp[];
}

const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
  { name: 'react', importPatterns: [/from ['"]react['"]/, /require\(['"]react['"]\)/], pathPatterns: [/\.tsx$/] },
  { name: 'next.js', importPatterns: [/from ['"]next\//], pathPatterns: [/next\.config\./] },
  { name: 'vue', importPatterns: [/from ['"]vue['"]/, /createApp/], pathPatterns: [/\.vue$/] },
  { name: 'angular', importPatterns: [/from ['"]@angular\//], pathPatterns: [/angular\.json$/] },
  { name: 'svelte', importPatterns: [/from ['"]svelte\//], pathPatterns: [/\.svelte$/] },
  { name: 'express', importPatterns: [/from ['"]express['"]/, /require\(['"]express['"]\)/] },
  { name: 'fastify', importPatterns: [/from ['"]fastify['"]/, /require\(['"]fastify['"]\)/] },
  { name: 'nestjs', importPatterns: [/from ['"]@nestjs\//] },
  { name: 'django', importPatterns: [/from django/, /import django/] },
  { name: 'flask', importPatterns: [/from flask/, /import flask/] },
  { name: 'fastapi', importPatterns: [/from fastapi/, /import fastapi/] },
  { name: 'spring', importPatterns: [/import org\.springframework/] },
  { name: 'rails', importPatterns: [/require ['"]rails['"]/, /Rails\.application/] },
  { name: 'laravel', importPatterns: [/use Illuminate\\/, /namespace App\\/] },
  { name: 'gin', importPatterns: [/github\.com\/gin-gonic\/gin/] },
  { name: 'actix', importPatterns: [/actix_web/, /use actix/] },
  { name: 'socket.io', importPatterns: [/from ['"]socket\.io['"]/, /require\(['"]socket\.io['"]\)/] },
  { name: 'prisma', importPatterns: [/from ['"]@prisma\/client['"]/, /PrismaClient/] },
  { name: 'typeorm', importPatterns: [/from ['"]typeorm['"]/, /Entity\(\)/, /@Column/] },
  { name: 'sequelize', importPatterns: [/from ['"]sequelize['"]/, /require\(['"]sequelize['"]\)/] },
  { name: 'mongoose', importPatterns: [/from ['"]mongoose['"]/, /require\(['"]mongoose['"]\)/] },
  { name: 'graphql', importPatterns: [/from ['"]graphql['"]/, /from ['"]@apollo\//, /gql`/] },
  { name: 'tailwind', importPatterns: [], pathPatterns: [/tailwind\.config\./] },
  { name: 'chakra-ui', importPatterns: [/from ['"]@chakra-ui\//] },
  { name: 'material-ui', importPatterns: [/from ['"]@mui\//, /from ['"]@material-ui\//] },
];

function detectFrameworks(codeFiles: any[]): string[] {
  const frameworks = new Set<string>();
  for (const file of codeFiles) {
    const path: string = file.path || file.filePath || '';
    const content: string = file.content || '';

    for (const sig of FRAMEWORK_SIGNATURES) {
      if (frameworks.has(sig.name)) continue;
      // Check path patterns
      if (sig.pathPatterns?.some(p => p.test(path))) {
        frameworks.add(sig.name);
        continue;
      }
      // Check import patterns (only scan first 5000 chars for performance)
      const snippet = content.substring(0, 5000);
      if (sig.importPatterns.some(p => p.test(snippet))) {
        frameworks.add(sig.name);
      }
    }
  }
  return Array.from(frameworks);
}

// ---------------------------------------------------------------------------
// Pattern detection
// ---------------------------------------------------------------------------

/**
 * Detects architectural and structural patterns present in the codebase.
 * These pattern IDs correspond to the `requires.hasPatterns` fields in
 * agent definitions.
 */
function detectPatterns(codeFiles: any[]): string[] {
  const patterns = new Set<string>();
  const paths = codeFiles.map(f => (f.path || f.filePath || '').toLowerCase());
  const pathSet = new Set(paths);

  // Helper: check if any file path matches a regex
  const anyPath = (rx: RegExp) => paths.some(p => rx.test(p));
  // Helper: check if any file content matches a regex (first 5000 chars)
  const anyContent = (rx: RegExp) =>
    codeFiles.some(f => rx.test((f.content || '').substring(0, 5000)));

  // --- api-routes ---
  if (
    anyPath(/route[s]?\.(ts|js|py|rb|go|java)$/) ||
    anyPath(/controller[s]?\.(ts|js|py|rb|go|java)$/) ||
    anyPath(/handler[s]?\.(ts|js|py|rb|go|java)$/) ||
    anyPath(/\/api\//) ||
    anyPath(/\/routes\//) ||
    anyContent(/\.(get|post|put|delete|patch)\s*\(/) ||
    anyContent(/app\.(get|post|put|delete|patch)\s*\(/) ||
    anyContent(/@(Get|Post|Put|Delete|Patch)\s*\(/)
  ) {
    patterns.add('api-routes');
  }

  // --- frontend-components ---
  if (
    anyPath(/\.(tsx|jsx)$/) ||
    anyPath(/\/components\//) ||
    anyContent(/from ['"]react['"]/) ||
    anyContent(/from ['"]vue['"]/) ||
    anyContent(/from ['"]svelte['"]/)
  ) {
    patterns.add('frontend-components');
  }

  // --- middleware ---
  if (anyPath(/\/middleware\//) || anyPath(/middleware\.(ts|js)$/)) {
    patterns.add('middleware');
  }

  // --- dockerfile ---
  if (anyPath(/dockerfile/i) || anyPath(/\.dockerfile$/)) {
    patterns.add('dockerfile');
  }

  // --- ci-cd ---
  if (
    anyPath(/\.github\/workflows\//) ||
    anyPath(/\.gitlab-ci/) ||
    anyPath(/jenkinsfile/i) ||
    anyPath(/\.circleci\//) ||
    anyPath(/azure-pipelines/) ||
    anyPath(/bitbucket-pipelines/)
  ) {
    patterns.add('ci-cd');
  }

  // --- migrations ---
  if (
    anyPath(/\/migrations\//) ||
    anyPath(/migrate/) ||
    anyPath(/\.migration\.(ts|js|sql)$/)
  ) {
    patterns.add('migrations');
  }

  // --- graphql ---
  if (
    anyPath(/\.graphql$/) ||
    anyPath(/\.gql$/) ||
    anyContent(/type Query/) ||
    anyContent(/type Mutation/) ||
    anyContent(/gql`/)
  ) {
    patterns.add('graphql');
  }

  // --- websocket ---
  if (
    anyContent(/socket\.io/) ||
    anyContent(/from ['"]ws['"]/) ||
    anyContent(/WebSocket/) ||
    anyContent(/\.on\(['"]connection['"]/)
  ) {
    patterns.add('websocket');
  }

  // --- database ---
  if (
    anyPath(/\/models\//) ||
    anyPath(/\/schema[s]?\//) ||
    anyPath(/\/entities\//) ||
    anyPath(/\/migrations\//) ||
    anyContent(/CREATE TABLE/) ||
    anyContent(/mongoose\.model/) ||
    anyContent(/PrismaClient/) ||
    anyContent(/@Entity/)
  ) {
    patterns.add('database');
  }

  // --- test-files ---
  if (
    anyPath(/\/__tests__\//) ||
    anyPath(/\.test\.(ts|tsx|js|jsx)$/) ||
    anyPath(/\.spec\.(ts|tsx|js|jsx)$/) ||
    anyPath(/\/test\//) ||
    anyPath(/tests\//)
  ) {
    patterns.add('test-files');
  }

  // --- monorepo ---
  if (
    anyPath(/lerna\.json$/) ||
    anyPath(/nx\.json$/) ||
    anyPath(/turbo\.json$/) ||
    anyPath(/pnpm-workspace\.yaml$/) ||
    anyPath(/\/packages\/.*\/package\.json$/) ||
    anyPath(/\/apps\/.*\/package\.json$/)
  ) {
    patterns.add('monorepo');
  }

  // --- docker-compose ---
  if (anyPath(/docker-compose\.(yml|yaml)$/)) {
    patterns.add('docker-compose');
  }

  // --- terraform ---
  if (anyPath(/\.tf$/) || anyPath(/terraform/)) {
    patterns.add('terraform');
  }

  // --- kubernetes ---
  if (
    anyPath(/\/k8s\//) ||
    anyPath(/kubernetes/) ||
    anyContent(/apiVersion:/) ||
    anyContent(/kind:\s*(Deployment|Service|Pod|Ingress)/)
  ) {
    patterns.add('kubernetes');
  }

  return Array.from(patterns);
}

// ---------------------------------------------------------------------------
// App type inference
// ---------------------------------------------------------------------------

function inferAppType(languages: string[], frameworks: string[], patterns: string[]): string {
  const hasFrontend = patterns.includes('frontend-components');
  const hasBackend = patterns.includes('api-routes');
  const hasDocker = patterns.includes('dockerfile') || patterns.includes('docker-compose');
  const isMonorepo = patterns.includes('monorepo');

  if (isMonorepo) return 'monorepo';
  if (hasFrontend && hasBackend) return 'fullstack';
  if (hasFrontend && !hasBackend) return 'frontend';
  if (hasBackend && !hasFrontend) return 'api-service';
  if (patterns.includes('ci-cd') && !hasBackend && !hasFrontend) return 'devops';
  if (hasDocker && !hasBackend && !hasFrontend) return 'infrastructure';
  if (languages.includes('python') && !hasBackend) return 'library';
  return 'library';
}

// ---------------------------------------------------------------------------
// Profile builders
// ---------------------------------------------------------------------------

/**
 * Build a repository profile from in-memory code files.
 * This is the primary profiler — always available, no DB needed.
 *
 * @param codeFiles - Array of { path, content } objects
 * @param businessContext - Optional business context from the business-context agent
 */
export function buildRepoProfile(codeFiles: any[], businessContext?: any): RepoProfile {
  const languages = detectLanguages(codeFiles);
  const frameworks = detectFrameworks(codeFiles);
  const patterns = detectPatterns(codeFiles);
  const appType = businessContext?.appType?.toLowerCase() || inferAppType(languages, frameworks, patterns);

  return {
    languages,
    frameworks,
    patterns,
    appType,
    fileCount: codeFiles.length,
    graphDensity: 0, // Not available without DB
  };
}

/**
 * Build a richer repository profile using ArangoDB graph data.
 * Falls back to in-memory profiling if DB query fails.
 *
 * @param dbClient - ArangoDB database client
 * @param repositoryId - ArangoDB repository document _key
 * @param businessContext - Optional business context from the business-context agent
 */
export async function buildRepoProfileFromDB(
  dbClient: any,
  repositoryId: string,
  businessContext?: any,
): Promise<RepoProfile> {
  try {
    // Query code files from ArangoDB for a richer profile
    const cursor = await dbClient.query(`
      FOR cf IN code_files
        FILTER cf.repositoryId == @repoId
        RETURN { path: cf.filePath, content: cf.content }
    `, { repoId: repositoryId });

    const codeFiles = await cursor.all();
    const baseProfile = buildRepoProfile(codeFiles, businessContext);

    // Enrich with graph density
    let graphDensity = 0;
    try {
      const densityCursor = await dbClient.query(`
        LET nodeCount = (FOR v IN code_files FILTER v.repositoryId == @repoId COLLECT WITH COUNT INTO c RETURN c)[0]
        LET edgeCount = (
          FOR e IN depends_on
            LET fromDoc = DOCUMENT(e._from)
            FILTER fromDoc.repositoryId == @repoId
            COLLECT WITH COUNT INTO c RETURN c
        )[0]
        RETURN nodeCount > 1 ? edgeCount / (nodeCount * (nodeCount - 1)) : 0
      `, { repoId: repositoryId });
      const densityResult = await densityCursor.all();
      graphDensity = densityResult[0] || 0;
    } catch {
      // graph density is best-effort
    }

    return { ...baseProfile, graphDensity };
  } catch (err) {
    console.warn('[DynamicRouter] DB profile query failed, falling back to empty profile:', err);
    return {
      languages: [],
      frameworks: [],
      patterns: [],
      appType: businessContext?.appType?.toLowerCase() || 'unknown',
      fileCount: 0,
      graphDensity: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Agent selection
// ---------------------------------------------------------------------------

/**
 * Check whether a single agent's requirements are satisfied by the profile.
 */
function requirementsMet(requires: AgentRequirements, profile: RepoProfile): boolean {
  if (requires.hasLanguages && requires.hasLanguages.length > 0) {
    const profileLangs = new Set(profile.languages.map(l => l.toLowerCase()));
    if (!requires.hasLanguages.some(l => profileLangs.has(l.toLowerCase()))) return false;
  }

  if (requires.hasFrameworks && requires.hasFrameworks.length > 0) {
    const profileFrameworks = new Set(profile.frameworks.map(f => f.toLowerCase()));
    if (!requires.hasFrameworks.some(f => profileFrameworks.has(f.toLowerCase()))) return false;
  }

  if (requires.hasPatterns && requires.hasPatterns.length > 0) {
    const profilePatterns = new Set(profile.patterns.map(p => p.toLowerCase()));
    if (!requires.hasPatterns.some(p => profilePatterns.has(p.toLowerCase()))) return false;
  }

  if (requires.minFiles != null && profile.fileCount < requires.minFiles) return false;

  return true;
}

/**
 * Check whether an agent's exclusion conditions are triggered.
 */
function isExcluded(agent: AgentDefinition, profile: RepoProfile): boolean {
  if (!agent.excludeWhen) return false;

  if (agent.excludeWhen.appTypes?.includes(profile.appType)) return true;

  if (agent.excludeWhen.missingPatterns) {
    const profilePatterns = new Set(profile.patterns);
    if (agent.excludeWhen.missingPatterns.every(p => !profilePatterns.has(p))) return true;
  }

  return false;
}

/**
 * Select which agents should run for a given repository profile.
 *
 * @param registry - The full agent registry
 * @param profile - The repository profile
 * @param track - Optional filter to only include agents from a specific track
 * @returns Sorted array of agents that should run, ordered by priority
 */
export function selectAgents(
  registry: AgentDefinition[],
  profile: RepoProfile,
  track?: string,
): AgentDefinition[] {
  const selected = registry.filter(agent => {
    // Track filter
    if (track && agent.track !== track) return false;

    // Check requirements
    if (!requirementsMet(agent.requires, profile)) return false;

    // Check exclusions
    if (isExcluded(agent, profile)) return false;

    return true;
  });

  // Sort by priority (lower = first)
  selected.sort((a, b) => a.priority - b.priority);

  return selected;
}

/**
 * Convenience: build profile + select agents in one call.
 */
export function routeAgents(
  registry: AgentDefinition[],
  codeFiles: any[],
  businessContext?: any,
  track?: string,
): { profile: RepoProfile; agents: AgentDefinition[] } {
  const profile = buildRepoProfile(codeFiles, businessContext);
  const agents = selectAgents(registry, profile, track);
  return { profile, agents };
}
