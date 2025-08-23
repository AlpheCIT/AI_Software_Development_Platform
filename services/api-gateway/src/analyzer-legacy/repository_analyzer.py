#!/usr/bin/env python3
"""
Repository Analyzer - Analyzes code repositories and populates AST data
Integrates with the AST Graph Schema to store comprehensive code analysis
"""

import os
import git
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
import hashlib

from ast_parser_service import ASTParserService

try:
    from arango import ArangoClient
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RepositoryAnalyzer:
    """Analyzes code repositories and populates the graph database."""
    
    def __init__(self, db=None):
        self.db = db
        self.ast_parser = ASTParserService(db)
        
    def analyze_repository(self, repo_path: str, repo_url: str = None) -> Dict[str, Any]:
        """Analyze a repository and populate the database."""
        try:
            if not os.path.exists(repo_path):
                logger.error(f"Repository path does not exist: {repo_path}")
                return {"success": False, "error": "Repository path not found"}
                
            # Get repository metadata
            repo_info = self._get_repository_info(repo_path, repo_url)
            
            # Store repository in database
            repo_id = self._store_repository(repo_info)
            
            # Analyze code files
            analysis_results = self._analyze_code_files(repo_path, repo_id)
            
            return {
                "success": True,
                "repository_id": repo_id,
                "repository_info": repo_info,
                "analysis_results": analysis_results
            }
            
        except Exception as e:
            logger.error(f"Error analyzing repository {repo_path}: {e}")
            return {"success": False, "error": str(e)}
    
    def _get_repository_info(self, repo_path: str, repo_url: str = None) -> Dict[str, Any]:
        """Extract repository metadata."""
        try:
            repo = git.Repo(repo_path)
            
            # Get latest commit info
            latest_commit = repo.head.commit
            
            # Count files by extension
            file_stats = self._count_files_by_extension(repo_path)
            
            repo_info = {
                "_key": hashlib.md5(repo_path.encode()).hexdigest()[:16],
                "name": os.path.basename(repo_path),
                "path": repo_path,
                "url": repo_url or "",
                "branch": repo.active_branch.name,
                "latest_commit": {
                    "hash": latest_commit.hexsha,
                    "message": latest_commit.message.strip(),
                    "author": latest_commit.author.name,
                    "date": latest_commit.committed_datetime.isoformat()
                },
                "file_stats": file_stats,
                "analyzed_at": datetime.now().isoformat(),
                "status": "active"
            }
            
        except git.InvalidGitRepositoryError:
            # Not a git repository, analyze as regular directory
            file_stats = self._count_files_by_extension(repo_path)
            
            repo_info = {
                "_key": hashlib.md5(repo_path.encode()).hexdigest()[:16],
                "name": os.path.basename(repo_path),
                "path": repo_path,
                "url": repo_url or "",
                "branch": "main",
                "latest_commit": None,
                "file_stats": file_stats,
                "analyzed_at": datetime.now().isoformat(),
                "status": "active"
            }
            
        return repo_info
    
    def _count_files_by_extension(self, repo_path: str) -> Dict[str, Any]:
        """Count files by extension and calculate statistics."""
        stats = {
            "total_files": 0,
            "by_extension": {},
            "by_language": {},
            "total_lines": 0
        }
        
        # Language mapping
        language_map = {
            ".py": "Python",
            ".js": "JavaScript", 
            ".ts": "TypeScript",
            ".jsx": "React",
            ".tsx": "React TypeScript",
            ".java": "Java",
            ".cpp": "C++",
            ".c": "C",
            ".cs": "C#",
            ".go": "Go",
            ".rs": "Rust",
            ".php": "PHP",
            ".rb": "Ruby",
            ".swift": "Swift",
            ".kt": "Kotlin",
            ".scala": "Scala",
            ".r": "R",
            ".m": "MATLAB",
            ".sql": "SQL",
            ".html": "HTML",
            ".css": "CSS",
            ".scss": "SCSS",
            ".less": "LESS",
            ".json": "JSON",
            ".xml": "XML",
            ".yaml": "YAML",
            ".yml": "YAML",
            ".md": "Markdown",
            ".txt": "Text"
        }
        
        for root, dirs, files in os.walk(repo_path):
            # Skip hidden directories and common ignore patterns
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv', '.git']]
            
            for file in files:
                if file.startswith('.'):
                    continue
                    
                file_path = os.path.join(root, file)
                ext = os.path.splitext(file)[1].lower()
                
                stats["total_files"] += 1
                stats["by_extension"][ext] = stats["by_extension"].get(ext, 0) + 1
                
                # Map to language
                language = language_map.get(ext, "Other")
                stats["by_language"][language] = stats["by_language"].get(language, 0) + 1
                
                # Count lines for text files
                if ext in language_map and ext not in ['.json', '.xml']:
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = len(f.readlines())
                            stats["total_lines"] += lines
                    except Exception:
                        continue
        
        return stats
    
    def _store_repository(self, repo_info: Dict[str, Any]) -> str:
        """Store repository information in the database."""
        try:
            if not self.db:
                logger.warning("Database not available")
                return repo_info["_key"]
                
            collection = self.db.collection('repositories')
            
            # Check if repository already exists
            existing = None
            try:
                existing = collection.get(repo_info["_key"])
            except:
                pass
                
            if existing:
                # Update existing repository
                collection.update(repo_info)
                logger.info(f"Updated repository: {repo_info['name']}")
            else:
                # Insert new repository
                collection.insert(repo_info)
                logger.info(f"Stored new repository: {repo_info['name']}")
                
            return repo_info["_key"]
            
        except Exception as e:
            logger.error(f"Error storing repository: {e}")
            return repo_info["_key"]
    
    def _analyze_code_files(self, repo_path: str, repo_id: str) -> Dict[str, Any]:
        """Analyze all code files in the repository."""
        results = {
            "files_analyzed": 0,
            "ast_nodes_created": 0,
            "relationships_created": 0,
            "errors": []
        }
        
        # Find all Python files (extend for other languages later)
        python_files = []
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv', '.git']]
            
            for file in files:
                if file.endswith('.py'):
                    python_files.append(os.path.join(root, file))
        
        # Analyze each Python file
        for file_path in python_files:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Store file metadata
                self._store_code_file(file_path, repo_id, content)
                
                # Parse AST and extract nodes/relationships
                nodes, relationships = self.ast_parser.parse_python_file(file_path, repo_id, content)
                
                # Store AST nodes
                for node in nodes:
                    self._store_ast_node(node)
                    results["ast_nodes_created"] += 1
                
                # Store relationships
                for rel in relationships:
                    self._store_relationship(rel)
                    results["relationships_created"] += 1
                
                results["files_analyzed"] += 1
                
            except Exception as e:
                error_msg = f"Error analyzing {file_path}: {e}"
                logger.error(error_msg)
                results["errors"].append(error_msg)
        
        return results
    
    def _store_code_file(self, file_path: str, repo_id: str, content: str):
        """Store code file metadata."""
        try:
            if not self.db:
                return
                
            file_key = hashlib.md5(file_path.encode()).hexdigest()[:16]
            
            file_doc = {
                "_key": file_key,
                "file_path": file_path,
                "repository_id": repo_id,
                "language": "python",
                "size_bytes": len(content.encode('utf-8')),
                "line_count": len(content.splitlines()),
                "analyzed_at": datetime.now().isoformat()
            }
            
            collection = self.db.collection('code_files')
            try:
                existing = collection.get(file_key)
                if existing:
                    collection.update(file_doc)
                else:
                    collection.insert(file_doc)
            except:
                collection.insert(file_doc)
                
        except Exception as e:
            logger.error(f"Error storing code file {file_path}: {e}")
    
    def _store_ast_node(self, node: Dict[str, Any]):
        """Store AST node in the database."""
        try:
            if not self.db:
                return
                
            collection = self.db.collection('ast_nodes')
            try:
                existing = collection.get(node["_key"])
                if existing:
                    collection.update(node)
                else:
                    collection.insert(node)
            except:
                collection.insert(node)
                
        except Exception as e:
            logger.error(f"Error storing AST node: {e}")
    
    def _store_relationship(self, relationship: Dict[str, Any]):
        """Store relationship in the database."""
        try:
            if not self.db:
                return
                
            collection = self.db.collection('relationships')
            
            # Generate a unique key for the relationship
            rel_key = hashlib.md5(f"{relationship['_from']}_{relationship['_to']}_{relationship['relationship_type']}".encode()).hexdigest()[:16]
            relationship["_key"] = rel_key
            
            try:
                existing = collection.get(rel_key)
                if existing:
                    collection.update(relationship)
                else:
                    collection.insert(relationship)
            except:
                collection.insert(relationship)
                
        except Exception as e:
            logger.error(f"Error storing relationship: {e}")

def analyze_local_repository(repo_path: str, repo_url: str = None):
    """Standalone function to analyze a repository."""
    try:
        # Connect to ArangoDB using same credentials as backend
        if not ARANGO_AVAILABLE:
            print("ArangoDB client not available")
            return
            
        # Use same connection parameters as the backend
        arango_host = os.getenv('ARANGO_HOST', 'localhost')
        arango_port = int(os.getenv('ARANGO_PORT', '8529'))
        ARANGO_USER = os.getenv('ARANGO_USER', 'root')
        arango_password = os.getenv('ARANGO_PASSWORD', 'password')  # Same default as backend
        arango_database = os.getenv('ARANGO_DATABASE', 'code_management')
        
        client = ArangoClient(hosts=f'http://{arango_host}:{arango_port}')
        db = client.db(arango_database, username=ARANGO_USER, password=arango_password)
        
        analyzer = RepositoryAnalyzer(db)
        result = analyzer.analyze_repository(repo_path, repo_url)
        
        print(json.dumps(result, indent=2))
        return result
        
    except Exception as e:
        print(f"Error: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Example usage
    repo_path = "/path/to/repository"
    analyze_local_repository(repo_path)
