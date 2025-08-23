#!/usr/bin/env python3
"""
Populate database via API endpoint
This script calls the backend API to populate AST data
"""

import requests
import json

def populate_via_api():
    """Use the backend API to populate sample AST data."""
    try:
        # Test if backend is running
        health_response = requests.get("http://localhost:8002/api/health")
        if health_response.status_code == 200:
            print("✅ Backend is running")
        else:
            print("❌ Backend not responding")
            return
            
        # Populate sample AST data
        print("📊 Populating sample AST data...")
        sample_response = requests.post("http://localhost:8002/api/ast/populate-sample")
        
        if sample_response.status_code == 200:
            result = sample_response.json()
            print("✅ Sample data populated successfully!")
            print(json.dumps(result, indent=2))
        else:
            print(f"❌ Error populating sample data: {sample_response.status_code}")
            print(sample_response.text)
            
        # Check schema status
        print("\n🔍 Checking schema status...")
        schema_response = requests.get("http://localhost:8002/api/ast/schema-status")
        
        if schema_response.status_code == 200:
            schema = schema_response.json()
            print("📊 Schema Status:")
            print(json.dumps(schema, indent=2))
        else:
            print(f"❌ Error checking schema: {schema_response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    populate_via_api()
