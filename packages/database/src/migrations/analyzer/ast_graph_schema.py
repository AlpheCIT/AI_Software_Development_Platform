#!/usr/bin/env python3
"""
ArangoDB AST Graph Schema Setup
Implements INFRA-002: ArangoDB Graph Schema Enhancement

This module creates and manages the enhanced database schema for AST-based code analysis.
Supports semantic relationships, cross-file dependencies, and optimized graph traversal.
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ASTGraphSchemaManager:
    """Manages the enhanced ArangoDB schema for AST-based code analysis."""
    
    def __init__(self, 
                 host: str = 'localhost',
                 port: int = 8529,
                 username: str = 'root',
                 password: str = 'password',
                 database: str = 'code_management'):
        """Initialize the schema manager."""
        if not ARANGO_AVAILABLE:
            raise ImportError("ArangoDB package not available. Install with: pip install python-arango")
        
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.database_name = database
        self.client = None
        self.db = None
        
    def connect(self) -> Any:
        """Connect to ArangoDB and ensure database exists."""
        try:
            self.client = ArangoClient(hosts=f'http://{self.host}:{self.port}')
            
            # Connect to system database
            sys_db = self.client.db('_system', username=self.username, password=self.password)
            
            # Create database if it doesn't exist
            if not sys_db.has_database(self.database_name):
                sys_db.create_database(self.database_name)
                logger.info(f"Created database: {self.database_name}")
            
            # Connect to our database
            self.db = self.client.db(self.database_name, username=self.username, password=self.password)
            logger.info(f"Connected to ArangoDB database: {self.database_name}")
            
            return self.db
            
        except Exception as e:
            logger.error(f"Failed to connect to ArangoDB: {e}")
            raise
            
    def create_collections(self) -> bool:
        """Create all required collections for AST graph analysis."""
        if not self.db:
            raise RuntimeError("Database connection not established. Call connect() first.")
        
        collections = [
            ('ast_nodes', 'document', 'Stores AST nodes from parsed code files'),
            ('relationships', 'edge', 'Stores semantic relationships between AST nodes'),
            ('code_files', 'document', 'Stores file metadata and analysis results'),
            ('repositories', 'document', 'Stores repository information and analysis metadata')
        ]
        
        created_count = 0
        
        for name, collection_type, description in collections:
            try:
                if not self.db.has_collection(name):
                    if collection_type == 'edge':
                        self.db.create_collection(name, edge=True)
                    else:
                        self.db.create_collection(name)
                    
                    logger.info(f"Created {collection_type} collection: {name} - {description}")
                    created_count += 1
                else:
                    logger.info(f"Collection already exists: {name}")
                    
            except Exception as e:
                logger.error(f"Failed to create collection {name}: {e}")
                return False
                
        logger.info(f"Collections setup complete. Created {created_count} new collections.")
        return True
        
    def create_indexes(self) -> bool:
        """Create optimized indexes for fast graph traversal."""
        if not self.db:
            raise RuntimeError("Database connection not established. Call connect() first.")
        
        indexes = [
            # AST Nodes indexes
            ('ast_nodes', ['type'], 'persistent', 'idx_ast_node_type'),
            ('ast_nodes', ['file_path'], 'persistent', 'idx_ast_node_file'),
            ('ast_nodes', ['name'], 'fulltext', 'idx_ast_node_name_fulltext'),
            ('ast_nodes', ['repository_id', 'file_path'], 'persistent', 'idx_ast_node_repo_file'),
            ('ast_nodes', ['language', 'type'], 'persistent', 'idx_ast_node_lang_type'),
            
            # Relationships indexes
            ('relationships', ['relationship_type'], 'persistent', 'idx_relationship_type'),
            ('relationships', ['_from', 'relationship_type'], 'persistent', 'idx_relationship_from_type'),
            ('relationships', ['_to', 'relationship_type'], 'persistent', 'idx_relationship_to_type'),
            ('relationships', ['source_file', 'target_file'], 'persistent', 'idx_relationship_files'),
            
            # Code Files indexes
            ('code_files', ['file_path'], 'persistent', 'idx_code_file_path'),
            ('code_files', ['repository_id', 'file_path'], 'persistent', 'idx_code_file_repo_path'),
            ('code_files', ['language'], 'persistent', 'idx_code_file_language'),
            ('code_files', ['last_analyzed'], 'persistent', 'idx_code_file_analyzed'),
            
            # Repositories indexes
            ('repositories', ['url'], 'persistent', 'idx_repository_url'),
            ('repositories', ['name'], 'persistent', 'idx_repository_name'),
        ]
        
        created_count = 0
        
        for collection_name, fields, index_type, name in indexes:
            try:
                collection = self.db.collection(collection_name)
                
                # Check if index already exists
                existing_indexes = collection.indexes()
                index_exists = any(idx.get('name') == name for idx in existing_indexes)
                
                if not index_exists:
                    if index_type == 'fulltext':
                        collection.add_fulltext_index(fields, name=name)
                    else:
                        unique = 'unique' in name.lower()
                        collection.add_persistent_index(fields, unique=unique, name=name)
                    
                    logger.info(f"Created {index_type} index {name} on {collection_name}.{fields}")
                    created_count += 1
                else:
                    logger.info(f"Index already exists: {name}")
                    
            except Exception as e:
                logger.error(f"Failed to create index {name}: {e}")
                return False
                
        logger.info(f"Indexes setup complete. Created {created_count} new indexes.")
        return True
        
    def create_graph(self) -> bool:
        """Create the code analysis graph."""
        if not self.db:
            raise RuntimeError("Database connection not established. Call connect() first.")
        
        graph_name = 'code_graph'
        
        try:
            if not self.db.has_graph(graph_name):
                self.db.create_graph(
                    graph_name,
                    edge_definitions=[
                        {
                            'edge_collection': 'relationships',
                            'from_vertex_collections': ['ast_nodes', 'code_files'],
                            'to_vertex_collections': ['ast_nodes', 'code_files']
                        }
                    ]
                )
                logger.info(f"Created graph: {graph_name}")
                return True
            else:
                logger.info(f"Graph already exists: {graph_name}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to create graph {graph_name}: {e}")
            return False
            
    def setup_enhanced_schema(self) -> bool:
        """Complete setup of the enhanced AST graph schema."""
        logger.info("Starting ArangoDB AST Graph Schema Enhancement setup...")
        
        try:
            # Connect to database
            self.connect()
            
            # Create collections
            if not self.create_collections():
                return False
                
            # Create indexes
            if not self.create_indexes():
                return False
                
            # Create graph
            if not self.create_graph():
                return False
                
            logger.info("✅ ArangoDB AST Graph Schema Enhancement completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Schema setup failed: {e}")
            return False
            
    def validate_schema(self) -> Dict[str, Any]:
        """Validate the schema setup and return status."""
        if not self.db:
            return {"connected": False, "error": "Not connected to database"}
        
        try:
            status = {
                "connected": True,
                "database": self.database_name,
                "collections": {},
                "graphs": [],
                "total_indexes": 0
            }
            
            # Check collections
            required_collections = ['ast_nodes', 'relationships', 'code_files', 'repositories']
            for collection_name in required_collections:
                if self.db.has_collection(collection_name):
                    collection = self.db.collection(collection_name)
                    indexes = collection.indexes()
                    status["collections"][collection_name] = {
                        "exists": True,
                        "count": collection.count(),
                        "indexes": len(indexes)
                    }
                    status["total_indexes"] += len(indexes)
                else:
                    status["collections"][collection_name] = {"exists": False}
            
            # Check graphs
            if self.db.has_graph('code_graph'):
                status["graphs"].append('code_graph')
            
            return status
            
        except Exception as e:
            return {"connected": False, "error": str(e)}

# Graph traversal and analysis utilities
class ASTGraphAnalyzer:
    """Provides graph analysis capabilities for AST data."""
    
    def __init__(self, db: Any):
        self.db = db
        
    def find_dead_code(self, repository_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Find potentially dead code (unreferenced functions)."""
        query = """
        FOR node IN ast_nodes
        FILTER node.type == "FunctionDeclaration"
        """
        
        if repository_id:
            query += f' AND node.repository_id == "{repository_id}"'
            
        query += """
        LET callers = (FOR v, e IN 1..1 INBOUND node relationships
                       FILTER e.relationship_type == "calls"
                       RETURN 1)
        FILTER LENGTH(callers) == 0 AND node.name NOT IN ["main", "__init__", "init"]
        RETURN {
            function: node.name,
            file: node.file_path,
            lines: {start: node.line_start, end: node.line_end},
            complexity: node.complexity.cyclomatic
        }
        """
        
        try:
            cursor = self.db.aql.execute(query)
            return list(cursor)
        except Exception as e:
            logger.error(f"Failed to find dead code: {e}")
            return []
            
    def find_function_dependencies(self, function_key: str, max_depth: int = 3) -> List[Dict[str, Any]]:
        """Find all functions that a given function depends on."""
        query = """
        FOR node IN ast_nodes
        FILTER node._key == @functionKey
        FOR v, e, p IN 1..@maxDepth OUTBOUND node relationships
        FILTER e.relationship_type == "calls" AND v.type == "FunctionDeclaration"
        RETURN {
            function: v.name,
            file: v.file_path,
            depth: LENGTH(p.edges),
            call_count: e.call_count
        }
        """
        
        try:
            cursor = self.db.aql.execute(query, bind_vars={
                'functionKey': function_key,
                'maxDepth': max_depth
            })
            return list(cursor)
        except Exception as e:
            logger.error(f"Failed to find function dependencies: {e}")
            return []
            
    def calculate_coupling_metrics(self, threshold: int = 5) -> List[Dict[str, Any]]:
        """Calculate coupling metrics for functions and classes."""
        query = """
        FOR node IN ast_nodes
        FILTER node.type IN ["FunctionDeclaration", "ClassDeclaration"]
        LET fan_in = LENGTH(FOR v, e IN 1..1 INBOUND node relationships
                            FILTER e.relationship_type IN ["calls", "imports", "extends"]
                            RETURN 1)
        LET fan_out = LENGTH(FOR v, e IN 1..1 OUTBOUND node relationships  
                             FILTER e.relationship_type IN ["calls", "imports", "extends"]
                             RETURN 1)
        LET coupling = fan_in + fan_out
        FILTER coupling >= @threshold
        SORT coupling DESC
        RETURN {
            name: node.name,
            file: node.file_path,
            type: node.type,
            fan_in: fan_in,
            fan_out: fan_out,
            coupling_score: coupling
        }
        """
        
        try:
            cursor = self.db.aql.execute(query, bind_vars={'threshold': threshold})
            return list(cursor)
        except Exception as e:
            logger.error(f"Failed to calculate coupling metrics: {e}")
            return []

def main():
    """Main function to setup the enhanced schema."""
    schema_manager = ASTGraphSchemaManager()
    
    success = schema_manager.setup_enhanced_schema()
    
    if success:
        status = schema_manager.validate_schema()
        logger.info(f"Schema validation: {status}")
        
        # Test basic graph analysis
        if status.get("connected"):
            analyzer = ASTGraphAnalyzer(schema_manager.db)
            logger.info("Graph analyzer ready for AST analysis")
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
