#!/usr/bin/env python3
"""
Startup script to populate the database with enhanced project management data.
This script loads the consultant's sample data into the database.
"""

import asyncio
import json
import logging
import sys
import os

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from story_service import story_service
from database import db_connection

logger = logging.getLogger(__name__)

async def load_sample_data():
    """Load the consultant's sample data into the database"""
    try:
        # Load the JSON data
        json_path = "../Code_To_Implement/user_stories_data.json"
        if not os.path.exists(json_path):
            json_path = "Code_To_Implement/user_stories_data.json"
        
        if not os.path.exists(json_path):
            logger.error(f"Sample data file not found at {json_path}")
            return False
        
        with open(json_path, 'r') as f:
            project_data = json.load(f)
        
        logger.info(f"Loaded project data: {project_data['project_info']['name']}")
        logger.info(f"Found {len(project_data['stories'])} stories to import")
        
        # Save all stories to the database
        imported_count = 0
        for story in project_data['stories']:
            try:
                await story_service.save_story(story)
                imported_count += 1
                logger.info(f"Imported story: {story['id']} - {story['title']}")
            except Exception as e:
                logger.error(f"Failed to import story {story['id']}: {str(e)}")
        
        logger.info(f"Successfully imported {imported_count} stories")
        return True
        
    except Exception as e:
        logger.error(f"Failed to load sample data: {str(e)}")
        return False

async def initialize_database():
    """Initialize the database with sample data if it's empty"""
    try:
        # Check if we already have stories
        stories_result = await story_service.get_all_stories()
        existing_stories = stories_result.get("stories", [])
        
        if len(existing_stories) > 0:
            logger.info(f"Database already contains {len(existing_stories)} stories")
            return True
        
        logger.info("Database is empty, loading sample data...")
        return await load_sample_data()
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        return False

async def main():
    """Main function"""
    logging.basicConfig(level=logging.INFO)
    
    logger.info("Starting database initialization...")
    
    # Wait for database connection
    if not db_connection.is_connected():
        logger.info("Waiting for database connection...")
        await asyncio.sleep(2)
    
    if not db_connection.is_connected():
        logger.warning("Database not connected, skipping initialization")
        return
    
    success = await initialize_database()
    
    if success:
        logger.info("Database initialization completed successfully")
    else:
        logger.error("Database initialization failed")

if __name__ == "__main__":
    asyncio.run(main())
