#!/usr/bin/env python3
"""
Enhanced AST Graph Schema for AI-Powered Refactoring System
Extends the existing schema to support purpose-based embeddings and advanced analysis
"""

import os
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

try:
    from arango import ArangoClient
    from arango.database import StandardDatabase
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False
    StandardDatabase = Any

from database.ast_graph_schema import ASTGraphSchemaManager

logger = logging.getLogger(__name__)

class EnhancedASTGraphSchemaManager(ASTGraphSchemaManager):
    """Enhanced schema manager for AI-powered refactoring system."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.enhanced_collections = {
            # Enhanced core collections
            'codeunits': {
                'type': 'document',
                'description': 'Enhanced code units with embeddings and purpose analysis',
                'indexes': [
                    {'type': 'persistent', 'fields': ['type']},
                    {'type': 'persistent', 'fields': ['file_path']},
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['purpose.domain']},
                    {'type': 'persistent', 'fields': ['purpose.operation_type']},
                    {'type': 'persistent', 'fields': ['purpose.intent']},
                    {'type': 'persistent', 'fields': ['metrics.complexity']},
                    {'type': 'persistent', 'fields': ['metadata.analysis_timestamp']},
                ]
            },
            
            # New collections for AI system
            'similarity_cache': {
                'type': 'document',
                'description': 'Cache for similarity computation results',
                'indexes': [
                    {'type': 'persistent', 'fields': ['source_id', 'target_id']},
                    {'type': 'persistent', 'fields': ['similarity_type']},
                    {'type': 'ttl', 'fields': ['expires_at'], 'expireAfterSeconds': 0},
                ]
            },
            
            'refactoring_opportunities': {
                'type': 'document',
                'description': 'Identified refactoring opportunities',
                'indexes': [
                    {'type': 'persistent', 'fields': ['type']},
                    {'type': 'persistent', 'fields': ['priority']},
                    {'type': 'persistent', 'fields': ['status']},
                    {'type': 'persistent', 'fields': ['created_at']},
                    {'type': 'persistent', 'fields': ['estimated_effort']},
                ]
            },
            
            'similarity_groups': {
                'type': 'document',
                'description': 'Groups of similar code units for refactoring',
                'indexes': [
                    {'type': 'persistent', 'fields': ['similarity_type']},
                    {'type': 'persistent', 'fields': ['priority']},
                    {'type': 'persistent', 'fields': ['average_similarity']},
                    {'type': 'persistent', 'fields': ['created_at']},
                ]
            },
            
            'purpose_patterns': {
                'type': 'document',
                'description': 'Learned patterns for purpose extraction',
                'indexes': [
                    {'type': 'persistent', 'fields': ['pattern_type']},
                    {'type': 'persistent', 'fields': ['confidence']},
                    {'type': 'persistent', 'fields': ['domain']},
                ]
            },
            
            'embedding_metadata': {
                'type': 'document',
                'description': 'Metadata about embedding models and versions',
                'indexes': [
                    {'type': 'persistent', 'fields': ['model_version']},
                    {'type': 'persistent', 'fields': ['embedding_type']},
                    {'type': 'persistent', 'fields': ['created_at']},
                ]
            },
        }
        
        self.enhanced_edge_collections = {
            'similarity_relationships': {
                'type': 'edge',
                'description': 'Similarity relationships between code units',
                'from_collections': ['codeunits'],
                'to_collections': ['codeunits'],
                'indexes': [
                    {'type': 'edge', 'fields': ['_from', '_to']},
                    {'type': 'persistent', 'fields': ['similarity_type']},
                    {'type': 'persistent', 'fields': ['similarity_score']},
                ]
            },
            
            'refactoring_relationships': {
                'type': 'edge',
                'description': 'Relationships in refactoring opportunities',
                'from_collections': ['refactoring_opportunities'],
                'to_collections': ['codeunits', 'similarity_groups'],
                'indexes': [
                    {'type': 'edge', 'fields': ['_from', '_to']},
                    {'type': 'persistent', 'fields': ['relationship_type']},
                ]
            },
        }
    
    def setup_enhanced_schema(self) -> Dict[str, Any]:
        """Set up the enhanced schema for AI-powered refactoring."""
        result = {
            'success': True,
            'collections_created': [],
            'indexes_created': [],
            'graphs_created': [],
            'errors': []
        }
        
        try:
            # First setup base schema
            base_result = self.setup_complete_schema()
            if not base_result.get('success', False):
                result['errors'].extend(base_result.get('errors', []))
            
            # Create enhanced collections
            for collection_name, config in self.enhanced_collections.items():
                try:
                    if not self.db.has_collection(collection_name):
                        collection = self.db.create_collection(collection_name)
                        result['collections_created'].append(collection_name)
                        logger.info(f"Created enhanced collection: {collection_name}")
                    else:
                        collection = self.db.collection(collection_name)
                    
                    # Create indexes
                    for index_config in config.get('indexes', []):
                        try:
                            collection.add_index(index_config)
                            result['indexes_created'].append(f"{collection_name}.{index_config}")
                        except Exception as e:
                            logger.warning(f"Index creation warning for {collection_name}: {e}")
                
                except Exception as e:
                    error_msg = f"Failed to create collection {collection_name}: {e}"
                    result['errors'].append(error_msg)
                    logger.error(error_msg)
            
            # Create enhanced edge collections
            for collection_name, config in self.enhanced_edge_collections.items():
                try:
                    if not self.db.has_collection(collection_name):
                        collection = self.db.create_collection(collection_name, edge=True)
                        result['collections_created'].append(collection_name)
                        logger.info(f"Created enhanced edge collection: {collection_name}")
                    else:
                        collection = self.db.collection(collection_name)
                    
                    # Create indexes
                    for index_config in config.get('indexes', []):
                        try:
                            collection.add_index(index_config)
                            result['indexes_created'].append(f"{collection_name}.{index_config}")
                        except Exception as e:
                            logger.warning(f"Index creation warning for {collection_name}: {e}")
                
                except Exception as e:
                    error_msg = f"Failed to create edge collection {collection_name}: {e}"
                    result['errors'].append(error_msg)
                    logger.error(error_msg)
            
            # Create enhanced graphs
            self._create_enhanced_graphs(result)
            
            # Insert initial data
            self._insert_initial_enhanced_data(result)
            
            logger.info("Enhanced AST graph schema setup completed")
            return result
            
        except Exception as e:
            error_msg = f"Enhanced schema setup failed: {e}"
            result['errors'].append(error_msg)
            result['success'] = False
            logger.error(error_msg)
            return result
    
    def _create_enhanced_graphs(self, result: Dict[str, Any]):
        """Create enhanced graphs for AI refactoring analysis."""
        graphs_to_create = [
            {
                'name': 'knowledge_graph',
                'edge_definitions': [
                    {
                        'edge_collection': 'relationships',
                        'from_vertex_collections': ['ast_nodes', 'codeunits', 'code_files', 'code_entities', 'repositories'],
                        'to_vertex_collections': ['ast_nodes', 'codeunits', 'code_files', 'code_entities', 'repositories']
                    },
                    {
                        'edge_collection': 'similarity_relationships',
                        'from_vertex_collections': ['codeunits'],
                        'to_vertex_collections': ['codeunits']
                    },
                    {
                        'edge_collection': 'refactoring_relationships',
                        'from_vertex_collections': ['refactoring_opportunities'],
                        'to_vertex_collections': ['codeunits', 'similarity_groups']
                    },
                    {
                        'edge_collection': 'dependencies',
                        'from_vertex_collections': ['ast_nodes', 'codeunits', 'code_files', 'code_entities', 'repositories'],
                        'to_vertex_collections': ['ast_nodes', 'codeunits', 'code_files', 'code_entities', 'repositories']
                    },
                    {
                        'edge_collection': 'semantic_relationships',
                        'from_vertex_collections': ['ast_nodes', 'codeunits', 'code_files', 'code_entities', 'repositories'],
                        'to_vertex_collections': ['ast_nodes', 'codeunits', 'code_files', 'code_entities', 'repositories']
                    }
                ]
            }
        ]
        
        for graph_config in graphs_to_create:
            try:
                if not self.db.has_graph(graph_config['name']):
                    self.db.create_graph(
                        graph_config['name'],
                        edge_definitions=graph_config['edge_definitions']
                    )
                    result['graphs_created'].append(graph_config['name'])
                    logger.info(f"Created enhanced graph: {graph_config['name']}")
            except Exception as e:
                error_msg = f"Failed to create graph {graph_config['name']}: {e}"
                result['errors'].append(error_msg)
                logger.warning(error_msg)
    
    def _insert_initial_enhanced_data(self, result: Dict[str, Any]):
        """Insert initial data for enhanced collections."""
        try:
            # Insert embedding metadata
            embedding_metadata = self.db.collection('embedding_metadata')
            initial_metadata = [
                {
                    '_key': 'purpose_embedding_v1',
                    'embedding_type': 'purpose',
                    'model_name': 'all-MiniLM-L6-v2',
                    'model_version': '1.0',
                    'dimension': 384,
                    'description': 'Purpose-based semantic embeddings',
                    'created_at': datetime.now().isoformat()
                },
                {
                    '_key': 'code_structure_v1',
                    'embedding_type': 'code',
                    'model_name': 'structural_features',
                    'model_version': '1.0',
                    'dimension': 256,
                    'description': 'Code structure embeddings',
                    'created_at': datetime.now().isoformat()
                },
                {
                    '_key': 'context_embedding_v1',
                    'embedding_type': 'context',
                    'model_name': 'usage_patterns',
                    'model_version': '1.0',
                    'dimension': 256,
                    'description': 'Usage context embeddings',
                    'created_at': datetime.now().isoformat()
                },
                {
                    '_key': 'domain_embedding_v1',
                    'embedding_type': 'domain',
                    'model_name': 'domain_classifier',
                    'model_version': '1.0',
                    'dimension': 128,
                    'description': 'Business domain embeddings',
                    'created_at': datetime.now().isoformat()
                }
            ]
            
            for metadata in initial_metadata:
                try:
                    embedding_metadata.insert(metadata)
                except Exception as e:
                    # Ignore duplicate key errors
                    if 'unique constraint violated' not in str(e).lower():
                        logger.warning(f"Failed to insert embedding metadata: {e}")
            
            # Insert purpose patterns
            purpose_patterns = self.db.collection('purpose_patterns')
            initial_patterns = [
                {
                    '_key': 'validation_pattern',
                    'pattern_type': 'validation',
                    'keywords': ['validate', 'check', 'verify', 'assert', 'ensure'],
                    'structural_indicators': ['early_return', 'exception_throwing', 'boolean_return'],
                    'confidence': 0.9,
                    'domain': 'general',
                    'created_at': datetime.now().isoformat()
                },
                {
                    '_key': 'transformation_pattern',
                    'pattern_type': 'transformation',
                    'keywords': ['transform', 'convert', 'parse', 'format', 'serialize'],
                    'structural_indicators': ['data_manipulation', 'comprehensions', 'functional_patterns'],
                    'confidence': 0.85,
                    'domain': 'general',
                    'created_at': datetime.now().isoformat()
                },
                {
                    '_key': 'persistence_pattern',
                    'pattern_type': 'persistence',
                    'keywords': ['save', 'store', 'persist', 'load', 'fetch', 'query'],
                    'structural_indicators': ['sql_patterns', 'crud_operations'],
                    'confidence': 0.9,
                    'domain': 'data',
                    'created_at': datetime.now().isoformat()
                }
            ]
            
            for pattern in initial_patterns:
                try:
                    purpose_patterns.insert(pattern)
                except Exception as e:
                    # Ignore duplicate key errors
                    if 'unique constraint violated' not in str(e).lower():
                        logger.warning(f"Failed to insert purpose pattern: {e}")
            
            logger.info("Initial enhanced data inserted successfully")
            
        except Exception as e:
            error_msg = f"Failed to insert initial enhanced data: {e}"
            result['errors'].append(error_msg)
            logger.warning(error_msg)
    
    def get_enhanced_schema_info(self) -> Dict[str, Any]:
        """Get information about the enhanced schema."""
        try:
            info = {
                'enhanced_collections': {},
                'enhanced_edge_collections': {},
                'enhanced_graphs': [],
                'total_documents': 0,
                'schema_version': '2.0'
            }
            
            # Get collection info
            for collection_name in self.enhanced_collections.keys():
                if self.db.has_collection(collection_name):
                    collection = self.db.collection(collection_name)
                    doc_count = collection.count()
                    info['enhanced_collections'][collection_name] = {
                        'document_count': doc_count,
                        'indexes': len(collection.indexes()),
                        'status': 'active'
                    }
                    info['total_documents'] += doc_count
                else:
                    info['enhanced_collections'][collection_name] = {'status': 'missing'}
            
            # Get edge collection info
            for collection_name in self.enhanced_edge_collections.keys():
                if self.db.has_collection(collection_name):
                    collection = self.db.collection(collection_name)
                    doc_count = collection.count()
                    info['enhanced_edge_collections'][collection_name] = {
                        'edge_count': doc_count,
                        'indexes': len(collection.indexes()),
                        'status': 'active'
                    }
                else:
                    info['enhanced_edge_collections'][collection_name] = {'status': 'missing'}
            
            # Get graph info
            graph_names = ['knowledge_graph']
            for graph_name in graph_names:
                if self.db.has_graph(graph_name):
                    info['enhanced_graphs'].append({
                        'name': graph_name,
                        'status': 'active'
                    })
                else:
                    info['enhanced_graphs'].append({
                        'name': graph_name,
                        'status': 'missing'
                    })
            
            return info
            
        except Exception as e:
            logger.error(f"Failed to get enhanced schema info: {e}")
            return {'error': str(e)}
    
    def validate_enhanced_schema(self) -> Dict[str, Any]:
        """Validate the enhanced schema integrity."""
        validation_result = {
            'valid': True,
            'issues': [],
            'warnings': [],
            'recommendations': []
        }
        
        try:
            # Check required collections exist
            required_collections = list(self.enhanced_collections.keys()) + list(self.enhanced_edge_collections.keys())
            for collection_name in required_collections:
                if not self.db.has_collection(collection_name):
                    validation_result['issues'].append(f"Missing required collection: {collection_name}")
                    validation_result['valid'] = False
            
            # Check graphs exist
            required_graphs = ['knowledge_graph']
            for graph_name in required_graphs:
                if not self.db.has_graph(graph_name):
                    validation_result['issues'].append(f"Missing required graph: {graph_name}")
                    validation_result['valid'] = False
            
            # Check for orphaned documents
            if self.db.has_collection('codeunits'):
                collection = self.db.collection('codeunits')
                orphaned_query = """
                FOR doc IN codeunits
                    FILTER !HAS(doc, 'embeddings') OR !HAS(doc, 'purpose')
                    LIMIT 10
                    RETURN doc._key
                """
                orphaned_docs = list(self.db.aql.execute(orphaned_query))
                if orphaned_docs:
                    validation_result['warnings'].append(
                        f"Found {len(orphaned_docs)} code units without enhanced analysis"
                    )
                    validation_result['recommendations'].append(
                        "Re-run enhanced analysis on existing code units"
                    )
            
            # Check embedding consistency
            if self.db.has_collection('codeunits'):
                inconsistent_query = """
                FOR doc IN codeunits
                    FILTER HAS(doc, 'embeddings')
                    LET purpose_dim = LENGTH(doc.embeddings.purpose)
                    LET code_dim = LENGTH(doc.embeddings.code)
                    LET context_dim = LENGTH(doc.embeddings.context)
                    LET domain_dim = LENGTH(doc.embeddings.domain)
                    FILTER purpose_dim == 0 OR code_dim == 0 OR context_dim == 0 OR domain_dim == 0
                    LIMIT 5
                    RETURN {key: doc._key, dims: {purpose: purpose_dim, code: code_dim, context: context_dim, domain: domain_dim}}
                """
                inconsistent_embeddings = list(self.db.aql.execute(inconsistent_query))
                if inconsistent_embeddings:
                    validation_result['warnings'].append(
                        f"Found {len(inconsistent_embeddings)} code units with empty embeddings"
                    )
            
            logger.info(f"Enhanced schema validation completed. Valid: {validation_result['valid']}")
            return validation_result
            
        except Exception as e:
            validation_result['valid'] = False
            validation_result['issues'].append(f"Validation failed: {e}")
            logger.error(f"Enhanced schema validation error: {e}")
            return validation_result
