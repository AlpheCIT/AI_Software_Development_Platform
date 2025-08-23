/**
 * GitHub API Integration Service
 * Handles GitHub repository search, validation, and metadata retrieval
 */

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  git_url: string;
  ssh_url: string;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  size: number;
  default_branch: string;
  owner: {
    login: string;
    avatar_url: string;
    type: 'User' | 'Organization';
  };
  created_at: string;
  updated_at: string;
  pushed_at: string;
  topics: string[];
  license: {
    key: string;
    name: string;
  } | null;
}

export interface GitHubSearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

export interface RepoValidationResult {
  isValid: boolean;
  isAccessible: boolean;
  size: number;
  language: string | null;
  defaultBranch: string;
  lastUpdated: string;
  errors?: string[];
  warnings?: string[];
}

class GitHubService {
  private readonly apiUrl = 'https://api.github.com';
  private readonly proxyUrl = '/api/github'; // Use backend proxy to avoid CORS
  
  /**
   * Search GitHub repositories
   */
  async searchRepositories(query: string, options: {
    sort?: 'stars' | 'updated' | 'forks';
    order?: 'desc' | 'asc';
    per_page?: number;
    language?: string;
  } = {}): Promise<GitHubSearchResult> {
    try {
      const searchParams = new URLSearchParams({
        q: query,
        sort: options.sort || 'stars',
        order: options.order || 'desc',
        per_page: (options.per_page || 30).toString()
      });

      if (options.language) {
        searchParams.set('q', `${query} language:${options.language}`);
      }

      const response = await fetch(`${this.proxyUrl}/search/repositories?${searchParams}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub search failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ GitHub repository search failed:', error);
      throw error;
    }
  }

  /**
   * Get repository details from GitHub URL or full name
   */
  async getRepositoryDetails(repoIdentifier: string): Promise<GitHubRepository> {
    try {
      let owner: string;
      let repo: string;

      // Handle different input formats
      if (repoIdentifier.includes('github.com')) {
        // Extract from URL: https://github.com/owner/repo
        const match = repoIdentifier.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
        if (!match) {
          throw new Error('Invalid GitHub repository URL');
        }
        [, owner, repo] = match;
        // Remove .git suffix if present
        repo = repo.replace(/\.git$/, '');
      } else if (repoIdentifier.includes('/')) {
        // Handle owner/repo format
        [owner, repo] = repoIdentifier.split('/');
      } else {
        throw new Error('Repository must be in format "owner/repo" or GitHub URL');
      }

      const response = await fetch(`${this.proxyUrl}/repos/${owner}/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository not found or is private');
        }
        throw new Error(`Failed to get repository details: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get repository details:', error);
      throw error;
    }
  }

  /**
   * Validate repository for ingestion
   */
  async validateRepository(repoIdentifier: string): Promise<RepoValidationResult> {
    try {
      const repo = await this.getRepositoryDetails(repoIdentifier);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check accessibility
      if (repo.private) {
        errors.push('Repository is private and may not be accessible');
      }

      // Check size (GitHub limit is typically 1GB, warn at 100MB)
      if (repo.size > 100000) { // Size is in KB
        warnings.push(`Repository is large (${Math.round(repo.size / 1024)}MB). Ingestion may take longer.`);
      }

      if (repo.size > 1000000) { // 1GB
        errors.push('Repository is too large for ingestion (>1GB)');
      }

      // Check if recently updated
      const lastUpdate = new Date(repo.updated_at);
      const monthsOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld > 12) {
        warnings.push('Repository has not been updated in over a year');
      }

      // Check language support
      const supportedLanguages = [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 
        'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Scala', 'C'
      ];

      if (repo.language && !supportedLanguages.includes(repo.language)) {
        warnings.push(`Language ${repo.language} may have limited analysis support`);
      }

      return {
        isValid: errors.length === 0,
        isAccessible: !repo.private,
        size: repo.size,
        language: repo.language,
        defaultBranch: repo.default_branch,
        lastUpdated: repo.updated_at,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('❌ Repository validation failed:', error);
      return {
        isValid: false,
        isAccessible: false,
        size: 0,
        language: null,
        defaultBranch: 'main',
        lastUpdated: new Date().toISOString(),
        errors: [error.message || 'Failed to validate repository']
      };
    }
  }

  /**
   * Get popular repositories for suggestions
   */
  async getPopularRepositories(language?: string, limit: number = 10): Promise<GitHubRepository[]> {
    try {
      let query = 'stars:>1000';
      if (language) {
        query += ` language:${language}`;
      }

      const result = await this.searchRepositories(query, {
        sort: 'stars',
        order: 'desc',
        per_page: limit
      });

      return result.items;
    } catch (error) {
      console.error('❌ Failed to get popular repositories:', error);
      return [];
    }
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    try {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#\.]+)/);
      if (match) {
        return {
          owner: match[1],
          repo: match[2]
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const gitHubService = new GitHubService();
export default gitHubService;