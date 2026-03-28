#!/usr/bin/env python3
"""
Database Migration Script for AST Graph Schema Enhancement
Migrates existing databases to include new AST graph collections and indexes.
Implements INFRA-002: ArangoDB Graph Schema Enhancement
"""

import os
import sys
import logging
from datetime import datetime

# Add the database directory to the path
sys.path.append(os.path.dirname(__file__))

try:
    from ast_graph_schema import ASTGraphSchemaManager
    from arango import ArangoClient
    ARANGO_AVAILABLE = True
except ImportError as e:
    print(f"Error importing required modules: {e}")
    ARANGO_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseMigration:
    """Handles migration of existing databases to support AST graph schema."""
    
    def __init__(self):
        self.schema_manager = None
        if ARANGO_AVAILABLE:
            self.schema_manager = ASTGraphSchemaManager()
    
    def check_prerequisites(self) -> bool:
        """Check if prerequisites are met for migration."""
        if not ARANGO_AVAILABLE:
            logger.error("ArangoDB package not available. Install with: pip install python-arango")
            return False
        
        try:
            # Test connection
            self.schema_manager.connect()
            logger.info("✅ Database connection successful")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False
    
    def backup_existing_data(self) -> bool:
        """Create backup of existing collections before migration."""
        try:
            db = self.schema_manager.db
            backup_collections = ['stories', 'team_members', 'milestones', 'jira_sync_log']
            
            logger.info("Creating backup of existing collections...")
            
            for collection_name in backup_collections:
                if db.has_collection(collection_name):
                    # Export collection data
                    collection = db.collection(collection_name)
                    docs = list(collection.all())
                    
                    backup_file = f"/tmp/{collection_name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                    
                    import json
                    with open(backup_file, 'w') as f:
                        json.dump(docs, f, indent=2, default=str)
                    
                    logger.info(f"✅ Backed up {collection_name}: {len(docs)} documents to {backup_file}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Backup failed: {e}")
            return False
    
    def migrate_schema(self) -> bool:
        """Perform the actual schema migration."""
        try:
            logger.info("Starting AST graph schema migration...")
            
            # Setup enhanced schema (this will create new collections and indexes)
            success = self.schema_manager.setup_enhanced_schema()
            
            if success:
                logger.info("✅ Schema migration completed successfully")
                return True
            else:
                logger.error("❌ Schema migration failed")
                return False
                
        except Exception as e:
            logger.error(f"❌ Migration error: {e}")
            return False
    
    def verify_migration(self) -> bool:
        """Verify that the migration was successful."""
        try:
            status = self.schema_manager.validate_schema()
            
            if not status.get('connected'):
                logger.error("❌ Database not connected after migration")
                return False
            
            # Check required collections
            required_collections = ['ast_nodes', 'relationships', 'code_files', 'repositories']
            missing_collections = []
            
            for collection_name in required_collections:
                if not status['collections'].get(collection_name, {}).get('exists', False):
                    missing_collections.append(collection_name)
            
            if missing_collections:
                logger.error(f"❌ Missing collections after migration: {missing_collections}")
                return False
            
            # Check graph
            if 'knowledge_graph' not in status.get('graphs', []):
                logger.error("❌ Knowledge graph not created")
                return False
            
            logger.info("✅ Migration verification successful")
            logger.info(f"   Collections: {len(status['collections'])} total")
            logger.info(f"   Indexes: {status['total_indexes']} total")
            logger.info(f"   Graphs: {len(status['graphs'])} total")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Verification failed: {e}")
            return False
    
    def run_migration(self) -> bool:
        """Run the complete migration process."""
        logger.info("🚀 Starting ArangoDB AST Graph Schema Migration")
        logger.info("=" * 60)
        
        # Step 1: Check prerequisites
        if not self.check_prerequisites():
            return False
        
        # Step 2: Backup existing data
        if not self.backup_existing_data():
            logger.warning("⚠️  Backup failed, but continuing with migration...")
        
        # Step 3: Migrate schema
        if not self.migrate_schema():
            return False
        
        # Step 4: Verify migration
        if not self.verify_migration():
            return False
        
        logger.info("=" * 60)
        logger.info("🎉 Migration completed successfully!")
        logger.info("")
        logger.info("Next steps:")
        logger.info("1. Test the AST Graph Dashboard at /ast-graph")
        logger.info("2. Use the new AST analysis endpoints")
        logger.info("3. Start populating AST data from repository analysis")
        
        return True

def main():
    """Main migration function."""
    print("ArangoDB AST Graph Schema Migration")
    print("==================================")
    print()
    
    if not ARANGO_AVAILABLE:
        print("❌ Required dependencies not available")
        print("Please install: pip install python-arango")
        return False
    
    migration = DatabaseMigration()
    
    # Ask for confirmation
    print("This will enhance your ArangoDB schema with AST graph collections.")
    print("Existing data will be preserved and backed up.")
    print()
    
    confirm = input("Do you want to proceed? (y/N): ").strip().lower()
    if confirm not in ['y', 'yes']:
        print("Migration cancelled.")
        return False
    
    success = migration.run_migration()
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("You can now use the enhanced AST graph features.")
    else:
        print("\n❌ Migration failed!")
        print("Please check the logs and try again.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
