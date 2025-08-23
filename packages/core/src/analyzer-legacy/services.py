import os
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging
from urllib.parse import urlparse
import json

logger = logging.getLogger(__name__)

class RepositoryService:
    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "code_analyzer_repos"
        self.temp_dir.mkdir(exist_ok=True)

    async def clone_repository(self, repository_url: str) -> Path:
        """Clone a repository to a temporary directory."""
        try:
            # Parse repository URL to get repo name
            parsed_url = urlparse(repository_url)
            repo_name = Path(parsed_url.path).stem
            
            # Create unique directory for this repository
            repo_dir = self.temp_dir / f"{repo_name}_{hash(repository_url) % 10000}"
            
            # Remove if exists
            if repo_dir.exists():
                shutil.rmtree(repo_dir)
            
            # Clone repository
            cmd = ["git", "clone", "--depth", "1", repository_url, str(repo_dir)]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                raise Exception(f"Failed to clone repository: {result.stderr}")
            
            logger.info(f"Successfully cloned {repository_url} to {repo_dir}")
            return repo_dir
            
        except subprocess.TimeoutExpired:
            raise Exception("Repository clone timed out")
        except Exception as e:
            logger.error(f"Error cloning repository {repository_url}: {str(e)}")
            raise

    async def analyze_repository(self, repository_url: str) -> Dict[str, Any]:
        """Perform comprehensive analysis of a repository."""
        repo_dir = None
        try:
            # Clone repository
            repo_dir = await self.clone_repository(repository_url)
            
            # Perform various analyses
            analysis_result = {
                "repository_url": repository_url,
                "basic_stats": await self._get_basic_stats(repo_dir),
                "file_structure": await self._analyze_file_structure(repo_dir),
                "languages": await self._detect_languages(repo_dir),
                "dependencies": await self._analyze_dependencies(repo_dir),
                "code_quality": await self._analyze_code_quality(repo_dir),
                "complexity": await self._analyze_complexity(repo_dir),
                "security": await self._analyze_security(repo_dir),
                "documentation": await self._analyze_documentation(repo_dir),
                "git_history": await self._analyze_git_history(repo_dir),
                "maintainability": await self._analyze_maintainability(repo_dir),
            }
            
            return analysis_result
            
        finally:
            # Cleanup
            if repo_dir and repo_dir.exists():
                try:
                    shutil.rmtree(repo_dir)
                except Exception as e:
                    logger.warning(f"Failed to cleanup {repo_dir}: {str(e)}")

    async def _get_basic_stats(self, repo_dir: Path) -> Dict[str, Any]:
        """Get basic repository statistics."""
        stats = {
            "total_files": 0,
            "total_lines": 0,
            "total_size_bytes": 0,
        }
        
        for file_path in repo_dir.rglob("*"):
            if file_path.is_file() and not self._should_ignore_file(file_path):
                stats["total_files"] += 1
                stats["total_size_bytes"] += file_path.stat().st_size
                
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        stats["total_lines"] += sum(1 for _ in f)
                except Exception:
                    pass  # Skip files that can't be read
        
        return stats

    async def _analyze_file_structure(self, repo_dir: Path) -> Dict[str, Any]:
        """Analyze the file structure of the repository."""
        structure = {
            "directories": [],
            "files_by_extension": {},
            "max_depth": 0,
        }
        
        for file_path in repo_dir.rglob("*"):
            if file_path.is_dir():
                relative_path = file_path.relative_to(repo_dir)
                structure["directories"].append(str(relative_path))
                structure["max_depth"] = max(structure["max_depth"], len(relative_path.parts))
            elif file_path.is_file() and not self._should_ignore_file(file_path):
                ext = file_path.suffix.lower()
                if ext not in structure["files_by_extension"]:
                    structure["files_by_extension"][ext] = 0
                structure["files_by_extension"][ext] += 1
        
        return structure

    async def _detect_languages(self, repo_dir: Path) -> Dict[str, Any]:
        """Detect programming languages used in the repository."""
        language_extensions = {
            '.py': 'Python',
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'JavaScript',
            '.tsx': 'TypeScript',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.r': 'R',
            '.sql': 'SQL',
            '.sh': 'Shell',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.less': 'LESS',
        }
        
        languages = {}
        
        for file_path in repo_dir.rglob("*"):
            if file_path.is_file() and not self._should_ignore_file(file_path):
                ext = file_path.suffix.lower()
                if ext in language_extensions:
                    lang = language_extensions[ext]
                    if lang not in languages:
                        languages[lang] = {"files": 0, "lines": 0}
                    
                    languages[lang]["files"] += 1
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            languages[lang]["lines"] += sum(1 for _ in f)
                    except Exception:
                        pass
        
        return languages

    async def _analyze_dependencies(self, repo_dir: Path) -> Dict[str, Any]:
        """Analyze project dependencies."""
        dependencies = {
            "package_files": [],
            "python": [],
            "javascript": [],
            "java": [],
            "other": []
        }
        
        # Python dependencies
        for requirements_file in ["requirements.txt", "pyproject.toml", "setup.py", "Pipfile"]:
            file_path = repo_dir / requirements_file
            if file_path.exists():
                dependencies["package_files"].append(requirements_file)
                if requirements_file == "requirements.txt":
                    try:
                        with open(file_path, 'r') as f:
                            for line in f:
                                line = line.strip()
                                if line and not line.startswith('#'):
                                    dependencies["python"].append(line.split('==')[0].split('>=')[0].split('<=')[0])
                    except Exception:
                        pass
        
        # JavaScript/Node.js dependencies
        package_json = repo_dir / "package.json"
        if package_json.exists():
            dependencies["package_files"].append("package.json")
            try:
                with open(package_json, 'r') as f:
                    data = json.load(f)
                    for dep_type in ["dependencies", "devDependencies"]:
                        if dep_type in data:
                            dependencies["javascript"].extend(data[dep_type].keys())
            except Exception:
                pass
        
        return dependencies

    async def _analyze_code_quality(self, repo_dir: Path) -> Dict[str, Any]:
        """Analyze code quality metrics."""
        return {
            "has_tests": self._has_test_files(repo_dir),
            "has_ci_config": self._has_ci_config(repo_dir),
            "has_linting_config": self._has_linting_config(repo_dir),
            "has_documentation": self._has_documentation(repo_dir),
            "test_coverage_estimate": 0.0,  # Would need actual tools to calculate
        }

    async def _analyze_complexity(self, repo_dir: Path) -> Dict[str, Any]:
        """Analyze code complexity (simplified)."""
        complexity_score = 0
        total_files = 0
        
        for file_path in repo_dir.rglob("*.py"):
            if not self._should_ignore_file(file_path):
                total_files += 1
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        # Simple heuristic: count control structures
                        complexity_score += content.count('if ') + content.count('for ') + \
                                          content.count('while ') + content.count('def ') + \
                                          content.count('class ')
                except Exception:
                    pass
        
        avg_complexity = complexity_score / max(total_files, 1)
        
        return {
            "average_complexity": avg_complexity,
            "complexity_score": complexity_score,
            "total_analyzed_files": total_files,
        }

    async def _analyze_security(self, repo_dir: Path) -> Dict[str, Any]:
        """Basic security analysis."""
        security_issues = []
        
        # Check for common security issues (simplified)
        for file_path in repo_dir.rglob("*"):
            if file_path.is_file() and not self._should_ignore_file(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read().lower()
                        
                        # Look for potential security issues
                        if 'password' in content and '=' in content:
                            security_issues.append(f"Potential hardcoded password in {file_path.name}")
                        if 'api_key' in content and '=' in content:
                            security_issues.append(f"Potential hardcoded API key in {file_path.name}")
                        if 'eval(' in content:
                            security_issues.append(f"Use of eval() function in {file_path.name}")
                            
                except Exception:
                    pass
        
        return {
            "security_issues": security_issues[:10],  # Limit to first 10
            "total_issues": len(security_issues),
        }

    async def _analyze_documentation(self, repo_dir: Path) -> Dict[str, Any]:
        """Analyze documentation coverage."""
        doc_files = []
        doc_extensions = ['.md', '.txt', '.rst', '.wiki']
        
        for file_path in repo_dir.rglob("*"):
            if (file_path.is_file() and 
                (file_path.suffix.lower() in doc_extensions or 
                 file_path.name.lower() in ['readme', 'changelog', 'license'])):
                doc_files.append(str(file_path.relative_to(repo_dir)))
        
        return {
            "documentation_files": doc_files,
            "has_readme": any('readme' in f.lower() for f in doc_files),
            "has_changelog": any('changelog' in f.lower() for f in doc_files),
            "has_license": any('license' in f.lower() for f in doc_files),
        }

    async def _analyze_git_history(self, repo_dir: Path) -> Dict[str, Any]:
        """Analyze git history (simplified)."""
        try:
            # Get commit count
            result = subprocess.run(
                ["git", "rev-list", "--count", "HEAD"],
                cwd=repo_dir,
                capture_output=True,
                text=True
            )
            commit_count = int(result.stdout.strip()) if result.returncode == 0 else 0
            
            # Get contributors
            result = subprocess.run(
                ["git", "shortlog", "-sn"],
                cwd=repo_dir,
                capture_output=True,
                text=True
            )
            contributors = len(result.stdout.strip().split('\n')) if result.returncode == 0 else 0
            
            return {
                "total_commits": commit_count,
                "total_contributors": contributors,
            }
            
        except Exception:
            return {
                "total_commits": 0,
                "total_contributors": 0,
            }

    async def _analyze_maintainability(self, repo_dir: Path) -> Dict[str, Any]:
        """Analyze maintainability metrics."""
        # This is a simplified version - real implementation would use more sophisticated metrics
        score = 0
        
        # Check for good practices
        if self._has_test_files(repo_dir):
            score += 20
        if self._has_ci_config(repo_dir):
            score += 15
        if self._has_documentation(repo_dir):
            score += 15
        if self._has_linting_config(repo_dir):
            score += 10
        
        # Check file organization
        if (repo_dir / "src").exists() or (repo_dir / "lib").exists():
            score += 10
        if (repo_dir / "tests").exists() or (repo_dir / "test").exists():
            score += 10
        
        # Check for package management
        if (repo_dir / "requirements.txt").exists() or (repo_dir / "package.json").exists():
            score += 10
        
        # Additional 10 points for having a reasonable number of files (not too many, not too few)
        file_count = sum(1 for _ in repo_dir.rglob("*") if _.is_file())
        if 10 <= file_count <= 1000:
            score += 10
        
        return {
            "maintainability_score": min(score, 100),
            "factors": {
                "has_tests": self._has_test_files(repo_dir),
                "has_ci": self._has_ci_config(repo_dir),
                "has_docs": self._has_documentation(repo_dir),
                "has_linting": self._has_linting_config(repo_dir),
                "organized_structure": (repo_dir / "src").exists() or (repo_dir / "lib").exists(),
                "has_package_management": (repo_dir / "requirements.txt").exists() or (repo_dir / "package.json").exists(),
            }
        }

    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if a file should be ignored in analysis."""
        ignore_patterns = [
            '.git', '__pycache__', 'node_modules', '.vscode', '.idea',
            'dist', 'build', 'target', '.pytest_cache', '.coverage',
            'venv', 'env', '.env'
        ]
        
        path_str = str(file_path)
        return any(pattern in path_str for pattern in ignore_patterns)

    def _has_test_files(self, repo_dir: Path) -> bool:
        """Check if the repository has test files."""
        test_patterns = ['test_*.py', '*_test.py', '*.test.js', '*.spec.js', 'test/*.py']
        for pattern in test_patterns:
            if list(repo_dir.rglob(pattern)):
                return True
        return (repo_dir / "tests").exists() or (repo_dir / "test").exists()

    def _has_ci_config(self, repo_dir: Path) -> bool:
        """Check if the repository has CI configuration."""
        ci_files = [
            '.github/workflows',
            '.gitlab-ci.yml',
            '.travis.yml',
            'azure-pipelines.yml',
            'Jenkinsfile',
            '.circleci/config.yml'
        ]
        return any((repo_dir / ci_file).exists() for ci_file in ci_files)

    def _has_linting_config(self, repo_dir: Path) -> bool:
        """Check if the repository has linting configuration."""
        lint_files = [
            '.pylintrc', '.flake8', 'pyproject.toml', 'setup.cfg',
            '.eslintrc.js', '.eslintrc.json', '.eslintrc',
            'tslint.json', '.prettier'
        ]
        return any((repo_dir / lint_file).exists() for lint_file in lint_files)

    def _has_documentation(self, repo_dir: Path) -> bool:
        """Check if the repository has documentation."""
        doc_indicators = [
            'README.md', 'README.rst', 'README.txt', 'README',
            'docs', 'documentation', 'wiki'
        ]
        return any((repo_dir / doc).exists() for doc in doc_indicators)

# Global repository service instance
repository_service = RepositoryService()
