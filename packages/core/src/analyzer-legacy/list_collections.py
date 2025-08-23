"""
List existing collections in ArangoDB
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db_connection

def list_collections():
    """List all collections in the database"""
    try:
        print(f"Database connected: {db_connection.is_connected()}")
        
        if db_connection.is_connected():
            # List all collections
            collections = db_connection.db.collections()
            print(f"Total collections: {len(collections)}")
            
            for collection in collections:
                print(f"  - {collection['name']} (type: {collection['type']})")
            
            # Try to access stories collection specifically
            try:
                stories_collection = db_connection.db.collection("stories")
                count = stories_collection.count()
                print(f"\nStories collection exists with {count} documents")
            except Exception as e:
                print(f"\nStories collection error: {e}")
            
        else:
            print("❌ Database not connected")
            
    except Exception as e:
        print(f"❌ Error listing collections: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    list_collections()
