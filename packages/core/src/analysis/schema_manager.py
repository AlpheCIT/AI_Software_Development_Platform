#!/usr/bin/env python3
"""
Unified Schema Manager
Merges ast_graph_schema.py + enhanced_ast_graph_schema.py
Complete schema management with version control and migration support
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

logger = logging.getLogger(__name__)

class UnifiedSchemaManager:
    """
    Complete schema management with version control
    Merges basic + enhanced schemas from multiple files
    """
    
    def __init__(self, 
                 host: str = 'localhost',
                 port: int = 8529,
                 username: str = 'root',
                 password: str = 'password',
                 database: str = 'ARANGO_AISDP_DB'):
        """Initialize the unified schema manager."""
        if not ARANGO_AVAILABLE:
            raise ImportError("ArangoDB package not available. Install with: pip install python-arango")
        
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.database_name = database
        self.client = None
        self.db = None
        
        # Schema version for migration tracking
        self.schema_version = "2.0.0"
        
        # Complete unified schema definition
        self.unified_schema = {
            # Core collections from basic schema
            'repositories': {
                'type': 'document',
                'description': 'Repository metadata and analysis information',
                'indexes': [
                    {'type': 'persistent', 'fields': ['url']},
                    {'type': 'persistent', 'fields': ['content_hash']},
                    {'type': 'persistent', 'fields': ['analysis_timestamp']},
                    {'type': 'persistent', 'fields': ['current_branch']},
                    {'type': 'persistent', 'fields': ['latest_commit']}
                ]
            },
            
            'code_files': {
                'type': 'document',
                'description': 'Individual code files with metadata',
                'indexes': [
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['file_path']},
                    {'type': 'persistent', 'fields': ['extension']},
                    {'type': 'persistent', 'fields': ['size']},
                    {'type': 'persistent', 'fields': ['analysis_timestamp']}
                ]
            },
            
            'ast_nodes': {
                'type': 'document',
                'description': 'AST nodes with enhanced metadata and embeddings',
                'indexes': [
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['file_path']},
                    {'type': 'persistent', 'fields': ['type']},
                    {'type': 'persistent', 'fields': ['name']},
                    {'type': 'persistent', 'fields': ['start_line']},
                    {'type': 'persistent', 'fields': ['end_line']},
                    {'type': 'persistent', 'fields': ['parent_id']},
                    {'type': 'persistent', 'fields': ['depth']},
                    {'type': 'fulltext', 'fields': ['content']}
                ]
            },
            
            # Enhanced collections from enhanced schema
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
                    {'type': 'fulltext', 'fields': ['content', 'documentation']}
                ]
            },
            
            # Relationship collections
            'relationships': {
                'type': 'edge',
                'description': 'Semantic and structural relationships between code elements',
                'indexes': [
                    {'type': 'persistent', 'fields': ['relationship_type']},
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['confidence']},
                    {'type': 'persistent', 'fields': ['created_at']}
                ]
            },
            
            'dependencies': {
                'type': 'edge',
                'description': 'Code dependencies and import relationships',
                'indexes': [
                    {'type': 'persistent', 'fields': ['dependency_type']},
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['source_file']},
                    {'type': 'persistent', 'fields': ['target_file']}
                ]
            },
            
            # AI-powered collections
            'similarity_cache': {
                'type': 'document',
                'description': 'Cache for similarity computation results',
                'indexes': [
                    {'type': 'persistent', 'fields': ['source_id']},
                    {'type': 'persistent', 'fields': ['target_id']},
                    {'type': 'persistent', 'fields': ['similarity_type']},
                    {'type': 'persistent', 'fields': ['similarity_score']},
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['computed_at']}
                ]
            },
            
            'refactoring_opportunities': {
                'type': 'document',
                'description': 'AI-identified refactoring opportunities',
                'indexes': [
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['opportunity_type']},
                    {'type': 'persistent', 'fields': ['confidence_score']},
                    {'type': 'persistent', 'fields': ['priority']},
                    {'type': 'persistent', 'fields': ['identified_at']},
                    {'type': 'persistent', 'fields': ['status']}
                ]
            },
            
            'purpose_patterns': {
                'type': 'document',
                'description': 'Learned patterns for purpose extraction',
                'indexes': [
                    {'type': 'persistent', 'fields': ['pattern_type']},
                    {'type': 'persistent', 'fields': ['domain']},
                    {'type': 'persistent', 'fields': ['confidence']},
                    {'type': 'persistent', 'fields': ['usage_count']},
                    {'type': 'fulltext', 'fields': ['description']}
                ]
            },
            
            'embedding_metadata': {
                'type': 'document',
                'description': 'Metadata for embeddings with multi-dimensional support',
                'indexes': [
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['file_path']},
                    {'type': 'persistent', 'fields': ['embedding_type']},
                    {'type': 'persistent', 'fields': ['model_name']},
                    {'type': 'persistent', 'fields': ['created_at']},
                    {'type': 'persistent', 'fields': ['purpose_category']}
                ]
            },
            
            # Security and analysis collections
            'security_findings': {
                'type': 'document',
                'description': 'Security vulnerabilities and analysis results',
                'indexes': [
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['file_path']},
                    {'type': 'persistent', 'fields': ['severity']},
                    {'type': 'persistent', 'fields': ['finding_type']},
                    {'type': 'persistent', 'fields': ['status']},
                    {'type': 'persistent', 'fields': ['discovered_at']}
                ]
            },
            
            'metrics_cache': {
                'type': 'document',
                'description': 'Cached metrics and analysis results',
                'indexes': [
                    {'type': 'persistent', 'fields': ['repository_id']},
                    {'type': 'persistent', 'fields': ['metric_type']},
                    {'type': 'persistent', 'fields': ['calculated_at']},
                    {'type': 'persistent', 'fields': ['expires_at']}
                ]
            },
            
            # Schema management
            'schema_migrations': {
                'type': 'document',
                'description': 'Schema version and migration tracking',
                'indexes': [
                    {'type': 'persistent', 'fields': ['version']},
                    {'type': 'persistent', 'fields': ['applied_at']},
                    {'type': 'persistent', 'fields': ['status']}
                ]
            }
        }
        
        # Unified graph definition for relationship traversal
        # All edge collections are included in a single 'knowledge_graph' so that
        # the MCP server and all backend services use a consistent graph name.
        self.graph_definitions = {
            'knowledge_graph': {
                'edge_collections': [
                    'relationships', 'dependencies', 'depends_on',
                    'imports', 'calls', 'contains', 'inherits',
                    'implements', 'references', 'cross_file_calls',
                    'semantic_relationships'
                ],
                'vertex_collections': [
                    'ast_nodes', 'codeunits', 'code_files',
                    'code_entities', 'repositories'
                ]
            }
        }
    
    async def connect(self):
        """Connect to ArangoDB and ensure database exists."""
        try:
            self.client = ArangoClient(hosts=f'http://{self.host}:{self.port}')
            
            # Connect to system database first
            sys_db = self.client.db('_system', username=self.username, password=self.password)
            
            # Create database if it doesn't exist
            if not sys_db.has_database(self.database_name):
                logger.info(f"📊 Creating database: {self.database_name}")
                sys_db.create_database(self.database_name)
            
            # Connect to our database
            self.db = self.client.db(self.database_name, username=self.username, password=self.password)
            
            logger.info(f"✅ Connected to database: {self.database_name}")
            return self.db
            
        except Exception as e:
            logger.error(f"❌ Database connection failed: {str(e)}")
            raise
    
    async def setup_complete_schema(self) -> bool:
        """Set up the complete unified schema."""
        try:
            if not self.db:
                await self.connect()
            
            logger.info("🔧 Setting up unified database schema...")
            
            # Check current schema version
            current_version = await self._get_current_schema_version()
            
            if current_version == self.schema_version:
                logger.info(f"✅ Schema already at version {self.schema_version}")
                return True
            
            # Create collections
            await self._create_collections()
            
            # Create indexes
            await self._create_indexes()
            
            # Create graphs
            await self._create_graphs()
            
            # Record schema version
            await self._record_schema_version()
            
            # Verify schema integrity
            await self._verify_schema()
            
            logger.info("✅ Unified schema setup completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Schema setup failed: {str(e)}")
            raise
    
    async def _get_current_schema_version(self) -> Optional[str]:
        """Get the current schema version."""
        try:
            if self.db.has_collection('schema_migrations'):
                migrations = self.db.collection('schema_migrations')
                cursor = migrations.find({}, sort=[('applied_at', -1)], limit=1)
                
                if cursor.count() > 0:
                    latest = next(cursor)
                    return latest.get('version')
            
            return None
            
        except Exception:
            return None
    
    async def _create_collections(self):
        """Create all collections defined in the schema."""
        for collection_name, config in self.unified_schema.items():
            try:
                if not self.db.has_collection(collection_name):
                    if config['type'] == 'edge':
                        collection = self.db.create_collection(collection_name, edge=True)
                        logger.info(f"📊 Created edge collection: {collection_name}")
                    else:
                        collection = self.db.create_collection(collection_name)
                        logger.info(f"📊 Created document collection: {collection_name}")
                else:
                    logger.info(f"📊 Collection already exists: {collection_name}")
                    
            except Exception as e:
                logger.error(f"Failed to create collection {collection_name}: {str(e)}")
                raise
    
    async def _create_indexes(self):
        """Create all indexes defined in the schema."""
        for collection_name, config in self.unified_schema.items():
            try:
                collection = self.db.collection(collection_name)
                
                for index_config in config.get('indexes', []):
                    index_type = index_config['type']
                    fields = index_config['fields']
                    
                    # Check if index already exists
                    existing_indexes = collection.indexes()
                    index_exists = any(
                        set(idx.get('fields', [])) == set(fields) 
                        for idx in existing_indexes
                    )
                    
                    if not index_exists:
                        if index_type == 'persistent':
                            collection.add_index({'type': 'persistent', 'fields': fields})
                        elif index_type == 'fulltext':
                            collection.add_index({'type': 'fulltext', 'fields': fields})
                        elif index_type == 'geo':
                            collection.add_index({'type': 'geo', 'fields': fields})
                        
                        logger.info(f"🔍 Created {index_type} index on {collection_name}: {fields}")
                    
            except Exception as e:
                logger.error(f"Failed to create indexes for {collection_name}: {str(e)}")
                # Continue with other collections
    
    async def _create_graphs(self):
        """Create graph definitions for traversal queries."""
        for graph_name, config in self.graph_definitions.items():
            try:
                if not self.db.has_graph(graph_name):
                    self.db.create_graph(
                        graph_name,
                        edge_definitions=[{
                            'edge_collection': edge_col,
                            'from_vertex_collections': config['vertex_collections'],
                            'to_vertex_collections': config['vertex_collections']
                        } for edge_col in config['edge_collections']]
                    )
                    logger.info(f"🕸️ Created graph: {graph_name}")
                else:
                    logger.info(f"🕸️ Graph already exists: {graph_name}")
                    
            except Exception as e:
                logger.error(f"Failed to create graph {graph_name}: {str(e)}")
                # Continue with other graphs
    
    async def _record_schema_version(self):
        """Record the current schema version."""
        try:
            migrations = self.db.collection('schema_migrations')
            migration_record = {
                'version': self.schema_version,
                'applied_at': datetime.utcnow().isoformat(),
                'status': 'completed',
                'description': 'Unified schema with enhanced AI capabilities'
            }
            
            migrations.insert(migration_record)
            logger.info(f"📝 Recorded schema version: {self.schema_version}")
            
        except Exception as e:
            logger.error(f"Failed to record schema version: {str(e)}")
            raise
    
    async def _verify_schema(self):
        """Verify schema integrity and completeness."""
        try:
            verification_results = {
                'collections': {},
                'indexes': {},
                'graphs': {}
            }
            
            # Verify collections
            for collection_name in self.unified_schema.keys():
                exists = self.db.has_collection(collection_name)
                verification_results['collections'][collection_name] = exists
                
                if not exists:
                    logger.warning(f"⚠️ Collection missing: {collection_name}")
            
            # Verify graphs
            for graph_name in self.graph_definitions.keys():
                exists = self.db.has_graph(graph_name)
                verification_results['graphs'][graph_name] = exists
                
                if not exists:
                    logger.warning(f"⚠️ Graph missing: {graph_name}")
            
            # Log verification summary
            total_collections = len(self.unified_schema)
            valid_collections = sum(verification_results['collections'].values())
            
            total_graphs = len(self.graph_definitions)
            valid_graphs = sum(verification_results['graphs'].values())
            
            logger.info(f"🔍 Schema verification: {valid_collections}/{total_collections} collections, "
                       f"{valid_graphs}/{total_graphs} graphs")
            
            if valid_collections == total_collections and valid_graphs == total_graphs:
                logger.info("✅ Schema verification passed")
            else:
                logger.warning("⚠️ Schema verification found issues")
            
        except Exception as e:
            logger.error(f"Schema verification failed: {str(e)}")
            raise
    
    async def migrate_schema(self, target_version: str) -> bool:
        """Migrate schema to target version."""
        try:
            current_version = await self._get_current_schema_version()
            
            if current_version == target_version:
                logger.info(f"✅ Schema already at target version: {target_version}")
                return True
            
            logger.info(f"🔄 Migrating schema from {current_version} to {target_version}")
            
            # Implement migration logic based on version differences
            # This would contain specific migration steps
            
            # For now, we'll just update to the new schema
            await self.setup_complete_schema()
            
            return True
            
        except Exception as e:
            logger.error(f"Schema migration failed: {str(e)}")
            raise
    
    async def drop_schema(self, confirm: bool = False) -> bool:
        """Drop all schema collections (DANGEROUS - requires confirmation)."""
        if not confirm:
            logger.warning("⚠️ Schema drop requires explicit confirmation")
            return False
        
        try:
            logger.warning("🗑️ Dropping all collections...")
            
            # Drop graphs first
            for graph_name in self.graph_definitions.keys():
                if self.db.has_graph(graph_name):
                    self.db.delete_graph(graph_name, drop_collections=False)
                    logger.info(f"🗑️ Dropped graph: {graph_name}")
            
            # Drop collections
            for collection_name in self.unified_schema.keys():
                if self.db.has_collection(collection_name):
                    self.db.delete_collection(collection_name)
                    logger.info(f"🗑️ Dropped collection: {collection_name}")
            
            logger.warning("💀 Schema completely dropped")
            return True
            
        except Exception as e:
            logger.error(f"Schema drop failed: {str(e)}")
            raise
    
    def get_schema_info(self) -> Dict[str, Any]:
        """Get comprehensive schema information."""
        return {
            'version': self.schema_version,
            'collections': {
                name: {
                    'type': config['type'],
                    'description': config['description'],
                    'index_count': len(config.get('indexes', []))
                }
                for name, config in self.unified_schema.items()
            },
            'graphs': self.graph_definitions,
            'total_collections': len(self.unified_schema),
            'total_indexes': sum(len(config.get('indexes', [])) for config in self.unified_schema.values())
        }
