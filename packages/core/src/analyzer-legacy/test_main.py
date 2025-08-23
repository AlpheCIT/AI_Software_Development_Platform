#!/usr/bin/env python3
"""
Minimal test to check what's wrong with main.py import
"""

try:
    print("Testing basic imports...")
    import sys
    import os
    print(f"Python path: {sys.path}")
    print(f"Current working directory: {os.getcwd()}")
    
    print("Importing FastAPI...")
    from fastapi import FastAPI
    
    print("Importing database...")
    from database import db_connection
    
    print("Importing services...")
    from embedding_service import EmbeddingService
    from repository_analysis_service import RepositoryAnalysisService
    from code_search_service import CodeSearchService
    
    print("All imports successful!")
    
    print("Now importing main module...")
    import main
    print("Main module imported successfully!")
    
    print(f"App object: {main.app}")
    
except Exception as e:
    import traceback
    print(f"Error: {e}")
    print("Full traceback:")
    traceback.print_exc()
