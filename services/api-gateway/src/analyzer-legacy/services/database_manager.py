#!/usr/bin/env python3
"""
Database Manager - Singleton pattern for ArangoDB connections
Fixes multiple database initialization issues and provides centralized connection management
"""

import logging
import threading
import time
import os
from typing import Optional, Any, Union
from datetime import datetime

# Set up logging first
logger = logging.getLogger(__name__)

# Load environment variables
try:
    from dotenv import load_dotenv
    # Try to load from the parent directory where .env is located
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass  # dotenv not available

try:
    from arango import ArangoClient
    from arango.database import StandardDatabase
    from arango.exceptions import ServerConnectionError, DatabaseCreateError
    ARANGO_AVAILABLE = True
    logger.info("ArangoDB modules imported successfully")
except ImportError as e:
    logger.error(f"Failed to import ArangoDB modules: {e}")
    ARANGO_AVAILABLE = False
    ArangoClient = None
    StandardDatabase = None


class DatabaseManager:
    """
    Singleton Database Manager for ArangoDB connections
    
    Provides centralized connection management with:
    - Singleton pattern to prevent multiple connections
    - Connection pooling and reuse
    - Automatic reconnection on failures
    - Health monitoring and status reporting
    - Thread-safe operations
    """
    
    _instance: Optional['DatabaseManager'] = None
    _lock = threading.Lock()
    
    def __new__(cls) -> 'DatabaseManager':
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(DatabaseManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, '_initialized') or not self._initialized:
            self._initialized = True
            self._db = None
            self._client = None
            self._connection_status = "disconnected"
            self._last_health_check = None
            self._connection_attempts = 0
            self._max_retries = 3
            self._retry_delay = 2
            
            # Database configuration with environment variables
            self._config = {
                'host': os.getenv('ARANGO_HOST', 'localhost'),
                'port': int(os.getenv('ARANGO_PORT', '8529')),
                'username': os.getenv('ARANGO_USER', 'root'),
                'password': os.getenv('ARANGO_PASSWORD', 'password'),  # Default from .env
                'database': os.getenv('ARANGO_DATABASE', 'code_management')
            }
    
    def get_db(self) -> Optional[Any]:
        """Get database connection, creating if necessary"""
        if not ARANGO_AVAILABLE:
            logger.error("ArangoDB is not available - please install python-arango")
            return None
            
        if self._db is None:
            self._db = self._initialize_connection()
        
        # Health check if needed
        if self._should_health_check():
            if not self._health_check():
                logger.warning("Database health check failed, attempting reconnection")
                self._db = self._initialize_connection()
        
        return self._db
    
    def _initialize_connection(self) -> Optional[Any]:
        """Initialize ArangoDB connection with retry logic"""
        if not ARANGO_AVAILABLE:
            logger.error("Cannot initialize connection - ArangoDB not available")
            return None
        
        for attempt in range(self._max_retries):
            try:
                logger.info(f"Attempting database connection (attempt {attempt + 1}/{self._max_retries})")
                
                # Create client
                self._client = ArangoClient(
                    hosts=f"http://{self._config['host']}:{self._config['port']}"
                )
                
                # Connect to database
                db = self._client.db(
                    self._config['database'],
                    username=self._config['username'],
                    password=self._config['password']
                )
                
                # Test connection
                try:
                    db.collections()
                    self._connection_status = "connected"
                    self._connection_attempts = 0
                    logger.info("Database connection established successfully")
                    return db
                except Exception as test_error:
                    logger.error(f"Database connection test failed: {test_error}")
                    raise test_error
                    
            except ServerConnectionError as e:
                self._connection_attempts += 1
                logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
                if attempt < self._max_retries - 1:
                    time.sleep(self._retry_delay * (attempt + 1))
                else:
                    self._connection_status = "failed"
                    logger.error("All connection attempts failed")
            except Exception as e:
                self._connection_attempts += 1
                logger.error(f"Unexpected error during connection attempt {attempt + 1}: {e}")
                if attempt < self._max_retries - 1:
                    time.sleep(self._retry_delay * (attempt + 1))
                else:
                    self._connection_status = "failed"
                    logger.error("All connection attempts failed due to unexpected errors")
        
        return None
    
    def _should_health_check(self) -> bool:
        """Determine if health check is needed"""
        if self._last_health_check is None:
            return True
        
        # Check every 5 minutes
        time_since_check = datetime.now().timestamp() - self._last_health_check
        return time_since_check > 300
    
    def _health_check(self) -> bool:
        """Perform database health check"""
        if not self._db:
            return False
        
        try:
            # Simple query to test connection
            self._db.collections()
            self._last_health_check = datetime.now().timestamp()
            self._connection_status = "connected"
            return True
        except Exception as e:
            logger.warning(f"Database health check failed: {e}")
            self._connection_status = "unhealthy"
            return False
    
    def get_status(self) -> dict:
        """Get connection status information"""
        return {
            'status': self._connection_status,
            'connected': self._db is not None and self._connection_status == "connected",
            'last_health_check': self._last_health_check,
            'connection_attempts': self._connection_attempts,
            'arango_available': ARANGO_AVAILABLE,
            'config': {
                'host': self._config['host'],
                'port': self._config['port'],
                'database': self._config['database']
            }
        }
    
    def validate_collections(self) -> dict:
        """Validate that required collections exist"""
        required_collections = ['ast_nodes', 'relationships', 'code_files', 'repositories', 'codeunits']
        result = {
            'all_present': True,
            'collections': {},
            'missing': []
        }
        
        db = self.get_db()
        if not db:
            result['all_present'] = False
            result['error'] = "No database connection"
            return result
        
        try:
            existing_collections = {col['name'] for col in db.collections()}
            
            for collection_name in required_collections:
                if collection_name in existing_collections:
                    result['collections'][collection_name] = 'present'
                else:
                    result['collections'][collection_name] = 'missing'
                    result['missing'].append(collection_name)
                    result['all_present'] = False
            
        except Exception as e:
            result['all_present'] = False
            result['error'] = str(e)
            logger.error(f"Error validating collections: {e}")
        
        return result
    
    def ensure_required_collections(self) -> dict:
        """Ensure all required collections exist, creating them if missing"""
        validation = self.validate_collections()
        
        if validation['all_present']:
            logger.info("All required collections are present")
            return validation
        
        db = self.get_db()
        if not db:
            return {'success': False, 'error': 'No database connection'}
        
        created_collections = []
        
        try:
            for collection_name in validation['missing']:
                if collection_name == 'codeunits':
                    # Create codeunits collection for similarity engine
                    logger.info(f"Creating missing collection: {collection_name}")
                    collection = db.create_collection(collection_name)
                    created_collections.append(collection_name)
                    logger.info(f"✅ Created collection: {collection_name}")
                else:
                    # Create other required collections as needed
                    logger.info(f"Creating missing collection: {collection_name}")
                    collection = db.create_collection(collection_name)
                    created_collections.append(collection_name)
                    logger.info(f"✅ Created collection: {collection_name}")
            
            return {
                'success': True, 
                'created_collections': created_collections,
                'message': f"Created {len(created_collections)} missing collections"
            }
            
        except Exception as e:
            logger.error(f"Error creating collections: {e}")
            return {'success': False, 'error': str(e)}
    
    def populate_codeunits_from_ast_nodes(self) -> dict:
        """Populate codeunits collection with data from ast_nodes for similarity engine"""
        db = self.get_db()
        if not db:
            return {'success': False, 'error': 'No database connection'}
        
        try:
            # Check if codeunits collection exists
            collections = {col['name'] for col in db.collections()}
            if 'codeunits' not in collections:
                logger.error("codeunits collection does not exist")
                return {'success': False, 'error': 'codeunits collection not found'}
            
            codeunits_collection = db.collection('codeunits')
            
            # Check if already populated
            existing_count = codeunits_collection.count()
            if existing_count > 0:
                logger.info(f"codeunits collection already has {existing_count} documents")
                return {'success': True, 'message': f'Collection already populated with {existing_count} documents'}
            
            # Populate from ast_nodes
            query = """
            FOR node IN ast_nodes
                FILTER node.type IN ["FunctionDeclaration", "AsyncFunctionDeclaration", "ClassDeclaration"]
                INSERT {
                    _key: node._key,
                    name: node.name,
                    type: node.type,
                    file_path: node.file_path,
                    repository_id: node.repository_id,
                    language: node.language,
                    line_start: node.line_start,
                    line_end: node.line_end,
                    complexity: node.complexity,
                    metadata: node.metadata,
                    analysis_timestamp: node.analysis_timestamp,
                    // Initialize empty embeddings structure for similarity engine
                    embeddings: {
                        purpose: [],
                        code: [],
                        context: [],
                        domain: []
                    },
                    // Add source reference
                    source_collection: "ast_nodes",
                    source_key: node._key
                } INTO codeunits
                RETURN NEW
            """
            
            cursor = db.aql.execute(query)
            documents = list(cursor)
            
            logger.info(f"✅ Populated codeunits collection with {len(documents)} documents")
            return {
                'success': True, 
                'documents_created': len(documents),
                'message': f'Populated codeunits with {len(documents)} code units from ast_nodes'
            }
            
        except Exception as e:
            logger.error(f"Error populating codeunits collection: {e}")
            return {'success': False, 'error': str(e)}
    
    def reset_codeunits_collection(self) -> dict:
        """Reset and repopulate the codeunits collection"""
        db = self.get_db()
        if not db:
            return {'success': False, 'error': 'No database connection'}
        
        try:
            # Clear existing codeunits collection
            collections = {col['name'] for col in db.collections()}
            if 'codeunits' in collections:
                codeunits_collection = db.collection('codeunits')
                codeunits_collection.truncate()
                logger.info("Cleared existing codeunits collection")
            
            # Repopulate
            return self.populate_codeunits_from_ast_nodes()
            
        except Exception as e:
            logger.error(f"Error resetting codeunits collection: {e}")
            return {'success': False, 'error': str(e)}
    
    def reset_connection(self):
        """Reset connection (useful for testing or recovery)"""
        logger.info("Resetting database connection")
        self._db = None
        self._client = None
        self._connection_status = "disconnected"
        self._last_health_check = None
        self._connection_attempts = 0
    
    def close(self):
        """Close database connection"""
        if self._client:
            try:
                # ArangoDB client doesn't have explicit close, just clear references
                self._db = None
                self._client = None
                self._connection_status = "disconnected"
                logger.info("Database connection closed")
            except Exception as e:
                logger.error(f"Error closing database connection: {e}")


# Global instance and convenience function
def get_database() -> Optional[Any]:
    """Get database connection through singleton manager"""
    manager = DatabaseManager()
    return manager.get_db()


def get_database_status() -> dict:
    """Get database status through singleton manager"""
    manager = DatabaseManager()
    return manager.get_status()


def validate_database_collections() -> dict:
    """Validate database collections through singleton manager"""
    manager = DatabaseManager()
    return manager.validate_collections()


def ensure_required_collections() -> dict:
    """Ensure all required collections exist through singleton manager"""
    manager = DatabaseManager()
    return manager.ensure_required_collections()


def populate_codeunits_collection() -> dict:
    """Populate codeunits collection through singleton manager"""
    manager = DatabaseManager()
    return manager.populate_codeunits_from_ast_nodes()


def reset_codeunits_collection() -> dict:
    """Reset and repopulate codeunits collection through singleton manager"""
    manager = DatabaseManager()
    return manager.reset_codeunits_collection()


# Initialize on import
_db_manager = DatabaseManager()
