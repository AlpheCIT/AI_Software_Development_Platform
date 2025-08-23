#!/usr/bin/env python3
"""
Database initialization script for Technical Debt Analysis
Creates ArangoDB collections and indexes for storing historical data
"""

import os
import logging
import sys
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    """Initialize the technical debt database"""
    try:
        from api.debt_database import debt_db, DATABASE_AVAILABLE
        
        if not DATABASE_AVAILABLE:
            logger.error("ArangoDB package not available. Install with: pip install python-arango")
            return False
        
        if not debt_db:
            logger.error("Database service not initialized")
            return False
        
        if not debt_db.is_connected():
            logger.error("Failed to connect to ArangoDB. Check connection settings.")
            logger.info("Environment variables needed:")
            logger.info("  ARANGO_HOST (default: localhost)")
            logger.info("  ARANGO_PORT (default: 8529)")
            logger.info("  ARANGO_USER (default: root)")
            logger.info("  ARANGO_PASSWORD (required)")
            logger.info("  ARANGO_DATABASE (default: code_management)")
            return False
        
        logger.info("✅ Database connection successful")
        logger.info("✅ Collections and indexes initialized")
        
        # Test basic operations
        try:
            # Try to get some data to verify everything works
            trends = debt_db.get_historical_trends(days=1)
            logger.info(f"✅ Database operations verified (found {len(trends)} trend records)")
        except Exception as e:
            logger.warning(f"Database operations test failed: {str(e)}")
        
        return True
        
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        return False

def main():
    """Main initialization function"""
    logger.info("Initializing Technical Debt Analysis Database...")
    
    # Check environment variables
    required_vars = ['ARANGO_PASSWORD']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        logger.info("Please set the required environment variables in your .env file")
        return 1
    
    # Initialize database
    if init_database():
        logger.info("🎉 Database initialization completed successfully!")
        logger.info("The technical debt analysis system will now store historical data.")
        return 0
    else:
        logger.error("❌ Database initialization failed")
        return 1

if __name__ == "__main__":
    exit(main())
