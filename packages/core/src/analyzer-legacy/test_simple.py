#!/usr/bin/env python3
"""
Simple test to isolate backend issues
"""

print("Testing imports...")

try:
    import fastapi
    print("✓ FastAPI imported")
except Exception as e:
    print(f"✗ FastAPI import failed: {e}")

try:
    from database import db_connection
    print("✓ Database module imported")
    print(f"Database connected: {db_connection.is_connected()}")
except Exception as e:
    print(f"✗ Database import failed: {e}")

try:
    from sample_data import sample_data
    print("✓ Sample data imported")
except Exception as e:
    print(f"✗ Sample data import failed: {e}")

print("Testing sample data generation...")
try:
    results = sample_data.generate_search_results("test", 3)
    print(f"✓ Generated {len(results)} sample results")
    if results:
        print(f"First result language: {results[0].get('language', 'N/A')}")
except Exception as e:
    print(f"✗ Sample data generation failed: {e}")

print("Test completed.")
