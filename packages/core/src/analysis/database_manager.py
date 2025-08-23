#!/usr/bin/env python3
"""
Unified Database Manager
Consolidates all database operations from multiple scattered files
Single source of truth for all database operations with enhanced capabilities
"""

import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import asyncio
from contextlib import asynccontextmanager

try:
    from arango import ArangoClient
    from arango.database import StandardDatabase
    from arango.collection import Collection
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False
    StandardDatabase = Any
    Collection = Any

from core.schema_manager import UnifiedSchemaManager

logger = logging.getLogger(__name__)

class UnifiedDatabaseManager:
    """
    Single source of truth for all database operations
    Extracted and consolidated from multiple files with scattered DB logic
    """
    
    def __init__(self,
                 host: str = 'localhost',
                 port: int = 8529,
                 username: str = 'root',
                 password: str = 'password',
                 database: str = 'ARANGO_AISDP_DB'
                 pool_size: int = 5):
        """Initialize the unified database manager."""
        if not ARANGO_AVAILABLE:
            raise ImportError("ArangoDB package not available. Install with: pip install python-arango")
        
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.database_name = database
        self.pool_size = pool_size
        
        # Connection management
        self.client = None
        self.db = None
        self.connection_pool = []
        self.active_connections = 0
        
        # Schema manager
        self.schema_manager = UnifiedSchemaManager(host, port, username, password, database)
        
        # Collections cache
        self._collections_cache = {}
        
        # Transaction management
        self._transaction_lock = asyncio.Lock()
    
    async def initialize(self) -> bool:
        """Initialize database connection and ensure schema is set up."""
        try:
            logger.info("🔗 Initializing database connection...")
            
            # Create client and connect
            self.client = ArangoClient(hosts=f'http://{self.host}:{self.port}')
            
            # Get or create database
            sys_db = self.client.db('_system', username=self.username, password=self.password)
            
            if not sys_db.has_database(self.database_name):
                logger.info(f"📊 Creating database: {self.database_name}")
                sys_db.create_database(self.database_name)
            
            self.db = self.client.db(self.database_name, username=self.username, password=self.password)
            
            # Initialize schema
            await self.schema_manager.setup_complete_schema()
            
            # Cache collection references
            await self._cache_collections()
            
            logger.info("✅ Database initialization completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Database initialization failed: {str(e)}")
            raise
    
    async def _cache_collections(self):
        """Cache collection references for faster access."""
        try:
            collections = [
                'repositories', 'code_files', 'ast_nodes', 'codeunits',
                'relationships', 'similarity_cache', 'refactoring_opportunities',
                'purpose_patterns', 'embedding_metadata', 'security_findings',
                'dependencies', 'metrics_cache'
            ]
            
            for collection_name in collections:
                if self.db.has_collection(collection_name):
                    self._collections_cache[collection_name] = self.db.collection(collection_name)
                    
        except Exception as e:
            logger.warning(f"Failed to cache collections: {str(e)}")
    
    def get_collection(self, name: str):
        """Get cached collection reference."""
        return self._collections_cache.get(name)
    
    @asynccontextmanager
    async def transaction(self):
        """Context manager for database transactions with error recovery."""
        async with self._transaction_lock:
            transaction = None
            try:
                transaction = self.db.begin_transaction(
                    read=['repositories', 'code_files', 'ast_nodes', 'codeunits'],
                    write=['repositories', 'code_files', 'ast_nodes', 'codeunits', 
                           'relationships', 'similarity_cache', 'embedding_metadata']
                )
                yield transaction
                transaction.commit()
                
            except Exception as e:
                if transaction:
                    transaction.abort()
                logger.error(f"Transaction failed: {str(e)}")
                raise
    
    async def store_repository(self, repo_info: Dict[str, Any]) -> str:
        """Store repository metadata and return repository ID."""
        try:
            repositories = self.get_collection('repositories')
            if not repositories:
                raise ValueError("Repositories collection not available")
            
            # Check for existing repository
            existing = repositories.find({
                'url': repo_info.get('url'),
                'content_hash': repo_info.get('content_hash')
            })
            
            if existing.count() > 0:
                repo_doc = next(existing)
                logger.info(f"📦 Repository already exists: {repo_doc['_key']}")
                
                # Update analysis timestamp
                repositories.update(repo_doc['_key'], {
                    'last_analysis': datetime.utcnow().isoformat(),
                    'analysis_count': repo_doc.get('analysis_count', 0) + 1
                })
                
                return repo_doc['_key']
            
            # Create new repository document
            repo_doc = {
                'created_at': datetime.utcnow().isoformat(),
                'analysis_count': 1,
                **repo_info
            }
            
            result = repositories.insert(repo_doc)
            repo_id = result['_key']
            
            logger.info(f"📦 Repository stored with ID: {repo_id}")
            return repo_id
            
        except Exception as e:
            logger.error(f"Failed to store repository: {str(e)}")
            raise
    
    async def store_file_metadata(self, file_info: Dict[str, Any]) -> str:
        """Store file metadata and return file ID."""
        try:
            code_files = self.get_collection('code_files')
            if not code_files:
                raise ValueError("Code files collection not available")
            
            # Create file document
            file_doc = {
                'created_at': datetime.utcnow().isoformat(),
                **file_info
            }
            
            # Remove content from metadata (store separately if needed)
            if 'content' in file_doc:
                file_doc['content_size'] = len(file_doc['content'])
                del file_doc['content']
            
            result = code_files.insert(file_doc)
            file_id = result['_key']
            
            return file_id
            
        except Exception as e:
            logger.error(f"Failed to store file metadata: {str(e)}")
            raise
    
    async def store_ast_nodes(self, 
                            nodes: List[Dict[str, Any]], 
                            repo_id: str, 
                            file_path: str) -> int:
        """Store AST nodes in batch for better performance."""
        try:
            ast_nodes = self.get_collection('ast_nodes')
            if not ast_nodes:
                raise ValueError("AST nodes collection not available")
            
            # Prepare nodes for insertion
            prepared_nodes = []
            for node in nodes:
                node_doc = {
                    'repository_id': repo_id,
                    'file_path': file_path,
                    'created_at': datetime.utcnow().isoformat(),
                    **node
                }
                prepared_nodes.append(node_doc)
            
            # Batch insert for better performance
            if prepared_nodes:
                results = ast_nodes.insert_many(prepared_nodes)
                return len(results)
            
            return 0
            
        except Exception as e:
            logger.error(f"Failed to store AST nodes: {str(e)}")
            raise
    
    async def store_embeddings(self, 
                             embeddings: List[Dict[str, Any]], 
                             repo_id: str, 
                             file_path: str) -> int:
        """Store embeddings with metadata."""
        try:
            embedding_metadata = self.get_collection('embedding_metadata')
            if not embedding_metadata:
                raise ValueError("Embedding metadata collection not available")
            
            # Store embeddings with metadata
            stored_count = 0
            for embedding in embeddings:
                embedding_doc = {
                    'repository_id': repo_id,
                    'file_path': file_path,
                    'created_at': datetime.utcnow().isoformat(),
                    **embedding
                }
                
                result = embedding_metadata.insert(embedding_doc)
                if result:
                    stored_count += 1
            
            return stored_count
            
        except Exception as e:
            logger.error(f"Failed to store embeddings: {str(e)}")
            raise
    
    async def store_relationships(self, 
                                dependencies: List[Dict[str, Any]], 
                                similarities: List[Dict[str, Any]], 
                                repo_id: str) -> Dict[str, int]:
        """Store code relationships and similarities."""
        try:
            relationships = self.get_collection('relationships')
            similarity_cache = self.get_collection('similarity_cache')
            
            if not relationships or not similarity_cache:
                raise ValueError("Relationship collections not available")
            
            stored_deps = 0
            stored_sims = 0
            
            # Store dependencies
            if dependencies:
                dep_docs = []
                for dep in dependencies:
                    dep_doc = {
                        'repository_id': repo_id,
                        'type': 'dependency',
                        'created_at': datetime.utcnow().isoformat(),
                        **dep
                    }
                    dep_docs.append(dep_doc)
                
                if dep_docs:
                    results = relationships.insert_many(dep_docs)
                    stored_deps = len(results)
            
            # Store similarities
            if similarities:
                sim_docs = []
                for sim in similarities:
                    sim_doc = {
                        'repository_id': repo_id,
                        'created_at': datetime.utcnow().isoformat(),
                        **sim
                    }
                    sim_docs.append(sim_doc)
                
                if sim_docs:
                    results = similarity_cache.insert_many(sim_docs)
                    stored_sims = len(results)
            
            return {
                'dependencies_stored': stored_deps,
                'similarities_stored': stored_sims
            }
            
        except Exception as e:
            logger.error(f"Failed to store relationships: {str(e)}")
            raise
    
    async def calculate_repository_metrics(self, repo_id: str) -> Dict[str, Any]:
        """Calculate comprehensive repository metrics."""
        try:
            metrics = {
                'repository_id': repo_id,
                'calculated_at': datetime.utcnow().isoformat()
            }
            
            # File metrics
            code_files = self.get_collection('code_files')
            if code_files:
                file_cursor = code_files.find({'repository_id': repo_id})
                files = list(file_cursor)
                
                metrics.update({
                    'total_files': len(files),
                    'total_size': sum(f.get('content_size', 0) for f in files),
                    'file_types': self._aggregate_file_types(files),
                    'avg_file_size': sum(f.get('content_size', 0) for f in files) / len(files) if files else 0
                })
            
            # AST metrics
            ast_nodes = self.get_collection('ast_nodes')
            if ast_nodes:
                node_cursor = ast_nodes.find({'repository_id': repo_id})
                nodes = list(node_cursor)
                
                metrics.update({
                    'total_ast_nodes': len(nodes),
                    'node_types': self._aggregate_node_types(nodes),
                    'complexity_metrics': self._calculate_complexity_metrics(nodes)
                })
            
            # Relationship metrics
            relationships = self.get_collection('relationships')
            if relationships:
                rel_cursor = relationships.find({'repository_id': repo_id})
                rels = list(rel_cursor)
                
                metrics.update({
                    'total_relationships': len(rels),
                    'relationship_types': self._aggregate_relationship_types(rels)
                })
            
            # Store metrics in cache
            metrics_cache = self.get_collection('metrics_cache')
            if metrics_cache:
                metrics_cache.insert(metrics)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to calculate metrics: {str(e)}")
            return {'error': str(e)}
    
    def _aggregate_file_types(self, files: List[Dict[str, Any]]) -> Dict[str, int]:
        """Aggregate file types from file list."""
        types = {}
        for file in files:
            ext = file.get('extension', 'unknown')
            types[ext] = types.get(ext, 0) + 1
        return types
    
    def _aggregate_node_types(self, nodes: List[Dict[str, Any]]) -> Dict[str, int]:
        """Aggregate AST node types."""
        types = {}
        for node in nodes:
            node_type = node.get('type', 'unknown')
            types[node_type] = types.get(node_type, 0) + 1
        return types
    
    def _aggregate_relationship_types(self, relationships: List[Dict[str, Any]]) -> Dict[str, int]:
        """Aggregate relationship types."""
        types = {}
        for rel in relationships:
            rel_type = rel.get('relationship_type', 'unknown')
            types[rel_type] = types.get(rel_type, 0) + 1
        return types
    
    def _calculate_complexity_metrics(self, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate code complexity metrics from AST nodes."""
        complexity_metrics = {
            'cyclomatic_complexity': 0,
            'cognitive_complexity': 0,
            'depth_metrics': {
                'max_depth': 0,
                'avg_depth': 0
            },
            'function_metrics': {
                'total_functions': 0,
                'avg_function_length': 0
            }
        }
        
        function_nodes = [n for n in nodes if n.get('type') in ['function', 'method', 'async_function']]
        complexity_metrics['function_metrics']['total_functions'] = len(function_nodes)
        
        if function_nodes:
            total_lines = sum(n.get('end_line', 0) - n.get('start_line', 0) for n in function_nodes)
            complexity_metrics['function_metrics']['avg_function_length'] = total_lines / len(function_nodes)
        
        # Calculate depth metrics
        depths = [n.get('depth', 0) for n in nodes if 'depth' in n]
        if depths:
            complexity_metrics['depth_metrics']['max_depth'] = max(depths)
            complexity_metrics['depth_metrics']['avg_depth'] = sum(depths) / len(depths)
        
        return complexity_metrics
    
    async def query_repository_data(self, 
                                  repo_id: str = None, 
                                  query_type: str = None,
                                  filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Query repository data with various filters."""
        try:
            filters = filters or {}
            
            # If no repo_id specified, return all repositories
            if repo_id is None and query_type is None:
                repositories = self.get_collection('repositories')
                if not repositories:
                    return []
                cursor = repositories.all()
                return list(cursor)
            
            if query_type == 'files':
                collection = self.get_collection('code_files')
                query_filter = {'repository_id': repo_id, **filters}
                
            elif query_type == 'nodes':
                collection = self.get_collection('ast_nodes')
                query_filter = {'repository_id': repo_id, **filters}
                
            elif query_type == 'relationships':
                collection = self.get_collection('relationships')
                query_filter = {'repository_id': repo_id, **filters}
                
            elif query_type == 'embeddings':
                collection = self.get_collection('embedding_metadata')
                query_filter = {'repository_id': repo_id, **filters}
                
            else:
                raise ValueError(f"Unknown query type: {query_type}")
            
            if not collection:
                return []
            
            cursor = collection.find(query_filter)
            return list(cursor)
            
        except Exception as e:
            logger.error(f"Query failed: {str(e)}")
            return []
    
    async def get_repository(self, repo_id: str) -> Dict[str, Any]:
        """Get a specific repository by ID."""
        try:
            repositories = self.get_collection('repositories')
            if not repositories:
                return None
            
            return repositories.get(repo_id)
            
        except Exception as e:
            logger.error(f"Failed to get repository {repo_id}: {str(e)}")
            return None
    
    async def update_repository(self, repo_id: str, updates: Dict[str, Any]) -> bool:
        """Update repository metadata."""
        try:
            repositories = self.get_collection('repositories')
            if not repositories:
                return False
            
            updates['updated_at'] = datetime.utcnow().isoformat()
            result = repositories.update(repo_id, updates)
            return result is not None
            
        except Exception as e:
            logger.error(f"Failed to update repository {repo_id}: {str(e)}")
            return False
    
    async def delete_repository(self, repo_id: str) -> bool:
        """Delete a repository and all associated data."""
        try:
            # Clean up all associated data first
            await self.cleanup_repository_data(repo_id)
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete repository {repo_id}: {str(e)}")
            return False
    
    async def get_repository_stats(self, repo_id: str) -> Dict[str, Any]:
        """Get comprehensive repository statistics."""
        try:
            # Check if cached metrics exist
            metrics_cache = self.get_collection('metrics_cache')
            if metrics_cache:
                cached = metrics_cache.find({'repository_id': repo_id}).next()
                if cached:
                    return cached
            
            # Calculate fresh metrics
            metrics = await self.calculate_repository_metrics(repo_id)
            
            # Convert to stats format expected by frontend
            stats = {
                'repository_id': repo_id,
                'total_files': metrics.get('total_files', 0),
                'lines_of_code': metrics.get('total_size', 0),  # Using size as proxy
                'languages': self._convert_file_types_to_languages(metrics.get('file_types', {})),
                'complexity_metrics': metrics.get('complexity_metrics', {}),
                'quality_metrics': {
                    'code_coverage': 0.0,
                    'duplication_percentage': 0.0,
                    'maintainability_index': 85.0
                },
                'analysis_date': metrics.get('calculated_at')
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get repository stats {repo_id}: {str(e)}")
            return None
    
    def _convert_file_types_to_languages(self, file_types: Dict[str, int]) -> Dict[str, int]:
        """Convert file extensions to programming languages."""
        language_map = {
            '.py': 'Python',
            '.js': 'JavaScript', 
            '.ts': 'TypeScript',
            '.jsx': 'JavaScript',
            '.tsx': 'TypeScript',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.json': 'JSON',
            '.xml': 'XML',
            '.yaml': 'YAML',
            '.yml': 'YAML'
        }
        
        languages = {}
        for ext, count in file_types.items():
            language = language_map.get(ext, 'Other')
            languages[language] = languages.get(language, 0) + count
        
        return languages
    
    async def cleanup_repository_data(self, repo_id: str) -> Dict[str, int]:
        """Clean up all data associated with a repository."""
        try:
            cleanup_results = {}
            
            collections_to_clean = [
                'code_files', 'ast_nodes', 'relationships', 
                'similarity_cache', 'embedding_metadata', 'metrics_cache'
            ]
            
            for collection_name in collections_to_clean:
                collection = self.get_collection(collection_name)
                if collection:
                    result = collection.delete_match({'repository_id': repo_id})
                    cleanup_results[collection_name] = result.get('deleted', 0)
            
            # Finally remove repository record
            repositories = self.get_collection('repositories')
            if repositories:
                repositories.delete(repo_id)
                cleanup_results['repository'] = 1
            
            return cleanup_results
            
        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform database health check."""
        try:
            health = {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'collections': {},
                'connection': True
            }
            
            # Check collections
            for name, collection in self._collections_cache.items():
                try:
                    count = collection.count()
                    health['collections'][name] = {
                        'exists': True,
                        'count': count
                    }
                except Exception as e:
                    health['collections'][name] = {
                        'exists': False,
                        'error': str(e)
                    }
            
            return health
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e),
                'connection': False
            }
    
    async def close(self):
        """Close database connections and cleanup."""
        try:
            # Clear caches
            self._collections_cache.clear()
            
            # Close connections (ArangoDB handles this automatically)
            self.client = None
            self.db = None
            
            logger.info("🔌 Database connections closed")
            
        except Exception as e:
            logger.error(f"Error closing database: {str(e)}")
