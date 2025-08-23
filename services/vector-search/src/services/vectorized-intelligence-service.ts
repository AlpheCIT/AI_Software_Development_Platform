// 🚀 Vector-Enhanced Code Intelligence Service Implementation
// Implementing enhanced vector search and GraphRAG capabilities

import { Database } from 'arangojs';
import { 
  EnhancedCodeEntity, 
  VectorSearchConfig, 
  GraphRAGQuery, 
  GraphRAGResult,
  VectorSearchResult,
  VectorEmbedding,
  SimilarityScore
} from '../types/enhanced-vector-types.js';

export class VectorizedCodeIntelligenceService {
  private db: Database;
  private embeddingService: any; // Will be injected
  private cacheEnabled: boolean = true;
  
  constructor(database: Database, embeddingService?: any) {
    this.db = database;
    this.embeddingService = embeddingService;
  }

  // ===== SEMANTIC CODE SEARCH =====
  
  async findSimilarCodeByDescription(
    description: string,
    options: Partial<VectorSearchConfig> = {}
  ): Promise<VectorSearchResult<EnhancedCodeEntity>[]> {
    
    console.log(`🔍 Searching for code similar to: "${description}"`);
    
    const config = this.mergeDefaultConfig(options);
    
    // Check cache first
    if (this.cacheEnabled) {
      const cached = await this.getCachedResults(description, config);
      if (cached) {
        console.log('📋 Returning cached results');
        return cached;
      }
    }

    try {
      // Generate embedding for the description if embedding service available
      let queryEmbedding: VectorEmbedding | null = null;
      if (this.embeddingService) {
        queryEmbedding = await this.embeddingService.generateEmbedding(
          description, 
          { model: 'text-embedding-ada-002', type: 'description' }
        );
      }

      // Hybrid search: vector + full-text + graph relationships
      const aqlQuery = `
        LET description = @description
        LET query_vector = @query_vector
        LET similarity_threshold = @similarity_threshold
        LET max_results = @max_results
        
        // Search across existing collections with embeddings
        FOR doc IN doc_embeddings
          FILTER doc.embedding_vector != null
          FILTER doc.content != null
          
          // Calculate text similarity using existing descriptions
          LET text_similarity = (
            CONTAINS(LOWER(doc.content), LOWER(description)) ? 1.0 :
            CONTAINS(LOWER(doc.description || ""), LOWER(description)) ? 0.8 : 0.0
          )
          
          // Vector similarity if available
          LET vector_similarity = (
            query_vector != null ? 
            COSINE_SIMILARITY(doc.embedding_vector, query_vector) : 0.0
          )
          
          // Combined scoring
          LET combined_score = (
            text_similarity * @text_weight +
            vector_similarity * @vector_weight
          ) / (@text_weight + @vector_weight)
          
          FILTER combined_score >= similarity_threshold
          
          // Get related code entity
          LET code_entity = FIRST(
            FOR entity IN code_entities
              FILTER entity._key == doc.entity_id
              RETURN entity
          )
          
          FILTER code_entity != null
          
          // Check business domain relevance
          LET business_boost = (
            @business_domain == null OR
            (doc.business_context != null AND CONTAINS(LOWER(doc.business_context), LOWER(@business_domain))) ? 1.2 : 1.0
          )
          
          LET final_score = combined_score * business_boost
          
          SORT final_score DESC
          LIMIT max_results
          
          RETURN {
            document: MERGE(code_entity, {
              embeddings: {
                description_vector: {
                  values: doc.embedding_vector,
                  model: doc.model_name || "unknown",
                  created_at: doc.created_at
                }
              },
              descriptions: {
                functional_description: doc.description || doc.content,
                business_purpose: doc.business_context || "",
                technical_summary: doc.content
              }
            }),
            similarity: {
              score: final_score,
              distance: 1 - final_score,
              rank: ROW_NUMBER(),
              method: "hybrid_cosine_text",
              explanation: CONCAT(
                "Found based on ",
                text_similarity > 0.5 ? "strong text match" : 
                vector_similarity > 0.7 ? "vector similarity" : "contextual relevance"
              )
            },
            context: {
              matched_fields: [
                text_similarity > 0 ? "content" : null,
                vector_similarity > 0 ? "embedding" : null
              ],
              business_relevance: business_boost - 1
            }
          }
      `;

      const results = await this.db.query(aqlQuery, {
        description: description,
        query_vector: queryEmbedding?.values || null,
        similarity_threshold: config.similarity_threshold,
        max_results: config.max_results,
        text_weight: config.search_weights.full_text_search,
        vector_weight: config.search_weights.vector_search,
        business_domain: config.search_scope.business_domains?.[0] || null
      });

      const searchResults = await results.all();
      
      // Cache results
      if (this.cacheEnabled && searchResults.length > 0) {
        await this.cacheResults(description, config, searchResults);
      }

      console.log(`✅ Found ${searchResults.length} similar code entities`);
      return searchResults;

    } catch (error) {
      console.error('❌ Error in semantic code search:', error);
      throw error;
    }
  }

  // ===== BUSINESS CONTEXT PATTERN DISCOVERY =====
  
  async discoverBusinessPatterns(
    repository_id: string,
    options: {
      clustering_threshold?: number;
      min_cluster_size?: number;
      business_domain?: string;
    } = {}
  ): Promise<{
    business_clusters: any[];
    technical_clusters: any[];
    cross_domain_patterns: any[];
    outliers: EnhancedCodeEntity[];
  }> {

    console.log(`🔍 Discovering business patterns for repository: ${repository_id}`);

    const aqlQuery = `
      LET cluster_threshold = @cluster_threshold
      LET min_cluster_size = @min_cluster_size
      LET repository_id = @repository_id
      
      // Get all entities with embeddings
      FOR doc IN doc_embeddings
        FILTER doc.entity_id != null
        
        // Get the corresponding code entity
        LET code_entity = FIRST(
          FOR entity IN code_entities
            FILTER entity._key == doc.entity_id
            FILTER entity.repository_id == repository_id
            RETURN entity
        )
        
        FILTER code_entity != null
        FILTER @business_domain == null OR CONTAINS(LOWER(doc.business_context || ""), LOWER(@business_domain))
        
        // Find similar entities using embeddings
        LET similar_entities = (
          FOR other_doc IN doc_embeddings
            FILTER other_doc.entity_id != doc.entity_id
            FILTER other_doc.embedding_vector != null
            FILTER doc.embedding_vector != null
            
            LET similarity = COSINE_SIMILARITY(doc.embedding_vector, other_doc.embedding_vector)
            FILTER similarity >= cluster_threshold
            
            // Get other code entity
            LET other_entity = FIRST(
              FOR entity IN code_entities
                FILTER entity._key == other_doc.entity_id
                FILTER entity.repository_id == repository_id
                RETURN entity
            )
            
            FILTER other_entity != null
            
            RETURN {
              entity: other_entity,
              embedding_doc: other_doc,
              similarity: similarity
            }
        )
        
        FILTER LENGTH(similar_entities) >= min_cluster_size
        
        // Analyze business patterns
        LET business_patterns = (
          FOR sim IN similar_entities
            LET business_context = sim.embedding_doc.business_context || "general"
            COLLECT business_purpose = business_context
            AGGREGATE count = LENGTH(sim), avg_similarity = AVG(sim.similarity)
            RETURN {
              business_purpose: business_purpose,
              entity_count: count,
              avg_similarity: avg_similarity
            }
        )
        
        // Analyze technical patterns
        LET technical_patterns = (
          FOR sim IN similar_entities
            COLLECT 
              entity_type = sim.entity.entity_type,
              language = sim.entity.language
            AGGREGATE 
              count = LENGTH(sim),
              avg_similarity = AVG(sim.similarity)
            RETURN {
              entity_type: entity_type,
              language: language,
              entity_count: count,
              avg_similarity: avg_similarity
            }
        )
        
        RETURN {
          anchor_entity: MERGE(code_entity, {
            embeddings: {
              description_vector: {
                values: doc.embedding_vector,
                model: doc.model_name || "unknown"
              }
            },
            descriptions: {
              functional_description: doc.description || doc.content,
              business_purpose: doc.business_context || ""
            }
          }),
          similar_entities: similar_entities,
          business_patterns: business_patterns,
          technical_patterns: technical_patterns,
          cluster_metadata: {
            business_diversity: LENGTH(business_patterns),
            technical_diversity: LENGTH(technical_patterns),
            total_similarity: AVG(similar_entities[*].similarity)
          }
        }
    `;

    try {
      const results = await this.db.query(aqlQuery, {
        repository_id: repository_id,
        cluster_threshold: options.clustering_threshold || 0.75,
        min_cluster_size: options.min_cluster_size || 3,
        business_domain: options.business_domain || null
      });

      const clusterResults = await results.all();
      console.log(`✅ Discovered ${clusterResults.length} pattern clusters`);

      return this.organizeClusterResults(clusterResults);
    } catch (error) {
      console.error('❌ Error in pattern discovery:', error);
      throw error;
    }
  }

  // ===== ENHANCED SEMANTIC SEARCH =====
  
  async performSemanticSearch(
    query: string,
    options: {
      search_type?: 'code' | 'description' | 'business' | 'all';
      max_results?: number;
      similarity_threshold?: number;
      include_relationships?: boolean;
    } = {}
  ): Promise<any[]> {
    
    console.log(`🔍 Performing semantic search: "${query}"`);
    
    const searchType = options.search_type || 'all';
    const maxResults = options.max_results || 20;
    const similarityThreshold = options.similarity_threshold || 0.6;
    
    const aqlQuery = `
      LET search_query = @query
      LET max_results = @max_results
      LET similarity_threshold = @similarity_threshold
      
      // Search through embeddings collection
      FOR doc IN doc_embeddings
        FILTER doc.embedding_vector != null
        
        // Text-based similarity scoring
        LET content_similarity = (
          CONTAINS(LOWER(doc.content || ""), LOWER(search_query)) ? 1.0 :
          CONTAINS(LOWER(doc.description || ""), LOWER(search_query)) ? 0.8 :
          CONTAINS(LOWER(doc.business_context || ""), LOWER(search_query)) ? 0.9 : 0.0
        )
        
        // Filter by search type
        LET type_relevant = (
          @search_type == "all" OR
          (@search_type == "description" AND doc.description != null) OR
          (@search_type == "business" AND doc.business_context != null) OR
          (@search_type == "code" AND doc.content != null)
        )
        
        FILTER type_relevant
        FILTER content_similarity >= similarity_threshold
        
        // Get associated code entity
        LET code_entity = FIRST(
          FOR entity IN code_entities
            FILTER entity._key == doc.entity_id
            RETURN entity
        )
        
        FILTER code_entity != null
        
        // Get relationships if requested
        LET relationships = (
          @include_relationships ? (
            FOR rel IN calls
              FILTER rel._from == code_entity._id OR rel._to == code_entity._id
              LIMIT 5
              RETURN {
                type: "function_call",
                from: rel._from,
                to: rel._to,
                confidence: rel.confidence || 0.5
              }
          ) : []
        )
        
        SORT content_similarity DESC
        LIMIT max_results
        
        RETURN {
          entity: code_entity,
          embedding_data: {
            content: doc.content,
            description: doc.description,
            business_context: doc.business_context,
            model: doc.model_name
          },
          similarity_score: content_similarity,
          relationships: relationships,
          search_metadata: {
            matched_field: (
              CONTAINS(LOWER(doc.content || ""), LOWER(search_query)) ? "content" :
              CONTAINS(LOWER(doc.description || ""), LOWER(search_query)) ? "description" :
              "business_context"
            ),
            search_type: @search_type
          }
        }
    `;

    try {
      const results = await this.db.query(aqlQuery, {
        query: query,
        max_results: maxResults,
        similarity_threshold: similarityThreshold,
        search_type: searchType,
        include_relationships: options.include_relationships || false
      });

      const searchResults = await results.all();
      console.log(`✅ Found ${searchResults.length} semantic search results`);
      
      return searchResults;
    } catch (error) {
      console.error('❌ Error in semantic search:', error);
      throw error;
    }
  }

  // ===== GRAPHRAG QUERY PROCESSING =====
  
  async performGraphRAGQuery(query: GraphRAGQuery): Promise<GraphRAGResult> {
    console.log(`🧠 Processing GraphRAG query: "${query.natural_language_query}"`);
    
    const startTime = Date.now();
    
    try {
      // Parse query intent
      const queryIntent = await this.parseQueryIntent(query.natural_language_query);
      
      // Execute multi-modal search
      const vectorResults = await this.executeVectorSearch(query);
      const graphResults = await this.executeGraphTraversal(query);
      const fulltextResults = await this.executeFulltextSearch(query);
      
      // Combine and rank results
      const combinedResults = await this.combineAndRankResults(
        vectorResults,
        graphResults,
        fulltextResults,
        query
      );
      
      // Generate insights
      const insights = await this.generateInsights(combinedResults, query);
      
      const processingTime = Date.now() - startTime;
      
      return {
        query_analysis: {
          understood_intent: queryIntent.description,
          confidence_score: queryIntent.confidence,
          query_complexity: this.determineQueryComplexity(query),
          processing_time_ms: processingTime
        },
        results: {
          similar_entities: vectorResults,
          related_entities: graphResults,
          keyword_matches: fulltextResults,
          ranked_results: combinedResults
        },
        insights: insights
      };
      
    } catch (error) {
      console.error('❌ Error in GraphRAG query:', error);
      throw error;
    }
  }

  // ===== AI DESCRIPTION ENHANCEMENT =====
  
  async enhanceEntityDescriptions(
    entity_ids: string[],
    options: {
      regenerate_embeddings?: boolean;
      update_business_context?: boolean;
    } = {}
  ): Promise<void> {
    
    console.log(`🔧 Enhancing descriptions for ${entity_ids.length} entities`);
    
    for (const entityId of entity_ids) {
      try {
        // Get existing entity and description
        const entityQuery = `
          FOR entity IN code_entities
            FILTER entity._key == @entity_id
            RETURN entity
        `;
        
        const entityResult = await this.db.query(entityQuery, { entity_id: entityId });
        const entity = await entityResult.next();
        
        if (!entity) continue;
        
        // Get existing AI description
        const descQuery = `
          FOR desc IN doc_ai_descriptions
            FILTER desc.entity_id == @entity_id
            RETURN desc
        `;
        
        const descResult = await this.db.query(descQuery, { entity_id: entityId });
        const existingDesc = await descResult.next();
        
        if (existingDesc && !options.update_business_context) {
          console.log(`📋 Description exists for ${entityId}, skipping`);
          continue;
        }
        
        // Generate enhanced description with business context
        const enhancedDescription = await this.generateEnhancedDescription(entity);
        
        // Update or create AI description
        const updateQuery = `
          UPSERT { entity_id: @entity_id }
          INSERT {
            entity_id: @entity_id,
            description: @description,
            business_context: @business_context,
            technical_details: @technical_details,
            updated_at: DATE_NOW()
          }
          UPDATE {
            description: @description,
            business_context: @business_context,
            technical_details: @technical_details,
            updated_at: DATE_NOW()
          }
          IN doc_ai_descriptions
        `;
        
        await this.db.query(updateQuery, {
          entity_id: entityId,
          description: enhancedDescription.description,
          business_context: enhancedDescription.business_context,
          technical_details: enhancedDescription.technical_details
        });
        
        console.log(`✅ Enhanced description for entity ${entityId}`);
        
      } catch (error) {
        console.error(`❌ Error enhancing description for ${entityId}:`, error);
      }
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private mergeDefaultConfig(options: Partial<VectorSearchConfig>): VectorSearchConfig {
    return {
      similarity_threshold: options.similarity_threshold || 0.7,
      max_results: options.max_results || 20,
      search_depth: options.search_depth || 2,
      vector_params: {
        metric: 'cosine',
        dimension: 768,
        nLists: 100,
        ...options.vector_params
      },
      search_weights: {
        vector_search: 1.0,
        graph_traversal: 0.8,
        full_text_search: 0.6,
        metadata_boost: 0.4,
        ...options.search_weights
      },
      search_scope: {
        entity_types: ['function', 'class', 'module'],
        languages: ['python', 'javascript', 'typescript'],
        file_patterns: ['*.py', '*.js', '*.ts'],
        business_domains: [],
        ...options.search_scope
      }
    };
  }

  private async getCachedResults(query: string, config: VectorSearchConfig): Promise<VectorSearchResult<EnhancedCodeEntity>[] | null> {
    try {
      const queryHash = this.generateQueryHash(query, config);
      
      const cacheQuery = `
        FOR cache IN doc_similarity_cache
          FILTER cache.query_hash == @query_hash
          FILTER cache.created_at > DATE_SUBTRACT(DATE_NOW(), @ttl, "seconds")
          RETURN cache
      `;
      
      const result = await this.db.query(cacheQuery, {
        query_hash: queryHash,
        ttl: 3600 // 1 hour TTL
      });
      
      const cached = await result.next();
      return cached?.similar_entities || null;
    } catch (error) {
      console.error('⚠️ Cache retrieval error:', error);
      return null;
    }
  }

  private async cacheResults(query: string, config: VectorSearchConfig, results: any[]): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(query, config);
      
      const cacheDoc = {
        query_hash: queryHash,
        query_text: query,
        similar_entities: results,
        similarity_scores: results.map(r => r.similarity?.score || 0),
        created_at: new Date().toISOString(),
        ttl: 3600
      };
      
      await this.db.collection('doc_similarity_cache').save(cacheDoc);
    } catch (error) {
      console.error('⚠️ Cache storage error:', error);
    }
  }

  private generateQueryHash(query: string, config: VectorSearchConfig): string {
    const configString = JSON.stringify({
      query,
      threshold: config.similarity_threshold,
      max_results: config.max_results,
      weights: config.search_weights
    });
    
    // Simple hash function (in production, use crypto.createHash)
    return Buffer.from(configString).toString('base64').slice(0, 16);
  }

  private organizeClusterResults(clusterResults: any[]): any {
    return {
      business_clusters: clusterResults.map(r => ({
        anchor_entity: r.anchor_entity,
        patterns: r.business_patterns,
        cluster_size: r.similar_entities?.length || 0
      })),
      technical_clusters: clusterResults.map(r => ({
        anchor_entity: r.anchor_entity,
        patterns: r.technical_patterns,
        cluster_size: r.similar_entities?.length || 0
      })),
      cross_domain_patterns: [],
      outliers: []
    };
  }

  private async parseQueryIntent(query: string): Promise<{ description: string; confidence: number }> {
    // Simple intent parsing - in production, use NLP service
    const keywords = query.toLowerCase();
    
    if (keywords.includes('find') || keywords.includes('search')) {
      return { description: 'Search for similar code entities', confidence: 0.8 };
    } else if (keywords.includes('pattern') || keywords.includes('similar')) {
      return { description: 'Discover code patterns', confidence: 0.9 };
    } else if (keywords.includes('relationship') || keywords.includes('depend')) {
      return { description: 'Analyze code relationships', confidence: 0.85 };
    }
    
    return { description: 'General code intelligence query', confidence: 0.6 };
  }

  private async executeVectorSearch(query: GraphRAGQuery): Promise<VectorSearchResult<EnhancedCodeEntity>[]> {
    // Implement vector search logic
    return [];
  }

  private async executeGraphTraversal(query: GraphRAGQuery): Promise<any[]> {
    // Implement graph traversal logic
    return [];
  }

  private async executeFulltextSearch(query: GraphRAGQuery): Promise<any[]> {
    // Implement fulltext search logic
    return [];
  }

  private async combineAndRankResults(
    vectorResults: any[],
    graphResults: any[],
    fulltextResults: any[],
    query: GraphRAGQuery
  ): Promise<any[]> {
    // Implement result combination and ranking
    return [];
  }

  private async generateInsights(results: any[], query: GraphRAGQuery): Promise<any> {
    return {
      patterns_discovered: [],
      relationship_insights: [],
      business_impact_analysis: [],
      technical_recommendations: []
    };
  }

  private determineQueryComplexity(query: GraphRAGQuery): 'simple' | 'moderate' | 'complex' {
    const queryLength = query.natural_language_query.length;
    const hasVectorComponent = !!query.vector_component;
    const hasGraphComponent = !!query.graph_component;
    
    if (queryLength > 100 && hasVectorComponent && hasGraphComponent) {
      return 'complex';
    } else if (queryLength > 50 && (hasVectorComponent || hasGraphComponent)) {
      return 'moderate';
    }
    
    return 'simple';
  }

  private async generateEnhancedDescription(entity: any): Promise<any> {
    // Fallback description generation based on entity properties
    const description = `${entity.entity_type} named '${entity.name}' in ${entity.language}`;
    const businessContext = this.inferBusinessContext(entity);
    const technicalDetails = this.extractTechnicalDetails(entity);
    
    return {
      description,
      business_context: businessContext,
      technical_details: technicalDetails
    };
  }

  private inferBusinessContext(entity: any): string {
    const name = entity.name?.toLowerCase() || '';
    
    if (name.includes('auth') || name.includes('login')) return 'Authentication and Security';
    if (name.includes('payment') || name.includes('billing')) return 'Financial Operations';
    if (name.includes('user') || name.includes('customer')) return 'User Management';
    if (name.includes('data') || name.includes('database')) return 'Data Management';
    if (name.includes('api') || name.includes('endpoint')) return 'API Services';
    
    return 'General Business Logic';
  }

  private extractTechnicalDetails(entity: any): string {
    const details = [];
    
    if (entity.entity_type) details.push(`Type: ${entity.entity_type}`);
    if (entity.language) details.push(`Language: ${entity.language}`);
    if (entity.file_path) details.push(`File: ${entity.file_path}`);
    
    return details.join(', ');
  }
}
