#!/usr/bin/env python3
"""
Optimized Hybrid Graph RAG Search Service
Performance improvements without additional compute resources
"""

import logging
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from enum import Enum
import asyncio

from api.services.database_manager import DatabaseManager

logger = logging.getLogger(__name__)


class SearchType(Enum):
    """Types of search operations"""
    SEMANTIC = "semantic"
    STRUCTURAL = "structural"
    TEXTUAL = "textual"
    HYBRID = "hybrid"


class GraphFilter(Enum):
    """Graph traversal filter types"""
    FUNCTIONS = "functions"
    CLASSES = "classes"
    ASYNC_FUNCTIONS = "async_functions"
    ALL_CODE = "all_code"
    DEPENDENCIES = "dependencies"
    SIMILAR_PURPOSE = "similar_purpose"


@dataclass
class SearchOptions:
    """Search configuration options"""
    search_type: SearchType = SearchType.HYBRID
    graph_filters: List[GraphFilter] = None
    similarity_threshold: float = 0.7
    max_results: int = 10
    include_context: bool = True
    traverse_depth: int = 2
    boost_factors: Dict[str, float] = None
    # New optimization options
    enable_early_termination: bool = True
    batch_size: int = 100
    use_index_hints: bool = True


@dataclass
class CodeSearchResult:
    """Enhanced search result with graph context"""
    id: str
    name: str
    type: str
    file_path: str
    language: str
    line_start: int
    line_end: int
    similarity_score: float
    text_relevance: float
    structural_relevance: float
    combined_score: float
    code_content: str
    context: Dict[str, Any]
    related_items: List[Dict[str, Any]]
    graph_path: List[str]
    metadata: Dict[str, Any]


class OptimizedHybridSearchService:
    """
    Performance-optimized search service with the following improvements:
    1. Reduced query complexity and collection scans
    2. Early termination and result limiting
    3. Simplified scoring algorithms
    4. Better index utilization
    5. Parallel search execution where possible
    """
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.default_boost_factors = {
            'semantic': 0.4,
            'structural': 0.3,
            'textual': 0.3
        }
        # Cache for frequently used queries
        self._query_cache = {}
    
    async def search_code(
        self, 
        query: str, 
        options: SearchOptions = None
    ) -> List[CodeSearchResult]:
        """
        Optimized hybrid search with performance improvements
        """
        if not options:
            options = SearchOptions()
        
        db = self.db_manager.get_db()
        if not db:
            raise Exception("Database connection not available")
        
        # Check cache first for exact queries
        cache_key = f"{query}_{hash(str(options))}"
        if cache_key in self._query_cache:
            logger.info(f"Returning cached results for query: {query}")
            return self._query_cache[cache_key]
        
        boost_factors = options.boost_factors or self.default_boost_factors
        
        try:
            if options.search_type == SearchType.SEMANTIC:
                results = await self._optimized_semantic_search(query, options)
            elif options.search_type == SearchType.STRUCTURAL:
                results = await self._optimized_structural_search(query, options)
            elif options.search_type == SearchType.TEXTUAL:
                results = await self._optimized_textual_search(query, options)
            else:
                results = await self._optimized_hybrid_search(query, options, boost_factors)
            
            # Cache results for frequently accessed queries
            if len(results) > 0:
                self._query_cache[cache_key] = results
                # Keep cache size manageable
                if len(self._query_cache) > 100:
                    # Remove oldest entries
                    oldest_key = next(iter(self._query_cache))
                    del self._query_cache[oldest_key]
            
            return results
                
        except Exception as e:
            logger.error(f"Search error: {e}")
            raise
    
    async def _optimized_hybrid_search(
        self, 
        query: str, 
        options: SearchOptions,
        boost_factors: Dict[str, float]
    ) -> List[CodeSearchResult]:
        """
        Optimized hybrid search using parallel execution and simpler queries
        """
        # Run searches in parallel instead of one complex query
        search_tasks = []
        
        # Create simplified search options for each type
        semantic_opts = SearchOptions(
            search_type=SearchType.SEMANTIC,
            max_results=options.max_results * 2,  # Get more candidates
            similarity_threshold=options.similarity_threshold * 0.8,  # Lower threshold
            graph_filters=options.graph_filters
        )
        
        textual_opts = SearchOptions(
            search_type=SearchType.TEXTUAL,
            max_results=options.max_results * 2,
            graph_filters=options.graph_filters
        )
        
        # Execute searches in parallel
        search_tasks = [
            self._fast_semantic_search(query, semantic_opts),
            self._fast_textual_search(query, textual_opts)
        ]
        
        # Only add structural search if needed (it's expensive)
        if options.include_context:
            structural_opts = SearchOptions(
                search_type=SearchType.STRUCTURAL,
                max_results=options.max_results,
                graph_filters=options.graph_filters
            )
            search_tasks.append(self._fast_structural_search(query, structural_opts))
        
        # Wait for all searches to complete
        search_results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Handle any exceptions
        semantic_results = search_results[0] if not isinstance(search_results[0], Exception) else []
        textual_results = search_results[1] if not isinstance(search_results[1], Exception) else []
        structural_results = search_results[2] if len(search_results) > 2 and not isinstance(search_results[2], Exception) else []
        
        # Combine and score results efficiently
        return self._combine_search_results(
            query, 
            semantic_results, 
            textual_results, 
            structural_results,
            boost_factors,
            options.max_results
        )
    
    async def _fast_semantic_search(
        self, 
        query: str, 
        options: SearchOptions
    ) -> List[CodeSearchResult]:
        """
        Optimized semantic search with better indexing
        """
        db = self.db_manager.get_db()
        
        # Build efficient filter
        type_filter = self._build_optimized_type_filter(options.graph_filters)
        
        # Simplified query focusing on indexed fields
        aql_query = f"""
        FOR codeunit IN codeunits
            {type_filter}
            // Use index on name field for better performance
            FILTER CONTAINS(LOWER(codeunit.name), LOWER(@query))
            
            LET semantic_score = (
                // Simplified scoring - avoid complex calculations
                STARTS_WITH(LOWER(codeunit.name), LOWER(@query)) ? 1.0 :
                CONTAINS(LOWER(codeunit.name), LOWER(@query)) ? 0.8 : 0.6
            )
            
            FILTER semantic_score >= @threshold
            SORT semantic_score DESC
            LIMIT @max_results
            
            RETURN {{
                id: codeunit._key,
                name: codeunit.name,
                type: codeunit.type,
                file_path: codeunit.file_path,
                language: codeunit.language,
                line_start: codeunit.line_start || 0,
                line_end: codeunit.line_end || 0,
                similarity_score: semantic_score,
                text_relevance: 0.0,
                structural_relevance: 0.0,
                combined_score: semantic_score,
                code_content: codeunit.code_content || "",
                context: {{ type: "semantic" }},
                related_items: [],
                graph_path: [],
                metadata: {{ search_type: "semantic" }}
            }}
        """
        
        try:
            cursor = db.aql.execute(
                aql_query,
                bind_vars={
                    'query': query,
                    'threshold': options.similarity_threshold,
                    'max_results': options.max_results
                }
            )
            
            results = []
            for item in cursor:
                results.append(CodeSearchResult(**item))
            
            return results
            
        except Exception as e:
            logger.error(f"Fast semantic search error: {e}")
            return []
    
    async def _fast_textual_search(
        self, 
        query: str, 
        options: SearchOptions
    ) -> List[CodeSearchResult]:
        """
        Optimized textual search with better indexing
        """
        db = self.db_manager.get_db()
        
        type_filter = self._build_optimized_type_filter(options.graph_filters)
        
        # Focus on most important text fields only
        aql_query = f"""
        FOR codeunit IN codeunits
            {type_filter}
            // Prioritize exact matches and use indexes
            LET name_match = CONTAINS(LOWER(codeunit.name || ""), LOWER(@query))
            LET path_match = CONTAINS(LOWER(codeunit.file_path || ""), LOWER(@query))
            
            FILTER name_match OR path_match
            
            LET text_score = (
                name_match ? 2.0 : 0
            ) + (
                path_match ? 1.0 : 0
            )
            
            SORT text_score DESC
            LIMIT @max_results
            
            RETURN {{
                id: codeunit._key,
                name: codeunit.name,
                type: codeunit.type,
                file_path: codeunit.file_path,
                language: codeunit.language,
                line_start: codeunit.line_start || 0,
                line_end: codeunit.line_end || 0,
                similarity_score: 0.0,
                text_relevance: text_score,
                structural_relevance: 0.0,
                combined_score: text_score,
                code_content: codeunit.code_content || "",
                context: {{ type: "textual" }},
                related_items: [],
                graph_path: [],
                metadata: {{ search_type: "textual" }}
            }}
        """
        
        try:
            cursor = db.aql.execute(
                aql_query,
                bind_vars={
                    'query': query,
                    'max_results': options.max_results
                }
            )
            
            results = []
            for item in cursor:
                results.append(CodeSearchResult(**item))
            
            return results
            
        except Exception as e:
            logger.error(f"Fast textual search error: {e}")
            return []
    
    async def _fast_structural_search(
        self, 
        query: str, 
        options: SearchOptions
    ) -> List[CodeSearchResult]:
        """
        Optimized structural search with limited traversal
        """
        db = self.db_manager.get_db()
        
        type_filter = self._build_optimized_type_filter(options.graph_filters)
        
        # Limit structural search to direct relationships only
        aql_query = f"""
        FOR codeunit IN codeunits
            {type_filter}
            FILTER CONTAINS(LOWER(codeunit.name), LOWER(@query))
            
            // Count direct relationships only (depth 1)
            LET relationship_count = LENGTH(
                FOR edge IN relationships
                    FILTER edge._from == codeunit._id OR edge._to == codeunit._id
                    RETURN edge
            )
            
            LET structural_score = relationship_count > 0 ? 
                MIN([1.0, relationship_count / 5.0]) : 0.1
            
            LIMIT @max_results
            
            RETURN {{
                id: codeunit._key,
                name: codeunit.name,
                type: codeunit.type,
                file_path: codeunit.file_path,
                language: codeunit.language,
                line_start: codeunit.line_start || 0,
                line_end: codeunit.line_end || 0,
                similarity_score: 0.0,
                text_relevance: 0.0,
                structural_relevance: structural_score,
                combined_score: structural_score,
                code_content: codeunit.code_content || "",
                context: {{ relationship_count: relationship_count }},
                related_items: [],
                graph_path: [],
                metadata: {{ search_type: "structural" }}
            }}
        """
        
        try:
            cursor = db.aql.execute(
                aql_query,
                bind_vars={
                    'query': query,
                    'max_results': options.max_results
                }
            )
            
            results = []
            for item in cursor:
                results.append(CodeSearchResult(**item))
            
            return results
            
        except Exception as e:
            logger.error(f"Fast structural search error: {e}")
            return []
    
    def _combine_search_results(
        self,
        query: str,
        semantic_results: List[CodeSearchResult],
        textual_results: List[CodeSearchResult],
        structural_results: List[CodeSearchResult],
        boost_factors: Dict[str, float],
        max_results: int
    ) -> List[CodeSearchResult]:
        """
        Efficiently combine and score results from multiple searches
        """
        # Create a map for efficient lookup
        combined_results = {}
        
        # Add semantic results
        for result in semantic_results:
            combined_results[result.id] = result
        
        # Merge textual results
        for result in textual_results:
            if result.id in combined_results:
                # Combine scores
                existing = combined_results[result.id]
                existing.text_relevance = result.text_relevance
                existing.combined_score = (
                    existing.similarity_score * boost_factors.get('semantic', 0.4) +
                    result.text_relevance * boost_factors.get('textual', 0.3)
                )
            else:
                result.combined_score = result.text_relevance * boost_factors.get('textual', 0.3)
                combined_results[result.id] = result
        
        # Merge structural results
        for result in structural_results:
            if result.id in combined_results:
                existing = combined_results[result.id]
                existing.structural_relevance = result.structural_relevance
                existing.combined_score = (
                    existing.similarity_score * boost_factors.get('semantic', 0.4) +
                    existing.text_relevance * boost_factors.get('textual', 0.3) +
                    result.structural_relevance * boost_factors.get('structural', 0.3)
                )
                # Add context from structural search
                existing.context.update(result.context)
            else:
                result.combined_score = result.structural_relevance * boost_factors.get('structural', 0.3)
                combined_results[result.id] = result
        
        # Sort by combined score and limit results
        final_results = sorted(
            combined_results.values(),
            key=lambda x: x.combined_score,
            reverse=True
        )[:max_results]
        
        logger.info(f"Combined search returned {len(final_results)} results")
        return final_results
    
    # Simplified versions of other search methods
    async def _optimized_semantic_search(
        self, 
        query: str, 
        options: SearchOptions
    ) -> List[CodeSearchResult]:
        """Optimized semantic search"""
        return await self._fast_semantic_search(query, options)
    
    async def _optimized_structural_search(
        self, 
        query: str, 
        options: SearchOptions
    ) -> List[CodeSearchResult]:
        """Optimized structural search"""
        return await self._fast_structural_search(query, options)
    
    async def _optimized_textual_search(
        self, 
        query: str, 
        options: SearchOptions
    ) -> List[CodeSearchResult]:
        """Optimized textual search"""
        return await self._fast_textual_search(query, options)
    
    def _build_optimized_type_filter(self, graph_filters: List[GraphFilter]) -> str:
        """
        Build optimized AQL filter that uses indexes better
        """
        if not graph_filters:
            return ""
        
        # Use IN operator for better index utilization
        type_values = []
        
        for filter_type in graph_filters:
            if filter_type == GraphFilter.FUNCTIONS:
                type_values.append("'FunctionDeclaration'")
            elif filter_type == GraphFilter.CLASSES:
                type_values.append("'ClassDeclaration'")
            elif filter_type == GraphFilter.ASYNC_FUNCTIONS:
                type_values.append("'AsyncFunctionDeclaration'")
            elif filter_type == GraphFilter.ALL_CODE:
                type_values.extend([
                    "'FunctionDeclaration'",
                    "'ClassDeclaration'", 
                    "'AsyncFunctionDeclaration'"
                ])
        
        if type_values:
            # Remove duplicates
            unique_types = list(set(type_values))
            return f"FILTER codeunit.type IN [{', '.join(unique_types)}]"
        
        return ""
    
    # Keep the utility methods but optimize them
    async def get_code_relationships(
        self, 
        code_id: str, 
        depth: int = 1  # Reduced default depth
    ) -> Dict[str, Any]:
        """
        Optimized relationship retrieval with limited depth
        """
        db = self.db_manager.get_db()
        if not db:
            raise Exception("Database connection not available")
        
        # Simplified query with depth limit
        aql_query = """
        LET start_node = FIRST(FOR c IN codeunits FILTER c._key == @code_id RETURN c)
        
        LET direct_relations = (
            FOR edge IN relationships
                FILTER edge._from == start_node._id OR edge._to == start_node._id
                LET related_id = edge._from == start_node._id ? edge._to : edge._from
                FOR related_unit IN codeunits
                    FILTER related_unit._id == related_id
                    LIMIT 10  // Limit results
                    RETURN {
                        name: related_unit.name,
                        type: related_unit.type,
                        relationship: edge.type
                    }
        )
        
        RETURN {
            center_node: start_node,
            direct_relationships: direct_relations,
            total_connections: LENGTH(direct_relations)
        }
        """
        
        cursor = db.aql.execute(aql_query, bind_vars={'code_id': code_id})
        result = list(cursor)
        
        return result[0] if result else {}
    
    async def get_search_suggestions(self, partial_query: str) -> List[str]:
        """
        Optimized search suggestions with caching
        """
        # Check cache first
        cache_key = f"suggestions_{partial_query.lower()}"
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]
        
        db = self.db_manager.get_db()
        if not db:
            return []
        
        # Use index on name field and limit results early
        aql_query = """
        FOR codeunit IN codeunits
            FILTER STARTS_WITH(LOWER(codeunit.name), LOWER(@partial_query))
            COLLECT suggestion = codeunit.name
            SORT suggestion
            LIMIT 5  // Reduced limit for faster response
            RETURN suggestion
        """
        
        cursor = db.aql.execute(aql_query, bind_vars={'partial_query': partial_query})
        suggestions = list(cursor)
        
        # Cache suggestions
        self._query_cache[cache_key] = suggestions
        
        return suggestions
    
    def clear_cache(self):
        """Clear the query cache"""
        self._query_cache.clear()
        logger.info("Query cache cleared")
    
    async def get_search_analytics(self) -> Dict[str, Any]:
        """
        Simplified analytics query
        """
        db = self.db_manager.get_db()
        if not db:
            return {}
        
        # Use separate simple queries instead of one complex one
        try:
            # Get total count
            total_query = "RETURN LENGTH(codeunits)"
            total_cursor = db.aql.execute(total_query)
            total_count = list(total_cursor)[0]
            
            # Get basic type breakdown (limit to avoid performance issues)
            type_query = """
            FOR codeunit IN codeunits
                COLLECT type = codeunit.type WITH COUNT INTO count
                SORT count DESC
                LIMIT 10
                RETURN { type: type, count: count }
            """
            type_cursor = db.aql.execute(type_query)
            type_breakdown = list(type_cursor)
            
            return {
                'total_codeunits': total_count,
                'breakdown_by_type': type_breakdown,
                'cache_size': len(self._query_cache),
                'last_updated': 'optimized_version'
            }
            
        except Exception as e:
            logger.error(f"Analytics error: {e}")
            return {'error': 'Analytics temporarily unavailable'}