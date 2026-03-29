/**
 * Graph intelligence helpers for QA agents.
 * Extracts import/call/dependency relationships from code files
 * and provides analysis functions (hub files, circular deps, blast radius).
 */

export interface Relationship {
  from: string;      // file path
  to: string;        // file path or module name
  type: 'import' | 'call' | 'extends' | 'dependency';
  evidence?: string;  // the actual import statement or call
}

export interface HubFile {
  path: string;
  importedBy: number;   // how many files import this one
  imports: number;       // how many files this one imports
  totalConnections: number;
}

export interface GraphContext {
  totalRelationships: number;
  hubFiles: HubFile[];          // top 5 most-connected files
  circularDependencies: string[][]; // groups of files in cycles
  orphanFiles: string[];         // files with zero connections
  importGraph: Map<string, string[]>; // file -> files it imports
  dependentGraph: Map<string, string[]>; // file -> files that import it
}

/**
 * Extract all import relationships from code files.
 * Handles: ES6 imports, CommonJS require, dynamic imports.
 */
export function extractRelationships(codeFiles: Array<{path: string; content?: string}>): Relationship[] {
  const relationships: Relationship[] = [];

  for (const file of codeFiles) {
    if (!file.content || !file.path) continue;

    // ES6 imports: import X from './path'
    const es6Regex = /(?:import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let match;
    while ((match = es6Regex.exec(file.content)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath && importPath.startsWith('.')) {
        // Resolve relative import
        const fromDir = file.path.substring(0, file.path.lastIndexOf('/'));
        const resolved = resolveRelativePath(fromDir, importPath);
        // Find actual file
        const targetFile = findFileByImport(codeFiles, resolved);
        if (targetFile) {
          relationships.push({
            from: file.path,
            to: targetFile.path,
            type: 'import',
            evidence: match[0].trim()
          });
        }
      }
    }

    // Class extends: class X extends Y
    const extendsRegex = /class\s+\w+\s+extends\s+(\w+)/g;
    while ((match = extendsRegex.exec(file.content)) !== null) {
      relationships.push({
        from: file.path,
        to: match[1],  // class name, not file
        type: 'extends',
        evidence: match[0]
      });
    }
  }

  return relationships;
}

function resolveRelativePath(fromDir: string, importPath: string): string {
  const parts = fromDir.split('/').filter(Boolean);
  for (const seg of importPath.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function findFileByImport(codeFiles: Array<{path: string}>, resolved: string): {path: string} | undefined {
  const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json', '/index.js', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const target = resolved + ext;
    const found = codeFiles.find(f => f.path === target || f.path.endsWith('/' + target));
    if (found) return found;
  }
  return undefined;
}

/**
 * Build graph context from relationships.
 */
export function buildGraphContext(
  relationships: Relationship[],
  codeFiles: Array<{path: string}>
): GraphContext {
  const importGraph = new Map<string, string[]>();
  const dependentGraph = new Map<string, string[]>();

  for (const rel of relationships) {
    if (rel.type === 'import') {
      if (!importGraph.has(rel.from)) importGraph.set(rel.from, []);
      importGraph.get(rel.from)!.push(rel.to);

      if (!dependentGraph.has(rel.to)) dependentGraph.set(rel.to, []);
      dependentGraph.get(rel.to)!.push(rel.from);
    }
  }

  // Find hub files (most connections)
  const hubFiles: HubFile[] = codeFiles
    .map(f => ({
      path: f.path,
      importedBy: (dependentGraph.get(f.path) || []).length,
      imports: (importGraph.get(f.path) || []).length,
      totalConnections: (dependentGraph.get(f.path) || []).length + (importGraph.get(f.path) || []).length
    }))
    .sort((a, b) => b.totalConnections - a.totalConnections)
    .slice(0, 10);

  // Find circular dependencies (simple cycle detection)
  const circularDeps = findCircularDependencies(importGraph);

  // Find orphan files (no imports and no dependents)
  const orphanFiles = codeFiles
    .filter(f => !importGraph.has(f.path) && !dependentGraph.has(f.path))
    .filter(f => f.path.match(/\.(ts|tsx|js|jsx)$/))
    .map(f => f.path);

  return {
    totalRelationships: relationships.length,
    hubFiles,
    circularDependencies: circularDeps,
    orphanFiles,
    importGraph,
    dependentGraph
  };
}

function findCircularDependencies(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const neighbor of (graph.get(node) || [])) {
      dfs(neighbor, [...path]);
    }

    recursionStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles.slice(0, 10); // limit to 10 cycles
}

/**
 * Calculate blast radius: which files are transitively affected by a change to `filePath`.
 */
export function calculateBlastRadius(
  filePath: string,
  dependentGraph: Map<string, string[]>,
  maxDepth: number = 5
): { affected: string[]; depth: Map<string, number> } {
  const affected = new Set<string>();
  const depth = new Map<string, number>();
  const queue: Array<{file: string; d: number}> = [{file: filePath, d: 0}];

  while (queue.length > 0) {
    const {file, d} = queue.shift()!;
    if (d > maxDepth) continue;

    const dependents = dependentGraph.get(file) || [];
    for (const dep of dependents) {
      if (!affected.has(dep)) {
        affected.add(dep);
        depth.set(dep, d + 1);
        queue.push({file: dep, d: d + 1});
      }
    }
  }

  return { affected: Array.from(affected), depth };
}

/**
 * Format graph context for inclusion in LLM prompts.
 */
export function formatGraphContextForPrompt(ctx: GraphContext): string {
  if (ctx.totalRelationships === 0) return '';

  let prompt = `\n## Code Structure Intelligence (${ctx.totalRelationships} relationships detected)\n\n`;

  if (ctx.hubFiles.length > 0) {
    prompt += `### Hub Files (most connected — changes here have wide impact)\n`;
    for (const hub of ctx.hubFiles.slice(0, 5)) {
      prompt += `- **${hub.path}**: imported by ${hub.importedBy} files, imports ${hub.imports} files\n`;
    }
    prompt += '\n';
  }

  if (ctx.circularDependencies.length > 0) {
    prompt += `### Circular Dependencies (${ctx.circularDependencies.length} cycles detected)\n`;
    for (const cycle of ctx.circularDependencies.slice(0, 3)) {
      prompt += `- ${cycle.join(' → ')} → ${cycle[0]}\n`;
    }
    prompt += '\n';
  }

  if (ctx.orphanFiles.length > 0) {
    prompt += `### Orphan Files (${ctx.orphanFiles.length} files with no connections — may be dead code)\n`;
    for (const f of ctx.orphanFiles.slice(0, 5)) {
      prompt += `- ${f}\n`;
    }
    prompt += '\n';
  }

  return prompt;
}
