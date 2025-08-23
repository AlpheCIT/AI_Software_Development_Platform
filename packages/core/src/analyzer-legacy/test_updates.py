"""
Test ArangoDB document updates
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db_connection

def test_document_updates():
    """Test updating documents in ArangoDB"""
    try:
        print(f"Database connected: {db_connection.is_connected()}")
        
        if db_connection.is_connected():
            # Get stories collection
            stories_collection = db_connection.db.collection("stories")
            
            # Find a story to test with
            stories = list(stories_collection.find({}, limit=1))
            if not stories:
                print("No stories found to test with")
                return
            
            story = stories[0]
            print(f"Testing with story: {story.get('id', story.get('_key'))}")
            print(f"Story keys: {list(story.keys())}")
            
            # Test different update methods
            print("\n1. Testing update with _key...")
            try:
                result = stories_collection.update(
                    {"_key": story["_key"]},
                    {"test_field": "test_value_key"}
                )
                print(f"Update with _key successful: {result}")
            except Exception as e:
                print(f"Update with _key failed: {e}")
            
            print("\n2. Testing update with _id...")
            try:
                result = stories_collection.update(
                    {"_id": story["_id"]},
                    {"test_field": "test_value_id"}
                )
                print(f"Update with _id successful: {result}")
            except Exception as e:
                print(f"Update with _id failed: {e}")
            
            print("\n3. Testing update with custom field...")
            try:
                result = stories_collection.update(
                    {"id": story.get("id")},
                    {"test_field": "test_value_custom"}
                )
                print(f"Update with custom field successful: {result}")
            except Exception as e:
                print(f"Update with custom field failed: {e}")
            
            print("\n4. Testing update_match...")
            try:
                result = stories_collection.update_match(
                    {"id": story.get("id")},
                    {"test_field": "test_value_match"}
                )
                print(f"Update_match successful: {result}")
            except Exception as e:
                print(f"Update_match failed: {e}")
                
        else:
            print("❌ Database not connected")
            
    except Exception as e:
        print(f"❌ Error testing updates: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_document_updates()
