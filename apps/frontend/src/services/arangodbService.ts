/**
 * ArangoDB MCP Integration Service
 * Direct integration with ArangoDB via MCP for frontend
 */

export interface Collection {
  name: string;
  type: 'document' | 'edge';
  count: number;
  isSystem: boolean;
  status: 'accessible' | 'populating' | 'error';
}

export interface Repository {
  _key?: string;
  _id?: string;
  _rev?: string;
  name: string;
  url: string;
  description?: string;
  language: string;
  owner?: string;
  defaultBranch?: string;
  lastAnalyzed?: string;
  created_at?: string;
  updated_at?: string;
  status?: 'active' | 'analyzing' | 'error' | 'pending';
  healthScore?: {
    overall: number;
    security: number;
    performance: number;
    quality: number;
    coverage: number;
  };
  stats?: {
    totalFiles: number;
    totalLines: number;
    totalFunctions: number;
    totalClasses: number;
    dependencies: number;
    issues: number;
  };
}

class ArangoDBService {
  private baseUrl = '/api/mcp/arangodb';
  
  /**
   * Get database health and collection statistics
   */
  async getDatabaseHealth(): Promise<{
    status: string;
    database: string;
    totalCollections: number;
    collectionStats: Collection[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          includeCacheStats: true, 
          includeCollectionStats: true 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Database health check failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to check database health:', error);
      throw error;
    }
  }

  /**
   * Browse all collections
   */
  async getAllCollections(): Promise<{
    totalCollections: number;
    collections: Collection[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          includeStats: true, 
          includeSystem: false 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to browse collections: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to browse collections:', error);
      throw error;
    }
  }

  /**
   * Get all repositories from ArangoDB
   */
  async getRepositories(): Promise<Repository[]> {
    try {
      const response = await fetch(`${this.baseUrl}/collection/browse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'repositories',
          limit: 50,
          offset: 0,
          sortBy: 'created_at',
          sortOrder: 'desc'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get repositories: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.documents || [];
    } catch (error) {
      console.error('❌ Failed to get repositories:', error);
      throw error;
    }
  }

  /**
   * Get specific repository by key
   */
  async getRepository(key: string): Promise<Repository | null> {
    try {
      const response = await fetch(`${this.baseUrl}/document/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'repositories',
          key: key,
          includeEdges: true
        })
      });
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get repository: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Failed to get repository ${key}:`, error);
      throw error;
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(repositoryData: {
    name: string;
    url: string;
    description?: string;
    language: string;
    owner?: string;
    defaultBranch?: string;
  }): Promise<Repository> {
    try {
      const document = {
        ...repositoryData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending' as const
      };

      const response = await fetch(`${this.baseUrl}/document/insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'repositories',
          documents: [document],
          batchSize: 1,
          overwrite: false
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create repository: ${response.statusText}`);
      }
      
      const result = await response.json();
      return { ...document, _key: result.inserted?.[0]?._key };
    } catch (error) {
      console.error('❌ Failed to create repository:', error);
      throw error;
    }
  }

  /**
   * Update repository status and metadata
   */
  async updateRepository(key: string, updates: Partial<Repository>): Promise<Repository> {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const response = await fetch(`${this.baseUrl}/document/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'repositories',
          updates: [{ key, update: updateData }],
          batchSize: 1,
          mergeObjects: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update repository: ${response.statusText}`);
      }
      
      // Return the updated repository
      return await this.getRepository(key) as Repository;
    } catch (error) {
      console.error(`❌ Failed to update repository ${key}:`, error);
      throw error;
    }
  }

  /**
   * Execute custom AQL query
   */
  async executeAQL(query: string, bindVars?: Record<string, any>): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/aql/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          bindVars: bindVars || {},
          limit: 1000
        })
      });
      
      if (!response.ok) {
        throw new Error(`AQL query failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('❌ AQL query execution failed:', error);
      throw error;
    }
  }

  /**
   * Get collection population status for ingestion monitoring
   */
  async getCollectionPopulationStatus(): Promise<{
    collections: Array<{
      name: string;
      currentCount: number;
      expectedCount: number;
      status: 'empty' | 'populating' | 'complete';
    }>;
  }> {
    try {
      const collections = await this.getAllCollections();
      
      // Transform to ingestion monitoring format
      const collectionStatus = collections.collections.map(col => ({
        name: col.name,
        currentCount: col.count,
        expectedCount: col.count > 0 ? Math.max(col.count, 100) : 100,
        status: col.count === 0 ? 'empty' as const : 
                col.count < 50 ? 'populating' as const : 
                'complete' as const
      }));

      return { collections: collectionStatus };
    } catch (error) {
      console.error('❌ Failed to get collection population status:', error);
      throw error;
    }
  }

  /**
   * Search across collections using semantic search (if available)
   */
  async semanticSearch(query: string, collections?: string[], limit: number = 10): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search/semantic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          collections,
          limit,
          threshold: 0.7
        })
      });
      
      if (!response.ok) {
        throw new Error(`Semantic search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('❌ Semantic search failed:', error);
      // Fall back to regular AQL search
      return this.fallbackTextSearch(query, collections, limit);
    }
  }

  /**
   * Fallback text search using AQL
   */
  private async fallbackTextSearch(query: string, collections?: string[], limit: number = 10): Promise<any[]> {
    try {
      const targetCollections = collections || ['repositories', 'code_entities', 'code_files'];
      
      const aqlQuery = `
        FOR collection_name IN @collections
          FOR doc IN @@collection_name
            FILTER CONTAINS(LOWER(doc.name || doc.summary || doc.description || ""), LOWER(@query))
            LIMIT ${limit}
            RETURN {
              collection: collection_name,
              document: doc,
              score: 1
            }
      `;

      return await this.executeAQL(aqlQuery, {
        collections: targetCollections,
        query
      });
    } catch (error) {
      console.error('❌ Fallback text search failed:', error);
      return [];
    }
  }

  /**
   * Get analytics data for repository insights
   */
  async getRepositoryAnalytics(repositoryId?: string): Promise<{
    metrics: string[];
    data: any;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId,
          timeRange: '7d',
          metrics: ['security', 'performance', 'quality']
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get repository analytics:', error);
      throw error;
    }
  }

  /**
   * Monitor ingestion progress for a repository
   */
  async getIngestionProgress(repositoryId: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number;
    currentPhase: string;
    collectionsPopulated: number;
    totalCollections: number;
    errors?: string[];
  }> {
    try {
      // This would integrate with the ingestion system
      const repository = await this.getRepository(repositoryId);
      
      if (!repository) {
        throw new Error('Repository not found');
      }

      // Mock ingestion progress - in real implementation, this would query ingestion status
      const collections = await this.getAllCollections();
      const populatedCollections = collections.collections.filter(col => col.count > 0).length;
      
      return {
        status: repository.status || 'pending',
        progress: Math.round((populatedCollections / collections.totalCollections) * 100),
        currentPhase: repository.status === 'analyzing' ? 'Code Analysis' : 'Completed',
        collectionsPopulated: populatedCollections,
        totalCollections: collections.totalCollections,
        errors: []
      };
    } catch (error) {
      console.error(`❌ Failed to get ingestion progress for ${repositoryId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const arangoDBService = new ArangoDBService();
export default arangoDBService;
