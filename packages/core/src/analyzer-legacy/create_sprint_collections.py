"""
Create sprint collections in ArangoDB
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db_connection

def create_sprint_collections():
    """Create sprint-related collections"""
    try:
        print(f"Database connected: {db_connection.is_connected()}")
        
        if db_connection.is_connected():
            # Create sprint collections
            try:
                sprints_collection = db_connection.db.create_collection("sprints")
                print(f"✅ Created sprints collection: {sprints_collection.name}")
            except Exception as e:
                if "duplicate" in str(e).lower():
                    print("ℹ️  Sprints collection already exists")
                else:
                    print(f"❌ Error creating sprints collection: {e}")
            
            try:
                sprint_history_collection = db_connection.db.create_collection("sprint_history")
                print(f"✅ Created sprint_history collection: {sprint_history_collection.name}")
            except Exception as e:
                if "duplicate" in str(e).lower():
                    print("ℹ️  Sprint_history collection already exists")
                else:
                    print(f"❌ Error creating sprint_history collection: {e}")
            
            # Test access to created collections
            try:
                sprints_col = db_connection.db.collection("sprints")
                sprint_history_col = db_connection.db.collection("sprint_history")
                
                print(f"✅ Sprints collection accessible: {sprints_col.name}")
                print(f"✅ Sprint history collection accessible: {sprint_history_col.name}")
                
                # Test inserting a document
                test_sprint = {
                    "sprint_id": "test_manual_create",
                    "name": "Test Manual Creation",
                    "project": "test",
                    "state": "planned"
                }
                
                result = sprints_col.insert(test_sprint)
                print(f"✅ Test document inserted: {result['_key']}")
                
            except Exception as e:
                print(f"❌ Error accessing collections: {e}")
                
        else:
            print("❌ Database not connected")
            
    except Exception as e:
        print(f"❌ Error creating sprint collections: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_sprint_collections()
