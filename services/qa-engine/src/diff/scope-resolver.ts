/**
 * Scope resolver — maps changed files to affected agents.
 * Determines which agents need to re-run vs which can inherit previous results.
 */
import { ChangedFile } from './diff-engine';

export interface ScopeResolution {
  agentsToRun: string[];
  agentsToSkip: string[];
  agentsToInherit: string[];
  reasoning: Record<string, string>;
}

/** Agents that ALWAYS run regardless of diff (foundational analysis) */
const ALWAYS_RUN = ['business-context-analyzer', 'code-quality-architect'];

/** File pattern → agent mapping */
const SCOPE_PATTERNS: Array<{
  agentId: string;
  filePatterns: RegExp[];
  description: string;
}> = [
  {
    agentId: 'api-validator',
    filePatterns: [
      /routes?\.(ts|js|py|rb|go|java)$/i,
      /controllers?\.(ts|js|py|rb|go|java)$/i,
      /handlers?\.(ts|js|py|rb|go|java)$/i,
      /\/api\//i,
      /\/routes\//i,
      /\/controllers\//i,
      /\/handlers\//i,
    ],
    description: 'API routes, controllers, or handlers',
  },
  {
    agentId: 'ui-ux-analyst',
    filePatterns: [
      /\.(tsx|jsx)$/i,
      /\/components\//i,
      /\/pages\//i,
      /\/views\//i,
      /\.vue$/i,
      /\.svelte$/i,
    ],
    description: 'Frontend components, pages, or views',
  },
  {
    agentId: 'self-healer',
    filePatterns: [
      /\.(ts|tsx|js|jsx|py|java|go|rs|rb)$/i,
    ],
    description: 'Any source code file',
  },
  {
    agentId: 'coverage-auditor',
    filePatterns: [
      /routes?\.(ts|js|py|rb|go|java)$/i,
      /\/api\//i,
      /\/routes\//i,
      /\.(tsx|jsx)$/i,
      /\/components\//i,
      /\/pages\//i,
    ],
    description: 'Backend routes OR frontend consumers',
  },
  {
    agentId: 'behavioral-analyst',
    filePatterns: [
      /\.(ts|tsx|js|jsx|py|java|go|rs|rb)$/i,
    ],
    description: 'Any source code affecting behavior',
  },
  {
    agentId: 'change-tracker',
    filePatterns: [
      /\.(ts|tsx|js|jsx|py|java|go|rs|rb|json|yaml|yml)$/i,
    ],
    description: 'Any tracked file type',
  },
  {
    agentId: 'fullstack-auditor',
    filePatterns: [
      /\/api\//i,
      /\/routes\//i,
      /\.(tsx|jsx)$/i,
      /\/components\//i,
    ],
    description: 'Backend API or frontend components',
  },
  {
    agentId: 'gherkin-writer',
    filePatterns: [
      /\.(ts|tsx|js|jsx|py|java|go|rs|rb)$/i,
    ],
    description: 'Source code changes needing behavior specs',
  },
  // Infrastructure agents
  {
    agentId: 'docker-analyzer',
    filePatterns: [/dockerfile/i, /docker-compose/i, /\.dockerignore/i],
    description: 'Docker configuration',
  },
  {
    agentId: 'cicd-analyzer',
    filePatterns: [/\.github\/workflows/i, /\.gitlab-ci/i, /jenkinsfile/i, /\.circleci/i],
    description: 'CI/CD configuration',
  },
  {
    agentId: 'infrastructure-as-code',
    filePatterns: [/\.tf$/i, /terraform/i, /k8s/i, /kubernetes/i, /helm/i],
    description: 'Infrastructure-as-code files',
  },
];

/**
 * Resolve which agents should run based on changed files.
 * @param changedFiles - Files that changed since last analysis
 * @param selectedAgents - Agent IDs selected for this pipeline run
 * @param forceAgents - Agent IDs the user wants to force-include
 */
export function resolveScope(
  changedFiles: ChangedFile[],
  selectedAgents: string[],
  forceAgents: string[] = []
): ScopeResolution {
  const agentsToRun = new Set<string>();
  const reasoning: Record<string, string> = {};

  // Always-run agents
  for (const agentId of ALWAYS_RUN) {
    if (selectedAgents.includes(agentId)) {
      agentsToRun.add(agentId);
      reasoning[agentId] = 'Foundational agent — always runs';
    }
  }

  // Force-included agents
  for (const agentId of forceAgents) {
    if (selectedAgents.includes(agentId)) {
      agentsToRun.add(agentId);
      reasoning[agentId] = 'Force-included by user';
    }
  }

  // Pattern-match changed files against agent scopes
  for (const scope of SCOPE_PATTERNS) {
    if (!selectedAgents.includes(scope.agentId)) continue;
    if (agentsToRun.has(scope.agentId)) continue;

    const matchingFiles = changedFiles.filter(f =>
      f.status !== 'deleted' && scope.filePatterns.some(p => p.test(f.path))
    );

    if (matchingFiles.length > 0) {
      agentsToRun.add(scope.agentId);
      const fileList = matchingFiles.slice(0, 3).map(f => f.path).join(', ');
      const more = matchingFiles.length > 3 ? ` (+${matchingFiles.length - 3} more)` : '';
      reasoning[scope.agentId] = `${scope.description} changed: ${fileList}${more}`;
    }
  }

  // Categorize remaining agents
  const agentsToSkip: string[] = [];
  const agentsToInherit: string[] = [];

  for (const agentId of selectedAgents) {
    if (!agentsToRun.has(agentId)) {
      agentsToInherit.push(agentId);
      reasoning[agentId] = reasoning[agentId] || 'No relevant files changed — inheriting previous results';
    }
  }

  console.log(`[ScopeResolver] ${agentsToRun.size} agents to run, ${agentsToInherit.length} to inherit`);
  for (const [agent, reason] of Object.entries(reasoning)) {
    console.log(`  ${agentsToRun.has(agent) ? '▶' : '⏭'} ${agent}: ${reason}`);
  }

  return {
    agentsToRun: Array.from(agentsToRun),
    agentsToSkip,
    agentsToInherit,
    reasoning,
  };
}
