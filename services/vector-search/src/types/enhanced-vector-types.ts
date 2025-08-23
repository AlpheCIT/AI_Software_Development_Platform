// 🚀 Enhanced Vector-Enabled TypeScript Interfaces for AI Code Intelligence Platform
// Supporting Vector Search, GraphRAG, and Hybrid Search Capabilities

// ===== CORE VECTOR TYPES =====

export interface VectorEmbedding {
  values: number[];           // The actual vector values (e.g., 128, 384, 768, 1536 dimensions)
  dimension: number;          // Vector dimension size
  model: string;              // Embedding model used (e.g., "text-embedding-ada-002", "all-MiniLM-L6-v2")
  created_at: string;         // When embedding was generated
  metadata?: {
    source_type: 'code' | 'description' | 'comment' | 'documentation' | 'business_context';
    confidence_score?: number;
    preprocessing_steps?: string[];
    generation_time_ms?: number;
  };
}

export interface SimilarityScore {
  score: number;              // Cosine similarity score (0-1)
  distance: number;           // Vector distance
  rank: number;               // Result ranking
  method: 'cosine' | 'l2' | 'dot_product';
  explanation?: string;       // Human-readable explanation
}

export interface VectorSearchResult<T = any> {
  document: T;
  similarity: SimilarityScore;
  context?: {
    matched_fields: string[];
    relationship_context?: any[];
    business_relevance?: number;
  };
}

// ===== ENHANCED CODE ENTITY WITH VECTORS =====

export interface EnhancedCodeEntity {
  // Existing base properties
  _key: string;
  _id?: string;
  name: string;
  entity_type: 'function' | 'class' | 'variable' | 'module' | 'interface' | 'component';
  file_path: string;
  language: string;
  source_code?: string;
  repository_id: string;
  branch_id?: string;
  
  // ENHANCED: Multiple vector representations
  embeddings: {
    // Code semantic embedding (raw code)
    code_vector?: VectorEmbedding;
    
    // Natural language description embedding
    description_vector?: VectorEmbedding;
    
    // Documentation/comments embedding
    documentation_vector?: VectorEmbedding;
    
    // Function signature embedding (for API similarity)
    signature_vector?: VectorEmbedding;
    
    // Business context embedding (what this code does in business terms)
    business_context_vector?: VectorEmbedding;
  };
  
  // ENHANCED: Natural language descriptions for search
  descriptions: {
    // AI-generated description of what the code does
    functional_description: string;
    
    // Business purpose description
    business_purpose: string;
    
    // Technical implementation details
    technical_summary: string;
    
    // Usage examples and patterns
    usage_patterns: string[];
    
    // Related business processes
    business_processes: string[];
  };
  
  // ENHANCED: Search metadata
  search_metadata: {
    // Keywords for full-text search
    keywords: string[];
    
    // Searchable tags
    tags: string[];
    
    // Domain categorization
    domain_categories: string[];
    
    // Complexity indicators for search filtering
    complexity_level: 'low' | 'medium' | 'high' | 'critical';
    
    // Search boost factors
    search_boost_factors: {
      business_importance: number;
      technical_complexity: number;
      usage_frequency: number;
    };
  };
  
  // ENHANCED: Vector search optimization
  vector_optimization: {
    // Index hints for vector search
    vector_index_hints: string[];
    
    // Dimension reduction metadata
    dimension_reduction?: {
      original_dimension: number;
      reduced_dimension: number;
      reduction_method: string;
      variance_retained: number;
    };
    
    // Clustering information
    cluster_id?: string;
    cluster_center_distance?: number;
  };
}

// ===== VECTOR SEARCH CONFIGURATION =====

export interface VectorSearchConfig {
  // Search parameters
  similarity_threshold: number;        // Minimum similarity score (0-1)
  max_results: number;                // Maximum results to return
  search_depth: number;               // Graph traversal depth
  
  // Vector search specific
  vector_params: {
    metric: 'cosine' | 'l2' | 'dot_product';
    dimension: number;
    nLists?: number;                  // FAISS clustering parameter
    nProbe?: number;                  // FAISS search parameter
  };
  
  // Hybrid search weights
  search_weights: {
    vector_search: number;            // Weight for vector similarity
    graph_traversal: number;          // Weight for graph relationships
    full_text_search: number;         // Weight for keyword matching
    metadata_boost: number;           // Weight for metadata matching
  };
  
  // Search scope
  search_scope: {
    entity_types: string[];
    languages: string[];
    file_patterns: string[];
    business_domains: string[];
    repository_ids?: string[];
  };
}

// ===== GRAPHRAG QUERY INTERFACE =====

export interface GraphRAGQuery {
  // Natural language query
  natural_language_query: string;
  
  // Query intent classification
  query_intent: {
    type: 'find_similar' | 'explain_relationship' | 'find_dependencies' | 'analyze_impact' | 'discover_patterns';
    confidence: number;
    extracted_entities: string[];
    extracted_concepts: string[];
  };
  
  // Vector search component
  vector_component?: {
    query_embedding: VectorEmbedding;
    embedding_sources: ('description' | 'code' | 'documentation' | 'business_context')[];
  };
  
  // Graph traversal component
  graph_component?: {
    starting_entities: string[];
    relationship_types: string[];
    traversal_depth: number;
    traversal_direction: 'outbound' | 'inbound' | 'any';
  };
  
  // Full-text search component
  fulltext_component?: {
    keywords: string[];
    phrases: string[];
    exact_matches: string[];
  };
  
  // Context and constraints
  context: {
    business_domain?: string;
    technical_domain?: string;
    compliance_requirements?: string[];
    performance_constraints?: string[];
    repository_scope?: string[];
  };
}

export interface GraphRAGResult {
  // Query understanding
  query_analysis: {
    understood_intent: string;
    confidence_score: number;
    query_complexity: 'simple' | 'moderate' | 'complex';
    processing_time_ms: number;
  };
  
  // Multi-modal results
  results: {
    // Vector search results
    similar_entities: VectorSearchResult<EnhancedCodeEntity>[];
    
    // Graph traversal results
    related_entities: {
      entity: EnhancedCodeEntity;
      relationship_path: string[];
      relationship_strength: number;
      path_type: string;
    }[];
    
    // Full-text search results
    keyword_matches: {
      entity: EnhancedCodeEntity;
      matched_fields: string[];
      match_score: number;
    }[];
    
    // Hybrid combined results
    ranked_results: {
      entity: EnhancedCodeEntity;
      combined_score: number;
      score_breakdown: {
        vector_score: number;
        graph_score: number;
        fulltext_score: number;
        metadata_score: number;
      };
      explanation: string;
    }[];
  };
  
  // Insights and explanations
  insights: {
    patterns_discovered: string[];
    relationship_insights: string[];
    business_impact_analysis: string[];
    technical_recommendations: string[];
    clustering_results?: any[];
  };
}

// ===== ENHANCED DATABASE COLLECTIONS =====

export interface VectorEnabledCollections {
  // Enhanced existing collections with vector support
  code_entities_vectorized: EnhancedCodeEntity[];
  
  // Vector-specific collections
  doc_vector_embeddings: {
    _key: string;
    entity_id: string;
    embedding_type: 'code' | 'description' | 'documentation' | 'signature' | 'business';
    vector_data: VectorEmbedding;
    generation_metadata: {
      model_used: string;
      generation_time: string;
      preprocessing_steps: string[];
      quality_score: number;
    };
  }[];
  
  doc_search_sessions: {
    _key: string;
    session_id: string;
    user_id: string;
    queries: GraphRAGQuery[];
    results: GraphRAGResult[];
    session_metadata: {
      start_time: string;
      end_time: string;
      total_queries: number;
      search_patterns: string[];
    };
  }[];
  
  doc_vector_clusters: {
    _key: string;
    cluster_id: string;
    cluster_center: number[];
    cluster_entities: string[];
    cluster_metadata: {
      size: number;
      cohesion_score: number;
      business_theme: string;
      technical_theme: string;
    };
  }[];
  
  doc_similarity_cache: {
    _key: string;
    query_hash: string;
    query_vector: number[];
    similar_entities: string[];
    similarity_scores: number[];
    created_at: string;
    ttl: number;
  }[];
}

// ===== ARANGO SEARCH VIEW DEFINITIONS =====

export interface ArangoSearchViewConfig {
  // Hybrid search view combining all search types
  hybrid_code_search: {
    links: {
      code_entities: {
        fields: {
          // Full-text searchable fields
          name: { analyzers: ['text_en', 'identity'] };
          'descriptions.functional_description': { analyzers: ['text_en'] };
          'descriptions.business_purpose': { analyzers: ['text_en'] };
          'descriptions.technical_summary': { analyzers: ['text_en'] };
          'search_metadata.keywords': { analyzers: ['text_en', 'identity'] };
          'search_metadata.tags': { analyzers: ['identity'] };
          source_code: { analyzers: ['text_en'] };
          
          // Vector searchable fields
          'embeddings.code_vector.values': { 
            type: 'vector';
            dimension: number;
            metric: 'cosine' | 'l2';
          };
          'embeddings.description_vector.values': { 
            type: 'vector';
            dimension: number;
            metric: 'cosine' | 'l2';
          };
        };
      };
    };
  };
}

// ===== ENHANCED ANALYSIS SERVICES =====

export interface VectorizedAnalysisService {
  // Vector-enhanced analysis methods
  findSimilarCode(
    queryCode: string,
    options?: {
      similarity_threshold?: number;
      include_descriptions?: boolean;
      search_scope?: string[];
    }
  ): Promise<VectorSearchResult<EnhancedCodeEntity>[]>;
  
  performHybridSearch(query: GraphRAGQuery): Promise<GraphRAGResult>;
  
  findCodeByDescription(
    description: string,
    options?: VectorSearchConfig
  ): Promise<VectorSearchResult<EnhancedCodeEntity>[]>;
  
  analyzeCodePatterns(
    entities: EnhancedCodeEntity[]
  ): Promise<{
    clusters: {
      pattern_name: string;
      entities: EnhancedCodeEntity[];
      similarity_score: number;
      business_context: string;
    }[];
    outliers: EnhancedCodeEntity[];
  }>;
  
  generateSemanticMap(
    repository_id: string
  ): Promise<{
    semantic_clusters: any[];
    relationship_strengths: any[];
    business_process_mapping: any[];
  }>;
}

// ===== LANGCHAIN INTEGRATION TYPES =====

export interface LangChainIntegration {
  // Natural language to AQL query conversion
  naturalLanguageToAQL(
    query: string,
    context?: {
      available_collections: string[];
      user_permissions: string[];
      search_history: string[];
    }
  ): Promise<{
    aql_query: string;
    confidence: number;
    explanation: string;
    estimated_results: number;
  }>;
  
  // Enhanced query understanding
  enhanceQuery(
    query: GraphRAGQuery
  ): Promise<{
    enhanced_query: GraphRAGQuery;
    additional_context: any;
    suggested_refinements: string[];
  }>;
}

// ===== VECTOR INDEX MANAGEMENT =====

export interface VectorIndexManager {
  // Index creation and management
  createVectorIndex(
    collection: string,
    field: string,
    config: {
      dimension: number;
      metric: 'cosine' | 'l2' | 'dot_product';
      nLists?: number;
    }
  ): Promise<void>;
  
  // Index optimization
  optimizeVectorIndex(collection: string, field: string): Promise<{
    optimization_stats: any;
    performance_improvement: number;
  }>;
  
  // Bulk vector operations
  bulkInsertVectors(
    vectors: {
      document_id: string;
      vector_data: VectorEmbedding;
      metadata: any;
    }[]
  ): Promise<void>;
}

// ===== PATTERN DISCOVERY TYPES =====

export interface PatternDiscoveryResult {
  business_patterns: {
    pattern_id: string;
    pattern_name: string;
    entities: EnhancedCodeEntity[];
    business_context: string;
    confidence_score: number;
  }[];
  
  technical_patterns: {
    pattern_id: string;
    pattern_type: string;
    entities: EnhancedCodeEntity[];
    implementation_details: string;
    complexity_level: string;
  }[];
  
  cross_domain_patterns: {
    business_context: string;
    technical_implementation: string;
    common_entities: EnhancedCodeEntity[];
    alignment_score: number;
  }[];
}

// ===== SERVICE CONFIGURATION =====

export interface VectorServiceConfig {
  // Embedding service configuration
  embedding: {
    provider: 'openai' | 'azure' | 'bedrock' | 'huggingface';
    model: string;
    dimension: number;
    batch_size: number;
    cache_enabled: boolean;
  };
  
  // Vector search configuration
  search: {
    default_similarity_threshold: number;
    max_results_limit: number;
    cache_ttl_seconds: number;
    enable_hybrid_search: boolean;
  };
  
  // Performance configuration
  performance: {
    index_optimization_enabled: boolean;
    parallel_processing_enabled: boolean;
    memory_limit_mb: number;
    query_timeout_ms: number;
  };
}

// ===== ALL TYPES EXPORTED INLINE ABOVE =====

// Note: All interfaces and types are already exported individually above
// This provides better tree-shaking and IDE support
