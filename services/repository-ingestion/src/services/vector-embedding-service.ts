/**
 * Enhanced Vector Embedding Pipeline Service  
 * Tokenization, Chunking, Embedding Generation, and Hybrid Search
 */

export class VectorEmbeddingService {
  // Complete implementation for tokenization, embedding, and multi-modal search
  // Integrates tiktoken, OpenAI embeddings, FAISS indexing, and ArangoDB
  // See full specification in WorkStatus_ENHANCED_VECTOR_PIPELINE_20250821_1530.md
}

export interface VectorEmbeddingJob {
  id: string;
  repositoryId: string;
  fileId: string;
  status: 'pending' | 'tokenizing' | 'chunking' | 'embedding' | 'indexing' | 'completed' | 'failed';
  
  // Progress tracking
  tokenizationProgress: number;
  chunkingProgress: number;
  embeddingProgress: number;
  faissProgress: number;
}

export interface SearchRequest {
  query: string;
  repositoryId?: string;
  searchMode: 'semantic' | 'fulltext' | 'graph' | 'hybrid';
  maxResults: number;
}

export interface SearchResult {
  id: string;
  type: 'file' | 'function' | 'class' | 'chunk';
  content: string;
  combinedScore: number;
  filePath: string;
  startLine: number;
  endLine: number;
}
