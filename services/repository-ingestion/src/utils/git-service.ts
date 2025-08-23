import { simpleGit, SimpleGit, CleanOptions } from 'simple-git';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface GitCloneOptions {
  shallow?: boolean;
  depth?: number;
  branch?: string;
  submodules?: boolean;
}

export interface GitRepositoryInfo {
  url: string;
  branch: string;
  commit: string;
  author: string;
  message: string;
  date: Date;
  remotes: string[];
  tags: string[];
}

export class GitService {
  private tempDirectories: Set<string> = new Set();

  async cloneRepository(
    url: string, 
    branch: string = 'main', 
    options: GitCloneOptions = {}
  ): Promise<string> {
    try {
      // Create temporary directory
      const tempDir = await this.createTempDirectory();
      this.tempDirectories.add(tempDir);

      logger.info(`Cloning repository ${url} to ${tempDir}`);

      const git: SimpleGit = simpleGit();
      
      // Prepare clone options
      const cloneOptions: string[] = [];
      
      if (options.shallow || options.depth) {
        cloneOptions.push('--depth', String(options.depth || 1));
      }
      
      if (branch && branch !== 'main' && branch !== 'master') {
        cloneOptions.push('--branch', branch);
      }
      
      if (!options.submodules) {
        cloneOptions.push('--no-recurse-submodules');
      }

      // Clone the repository
      await git.clone(url, tempDir, cloneOptions);

      // Verify the clone was successful
      if (!fs.existsSync(path.join(tempDir, '.git'))) {
        throw new Error('Repository clone failed - no .git directory found');
      }

      logger.info(`Successfully cloned repository to ${tempDir}`);
      return tempDir;

    } catch (error) {
      logger.error(`Failed to clone repository ${url}:`, error);
      throw new Error(`Git clone failed: ${error.message}`);
    }
  }

  async getRepositoryInfo(repositoryPath: string): Promise<GitRepositoryInfo> {
    try {
      const git: SimpleGit = simpleGit(repositoryPath);

      const [
        remotes,
        currentBranch,
        latestCommit,
        tags
      ] = await Promise.all([
        git.getRemotes(true),
        git.revparse(['--abbrev-ref', 'HEAD']),
        git.log({ maxCount: 1 }),
        git.tags()
      ]);

      const remote = remotes.find(r => r.name === 'origin');
      const commit = latestCommit.latest;

      return {
        url: remote?.refs?.fetch || 'unknown',
        branch: currentBranch,
        commit: commit?.hash || 'unknown',
        author: commit?.author_name || 'unknown',
        message: commit?.message || 'unknown',
        date: commit?.date ? new Date(commit.date) : new Date(),
        remotes: remotes.map(r => r.refs.fetch).filter(Boolean),
        tags: tags.all
      };

    } catch (error) {
      logger.error(`Failed to get repository info for ${repositoryPath}:`, error);
      throw new Error(`Git info failed: ${error.message}`);
    }
  }

  async getBranches(repositoryPath: string): Promise<{
    current: string;
    all: string[];
    remote: string[];
  }> {
    try {
      const git: SimpleGit = simpleGit(repositoryPath);

      const branchSummary = await git.branch(['-a']);

      return {
        current: branchSummary.current,
        all: branchSummary.all,
        remote: branchSummary.all.filter(branch => branch.startsWith('remotes/'))
      };

    } catch (error) {
      logger.error(`Failed to get branches for ${repositoryPath}:`, error);
      throw new Error(`Git branches failed: ${error.message}`);
    }
  }

  async getCommitHistory(
    repositoryPath: string, 
    options: {
      maxCount?: number;
      since?: string;
      until?: string;
      author?: string;
      grep?: string;
    } = {}
  ): Promise<Array<{
    hash: string;
    date: Date;
    message: string;
    author: string;
    email: string;
    refs: string;
  }>> {
    try {
      const git: SimpleGit = simpleGit(repositoryPath);

      const logOptions: any = {
        maxCount: options.maxCount || 100
      };

      if (options.since) logOptions.from = options.since;
      if (options.until) logOptions.to = options.until;
      if (options.author) logOptions.author = options.author;
      if (options.grep) logOptions.grep = options.grep;

      const log = await git.log(logOptions);

      return log.all.map(commit => ({
        hash: commit.hash,
        date: new Date(commit.date),
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email,
        refs: commit.refs
      }));

    } catch (error) {
      logger.error(`Failed to get commit history for ${repositoryPath}:`, error);
      throw new Error(`Git log failed: ${error.message}`);
    }
  }

  async getFileHistory(
    repositoryPath: string,
    filePath: string,
    maxCount: number = 50
  ): Promise<Array<{
    hash: string;
    date: Date;
    message: string;
    author: string;
    changes: {
      insertions: number;
      deletions: number;
    };
  }>> {
    try {
      const git: SimpleGit = simpleGit(repositoryPath);

      const log = await git.log({
        file: filePath,
        maxCount,
        format: {
          hash: '%H',
          date: '%ai',
          message: '%s',
          author_name: '%an',
          author_email: '%ae'
        }
      });

      const fileHistory = [];

      for (const commit of log.all) {
        try {
          // Get diff stats for this commit
          const diffStat = await git.show([
            '--numstat',
            '--format=',
            commit.hash,
            '--',
            filePath
          ]);

          const lines = diffStat.split('\n').filter(line => line.trim());
          let insertions = 0;
          let deletions = 0;

          if (lines.length > 0) {
            const stats = lines[0].split('\t');
            insertions = parseInt(stats[0]) || 0;
            deletions = parseInt(stats[1]) || 0;
          }

          fileHistory.push({
            hash: commit.hash,
            date: new Date(commit.date),
            message: commit.message,
            author: commit.author_name,
            changes: {
              insertions,
              deletions
            }
          });

        } catch (diffError) {
          logger.warn(`Failed to get diff stats for commit ${commit.hash}:`, diffError);
          fileHistory.push({
            hash: commit.hash,
            date: new Date(commit.date),
            message: commit.message,
            author: commit.author_name,
            changes: {
              insertions: 0,
              deletions: 0
            }
          });
        }
      }

      return fileHistory;

    } catch (error) {
      logger.error(`Failed to get file history for ${filePath}:`, error);
      throw new Error(`Git file history failed: ${error.message}`);
    }
  }

  async getDiffBetweenCommits(
    repositoryPath: string,
    fromCommit: string,
    toCommit: string,
    filePath?: string
  ): Promise<string> {
    try {
      const git: SimpleGit = simpleGit(repositoryPath);

      const diffOptions = [fromCommit, toCommit];
      if (filePath) {
        diffOptions.push('--', filePath);
      }

      const diff = await git.diff(diffOptions);
      return diff;

    } catch (error) {
      logger.error(`Failed to get diff between commits:`, error);
      throw new Error(`Git diff failed: ${error.message}`);
    }
  }

  async getFileBlame(
    repositoryPath: string,
    filePath: string
  ): Promise<Array<{
    line: number;
    content: string;
    hash: string;
    author: string;
    date: Date;
  }>> {
    try {
      const git: SimpleGit = simpleGit(repositoryPath);

      const blame = await git.raw(['blame', '--line-porcelain', filePath]);
      const lines = blame.split('\n');
      
      const blameData = [];
      let currentCommit = '';
      let currentAuthor = '';
      let currentDate = '';
      let lineNumber = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.match(/^[0-9a-f]{40}/)) {
          currentCommit = line.split(' ')[0];
        } else if (line.startsWith('author ')) {
          currentAuthor = line.substring(7);
        } else if (line.startsWith('author-time ')) {
          const timestamp = parseInt(line.substring(12));
          currentDate = new Date(timestamp * 1000).toISOString();
        } else if (line.startsWith('\t')) {
          const content = line.substring(1);
          blameData.push({
            line: lineNumber++,
            content,
            hash: currentCommit,
            author: currentAuthor,
            date: new Date(currentDate)
          });
        }
      }

      return blameData;

    } catch (error) {
      logger.error(`Failed to get file blame for ${filePath}:`, error);
      throw new Error(`Git blame failed: ${error.message}`);
    }
  }

  async getRepositoryStats(repositoryPath: string): Promise<{
    totalCommits: number;
    totalContributors: number;
    firstCommitDate: Date;
    lastCommitDate: Date;
    totalFiles: number;
    totalLines: number;
    languageStats: Record<string, number>;
  }> {
    try {
      const git: SimpleGit = simpleGit(repositoryPath);

      // Get commit count
      const commitCount = await git.raw(['rev-list', '--count', 'HEAD']);
      const totalCommits = parseInt(commitCount.trim());

      // Get contributor count
      const contributors = await git.raw(['log', '--format=%an']);
      const uniqueContributors = new Set(contributors.split('\n').filter(name => name.trim()));
      const totalContributors = uniqueContributors.size;

      // Get first and last commit dates
      const firstCommitLog = await git.log({ reverse: true, maxCount: 1 });
      const lastCommitLog = await git.log({ maxCount: 1 });

      const firstCommitDate = firstCommitLog.latest?.date ? new Date(firstCommitLog.latest.date) : new Date();
      const lastCommitDate = lastCommitLog.latest?.date ? new Date(lastCommitLog.latest.date) : new Date();

      // Get file statistics
      const fileList = await git.raw(['ls-tree', '-r', '--name-only', 'HEAD']);
      const files = fileList.split('\n').filter(file => file.trim());
      const totalFiles = files.length;

      // Count lines and analyze languages
      let totalLines = 0;
      const languageStats: Record<string, number> = {};

      for (const file of files) {
        try {
          const fullPath = path.join(repositoryPath, file);
          const stats = fs.statSync(fullPath);
          
          if (stats.isFile()) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n').length;
            totalLines += lines;

            const extension = path.extname(file).toLowerCase();
            languageStats[extension] = (languageStats[extension] || 0) + lines;
          }
        } catch (fileError) {
          // Skip files that can't be read
          logger.debug(`Skipping file ${file}:`, fileError);
        }
      }

      return {
        totalCommits,
        totalContributors,
        firstCommitDate,
        lastCommitDate,
        totalFiles,
        totalLines,
        languageStats
      };

    } catch (error) {
      logger.error(`Failed to get repository stats:`, error);
      throw new Error(`Git stats failed: ${error.message}`);
    }
  }

  async isValidRepository(repositoryPath: string): Promise<boolean> {
    try {
      const git: SimpleGit = simpleGit(repositoryPath);
      await git.revparse(['--git-dir']);
      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanup(repositoryPath: string): Promise<void> {
    try {
      if (this.tempDirectories.has(repositoryPath)) {
        logger.info(`Cleaning up temporary directory: ${repositoryPath}`);
        
        // Remove directory recursively
        await this.removeDirectory(repositoryPath);
        this.tempDirectories.delete(repositoryPath);
        
        logger.debug(`Successfully cleaned up ${repositoryPath}`);
      }
    } catch (error) {
      logger.error(`Failed to cleanup directory ${repositoryPath}:`, error);
      // Don't throw error for cleanup failures
    }
  }

  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.tempDirectories).map(dir => this.cleanup(dir));
    await Promise.allSettled(cleanupPromises);
  }

  private async createTempDirectory(): Promise<string> {
    const tempBase = os.tmpdir();
    const tempName = `ai-code-mgmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempDir = path.join(tempBase, tempName);
    
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    if (fs.existsSync(dirPath)) {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          await this.removeDirectory(itemPath);
        } else {
          fs.unlinkSync(itemPath);
        }
      }
      
      fs.rmdirSync(dirPath);
    }
  }

  // Utility methods for repository validation

  static isValidGitUrl(url: string): boolean {
    const gitUrlPatterns = [
      /^https?:\/\/.+\.git$/,
      /^git@.+:.+\.git$/,
      /^ssh:\/\/git@.+\/.+\.git$/,
      /^https?:\/\/github\.com\/.+\/.+$/,
      /^https?:\/\/gitlab\.com\/.+\/.+$/,
      /^https?:\/\/bitbucket\.org\/.+\/.+$/
    ];

    return gitUrlPatterns.some(pattern => pattern.test(url));
  }

  static extractRepoNameFromUrl(url: string): string {
    try {
      const urlParts = url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      
      // Remove .git extension if present
      return lastPart.endsWith('.git') ? lastPart.slice(0, -4) : lastPart;
    } catch (error) {
      return 'unknown-repo';
    }
  }

  static extractOwnerFromUrl(url: string): string {
    try {
      const urlParts = url.split('/');
      if (urlParts.length >= 2) {
        return urlParts[urlParts.length - 2];
      }
      return 'unknown-owner';
    } catch (error) {
      return 'unknown-owner';
    }
  }

  // Integration with the ingestion process

  async prepareRepositoryForIngestion(
    url: string,
    branch: string = 'main',
    options: GitCloneOptions = {}
  ): Promise<{
    path: string;
    info: GitRepositoryInfo;
    stats: any;
  }> {
    try {
      // Clone the repository
      const repositoryPath = await this.cloneRepository(url, branch, options);
      
      // Get repository information
      const info = await this.getRepositoryInfo(repositoryPath);
      
      // Get basic stats
      const stats = await this.getRepositoryStats(repositoryPath);
      
      return {
        path: repositoryPath,
        info,
        stats
      };

    } catch (error) {
      logger.error(`Failed to prepare repository for ingestion:`, error);
      throw error;
    }
  }

  async analyzeRepositoryForSecurity(repositoryPath: string): Promise<{
    hasSecrets: boolean;
    secretFiles: string[];
    largeBinaryFiles: string[];
    suspiciousPatterns: string[];
  }> {
    const analysis = {
      hasSecrets: false,
      secretFiles: [],
      largeBinaryFiles: [],
      suspiciousPatterns: []
    };

    try {
      const git: SimpleGit = simpleGit(repositoryPath);
      const files = await git.raw(['ls-tree', '-r', '--name-only', 'HEAD']);
      const fileList = files.split('\n').filter(f => f.trim());

      for (const file of fileList) {
        const fullPath = path.join(repositoryPath, file);
        
        try {
          const stats = fs.statSync(fullPath);
          
          // Check for large binary files (>10MB)
          if (stats.size > 10 * 1024 * 1024) {
            analysis.largeBinaryFiles.push(file);
          }
          
          // Check for potential secret files
          const secretPatterns = [
            /\.env$/,
            /\.key$/,
            /\.pem$/,
            /\.p12$/,
            /\.pfx$/,
            /id_rsa$/,
            /id_dsa$/,
            /\.ssh\/config$/,
            /\.aws\/credentials$/
          ];
          
          if (secretPatterns.some(pattern => pattern.test(file))) {
            analysis.secretFiles.push(file);
            analysis.hasSecrets = true;
          }
          
          // Check file content for suspicious patterns (only text files)
          if (stats.size < 1024 * 1024 && this.isTextFile(file)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const suspiciousPatterns = [
              /password\s*=\s*['"]\w+['"]/i,
              /api[_-]?key\s*=\s*['"]\w+['"]/i,
              /secret\s*=\s*['"]\w+['"]/i,
              /token\s*=\s*['"]\w+['"]/i,
              /-----BEGIN (RSA |DSA )?PRIVATE KEY-----/
            ];
            
            suspiciousPatterns.forEach(pattern => {
              if (pattern.test(content)) {
                analysis.suspiciousPatterns.push(`${file}: potential secret pattern`);
                analysis.hasSecrets = true;
              }
            });
          }
          
        } catch (fileError) {
          logger.debug(`Skipping security analysis for ${file}:`, fileError);
        }
      }

    } catch (error) {
      logger.error(`Failed to analyze repository security:`, error);
    }

    return analysis;
  }

  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs',
      '.cpp', '.c', '.h', '.hpp', '.rb', '.php', '.go', '.rs', '.swift',
      '.kt', '.scala', '.sql', '.html', '.css', '.scss', '.less', '.json',
      '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'
    ];
    
    const extension = path.extname(filePath).toLowerCase();
    return textExtensions.includes(extension);
  }
}
