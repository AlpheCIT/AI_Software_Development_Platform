#!/usr/bin/env python3
"""
Test the code search API endpoint
"""

import requests
import json

def test_api():
    base_url = "http://127.0.0.1:8002"
    
    # Test health endpoint
    print("Testing health endpoint...")
    response = requests.get(f"{base_url}/api/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    print()
    
    # Test code search endpoint
    print("Testing code search endpoint...")
    data = {"query": "authentication", "max_results": 3}
    response = requests.post(f"{base_url}/api/code/search", json=data)
    
    print(f"Status: {response.status_code}")
    print(f"Response length: {len(response.text)} characters")
    
    if response.status_code == 200:
        try:
            result = response.json()
            print(f"Query: {result.get('query', 'N/A')}")
            print(f"Total results: {result.get('total_results', 0)}")
            print(f"Query time: {result.get('query_time_ms', 0):.2f}ms")
            
            results = result.get('results', [])
            if results:
                print(f"\nFirst result:")
                first = results[0]
                print(f"  File: {first.get('file', 'N/A')}")
                print(f"  Language: {first.get('language', 'N/A')}")
                print(f"  Similarity: {first.get('similarity', 0)}")
                print(f"  Line number: {first.get('line_number', 0)}")
                print(f"  Code snippet: {first.get('code', 'N/A')[:100]}...")
                
                # Check embedding data
                embedding = first.get('embedding')
                if embedding:
                    print(f"  Embedding model: {embedding.get('model', 'N/A')}")
                    print(f"  Embedding dimensions: {embedding.get('dimensions', 0)}")
                    vector = embedding.get('vector', [])
                    if vector:
                        print(f"  Vector sample: [{vector[0]:.4f}, {vector[1]:.4f}, ..., {vector[-1]:.4f}]")
                    else:
                        print("  No vector data")
                else:
                    print("  No embedding data")
            else:
                print("No results returned")
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Raw response: {response.text[:500]}...")
    else:
        print(f"Error response: {response.text}")

if __name__ == "__main__":
    test_api()
