#!/usr/bin/env python3
"""
Unified Repository Processor
Consolidates repository_analyzer.py + repository_analysis_service.py
Combines best features from both analyzers for comprehensive repository analysis
"""

import os
import git
import json
import logging
import time
import tempfile
import shutil
import hashlib
from typing import Dict, List, Any, Optional, Set, Union
from datetime import datetime
from pathlib import Path

from core.database_manager import UnifiedDatabaseManager
from analysis.embedding_engine import PurposeAwareEmbeddingEngine
from analysis.ast_analyzer import MultiLanguageASTAnalyzer

logger = logging.getLogger(__name__)

class UnifiedRepositoryProcessor:
    """
    Consolidated repository analysis pipeline
    Combines best of both existing analyzers with enhanced capabilities
    """
    
    def __init__(self, 
                 db_manager: UnifiedDatabaseManager,
                 embedding_engine: PurposeAwareEmbeddingEngine,
                 ast_analyzer: MultiLanguageASTAnalyzer):
        """Initialize the unified repository processor."""
        self.db = db_manager
        self.embeddings = embedding_engine
        self.ast = ast_analyzer
        
        # Supported file extensions (enhanced from both analyzers)
        self.supported_extensions = {
            # Programming languages
            '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.c', '.h', '.hpp',
            '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.cs', '.vb',
            '.clj', '.cljs', '.elm', '.erl', '.ex', '.exs', '.fs', '.fsx', '.ml',
            '.mli', '.hs', '.lhs', '.jl', '.lua', '.m', '.mm', '.pl', '.pm',
            '.r', '.R', '.rkt', '.scm', '.tcl', '.vhd', '.vhdl', '.v', '.sv',
            
            # Web technologies
            '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl',
            '.vue', '.svelte', '.astro', '.pug', '.haml', '.erb', '.ejs',
            
            # Configuration and data
            '.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.cfg', '.conf',
            '.properties', '.env', '.dotenv',
            
            # Database and query languages
            '.sql', '.hql', '.cql', '.cypher', '.sparql',
            
            # Shell and scripts
            '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
            
            # Documentation and markup
            '.md', '.rst', '.asciidoc', '.adoc', '.tex', '.txt',
            
            # Docker and infrastructure
            '.dockerfile', '.dockerignore', 'Dockerfile', 'docker-compose.yml',
            'docker-compose.yaml', '.gitlab-ci.yml', '.github/workflows/*.yml',
            
            # Build and dependency files
            'package.json', 'requirements.txt', 'Cargo.toml', 'pom.xml',
            'build.gradle', 'CMakeLists.txt', 'Makefile', 'setup.py'
        }
        
        # Excluded directories (comprehensive from both analyzers)
        self.excluded_dirs = {
            # Version control
            '.git', '.svn', '.hg', '.bzr',
            
            # Dependencies and cache
            '__pycache__', 'node_modules', 'venv', '.venv', 'env', '.env',
            '.conda', 'vendor', 'bower_components', 'jspm_packages',
            
            # Build outputs
            'dist', 'build', 'target', 'bin', 'obj', 'out', 'output',
            '.next', '.nuxt', '.gatsby', '.vercel', '.netlify',
            
            # IDE and editor files
            '.vscode', '.idea', '.eclipse', '.sublime-project',
            
            # Testing and coverage
            'coverage', '.nyc_output', '.pytest_cache', '.tox', '.nox',
            'htmlcov', '.coverage', 'test-results', 'allure-results',
            
            # Logs and temporary files
            'logs', 'tmp', 'temp', '.tmp', '.sass-cache',
            
            # OS specific
            '.DS_Store', 'Thumbs.db', 'desktop.ini',
            
            # Language specific
            '.cargo', '.stack-work', '_build', 'elm-stuff',
            '.gradle', '.m2', '.ivy2', 'project/target'
        }
    
    async def analyze_repository(self, 
                                repo_url: str, 
                                branch: str = "main",
                                local_path: str = None,
                                analysis_options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Complete repository analysis pipeline:
        1. Git clone handling or local repository access
        2. File discovery and filtering 
        3. Multi-language AST parsing
        4. Purpose-aware embeddings generation
        5. Database storage with relationships
        6. Advanced semantic analysis
        """
        start_time = time.time()
        temp_dir = None
        
        try:
            logger.info(f"🔍 Starting unified analysis of {repo_url or local_path} (branch: {branch})")
            
            # Default analysis options
            options = {
                'include_embeddings': True,
                'include_ast': True,
                'include_purpose_analysis': True,
                'include_security_scan': True,
                'max_file_size': 1024 * 1024,  # 1MB
                'batch_size': 100,
                'parallel_processing': True,
                **(analysis_options or {})
            }
            
            # Step 1: Repository acquisition
            if local_path and os.path.exists(local_path):
                repo_path = local_path
                logger.info(f"📁 Using local repository: {repo_path}")
            else:
                repo_path, temp_dir = await self._clone_repository(repo_url, branch)
            
            # Step 2: Repository metadata extraction
            repo_info = await self._extract_repository_metadata(repo_path, repo_url)
            
            # Step 3: Store repository in database
            repo_id = await self.db.store_repository(repo_info)
            
            # Step 4: File discovery and analysis
            analysis_results = await self._analyze_repository_files(
                repo_path, repo_id, options
            )
            
            # Step 5: Advanced relationship analysis
            relationship_results = await self._analyze_code_relationships(
                repo_id, options
            )
            
            # Step 6: Generate comprehensive metrics
            metrics = await self._calculate_repository_metrics(repo_id)
            
            # Cleanup
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                
            elapsed_time = time.time() - start_time
            
            final_results = {
                "success": True,
                "repository_id": repo_id,
                "repository_info": repo_info,
                "analysis_results": analysis_results,
                "relationship_results": relationship_results,
                "metrics": metrics,
                "processing_time": elapsed_time,
                "files_processed": analysis_results.get("files_processed", 0),
                "total_nodes": analysis_results.get("total_nodes", 0),
                "embedding_count": analysis_results.get("embedding_count", 0)
            }
            
            logger.info(f"✅ Repository analysis completed in {elapsed_time:.2f}s")
            logger.info(f"📊 Processed {final_results['files_processed']} files, "
                       f"created {final_results['total_nodes']} AST nodes, "
                       f"generated {final_results['embedding_count']} embeddings")
            
            return final_results
            
        except Exception as e:
            logger.error(f"❌ Repository analysis failed: {str(e)}")
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            return {
                "success": False,
                "error": str(e),
                "processing_time": time.time() - start_time
            }
    
    async def _clone_repository(self, repo_url: str, branch: str) -> tuple[str, str]:
        """Clone repository to temporary directory."""
        if not git:
            raise ImportError("GitPython is required for repository cloning")
        
        temp_dir = tempfile.mkdtemp(prefix="repo_analysis_")
        
        try:
            logger.info(f"📥 Cloning repository: {repo_url}")
            repo = git.Repo.clone_from(
                repo_url, 
                temp_dir,
                branch=branch,
                depth=1,  # Shallow clone for faster processing
                single_branch=True
            )
            
            logger.info(f"✅ Repository cloned to: {temp_dir}")
            return temp_dir, temp_dir
            
        except Exception as e:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            raise Exception(f"Failed to clone repository: {str(e)}")
    
    async def _extract_repository_metadata(self, repo_path: str, repo_url: str = None) -> Dict[str, Any]:
        """Extract comprehensive repository metadata."""
        try:
            # Basic repository info
            repo_info = {
                "url": repo_url,
                "local_path": repo_path,
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "analyzer_version": "unified_v1.0"
            }
            
            # Try to get Git metadata
            try:
                repo = git.Repo(repo_path)
                repo_info.update({
                    "current_branch": repo.active_branch.name,
                    "latest_commit": repo.head.commit.hexsha,
                    "commit_message": repo.head.commit.message.strip(),
                    "commit_author": str(repo.head.commit.author),
                    "commit_date": repo.head.commit.committed_datetime.isoformat(),
                    "total_commits": len(list(repo.iter_commits())),
                    "branches": [ref.name for ref in repo.refs if 'origin/' not in ref.name],
                    "remotes": [remote.url for remote in repo.remotes]
                })
            except Exception as e:
                logger.warning(f"Could not extract Git metadata: {str(e)}")
                repo_info["git_metadata_error"] = str(e)
            
            # File system analysis
            total_files = 0
            total_size = 0
            file_types = {}
            
            for root, dirs, files in os.walk(repo_path):
                # Skip excluded directories
                dirs[:] = [d for d in dirs if d not in self.excluded_dirs]
                
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        file_size = os.path.getsize(file_path)
                        total_files += 1
                        total_size += file_size
                        
                        # Track file types
                        ext = Path(file).suffix.lower()
                        if ext:
                            file_types[ext] = file_types.get(ext, 0) + 1
                    except OSError:
                        continue
            
            repo_info.update({
                "total_files": total_files,
                "total_size_bytes": total_size,
                "file_types": file_types,
                "supported_files": sum(
                    count for ext, count in file_types.items() 
                    if ext in self.supported_extensions
                )
            })
            
            # Generate repository hash for deduplication
            repo_info["content_hash"] = self._calculate_repository_hash(repo_path)
            
            return repo_info
            
        except Exception as e:
            logger.error(f"Failed to extract repository metadata: {str(e)}")
            raise
    
    async def _analyze_repository_files(self, 
                                      repo_path: str, 
                                      repo_id: str,
                                      options: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze all files in the repository."""
        results = {
            "files_processed": 0,
            "files_skipped": 0,
            "total_nodes": 0,
            "embedding_count": 0,
            "errors": [],
            "file_results": []
        }
        
        # Discover analyzable files
        files_to_process = self._discover_files(repo_path)
        
        logger.info(f"📁 Found {len(files_to_process)} files to analyze")
        
        # Process files in batches for better performance
        batch_size = options.get('batch_size', 100)
        
        for i in range(0, len(files_to_process), batch_size):
            batch = files_to_process[i:i + batch_size]
            batch_results = await self._process_file_batch(
                batch, repo_path, repo_id, options
            )
            
            # Aggregate results
            results["files_processed"] += batch_results["files_processed"]
            results["files_skipped"] += batch_results["files_skipped"]
            results["total_nodes"] += batch_results["total_nodes"]
            results["embedding_count"] += batch_results["embedding_count"]
            results["errors"].extend(batch_results["errors"])
            results["file_results"].extend(batch_results["file_results"])
            
            logger.info(f"📊 Processed batch {i//batch_size + 1}/{(len(files_to_process) + batch_size - 1)//batch_size}")
        
        return results
    
    def _discover_files(self, repo_path: str) -> List[str]:
        """Discover all analyzable files in the repository."""
        files = []
        
        for root, dirs, filenames in os.walk(repo_path):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in self.excluded_dirs]
            
            for filename in filenames:
                file_path = os.path.join(root, filename)
                
                # Check if file should be analyzed
                if self._should_analyze_file(file_path, filename):
                    files.append(file_path)
        
        return files
    
    def _should_analyze_file(self, file_path: str, filename: str) -> bool:
        """Determine if a file should be analyzed."""
        # Check file extension
        ext = Path(filename).suffix.lower()
        if ext not in self.supported_extensions and filename not in self.supported_extensions:
            return False
        
        # Check file size (skip very large files)
        try:
            if os.path.getsize(file_path) > 1024 * 1024:  # 1MB limit
                return False
        except OSError:
            return False
        
        # Check if file is readable
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.read(1)  # Try to read first character
            return True
        except (UnicodeDecodeError, PermissionError, OSError):
            return False
    
    async def _process_file_batch(self, 
                                batch: List[str], 
                                repo_path: str,
                                repo_id: str,
                                options: Dict[str, Any]) -> Dict[str, Any]:
        """Process a batch of files."""
        batch_results = {
            "files_processed": 0,
            "files_skipped": 0,
            "total_nodes": 0,
            "embedding_count": 0,
            "errors": [],
            "file_results": []
        }
        
        for file_path in batch:
            try:
                file_result = await self._process_single_file(
                    file_path, repo_path, repo_id, options
                )
                
                if file_result["success"]:
                    batch_results["files_processed"] += 1
                    batch_results["total_nodes"] += file_result.get("nodes_created", 0)
                    batch_results["embedding_count"] += file_result.get("embeddings_created", 0)
                else:
                    batch_results["files_skipped"] += 1
                    batch_results["errors"].append(file_result.get("error", "Unknown error"))
                
                batch_results["file_results"].append(file_result)
                
            except Exception as e:
                batch_results["files_skipped"] += 1
                batch_results["errors"].append(f"Error processing {file_path}: {str(e)}")
                logger.error(f"Failed to process file {file_path}: {str(e)}")
        
        return batch_results
    
    async def _process_single_file(self, 
                                 file_path: str, 
                                 repo_path: str,
                                 repo_id: str,
                                 options: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single file with AST analysis and embeddings."""
        try:
            # Get relative path from repository root
            rel_path = os.path.relpath(file_path, repo_path)
            
            # Read file content
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            file_info = {
                "file_path": rel_path,
                "absolute_path": file_path,
                "repository_id": repo_id,
                "content": content,
                "size": len(content),
                "extension": Path(file_path).suffix.lower(),
                "filename": Path(file_path).name,
                "analysis_timestamp": datetime.utcnow().isoformat()
            }
            
            result = {
                "file_path": rel_path,
                "success": False,
                "nodes_created": 0,
                "embeddings_created": 0
            }
            
            # AST Analysis
            if options.get('include_ast', True):
                ast_result = await self.ast.analyze_file(file_info)
                if ast_result["success"]:
                    # Store AST nodes in database
                    nodes_stored = await self.db.store_ast_nodes(
                        ast_result["nodes"], repo_id, rel_path
                    )
                    result["nodes_created"] = nodes_stored
                    result["ast_analysis"] = ast_result
            
            # Purpose Analysis and Embeddings
            if options.get('include_embeddings', True):
                embedding_result = await self.embeddings.generate_file_embeddings(file_info)
                if embedding_result["success"]:
                    # Store embeddings in database
                    embeddings_stored = await self.db.store_embeddings(
                        embedding_result["embeddings"], repo_id, rel_path
                    )
                    result["embeddings_created"] = embeddings_stored
                    result["embedding_analysis"] = embedding_result
            
            # Store file metadata
            await self.db.store_file_metadata(file_info)
            
            result["success"] = True
            return result
            
        except Exception as e:
            return {
                "file_path": file_path,
                "success": False,
                "error": str(e),
                "nodes_created": 0,
                "embeddings_created": 0
            }
    
    async def _analyze_code_relationships(self, 
                                        repo_id: str,
                                        options: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze relationships between code elements."""
        try:
            # Cross-file dependency analysis
            dependencies = await self.ast.analyze_dependencies(repo_id)
            
            # Semantic similarity relationships
            similarities = await self.embeddings.calculate_similarities(repo_id)
            
            # Store relationships in database
            await self.db.store_relationships(dependencies, similarities, repo_id)
            
            return {
                "success": True,
                "dependencies_found": len(dependencies),
                "similarities_calculated": len(similarities)
            }
            
        except Exception as e:
            logger.error(f"Relationship analysis failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _calculate_repository_metrics(self, repo_id: str) -> Dict[str, Any]:
        """Calculate comprehensive repository metrics."""
        try:
            metrics = await self.db.calculate_repository_metrics(repo_id)
            return metrics
        except Exception as e:
            logger.error(f"Metrics calculation failed: {str(e)}")
            return {"error": str(e)}
    
    def _calculate_repository_hash(self, repo_path: str) -> str:
        """Calculate a hash representing the repository content."""
        hasher = hashlib.sha256()
        
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in self.excluded_dirs]
            
            for file in sorted(files):
                file_path = os.path.join(root, file)
                if self._should_analyze_file(file_path, file):
                    try:
                        with open(file_path, 'rb') as f:
                            hasher.update(f.read())
                    except (OSError, PermissionError):
                        continue
        
        return hasher.hexdigest()
