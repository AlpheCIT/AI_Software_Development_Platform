#!/usr/bin/env python3
"""
Database initialization script to create collections and indexes for story management.
"""

import sys
import os
import logging
from arango import ArangoClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    """Initialize database with required collections and indexes"""
    
    try:
        # Connection details
        host = 'localhost'
        port = 8529
        username = 'root'
        password = 'password'
        database_name = 'code_management'
        
        # Create client and connect to database
        client = ArangoClient(hosts=f'http://{host}:{port}')
        db = client.db(database_name, username=username, password=password)
        
        # Test connection
        db.properties()
        logger.info(f"Connected to ArangoDB database '{database_name}'")
        
        # Create collections if they don't exist
        collections_to_create = [
            {
                'name': 'stories',
                'indexes': [
                    {'fields': ['project'], 'type': 'persistent'},
                    {'fields': ['status'], 'type': 'persistent'},
                    {'fields': ['assignee'], 'type': 'persistent'},
                    {'fields': ['created_at'], 'type': 'persistent'},
                    {'fields': ['jira_key'], 'type': 'persistent', 'unique': True, 'sparse': True}
                ]
            },
            {
                'name': 'sync_states',
                'indexes': [
                    {'fields': ['story_id'], 'type': 'persistent'},
                    {'fields': ['last_synced'], 'type': 'persistent'},
                    {'fields': ['sync_status'], 'type': 'persistent'}
                ]
            },
            {
                'name': 'story_dependencies',
                'indexes': [
                    {'fields': ['from_story'], 'type': 'persistent'},
                    {'fields': ['to_story'], 'type': 'persistent'},
                    {'fields': ['dependency_type'], 'type': 'persistent'}
                ]
            }
        ]
        
        for collection_config in collections_to_create:
            collection_name = collection_config['name']
            
            # Check if collection exists
            if db.has_collection(collection_name):
                logger.info(f"Collection '{collection_name}' already exists")
                collection = db.collection(collection_name)
            else:
                # Create collection
                collection = db.create_collection(collection_name)
                logger.info(f"Created collection '{collection_name}'")
            
            # Create indexes
            for index_config in collection_config['indexes']:
                try:
                    collection.add_persistent_index(
                        fields=index_config['fields'],
                        unique=index_config.get('unique', False),
                        sparse=index_config.get('sparse', False)
                    )
                    logger.info(f"Created index on {index_config['fields']} for '{collection_name}'")
                except Exception as e:
                    if 'duplicate' in str(e).lower():
                        logger.info(f"Index on {index_config['fields']} already exists for '{collection_name}'")
                    else:
                        logger.warning(f"Failed to create index on {index_config['fields']} for '{collection_name}': {e}")
        
        # List all collections
        collections = db.collections()
        collection_names = [c['name'] for c in collections if not c['name'].startswith('_')]
        logger.info(f"Available collections: {collection_names}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = init_database()
    if success:
        print("Database initialization completed successfully!")
        sys.exit(0)
    else:
        print("Database initialization failed!")
        sys.exit(1)
