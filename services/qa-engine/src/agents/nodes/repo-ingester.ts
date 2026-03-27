import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { QAAgentState } from '../state';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** File extensions we treat as source code and ingest. */
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx',
  '.py',
  '.java',
  '.cs',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.vue', '.svelte',
  '.json', '.yaml', '.yml',
  '.md',
]);

/** Max individual file size we will read (256 KB). */
const MAX_FILE_SIZE = 256 * 1024;

/** Max total content bytes we will carry in state (~8 MB). */
const MAX_TOTAL_CONTENT = 8 * 1024 * 1024;

/** Directories to always skip. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.pytest_cache', 'venv', '.venv', 'env',
  'target', 'bin', 'obj', 'vendor', '.idea', '.vscode',
  'coverage', '.nyc_output', '.turbo', '.cache',
]);

// ---------------------------------------------------------------------------
// Regex-based entity extraction
// ---------------------------------------------------------------------------

interface CodeEntity {
  name: string;
  type: string;        // 'function' | 'class' | 'interface' | 'type' | 'enum' | 'method'
  file: string;
  signature?: string;
}

interface CodeFile {
  path: string;
  language: string;
  size: number;
  content?: string;
  hasDocumentation?: boolean;
}

/**
 * Detect whether a file contains documentation (JSDoc, docstrings, comment blocks).
 */
function hasDocumentation(content: string, language: string): boolean {
  if (!content) return false;
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'java':
    case 'csharp':
    case 'php':
    case 'vue':
    case 'svelte':
      // JSDoc or multi-line comment blocks
      return /\/\*\*[\s\S]*?\*\//.test(content);
    case 'python':
      // Python docstrings (triple quotes)
      return /"""[\s\S]*?"""/.test(content) || /'''[\s\S]*?'''/.test(content);
    case 'ruby':
      // RDoc-style or YARD
      return /=begin[\s\S]*?=end/.test(content) || /^\s*#\s*@/.test(content);
    case 'go':
      // Go convention: comment preceding function
      return /\/\/\s+\w+\s/.test(content);
    case 'rust':
      // Rust doc comments
      return /\/\/\//.test(content) || /\/\/!/.test(content);
    default:
      // Generic: check for block comments
      return /\/\*\*[\s\S]*?\*\//.test(content) || /"""[\s\S]*?"""/.test(content);
  }
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.vue': 'vue', '.svelte': 'svelte',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.md': 'markdown',
};

/**
 * Language-specific regex patterns for extracting top-level code entities.
 * Each pattern is expected to have at least one named capture group `name`.
 */
const ENTITY_PATTERNS: Record<string, Array<{ re: RegExp; type: string }>> = {
  typescript: [
    { re: /(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)/g, type: 'function' },
    { re: /(?:export\s+)?class\s+(?<name>\w+)/g, type: 'class' },
    { re: /(?:export\s+)?interface\s+(?<name>\w+)/g, type: 'interface' },
    { re: /(?:export\s+)?type\s+(?<name>\w+)\s*=/g, type: 'type' },
    { re: /(?:export\s+)?enum\s+(?<name>\w+)/g, type: 'enum' },
    { re: /(?:const|let|var)\s+(?<name>\w+)\s*=\s*(?:async\s+)?\(/g, type: 'function' },
  ],
  javascript: [
    { re: /(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)/g, type: 'function' },
    { re: /(?:export\s+)?class\s+(?<name>\w+)/g, type: 'class' },
    { re: /(?:const|let|var)\s+(?<name>\w+)\s*=\s*(?:async\s+)?\(/g, type: 'function' },
  ],
  python: [
    { re: /^def\s+(?<name>\w+)\s*\(/gm, type: 'function' },
    { re: /^class\s+(?<name>\w+)/gm, type: 'class' },
    { re: /^\s{4}def\s+(?<name>\w+)\s*\(/gm, type: 'method' },
  ],
  java: [
    { re: /(?:public|private|protected)\s+(?:static\s+)?(?:[\w<>\[\]]+)\s+(?<name>\w+)\s*\(/g, type: 'function' },
    { re: /(?:public|private|protected)?\s*class\s+(?<name>\w+)/g, type: 'class' },
    { re: /(?:public|private|protected)?\s*interface\s+(?<name>\w+)/g, type: 'interface' },
    { re: /(?:public|private|protected)?\s*enum\s+(?<name>\w+)/g, type: 'enum' },
  ],
  csharp: [
    { re: /(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?[\w<>\[\]]+\s+(?<name>\w+)\s*\(/g, type: 'function' },
    { re: /class\s+(?<name>\w+)/g, type: 'class' },
    { re: /interface\s+(?<name>\w+)/g, type: 'interface' },
    { re: /enum\s+(?<name>\w+)/g, type: 'enum' },
  ],
  go: [
    { re: /func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?(?<name>\w+)\s*\(/g, type: 'function' },
    { re: /type\s+(?<name>\w+)\s+struct/g, type: 'class' },
    { re: /type\s+(?<name>\w+)\s+interface/g, type: 'interface' },
  ],
  rust: [
    { re: /(?:pub\s+)?(?:async\s+)?fn\s+(?<name>\w+)/g, type: 'function' },
    { re: /(?:pub\s+)?struct\s+(?<name>\w+)/g, type: 'class' },
    { re: /(?:pub\s+)?trait\s+(?<name>\w+)/g, type: 'interface' },
    { re: /(?:pub\s+)?enum\s+(?<name>\w+)/g, type: 'enum' },
  ],
  ruby: [
    { re: /def\s+(?:self\.)?(?<name>\w+)/g, type: 'function' },
    { re: /class\s+(?<name>\w+)/g, type: 'class' },
    { re: /module\s+(?<name>\w+)/g, type: 'class' },
  ],
  php: [
    { re: /(?:public|private|protected)?\s*function\s+(?<name>\w+)/g, type: 'function' },
    { re: /class\s+(?<name>\w+)/g, type: 'class' },
    { re: /interface\s+(?<name>\w+)/g, type: 'interface' },
  ],
  vue: [
    { re: /(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)/g, type: 'function' },
    { re: /(?:const|let|var)\s+(?<name>\w+)\s*=\s*(?:async\s+)?\(/g, type: 'function' },
  ],
  svelte: [
    { re: /(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)/g, type: 'function' },
    { re: /(?:const|let|var)\s+(?<name>\w+)\s*=\s*(?:async\s+)?\(/g, type: 'function' },
  ],
};

function extractEntities(content: string, language: string, filePath: string): CodeEntity[] {
  const patterns = ENTITY_PATTERNS[language];
  if (!patterns) return [];

  const entities: CodeEntity[] = [];
  const seen = new Set<string>();

  for (const { re, type } of patterns) {
    // Reset lastIndex since we reuse the regex across files
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const name = match.groups?.name;
      if (!name) continue;

      const key = `${type}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Grab the line as a rough signature (first 120 chars of the matched line)
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      const signature = line.length > 120 ? line.slice(0, 120) + '...' : line;

      entities.push({ name, type, file: filePath, signature });
    }
  }

  return entities;
}

// ---------------------------------------------------------------------------
// Directory walking
// ---------------------------------------------------------------------------

function walkDirectory(dir: string, rootDir: string): string[] {
  const results: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...walkDirectory(fullPath, rootDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SOURCE_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Git clone helper
// ---------------------------------------------------------------------------

function buildCloneUrl(repoUrl: string, token?: string): string {
  // If a token is supplied, inject it into the HTTPS URL for private repos
  if (token && repoUrl.startsWith('https://')) {
    const url = new URL(repoUrl);
    url.username = 'x-access-token';
    url.password = token;
    return url.toString();
  }
  return repoUrl;
}

function cloneRepo(repoUrl: string, branch: string, destDir: string, token?: string): void {
  const url = buildCloneUrl(repoUrl, token);
  const cmd = `git clone --depth 1 --branch ${branch} --single-branch "${url}" "${destDir}"`;
  console.log(`[RepoIngester] Cloning ${repoUrl} (branch: ${branch}) ...`);
  execSync(cmd, { stdio: 'pipe', timeout: 120_000 });
}

// ---------------------------------------------------------------------------
// Main node
// ---------------------------------------------------------------------------

export async function repoIngesterNode(
  state: QAAgentState,
  dbClient: any,
  eventPublisher?: any,
): Promise<Partial<QAAgentState>> {
  const { repoUrl, branch, repositoryId, credentials } = state.config;

  eventPublisher?.emit('qa:agent.started', {
    runId: state.runId,
    agent: 'repo_ingester',
    step: 'Checking for existing code data or cloning repository',
  });

  // -----------------------------------------------------------------------
  // 1. Try ArangoDB first -- if the repo was already ingested, use that data
  // -----------------------------------------------------------------------
  try {
    const existingFiles: CodeFile[] = await dbClient.query(
      `FOR f IN code_files
         FILTER f.repositoryId == @repoId
         LIMIT 200
         RETURN { path: f.path, language: f.language, size: f.size, content: SUBSTRING(f.content, 0, 2000) }`,
      { repoId: repositoryId },
    );

    if (existingFiles.length > 0) {
      const existingEntities: CodeEntity[] = await dbClient.query(
        `FOR e IN code_entities
           FILTER e.repositoryId == @repoId
           LIMIT 500
           RETURN { name: e.name, type: e.type, file: e.filePath, signature: e.signature }`,
        { repoId: repositoryId },
      );

      console.log(
        `[RepoIngester] Found ${existingFiles.length} files and ${existingEntities.length} entities in ArangoDB — skipping clone`,
      );

      eventPublisher?.emit('qa:agent.completed', {
        runId: state.runId,
        agent: 'repo_ingester',
        result: { source: 'arangodb', files: existingFiles.length, entities: existingEntities.length },
      });

      return {
        codeFiles: existingFiles,
        codeEntities: existingEntities,
        ingestionSource: 'arangodb',
      };
    }
  } catch (err: any) {
    console.warn(`[RepoIngester] ArangoDB lookup failed (non-fatal): ${err.message}`);
  }

  // -----------------------------------------------------------------------
  // 2. Clone the repo to a temp directory
  // -----------------------------------------------------------------------
  const tmpDir = path.join(os.tmpdir(), `qa-ingest-${state.runId}`);

  try {
    eventPublisher?.emit('qa:agent.progress', {
      runId: state.runId,
      agent: 'repo_ingester',
      progress: 10,
      message: 'Cloning repository...',
    });

    cloneRepo(repoUrl, branch, tmpDir, credentials?.token);

    // -------------------------------------------------------------------
    // 2b. Capture git commit info from the cloned repo
    // -------------------------------------------------------------------
    let commitSha = '';
    let commitMessage = '';
    let commitDate = '';
    try {
      commitSha = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
      commitMessage = execSync('git log -1 --format=%s', { cwd: tmpDir, encoding: 'utf-8' }).trim();
      commitDate = execSync('git log -1 --format=%ci', { cwd: tmpDir, encoding: 'utf-8' }).trim();
      console.log(`[RepoIngester] Commit: ${commitSha.slice(0, 8)} — "${commitMessage}" (${commitDate})`);
    } catch (gitErr: any) {
      console.warn(`[RepoIngester] Could not read git commit info: ${gitErr.message}`);
    }

    // -------------------------------------------------------------------
    // 3. Walk the directory tree and read files
    // -------------------------------------------------------------------
    eventPublisher?.emit('qa:agent.progress', {
      runId: state.runId,
      agent: 'repo_ingester',
      progress: 40,
      message: 'Reading source files...',
    });

    const absolutePaths = walkDirectory(tmpDir, tmpDir);
    const codeFiles: CodeFile[] = [];
    const codeEntities: CodeEntity[] = [];
    let totalContentBytes = 0;

    for (const absPath of absolutePaths) {
      const relPath = path.relative(tmpDir, absPath).replace(/\\/g, '/');
      const ext = path.extname(absPath).toLowerCase();
      const language = LANGUAGE_MAP[ext] || ext.slice(1);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(absPath);
      } catch {
        continue;
      }

      if (stat.size > MAX_FILE_SIZE) {
        codeFiles.push({ path: relPath, language, size: stat.size });
        continue;
      }

      let content: string | undefined;
      if (totalContentBytes < MAX_TOTAL_CONTENT) {
        try {
          content = fs.readFileSync(absPath, 'utf-8');
          totalContentBytes += Buffer.byteLength(content, 'utf-8');
        } catch {
          // binary or unreadable — skip content
        }
      }

      codeFiles.push({
        path: relPath,
        language,
        size: stat.size,
        content: content ? content.slice(0, 2000) : undefined,
        hasDocumentation: content ? hasDocumentation(content, language) : undefined,
      });

      // -------------------------------------------------------------------
      // 4. Extract entities
      // -------------------------------------------------------------------
      if (content && ENTITY_PATTERNS[language]) {
        const entities = extractEntities(content, language, relPath);
        codeEntities.push(...entities);
      }
    }

    console.log(
      `[RepoIngester] Cloned & scanned: ${codeFiles.length} files, ${codeEntities.length} entities`,
    );

    eventPublisher?.emit('qa:agent.completed', {
      runId: state.runId,
      agent: 'repo_ingester',
      result: { source: 'git_clone', files: codeFiles.length, entities: codeEntities.length },
    });

    return {
      codeFiles,
      codeEntities,
      ingestionSource: 'git_clone',
      commitSha,
      commitMessage,
      commitDate,
    };
  } catch (err: any) {
    console.error(`[RepoIngester] Clone/scan failed: ${err.message}`);

    eventPublisher?.emit('qa:agent.failed', {
      runId: state.runId,
      agent: 'repo_ingester',
      error: err.message,
    });

    // Return empty arrays so downstream nodes degrade gracefully
    return {
      codeFiles: [],
      codeEntities: [],
      ingestionSource: 'failed',
      errors: [...state.errors, `Repo ingestion failed: ${err.message}`],
    };
  } finally {
    // -------------------------------------------------------------------
    // 5. Cleanup temp directory
    // -------------------------------------------------------------------
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log(`[RepoIngester] Cleaned up temp dir: ${tmpDir}`);
    } catch {
      console.warn(`[RepoIngester] Could not clean up temp dir: ${tmpDir}`);
    }
  }
}
