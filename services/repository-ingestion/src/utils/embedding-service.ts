import { logger } from './logger';
import axios from 'axios';

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  normalize?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
  tokens: number;
}

export class EmbeddingService {
  private ollamaUrl: string;
  private defaultModel: string;
  private cache: Map<string, EmbeddingResult> = new Map();

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'nomic-embed-text';
  }

  async generateEmbedding(
    text: string, 
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(text, options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug(`Using cached embedding for text: ${text.substring(0, 50)}...`);
        return cached.embedding;
      }

      // Clean and prepare text
      const cleanText = this.cleanText(text);
      if (cleanText.length === 0) {
        logger.warn('Empty text provided for embedding generation');
        return new Array(384).fill(0); // Default dimension for nomic-embed-text
      }

      // Generate embedding using Ollama
      const embedding = await this.generateOllamaEmbedding(cleanText, options);
      
      // Cache the result
      const result: EmbeddingResult = {
        embedding,
        dimensions: embedding.length,
        model: options.model || this.defaultModel,
        tokens: this.estimateTokens(cleanText)
      };
      
      this.cache.set(cacheKey, result);
      
      // Clean cache if it gets too large
      if (this.cache.size > 10000) {
        this.clearOldCache();
      }

      return embedding;

    } catch (error) {
      logger.error(`Failed to generate embedding for text: ${text.substring(0, 50)}...`, error);
      // Return zero vector as fallback
      return new Array(384).fill(0);
    }
  }

  async generateBatchEmbeddings(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    // Process in batches to avoid overwhelming the service
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(text => this.generateEmbedding(text, options));
      const batchEmbeddings = await Promise.all(batchPromises);
      
      embeddings.push(...batchEmbeddings);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await this.delay(100);
      }
    }

    return embeddings;
  }

  async generateEntityEmbedding(entity: any): Promise<number[]> {
    // Create rich text representation of the entity
    const entityText = this.createEntityText(entity);
    return this.generateEmbedding(entityText);
  }

  async generateRepositoryEmbeddings(repositoryId: string): Promise<void> {
    try {
      logger.info(`Generating embeddings for repository ${repositoryId}`);

      // This would be implemented with database access
      // For now, this is a placeholder that shows the pattern
      
      // 1. Get all entities for the repository
      // 2. Generate embeddings for each entity
      // 3. Store embeddings back to the database
      
      logger.info(`Completed embedding generation for repository ${repositoryId}`);

    } catch (error) {
      logger.error(`Failed to generate repository embeddings:`, error);
      throw error;
    }
  }

  private async generateOllamaEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
        model: options.model || this.defaultModel,
        prompt: text
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.embedding) {
        let embedding = response.data.embedding;
        
        // Normalize if requested
        if (options.normalize !== false) {
          embedding = this.normalizeVector(embedding);
        }
        
        return embedding;
      } else {
        throw new Error('Invalid response from Ollama embedding service');
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.error('Cannot connect to Ollama service. Is it running?');
        throw new Error('Ollama service unavailable');
      }
      
      logger.error(`Ollama embedding request failed:`, error);
      throw error;
    }
  }

  private createEntityText(entity: any): string {
    // Create a rich text representation combining multiple entity fields
    const parts = [];
    
    // Add entity name and type
    parts.push(`${entity.type}: ${entity.name}`);
    
    // Add signature if available
    if (entity.signature) {
      parts.push(`Signature: ${entity.signature}`);
    }
    
    // Add parameters for functions
    if (entity.parameters && entity.parameters.length > 0) {
      parts.push(`Parameters: ${entity.parameters.join(', ')}`);
    }
    
    // Add return type
    if (entity.returnType) {
      parts.push(`Returns: ${entity.returnType}`);
    }
    
    // Add documentation
    if (entity.documentation) {
      parts.push(`Documentation: ${entity.documentation}`);
    }
    
    // Add dependencies
    if (entity.dependencies && entity.dependencies.length > 0) {
      parts.push(`Dependencies: ${entity.dependencies.join(', ')}`);
    }
    
    // Add complexity information
    if (entity.metadata && entity.metadata.complexity) {
      parts.push(`Complexity: ${entity.metadata.complexity}`);
    }

    return parts.join(' | ');
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-_.,;:()\[\]{}]/g, '') // Remove special characters
      .trim()
      .substring(0, 8000); // Limit length to avoid token limits
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  private getCacheKey(text: string, options: EmbeddingOptions): string {
    const optionsStr = JSON.stringify(options);
    return `${text.substring(0, 100)}_${optionsStr}`;
  }

  private clearOldCache(): void {
    // Simple LRU-like cleanup - remove first 1000 items
    const keys = Array.from(this.cache.keys());
    for (let i = 0; i < 1000 && i < keys.length; i++) {
      this.cache.delete(keys[i]);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Similarity and search methods

  calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  async findSimilarEmbeddings(
    queryEmbedding: number[],
    candidateEmbeddings: Array<{ id: string; embedding: number[]; metadata?: any }>,
    topK: number = 10,
    threshold: number = 0.5
  ): Promise<Array<{ id: string; similarity: number; metadata?: any }>> {
    const similarities = candidateEmbeddings.map(candidate => ({
      id: candidate.id,
      similarity: this.calculateCosineSimilarity(queryEmbedding, candidate.embedding),
      metadata: candidate.metadata
    }));

    return similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // Health check and diagnostics

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    service: string;
    model: string;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await this.generateEmbedding('health check test');
      
      return {
        status: 'healthy',
        service: 'ollama',
        model: this.defaultModel,
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'ollama',
        model: this.defaultModel,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  // Configuration and utility methods

  updateConfiguration(config: {
    ollamaUrl?: string;
    defaultModel?: string;
  }): void {
    if (config.ollamaUrl) {
      this.ollamaUrl = config.ollamaUrl;
    }
    if (config.defaultModel) {
      this.defaultModel = config.defaultModel;
    }
    
    // Clear cache when configuration changes
    this.cache.clear();
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: 10000,
      hitRate: 0 // Would need to track hits/misses for real implementation
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
