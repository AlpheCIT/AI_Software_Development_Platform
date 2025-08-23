#!/usr/bin/env python3
"""
Analyze the Streamlit Code Analyzer Repository
This script will download and analyze the repository you mentioned
"""

import os
import sys
import git
import tempfile
import shutil
from repository_analyzer import analyze_local_repository

def clone_and_analyze_repository():
    """Clone and analyze the Streamlit Code Analyzer repository."""
    repo_url = "https://github.com/AlpheCIT/Streamlit_Code_Analyzer.git"
    
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        repo_path = os.path.join(temp_dir, "Streamlit_Code_Analyzer")
        
        print(f"Cloning repository: {repo_url}")
        print(f"Temporary path: {repo_path}")
        
        try:
            # Clone the repository
            git.Repo.clone_from(repo_url, repo_path)
            print(f"✅ Repository cloned successfully")
            
            # Analyze the repository
            print(f"🔍 Analyzing repository...")
            result = analyze_local_repository(repo_path, repo_url)
            
            if result and result.get("success"):
                print(f"✅ Analysis completed successfully!")
                print(f"📊 Repository ID: {result['repository_id']}")
                print(f"📁 Files analyzed: {result['analysis_results']['files_analyzed']}")
                print(f"🧩 AST nodes created: {result['analysis_results']['ast_nodes_created']}")
                print(f"🔗 Relationships created: {result['analysis_results']['relationships_created']}")
                
                # Print repository info
                repo_info = result["repository_info"]
                print(f"\n📋 Repository Information:")
                print(f"   Name: {repo_info['name']}")
                print(f"   Branch: {repo_info['branch']}")
                print(f"   Total files: {repo_info['file_stats']['total_files']}")
                print(f"   Total lines: {repo_info['file_stats']['total_lines']}")
                print(f"   Languages: {list(repo_info['file_stats']['by_language'].keys())}")
                
                if result['analysis_results']['errors']:
                    print(f"\n⚠️  Errors encountered:")
                    for error in result['analysis_results']['errors']:
                        print(f"   - {error}")
                        
            else:
                print(f"❌ Analysis failed: {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🚀 Starting analysis of Streamlit_Code_Analyzer repository...")
    clone_and_analyze_repository()
