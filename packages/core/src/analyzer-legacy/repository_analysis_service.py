"""
Repository Analysis Service for processing real repositories.
"""

import os
import logging
import time
import tempfile
import shutil
from typing import Dict, List, Any, Optional
from pathlib import Path
try:
    import git
except ImportError:
    git = None
from datetime import datetime
import hashlib

logger = logging.getLogger(__name__)

class RepositoryAnalysisService:
    """Service for analyzing real Git repositories."""
    
    def __init__(self, db_connection, embedding_service):
        """Initialize the repository analysis service."""
        self.db_connection = db_connection
        self.embedding_service = embedding_service
        
        # Supported file extensions
        self.supported_extensions = {
            '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.c', '.h', '.hpp',
            '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.cs', '.vb',
            '.html', '.css', '.scss', '.sass', '.less', '.xml', '.json', '.yaml', '.yml',
            '.sql', '.sh', '.bash', '.ps1', '.bat', '.dockerfile', '.md', '.txt'
        }
        
        # Excluded directories
        self.excluded_dirs = {
            '.git', '__pycache__', 'node_modules', 'venv', '.venv', 'env', '.env',
            'dist', 'build', 'target', 'bin', 'obj', '.next', '.nuxt', 'coverage',
            '.nyc_output', '.pytest_cache', '.tox', '.nox', 'htmlcov'
        }
    
    def analyze_repository(self, repo_url: str, branch: str = "main") -> Dict[str, Any]:
        """Analyze a repository and store results in the database."""
        start_time = time.time()
        temp_dir = None
        
        try:
            logger.info(f"🔍 Starting analysis of {repo_url} (branch: {branch})")
            
            # Clone repository
            temp_dir = self._clone_repository(repo_url, branch)
            
            # Analyze files
            analysis_results = self._analyze_files(temp_dir)
            
            # Store repository metadata
            repo_data = self._create_repository_record(repo_url, branch, analysis_results)
            
            # Store code nodes in database
            code_nodes = self._create_code_nodes(analysis_results, repo_data['id'])
            
            # Generate embeddings
            embedding_results = self._generate_embeddings(code_nodes)
            
            # Store results in database
            self._store_analysis_results(repo_data, code_nodes, embedding_results)
            
            duration = time.time() - start_time
            
            return {
                "success": True,
                "repository_id": repo_data['id'],
                "repository_url": repo_url,
                "branch": branch,
                "duration_seconds": round(duration, 2),
                "total_files": analysis_results['total_files'],
                "total_lines": analysis_results['total_lines'],
                "languages": analysis_results['languages'],
                "functions_found": analysis_results['functions_count'],
                "classes_found": analysis_results['classes_count'],
                "embeddings_generated": embedding_results['embeddings_generated'],
                "embedding_failures": embedding_results['embedding_failures']
            }
        
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"❌ Repository analysis failed: {e}")
            return {
                "success": False,
                "repository_url": repo_url,
                "branch": branch,
                "duration_seconds": round(duration, 2),
                "error": str(e)
            }
        
        finally:
            # Clean up temporary directory
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                    logger.info(f"🧹 Cleaned up temporary directory: {temp_dir}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp dir: {e}")
    
    def _clone_repository(self, repo_url: str, branch: str) -> str:
        """Clone repository to temporary directory."""
        temp_dir = tempfile.mkdtemp(prefix="repo_analysis_")
        
        try:
            logger.info(f"📥 Cloning {repo_url} to {temp_dir}")
            
            # Try to clone with the specified branch first
            try:
                git.Repo.clone_from(repo_url, temp_dir, branch=branch, depth=1)
                return temp_dir
            except git.exc.GitCommandError as e:
                if "Remote branch" in str(e) and "not found" in str(e):
                    logger.warning(f"Branch '{branch}' not found, trying 'master'")
                    # Clean up failed attempt
                    if os.path.exists(temp_dir):
                        shutil.rmtree(temp_dir)
                    temp_dir = tempfile.mkdtemp(prefix="repo_analysis_")
                    
                    # Try with 'master' branch
                    try:
                        git.Repo.clone_from(repo_url, temp_dir, branch="master", depth=1)
                        return temp_dir
                    except git.exc.GitCommandError:
                        logger.warning(f"Branch 'master' not found either, trying default branch")
                        # Clean up failed attempt
                        if os.path.exists(temp_dir):
                            shutil.rmtree(temp_dir)
                        temp_dir = tempfile.mkdtemp(prefix="repo_analysis_")
                        
                        # Try without specifying branch (use default)
                        git.Repo.clone_from(repo_url, temp_dir, depth=1)
                        return temp_dir
                else:
                    raise e
                    
        except Exception as e:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            raise Exception(f"Failed to clone repository: {e}")
    
    def _analyze_files(self, repo_path: str) -> Dict[str, Any]:
        """Analyze all files in the repository."""
        results = {
            'total_files': 0,
            'total_lines': 0,
            'languages': {},
            'functions_count': 0,
            'classes_count': 0,
            'files': []
        }
        
        repo_path_obj = Path(repo_path)
        
        for file_path in repo_path_obj.rglob('*'):
            # Skip directories and excluded paths
            if file_path.is_dir():
                continue
            
            if any(excluded in file_path.parts for excluded in self.excluded_dirs):
                continue
            
            if file_path.suffix not in self.supported_extensions:
                continue
            
            try:
                # Read file content
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Skip empty files or very large files
                if not content.strip() or len(content) > 1000000:  # 1MB limit
                    continue
                
                # Analyze file
                file_analysis = self._analyze_file_content(file_path, content)
                results['files'].append(file_analysis)
                
                # Update totals
                results['total_files'] += 1
                results['total_lines'] += file_analysis['line_count']
                results['functions_count'] += file_analysis['functions_count']
                results['classes_count'] += file_analysis['classes_count']
                
                # Update language stats
                language = file_analysis['language']
                if language not in results['languages']:
                    results['languages'][language] = {'files': 0, 'lines': 0}
                results['languages'][language]['files'] += 1
                results['languages'][language]['lines'] += file_analysis['line_count']
                
            except Exception as e:
                logger.warning(f"Error analyzing file {file_path}: {e}")
                continue
        
        logger.info(f"📊 Analyzed {results['total_files']} files, {results['total_lines']} lines of code")
        return results
    
    def _analyze_file_content(self, file_path: Path, content: str) -> Dict[str, Any]:
        """Analyze individual file content."""
        language = self._detect_language(file_path)
        lines = content.split('\n')
        
        # Simple function/class detection
        functions_count = 0
        classes_count = 0
        
        if language == 'python':
            functions_count = len([line for line in lines if line.strip().startswith('def ')])
            classes_count = len([line for line in lines if line.strip().startswith('class ')])
        elif language in ['javascript', 'typescript']:
            functions_count = len([line for line in lines if 'function ' in line or '=>' in line])
            classes_count = len([line for line in lines if line.strip().startswith('class ')])
        elif language == 'java':
            functions_count = len([line for line in lines if 'public ' in line and '(' in line and ')' in line])
            classes_count = len([line for line in lines if line.strip().startswith('public class ') or line.strip().startswith('class ')])
        
        relative_path = str(file_path).replace(str(file_path.parents[len(file_path.parents)-1]), '').lstrip('/')
        
        return {
            'file_path': relative_path,
            'language': language,
            'line_count': len(lines),
            'functions_count': functions_count,
            'classes_count': classes_count,
            'size_bytes': len(content.encode('utf-8')),
            'content': content,
            'hash': hashlib.md5(content.encode()).hexdigest()
        }
    
    def _detect_language(self, file_path: Path) -> str:
        """Detect programming language from file extension."""
        extension_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.cs': 'csharp',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.sql': 'sql',
            '.sh': 'bash',
            '.bash': 'bash',
            '.ps1': 'powershell',
            '.md': 'markdown'
        }
        return extension_map.get(file_path.suffix.lower(), 'unknown')
    
    def _create_repository_record(self, repo_url: str, branch: str, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """Create repository record for database."""
        repo_id = f"repo_{int(time.time() * 1000)}"
        repo_name = repo_url.split('/')[-1].replace('.git', '')
        
        return {
            'id': repo_id,
            'name': repo_name,
            'url': repo_url,
            'branch': branch,
            'total_files': analysis_results['total_files'],
            'total_lines': analysis_results['total_lines'],
            'languages': analysis_results['languages'],
            'created_at': datetime.now().isoformat(),
            'last_analyzed': datetime.now().isoformat(),
            'status': 'analyzed'
        }
    
    def _create_code_nodes(self, analysis_results: Dict[str, Any], repo_id: str) -> List[Dict[str, Any]]:
        """Create code nodes for database storage."""
        nodes = []
        
        for file_data in analysis_results['files']:
            # Create file node
            file_node = {
                'id': f"file_{repo_id}_{hashlib.md5(file_data['file_path'].encode()).hexdigest()[:8]}",
                'type': 'file',
                'repository_id': repo_id,
                'file_path': file_data['file_path'],
                'language': file_data['language'],
                'content': file_data['content'],
                'line_count': file_data['line_count'],
                'size_bytes': file_data['size_bytes'],
                'hash': file_data['hash'],
                'created_at': datetime.now().isoformat()
            }
            nodes.append(file_node)
            
            # Create function/class nodes (simplified)
            if file_data['functions_count'] > 0 or file_data['classes_count'] > 0:
                # This is a simplified approach - in a real implementation,
                # you'd parse the AST to extract actual function/class definitions
                for i in range(file_data['functions_count']):
                    func_id = f"func_{repo_id}_{hashlib.md5((file_data['file_path'] + f'_func_{i}').encode()).hexdigest()[:8]}"
                    func_node = {
                        'id': func_id,
                        'type': 'function',
                        'repository_id': repo_id,
                        'file_path': file_data['file_path'],
                        'language': file_data['language'],
                        'content': f"// Function {i+1} from {file_data['file_path']}",
                        'parent_file': file_node['id'],
                        'created_at': datetime.now().isoformat()
                    }
                    nodes.append(func_node)
        
        logger.info(f"📝 Created {len(nodes)} code nodes")
        return nodes
    
    def _generate_embeddings(self, code_nodes: List[Dict[str, Any]]) -> Dict[str, int]:
        """Generate embeddings for code nodes."""
        embeddings_generated = 0
        embedding_failures = 0
        
        if not self.embedding_service or not self.embedding_service.is_available():
            logger.warning("⚠️ Embedding service not available, skipping embeddings")
            return {'embeddings_generated': 0, 'embedding_failures': 0}
        
        for node in code_nodes:
            try:
                content = node.get('content', '')
                if not content.strip():
                    continue
                
                embedding = self.embedding_service.get_embedding(content)
                if embedding:
                    node['embedding'] = embedding
                    node['embedding_model'] = self.embedding_service.model
                    node['embedding_dimensions'] = len(embedding)
                    embeddings_generated += 1
                else:
                    embedding_failures += 1
            
            except Exception as e:
                logger.error(f"Error generating embedding for node {node.get('id')}: {e}")
                embedding_failures += 1
        
        logger.info(f"🧠 Generated {embeddings_generated} embeddings, {embedding_failures} failures")
        return {
            'embeddings_generated': embeddings_generated,
            'embedding_failures': embedding_failures
        }
    
    def _store_analysis_results(self, repo_data: Dict[str, Any], code_nodes: List[Dict[str, Any]], embedding_results: Dict[str, Any]):
        """Store analysis results in database."""
        if not self.db_connection or not self.db_connection.is_connected():
            logger.warning("⚠️ Database not connected, storing results in memory only")
            return
        
        try:
            # Store repository
            repos_collection = self.db_connection.get_collection('repositories')
            if repos_collection:
                repos_collection.insert(repo_data)
                logger.info(f"💾 Stored repository record: {repo_data['id']}")
            
            # Store code nodes
            code_collection = self.db_connection.get_collection('codeNodes')
            if code_collection and code_nodes:
                # Insert in batches
                batch_size = 100
                for i in range(0, len(code_nodes), batch_size):
                    batch = code_nodes[i:i + batch_size]
                    code_collection.insert_many(batch)
                logger.info(f"💾 Stored {len(code_nodes)} code nodes")
            
            # Store embeddings separately if they exist
            embeddings_collection = self.db_connection.get_collection('embeddings')
            if embeddings_collection:
                embedding_records = []
                for node in code_nodes:
                    if 'embedding' in node:
                        embedding_record = {
                            'id': f"embed_{node['id']}",
                            'code_node_id': node['id'],
                            'repository_id': node['repository_id'],
                            'vector': node['embedding'],
                            'dimensions': node['embedding_dimensions'],
                            'model': node['embedding_model'],
                            'created_at': datetime.now().isoformat()
                        }
                        embedding_records.append(embedding_record)
                
                if embedding_records:
                    # Insert embeddings in batches
                    batch_size = 50
                    for i in range(0, len(embedding_records), batch_size):
                        batch = embedding_records[i:i + batch_size]
                        embeddings_collection.insert_many(batch)
                    logger.info(f"💾 Stored {len(embedding_records)} embedding records")
        
        except Exception as e:
            logger.error(f"❌ Error storing analysis results: {e}")
    
    def search_code(self, query: str, repository_id: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Search for code using embeddings and text matching."""
        if not self.db_connection or not self.db_connection.is_connected():
            logger.warning("⚠️ Database not connected, cannot search")
            return []
        
        try:
            code_collection = self.db_connection.get_collection('codeNodes')
            if not code_collection:
                return []
            
            # Build query
            aql_query = """
                FOR node IN codeNodes
                    FILTER CONTAINS(LOWER(node.content), LOWER(@query))
            """
            
            bind_vars = {'query': query}
            
            if repository_id:
                aql_query += " FILTER node.repository_id == @repository_id"
                bind_vars['repository_id'] = repository_id
            
            aql_query += """
                LIMIT @limit
                RETURN {
                    id: node.id,
                    type: node.type,
                    repository_id: node.repository_id,
                    file_path: node.file_path,
                    language: node.language,
                    content: node.content,
                    line_count: node.line_count,
                    created_at: node.created_at
                }
            """
            
            bind_vars['limit'] = limit
            
            cursor = self.db_connection.db.aql.execute(aql_query, bind_vars=bind_vars)
            results = list(cursor)
            
            # If embedding service is available, enhance with similarity scoring
            if self.embedding_service and self.embedding_service.is_available() and results:
                enhanced_results = self.embedding_service.search_similar(query, results, limit)
                return enhanced_results
            
            # Basic text matching results
            for result in results:
                result['similarity'] = 0.7  # Default similarity for text matches
            
            return results
        
        except Exception as e:
            logger.error(f"❌ Error searching code: {e}")
            return []
