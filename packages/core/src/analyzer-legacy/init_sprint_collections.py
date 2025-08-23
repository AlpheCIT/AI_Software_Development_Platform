"""
Initialize sprint collections in ArangoDB
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db_connection

def init_sprint_collections():
    """Initialize sprint-related collections in ArangoDB"""
    try:
        if db_connection.is_connected():
            # Get or create collections
            sprints_collection = db_connection.get_collection("sprints")
            sprint_history_collection = db_connection.get_collection("sprint_history")
            
            print("✅ Sprint collections initialized:")
            print(f"  - sprints: {sprints_collection is not None}")
            print(f"  - sprint_history: {sprint_history_collection is not None}")
            
            # Test inserting a sample sprint to make sure collections work
            test_sprint = {
                "sprint_id": "test_init",
                "name": "Test Sprint",
                "project": "test",
                "state": "planned",
                "created": "2025-08-02T12:00:00Z"
            }
            
            if sprints_collection:
                # Check if test sprint exists
                existing = list(sprints_collection.find({"sprint_id": "test_init"}, limit=1))
                if not existing:
                    sprints_collection.insert(test_sprint)
                    print("✅ Test sprint inserted successfully")
                else:
                    print("ℹ️  Test sprint already exists")
            
        else:
            print("❌ Database not connected")
            
    except Exception as e:
        print(f"❌ Error initializing collections: {str(e)}")

if __name__ == "__main__":
    init_sprint_collections()
