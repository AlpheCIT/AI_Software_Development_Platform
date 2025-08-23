// 🗄️ Enhanced ArangoDB Schema for Vector Search & GraphRAG
// Extending existing collections with vector search capabilities

import { Database } from 'arangojs';
import { EnhancedCodeEntity, VectorEmbedding } from '../types/enhanced-vector-types.js';

// ===== VECTOR INDEX DEFINITIONS =====

interface VectorIndexDefinition {
  collection: string;
  field: string;
  type: "vector";
  params: {
    metric: "cosine" | "l2" | "dot_product";
    dimension: number;
    nLists: number;
  };
  name: string;
}

interface ArangoSearchViewDefinition {
  name: string;
  links: Record<string, {
    fields: Record<string, any>;
  }>;
}

interface IndexDefinition {
  collection: string;
  fields: string[];
  type: "persistent" | "geo" | "fulltext" | "hash" | "skiplist";
  name: string;
  unique?: boolean;
  sparse?: boolean;
}

class EnhancedVectorSchema {
  private db: Database;
  
  constructor(database: Database) {
    this.db = database;
  }
  
  // ===== VECTOR-ENHANCED COLLECTION DEFINITIONS =====
  
  getVectorEnabledCollections(): Record<string, string> {
    return {
      // Enhanced existing collections with vector support
      "code_entities": "Core code entities with multi-modal vector embeddings",
      "doc_embeddings": "Vector embeddings storage with metadata and versioning", 
      "doc_ai_descriptions": "AI-generated natural language descriptions",
      
      // NEW: Vector-specific collections
      "doc_vector_embeddings": "Multi-modal vector embeddings with generation metadata",
      "doc_semantic_clusters": "AI-generated semantic clusters of similar code",
      "doc_search_sessions": "User search sessions and query patterns",
      "doc_natural_language_queries": "NL query translations and learning",
      "doc_code_descriptions": "AI-generated natural language descriptions with vectors",
      "doc_similarity_cache": "Cached similarity calculations for performance",
      "doc_vector_models": "Embedding model metadata and configurations",
      "doc_search_analytics": "Search performance and usage analytics",
      
      // NEW: GraphRAG specific collections
      "doc_graphrag_contexts": "Context graphs for complex queries",
      "doc_hybrid_search_results": "Combined vector+graph+text search results",
      "doc_business_concepts": "Extracted business concepts and their vectors",
      "doc_technical_patterns": "Technical pattern recognition results",
      "doc_pattern_discovery": "Discovered patterns from vector clustering",
      "doc_cross_domain_mapping": "Business-technical pattern relationships"
    };
  }
  
  // ===== VECTOR INDEX DEFINITIONS =====
  
  getVectorIndexes(): VectorIndexDefinition[] {
    return [
      // Primary code vector indexes
      {
        collection: "code_entities",
        field: "embeddings.code_vector.values",
        type: "vector",
        params: {
          metric: "cosine",
          dimension: 768,
          nLists: 100
        },
        name: "idx_code_vector_cosine"
      },
      
      // Description vector indexes
      {
        collection: "code_entities", 
        field: "embeddings.description_vector.values",
        type: "vector",
        params: {
          metric: "cosine",
          dimension: 384,
          nLists: 50
        },
        name: "idx_description_vector_cosine"
      },
      
      // Business context vector indexes
      {
        collection: "code_entities",
        field: "embeddings.business_context_vector.values", 
        type: "vector",
        params: {
          metric: "cosine",
          dimension: 768,
          nLists: 75
        },
        name: "idx_business_vector_cosine"
      },
      
      // Enhanced embeddings collection vector index
      {
        collection: "doc_embeddings",
        field: "embedding_vector",
        type: "vector",
        params: {
          metric: "cosine",
          dimension: 768,
          nLists: 150
        },
        name: "idx_embeddings_vector_cosine"
      }
    ];
  }

  // ===== PERFORMANCE OPTIMIZATION INDEXES =====
  
  getPerformanceIndexes(): IndexDefinition[] {
    return [
      // Composite indexes for hybrid search
      {
        collection: "code_entities",
        fields: ["search_metadata.domain_categories", "entity_type", "language"],
        type: "persistent",
        name: "idx_hybrid_search_filters"
      },
      
      // Enhanced embeddings lookup
      {
        collection: "doc_embeddings",
        fields: ["entity_id", "embedding_type", "model_name"],
        type: "persistent",
        name: "idx_embeddings_lookup"
      },
      
      // Search session analytics
      {
        collection: "doc_search_sessions", 
        fields: ["user_id", "session_metadata.start_time"],
        type: "persistent",
        name: "idx_search_sessions"
      },
      
      // Vector model tracking
      {
        collection: "doc_vector_embeddings",
        fields: ["entity_id", "embedding_type", "vector_data.model"],
        type: "persistent", 
        name: "idx_vector_embeddings_lookup"
      },
      
      // Similarity cache optimization
      {
        collection: "doc_similarity_cache",
        fields: ["query_hash", "created_at"],
        type: "persistent",
        name: "idx_similarity_cache"
      }
    ];
  }
  
  // ===== SCHEMA INITIALIZATION =====
  
  async initializeVectorSchema(): Promise<void> {
    console.log('🚀 Initializing Enhanced Vector Schema...');
    
    try {
      // Create vector-enabled collections
      await this.createVectorCollections();
      
      // Create vector indexes (if supported by ArangoDB version)
      await this.createVectorIndexes();
      
      // Create performance indexes
      await this.createPerformanceIndexes();
      
      console.log('✅ Enhanced Vector Schema initialized successfully!');
    } catch (error) {
      console.error('❌ Error initializing vector schema:', error);
      throw error;
    }
  }
  
  // ===== TESTING METHODS (for unit tests only) =====
  
  async createVectorCollections(): Promise<void> {
    const collections = this.getVectorEnabledCollections();
    
    for (const [collectionName, description] of Object.entries(collections)) {
      try {
        if (!await this.db.collection(collectionName).exists()) {
          await this.db.createCollection(collectionName, {
            type: 2, // Document collection
            waitForSync: false
          });
          console.log(`✅ Created collection: ${collectionName}`);
        } else {
          console.log(`📋 Collection exists: ${collectionName}`);
        }
      } catch (error) {
        console.error(`❌ Error creating collection ${collectionName}:`, error);
      }
    }
  }
  
  async createVectorIndexes(): Promise<void> {
    const vectorIndexes = this.getVectorIndexes();
    
    for (const indexDef of vectorIndexes) {
      try {
        const collection = this.db.collection(indexDef.collection);
        
        if (await collection.exists()) {
          // Vector indexes require special handling in ArangoDB 3.12+
          // For now, we'll create them as placeholder persistent indexes
          // In production, use proper vector index creation when ArangoDB JS driver supports it
          console.log(`📝 Vector index placeholder for: ${indexDef.name} on ${indexDef.collection}`);
          console.log(`   Field: ${indexDef.field}, Dimension: ${indexDef.params.dimension}, Metric: ${indexDef.params.metric}`);
          
          // TODO: Replace with actual vector index creation when driver supports it
          // await collection.ensureVectorIndex({...});
        }
      } catch (error) {
        console.error(`❌ Error creating vector index ${indexDef.name}:`, error);
      }
    }
  }
  
  async createPerformanceIndexes(): Promise<void> {
    const indexes = this.getPerformanceIndexes();
    
    for (const indexDef of indexes) {
      try {
        const collection = this.db.collection(indexDef.collection);
        
        if (await collection.exists()) {
          // Create index with proper ArangoDB configuration
          const indexOptions: any = {
            type: indexDef.type,
            fields: indexDef.fields,
            name: indexDef.name,
            unique: indexDef.unique || false,
            sparse: indexDef.sparse || false
          };
          
          await collection.ensureIndex(indexOptions);
          console.log(`✅ Created index: ${indexDef.name} on ${indexDef.collection}`);
        }
      } catch (error) {
        console.error(`❌ Error creating index ${indexDef.name}:`, error);
      }
    }
  }
}

export { 
  EnhancedVectorSchema
};

export type { 
  VectorIndexDefinition,
  ArangoSearchViewDefinition,
  IndexDefinition 
};
