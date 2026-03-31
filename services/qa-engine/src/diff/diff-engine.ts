/**
 * Git diff engine — computes file-level changes between commits.
 * Uses the persistent repo cache from repo-ingester.ts.
 */
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

export interface DiffResult {
  fromCommit: string | null;
  toCommit: string;
  changedFiles: ChangedFile[];
  stats: {
    added: number;
    modified: number;
    deleted: number;
    renamed: number;
    total: number;
  };
  isFirstRun: boolean;
}

const REPO_CACHE_DIR = path.join(process.cwd(), '.qa-repo-cache');

function getRepoCachePath(repoUrl: string, branch: string): string {
  const hash = crypto.createHash('sha256').update(`${repoUrl}:${branch}`).digest('hex').substring(0, 16);
  return path.join(REPO_CACHE_DIR, hash);
}

/**
 * Compute the diff between the last analyzed commit and current HEAD.
 * Returns null if the repo cache doesn't exist (needs full clone first).
 */
export async function computeDiff(
  repoUrl: string,
  branch: string,
  lastAnalyzedCommit: string | null
): Promise<DiffResult> {
  const cachePath = getRepoCachePath(repoUrl, branch);

  if (!fs.existsSync(cachePath)) {
    // No cache — repo hasn't been cloned yet. Full analysis required.
    return {
      fromCommit: null,
      toCommit: 'unknown',
      changedFiles: [],
      stats: { added: 0, modified: 0, deleted: 0, renamed: 0, total: 0 },
      isFirstRun: true,
    };
  }

  // Fetch latest changes
  try {
    execSync(`git fetch origin ${branch}`, { cwd: cachePath, stdio: 'pipe', timeout: 30000 });
    execSync(`git checkout FETCH_HEAD`, { cwd: cachePath, stdio: 'pipe', timeout: 10000 });
  } catch (err) {
    console.error('[DiffEngine] Git fetch failed:', err);
  }

  // Get current HEAD
  const toCommit = execSync('git rev-parse HEAD', { cwd: cachePath, encoding: 'utf-8' }).trim();

  if (!lastAnalyzedCommit) {
    return {
      fromCommit: null,
      toCommit,
      changedFiles: [],
      stats: { added: 0, modified: 0, deleted: 0, renamed: 0, total: 0 },
      isFirstRun: true,
    };
  }

  if (lastAnalyzedCommit === toCommit) {
    return {
      fromCommit: lastAnalyzedCommit,
      toCommit,
      changedFiles: [],
      stats: { added: 0, modified: 0, deleted: 0, renamed: 0, total: 0 },
      isFirstRun: false,
    };
  }

  // Compute diff
  const changedFiles: ChangedFile[] = [];

  try {
    // Get name-status for file changes
    const nameStatus = execSync(
      `git diff --name-status ${lastAnalyzedCommit}..${toCommit}`,
      { cwd: cachePath, encoding: 'utf-8', timeout: 15000 }
    ).trim();

    if (nameStatus) {
      for (const line of nameStatus.split('\n')) {
        const [status, ...pathParts] = line.split('\t');
        const filePath = pathParts[pathParts.length - 1]; // Handle renames (R100\told\tnew)

        if (!filePath) continue;

        let fileStatus: ChangedFile['status'] = 'modified';
        if (status.startsWith('A')) fileStatus = 'added';
        else if (status.startsWith('D')) fileStatus = 'deleted';
        else if (status.startsWith('R')) fileStatus = 'renamed';
        else if (status.startsWith('M')) fileStatus = 'modified';

        changedFiles.push({ path: filePath, status: fileStatus, additions: 0, deletions: 0 });
      }
    }

    // Get numstat for line counts
    const numstat = execSync(
      `git diff --numstat ${lastAnalyzedCommit}..${toCommit}`,
      { cwd: cachePath, encoding: 'utf-8', timeout: 15000 }
    ).trim();

    if (numstat) {
      const statMap = new Map<string, { additions: number; deletions: number }>();
      for (const line of numstat.split('\n')) {
        const [add, del, file] = line.split('\t');
        if (file) {
          statMap.set(file, {
            additions: add === '-' ? 0 : parseInt(add, 10) || 0,
            deletions: del === '-' ? 0 : parseInt(del, 10) || 0,
          });
        }
      }

      for (const cf of changedFiles) {
        const stat = statMap.get(cf.path);
        if (stat) {
          cf.additions = stat.additions;
          cf.deletions = stat.deletions;
        }
      }
    }
  } catch (err) {
    console.error('[DiffEngine] Git diff failed:', err);
    // If diff fails (e.g., commit not found), treat as first run
    return {
      fromCommit: lastAnalyzedCommit,
      toCommit,
      changedFiles: [],
      stats: { added: 0, modified: 0, deleted: 0, renamed: 0, total: 0 },
      isFirstRun: true,
    };
  }

  const stats = {
    added: changedFiles.filter(f => f.status === 'added').length,
    modified: changedFiles.filter(f => f.status === 'modified').length,
    deleted: changedFiles.filter(f => f.status === 'deleted').length,
    renamed: changedFiles.filter(f => f.status === 'renamed').length,
    total: changedFiles.length,
  };

  console.log(`[DiffEngine] ${stats.total} files changed: +${stats.added} ~${stats.modified} -${stats.deleted} R${stats.renamed}`);

  return { fromCommit: lastAnalyzedCommit, toCommit, changedFiles, stats, isFirstRun: false };
}
