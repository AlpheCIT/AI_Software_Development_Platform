"""
Code Search Service for semantic and text-based code search.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class CodeSearchService:
    """Service for searching code using both text and semantic methods."""
    
    def __init__(self, db_connection, embedding_service):
        """Initialize the code search service."""
        self.db_connection = db_connection
        self.embedding_service = embedding_service
    
    def search(self, query: str, repository_id: Optional[str] = None, limit: int = 20, file_types: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Search for code using both text and semantic methods.
        
        Args:
            query: Search query
            repository_id: Optional repository ID to limit search
            limit: Maximum number of results
            file_types: Optional list of file extensions to filter by
            
        Returns:
            Dictionary with search results and metadata
        """
        start_time = datetime.now()
        
        try:
            # Get text-based results first
            text_results = self._text_search(query, repository_id, limit * 2, file_types)
            
            # Enhance with semantic search if embedding service is available
            if self.embedding_service and self.embedding_service.is_available() and text_results:
                semantic_results = self._semantic_search(query, text_results, limit)
                results = semantic_results
            else:
                # Use text results with basic scoring
                results = text_results[:limit]
                for result in results:
                    result['similarity'] = self._calculate_text_similarity(query, result.get('content', ''))
            
            duration_ms = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                'results': results,
                'total_results': len(results),
                'query': query,
                'query_time_ms': round(duration_ms, 2),
                'search_method': 'semantic' if self.embedding_service and self.embedding_service.is_available() else 'text',
                'has_embeddings': self.embedding_service and self.embedding_service.is_available()
            }
        
        except Exception as e:
            logger.error(f"Error in code search: {e}")
            return {
                'results': [],
                'total_results': 0,
                'query': query,
                'query_time_ms': 0,
                'error': str(e)
            }
    
    def _text_search(self, query: str, repository_id: Optional[str], limit: int, file_types: Optional[List[str]]) -> List[Dict[str, Any]]:
        """Perform text-based search in the database."""
        if not self.db_connection or not self.db_connection.is_connected():
            logger.warning("Database not connected for text search")
            return []
        
        try:
            # Build AQL query for text search
            aql_query = """
                FOR node IN codeNodes
                    FILTER CONTAINS(LOWER(node.content), LOWER(@query)) 
                       OR CONTAINS(LOWER(node.file_path), LOWER(@query))
            """
            
            bind_vars = {'query': query}
            
            # Add repository filter
            if repository_id:
                aql_query += " FILTER node.repository_id == @repository_id"
                bind_vars['repository_id'] = repository_id
            
            # Add file type filter
            if file_types:
                file_filters = []
                for i, ext in enumerate(file_types):
                    param_name = f"ext{i}"
                    file_filters.append(f"CONTAINS(node.file_path, @{param_name})")
                    bind_vars[param_name] = f".{ext}"
                
                if file_filters:
                    aql_query += f" FILTER ({' OR '.join(file_filters)})"
            
            aql_query += """
                LIMIT @limit
                RETURN {
                    id: node.id,
                    type: node.type,
                    repository_id: node.repository_id,
                    file_path: node.file_path,
                    language: node.language,
                    content: SUBSTRING(node.content, 0, 1000),
                    line_count: node.line_count,
                    created_at: node.created_at,
                    full_content: node.content
                }
            """
            
            bind_vars['limit'] = limit
            
            cursor = self.db_connection.db.aql.execute(aql_query, bind_vars=bind_vars)
            results = list(cursor)
            
            logger.info(f"Text search found {len(results)} results for query: '{query}'")
            return results
        
        except Exception as e:
            logger.error(f"Error in text search: {e}")
            return []
    
    def _semantic_search(self, query: str, candidates: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
        """Perform semantic search using embeddings."""
        try:
            # Generate embedding for the query
            query_embedding = self.embedding_service.get_embedding(query)
            if not query_embedding:
                logger.warning("Failed to generate query embedding, falling back to text search")
                return candidates[:limit]
            
            # Calculate similarities
            scored_results = []
            for candidate in candidates:
                content = candidate.get('full_content', candidate.get('content', ''))
                
                # Generate embedding for the candidate
                candidate_embedding = self.embedding_service.get_embedding(content)
                
                if candidate_embedding:
                    similarity = self.embedding_service.cosine_similarity(query_embedding, candidate_embedding)
                    candidate['similarity'] = similarity
                    candidate['embedding'] = {
                        'model': self.embedding_service.model,
                        'dimensions': len(candidate_embedding),
                        'vector': candidate_embedding[:10],  # Store only first 10 dimensions for display
                        'similarity_method': 'cosine'
                    }
                    scored_results.append(candidate)
                else:
                    # Fallback to text similarity
                    candidate['similarity'] = self._calculate_text_similarity(query, content)
                    scored_results.append(candidate)
            
            # Sort by similarity and return top results
            scored_results.sort(key=lambda x: x.get('similarity', 0), reverse=True)
            
            logger.info(f"Semantic search scored {len(scored_results)} results")
            return scored_results[:limit]
        
        except Exception as e:
            logger.error(f"Error in semantic search: {e}")
            # Fallback to text search results
            return candidates[:limit]
    
    def _calculate_text_similarity(self, query: str, text: str) -> float:
        """Calculate simple text similarity score."""
        if not query or not text:
            return 0.0
        
        query_lower = query.lower()
        text_lower = text.lower()
        
        # Count query word matches
        query_words = set(query_lower.split())
        text_words = set(text_lower.split())
        
        if not query_words:
            return 0.0
        
        # Calculate Jaccard similarity
        intersection = len(query_words.intersection(text_words))
        union = len(query_words.union(text_words))
        
        jaccard_similarity = intersection / union if union > 0 else 0.0
        
        # Boost score if query appears as substring
        substring_bonus = 0.2 if query_lower in text_lower else 0.0
        
        return min(jaccard_similarity + substring_bonus, 1.0)
    
    def index_repository_embeddings(self, repository_id: str) -> Dict[str, Any]:
        """Generate embeddings for all code nodes in a repository."""
        if not self.embedding_service or not self.embedding_service.is_available():
            return {
                'success': False,
                'error': 'Embedding service not available'
            }
        
        if not self.db_connection or not self.db_connection.is_connected():
            return {
                'success': False,
                'error': 'Database not connected'
            }
        
        try:
            # Get all code nodes for the repository
            aql_query = """
                FOR node IN codeNodes
                    FILTER node.repository_id == @repository_id
                    FILTER node.content != null AND node.content != ""
                    RETURN node
            """
            
            cursor = self.db_connection.db.aql.execute(aql_query, bind_vars={'repository_id': repository_id})
            nodes = list(cursor)
            
            embeddings_generated = 0
            embeddings_failed = 0
            
            # Generate embeddings in batches
            batch_size = 10
            for i in range(0, len(nodes), batch_size):
                batch = nodes[i:i + batch_size]
                
                for node in batch:
                    try:
                        content = node.get('content', '')
                        if not content.strip():
                            continue
                        
                        embedding = self.embedding_service.get_embedding(content)
                        if embedding:
                            # Store embedding in separate collection
                            embedding_record = {
                                'id': f"embed_{node['id']}",
                                'code_node_id': node['id'],
                                'repository_id': repository_id,
                                'vector': embedding,
                                'dimensions': len(embedding),
                                'model': self.embedding_service.model,
                                'created_at': datetime.now().isoformat()
                            }
                            
                            embeddings_collection = self.db_connection.get_collection('embeddings')
                            if embeddings_collection:
                                embeddings_collection.insert(embedding_record)
                            
                            embeddings_generated += 1
                        else:
                            embeddings_failed += 1
                    
                    except Exception as e:
                        logger.error(f"Error generating embedding for node {node.get('id')}: {e}")
                        embeddings_failed += 1
            
            return {
                'success': True,
                'repository_id': repository_id,
                'total_nodes': len(nodes),
                'embeddings_generated': embeddings_generated,
                'embeddings_failed': embeddings_failed
            }
        
        except Exception as e:
            logger.error(f"Error indexing repository embeddings: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_search_statistics(self) -> Dict[str, Any]:
        """Get statistics about searchable content."""
        if not self.db_connection or not self.db_connection.is_connected():
            return {
                'total_nodes': 0,
                'total_repositories': 0,
                'languages': {},
                'embedding_coverage': 0.0
            }
        
        try:
            # Get total code nodes
            nodes_query = "RETURN LENGTH(FOR node IN codeNodes RETURN 1)"
            nodes_cursor = self.db_connection.db.aql.execute(nodes_query)
            total_nodes = list(nodes_cursor)[0]
            
            # Get total repositories
            repos_query = "RETURN LENGTH(FOR repo IN repositories RETURN 1)"
            repos_cursor = self.db_connection.db.aql.execute(repos_query)
            total_repositories = list(repos_cursor)[0]
            
            # Get language distribution
            lang_query = """
                FOR node IN codeNodes
                    COLLECT language = node.language WITH COUNT INTO count
                    RETURN { language: language, count: count }
            """
            lang_cursor = self.db_connection.db.aql.execute(lang_query)
            languages = {item['language']: item['count'] for item in lang_cursor}
            
            # Get embedding coverage
            embeddings_query = "RETURN LENGTH(FOR embed IN embeddings RETURN 1)"
            embeddings_cursor = self.db_connection.db.aql.execute(embeddings_query)
            total_embeddings = list(embeddings_cursor)[0]
            
            embedding_coverage = (total_embeddings / total_nodes * 100) if total_nodes > 0 else 0.0
            
            return {
                'total_nodes': total_nodes,
                'total_repositories': total_repositories,
                'total_embeddings': total_embeddings,
                'languages': languages,
                'embedding_coverage': round(embedding_coverage, 1),
                'embedding_service_available': self.embedding_service and self.embedding_service.is_available()
            }
        
        except Exception as e:
            logger.error(f"Error getting search statistics: {e}")
            return {
                'total_nodes': 0,
                'total_repositories': 0,
                'languages': {},
                'embedding_coverage': 0.0,
                'error': str(e)
            }
