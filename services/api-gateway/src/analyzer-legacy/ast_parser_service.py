#!/usr/bin/env python3
"""
AST Parser Service - Populates the AST Graph Schema
Integrates with repository analysis to extract and store AST data
"""

import ast
import os
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import hashlib

try:
    from arango import ArangoClient
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ASTParserService:
    """Service to parse code files and populate AST graph schema."""
    
    def __init__(self, db=None):
        self.db = db
        self.parsed_files = set()
        
    def parse_python_file(self, file_path: str, repository_id: str, file_content: str) -> List[Dict[str, Any]]:
        """Parse a Python file and extract AST nodes."""
        try:
            tree = ast.parse(file_content, filename=file_path)
            nodes = []
            relationships = []
            
            for node in ast.walk(tree):
                ast_node = self._create_ast_node(node, file_path, repository_id)
                if ast_node:
                    nodes.append(ast_node)
                    
                    # Extract relationships
                    rels = self._extract_relationships(node, file_path, repository_id)
                    relationships.extend(rels)
            
            return nodes, relationships
            
        except SyntaxError as e:
            logger.warning(f"Syntax error in {file_path}: {e}")
            return [], []
        except Exception as e:
            logger.error(f"Error parsing {file_path}: {e}")
            return [], []
    
    def _create_ast_node(self, node: ast.AST, file_path: str, repository_id: str) -> Optional[Dict[str, Any]]:
        """Create an AST node document from Python AST node."""
        node_types = {
            ast.FunctionDef: "FunctionDeclaration",
            ast.AsyncFunctionDef: "AsyncFunctionDeclaration", 
            ast.ClassDef: "ClassDeclaration",
            ast.Import: "ImportStatement",
            ast.ImportFrom: "ImportFromStatement",
            ast.Assign: "VariableDeclaration"
        }
        
        node_type = node_types.get(type(node))
        if not node_type:
            return None
            
        # Generate unique key
        node_name = getattr(node, 'name', f"{node_type}_{node.lineno}")
        node_key = f"{node_type}_{node_name}_{os.path.basename(file_path)}_{node.lineno}"
        node_key = hashlib.md5(node_key.encode()).hexdigest()[:16]
        
        ast_node = {
            "_key": node_key,
            "type": node_type,
            "name": node_name,
            "file_path": file_path,
            "repository_id": repository_id,
            "language": "python",
            "line_start": getattr(node, 'lineno', 0),
            "line_end": getattr(node, 'end_lineno', getattr(node, 'lineno', 0)),
            "column_start": getattr(node, 'col_offset', 0),
            "column_end": getattr(node, 'end_col_offset', 0),
            "analysis_timestamp": datetime.now().isoformat()
        }
        
        # Add type-specific metadata
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            ast_node["metadata"] = {
                "parameters": [arg.arg for arg in node.args.args],
                "is_async": isinstance(node, ast.AsyncFunctionDef),
                "decorators": [self._get_decorator_name(d) for d in node.decorator_list],
                "docstring": ast.get_docstring(node)
            }
            
            # Calculate basic complexity
            ast_node["complexity"] = {
                "cyclomatic": self._calculate_cyclomatic_complexity(node),
                "nesting_depth": self._calculate_nesting_depth(node)
            }
            
        elif isinstance(node, ast.ClassDef):
            ast_node["metadata"] = {
                "base_classes": [self._get_name(base) for base in node.bases],
                "decorators": [self._get_decorator_name(d) for d in node.decorator_list],
                "docstring": ast.get_docstring(node),
                "methods": [n.name for n in node.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
            }
            
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            if isinstance(node, ast.Import):
                ast_node["metadata"] = {
                    "modules": [alias.name for alias in node.names]
                }
            else:
                ast_node["metadata"] = {
                    "module": node.module,
                    "names": [alias.name for alias in node.names],
                    "level": node.level
                }
        
        return ast_node
    
    def _extract_relationships(self, node: ast.AST, file_path: str, repository_id: str) -> List[Dict[str, Any]]:
        """Extract relationships from AST node."""
        relationships = []
        
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Generate source node key
            source_key = f"{type(node).__name__}_{node.name}_{os.path.basename(file_path)}_{node.lineno}"
            source_key = hashlib.md5(source_key.encode()).hexdigest()[:16]
            
            # Find function calls
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    func_name = self._get_name(child.func)
                    if func_name and func_name != node.name:  # Avoid self-reference
                        # Create a target key (we'll need to resolve this later)
                        target_key = f"call_{func_name}_{child.lineno}"
                        target_key = hashlib.md5(target_key.encode()).hexdigest()[:16]
                        
                        relationships.append({
                            "_from": f"ast_nodes/{source_key}",
                            "_to": f"ast_nodes/{target_key}",
                            "relationship_type": "calls",
                            "source_function": node.name,
                            "target_function": func_name,
                            "source_file": file_path,
                            "call_line": child.lineno,
                            "confidence": 0.8,  # Medium confidence for simple name matching
                            "analysis_timestamp": datetime.now().isoformat()
                        })
        
        return relationships
    
    def _get_name(self, node: ast.AST) -> str:
        """Get name from AST node."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_name(node.value)}.{node.attr}"
        elif isinstance(node, ast.Constant):
            return str(node.value)
        return ""
    
    def _get_decorator_name(self, node: ast.AST) -> str:
        """Get decorator name from AST node."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_name(node.value)}.{node.attr}"
        return ""
    
    def _calculate_cyclomatic_complexity(self, node: ast.AST) -> int:
        """Calculate basic cyclomatic complexity."""
        complexity = 1  # Base complexity
        
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor, 
                                ast.With, ast.AsyncWith, ast.Try, ast.ExceptHandler)):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                complexity += len(child.values) - 1
                
        return complexity
    
    def _calculate_nesting_depth(self, node: ast.AST, current_depth: int = 0) -> int:
        """Calculate maximum nesting depth."""
        max_depth = current_depth
        
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor,
                                ast.With, ast.AsyncWith, ast.Try, ast.FunctionDef, ast.AsyncFunctionDef)):
                child_depth = self._calculate_nesting_depth(child, current_depth + 1)
                max_depth = max(max_depth, child_depth)
                
        return max_depth
    
    def analyze_repository(self, repository_path: str, repository_id: str) -> Dict[str, Any]:
        """Analyze all Python files in a repository."""
        if not self.db:
            logger.error("Database connection required")
            return {"success": False, "error": "No database connection"}
        
        results = {
            "success": True,
            "repository_id": repository_id,
            "files_processed": 0,
            "nodes_created": 0,
            "relationships_created": 0,
            "errors": []
        }
        
        try:
            ast_collection = self.db.collection('ast_nodes')
            rel_collection = self.db.collection('relationships')
            files_collection = self.db.collection('code_files')
            
            # Walk through repository
            for root, dirs, files in os.walk(repository_path):
                # Skip common non-source directories
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['__pycache__', 'node_modules', 'venv', 'env']]
                
                for file in files:
                    if file.endswith('.py'):
                        file_path = os.path.join(root, file)
                        relative_path = os.path.relpath(file_path, repository_path)
                        
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            # Parse AST
                            nodes, relationships = self.parse_python_file(relative_path, repository_id, content)
                            
                            # Store nodes
                            for node in nodes:
                                try:
                                    ast_collection.insert(node)
                                    results["nodes_created"] += 1
                                except Exception as e:
                                    logger.warning(f"Failed to insert node: {e}")
                            
                            # Store relationships
                            for rel in relationships:
                                try:
                                    rel_collection.insert(rel)
                                    results["relationships_created"] += 1
                                except Exception as e:
                                    logger.warning(f"Failed to insert relationship: {e}")
                            
                            # Store file metadata
                            file_doc = {
                                "_key": hashlib.md5(relative_path.encode()).hexdigest()[:16],
                                "file_path": relative_path,
                                "repository_id": repository_id,
                                "language": "python",
                                "size_bytes": len(content),
                                "lines_of_code": len(content.splitlines()),
                                "last_analyzed": datetime.now().isoformat(),
                                "ast_nodes_count": len(nodes)
                            }
                            
                            try:
                                files_collection.insert(file_doc)
                            except Exception as e:
                                logger.warning(f"Failed to insert file doc: {e}")
                            
                            results["files_processed"] += 1
                            
                        except Exception as e:
                            error_msg = f"Error processing {relative_path}: {e}"
                            logger.error(error_msg)
                            results["errors"].append(error_msg)
            
            logger.info(f"Repository analysis complete: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Repository analysis failed: {e}")
            results["success"] = False
            results["error"] = str(e)
            return results

# Quick demo function to populate some sample data
def populate_sample_data():
    """Populate sample AST data for demonstration."""
    if not ARANGO_AVAILABLE:
        print("ArangoDB not available")
        return False
    
    try:
        # Connect to database
        client = ArangoClient(hosts='http://localhost:8529')
        db = client.db('code_management', username='root', password='password')
        
        parser = ASTParserService(db)
        
        # Sample Python code to analyze
        sample_files = [
            {
                "path": "main.py",
                "content": '''
def calculate_metrics(file_path, options={}):
    """Calculate code metrics for the given file."""
    result = {}
    
    if not file_path:
        return None
    
    data = parse_file(file_path)
    if data:
        result['complexity'] = analyze_complexity(data)
        result['quality'] = check_quality(data)
    
    return result

def parse_file(file_path):
    """Parse the specified file."""
    try:
        with open(file_path, 'r') as f:
            return f.read()
    except Exception as e:
        print(f"Error: {e}")
        return None

class CodeAnalyzer:
    """Main code analyzer class."""
    
    def __init__(self, config):
        self.config = config
        self.results = []
    
    def analyze(self, files):
        """Analyze multiple files."""
        for file in files:
            metrics = calculate_metrics(file)
            if metrics:
                self.results.append(metrics)
        return self.results
'''
            },
            {
                "path": "utils.py", 
                "content": '''
import os
import json
from pathlib import Path

def analyze_complexity(data):
    """Analyze code complexity."""
    lines = data.split('\\n')
    complexity = 0
    
    for line in lines:
        if 'if ' in line or 'while ' in line or 'for ' in line:
            complexity += 1
    
    return complexity

def check_quality(data):
    """Check code quality metrics."""
    issues = []
    
    if len(data) > 10000:
        issues.append("File too large")
    
    if 'TODO' in data:
        issues.append("Contains TODO items")
    
    return {
        'issues': issues,
        'score': max(0, 100 - len(issues) * 10)
    }

def load_config(config_file):
    """Load configuration from file."""
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except Exception:
        return {}
'''
            }
        ]
        
        # Parse and store sample files
        total_nodes = 0
        total_relationships = 0
        stored_nodes = {}  # Track stored nodes for relationships
        
        for file_info in sample_files:
            nodes, relationships = parser.parse_python_file(
                file_info["path"], 
                "sample-repo", 
                file_info["content"]
            )
            
            # Store nodes
            ast_collection = db.collection('ast_nodes')
            for node in nodes:
                try:
                    ast_collection.insert(node)
                    stored_nodes[node['name']] = node['_key']
                    total_nodes += 1
                except Exception as e:
                    print(f"Failed to insert node: {e}")
        
        # Create some manual relationships for demonstration
        rel_collection = db.collection('relationships')
        
        # Get some actual node keys from database
        ast_nodes = list(ast_collection.all())
        if len(ast_nodes) >= 2:
            
            # Find specific functions to create realistic relationships
            calculate_metrics_node = None
            parse_file_node = None
            analyze_complexity_node = None
            
            for node in ast_nodes:
                if node['name'] == 'calculate_metrics':
                    calculate_metrics_node = node
                elif node['name'] == 'parse_file':
                    parse_file_node = node
                elif node['name'] == 'analyze_complexity':
                    analyze_complexity_node = node
            
            # Create realistic function call relationships
            sample_relationships = []
            
            if calculate_metrics_node and parse_file_node:
                sample_relationships.append({
                    "_from": f"ast_nodes/{calculate_metrics_node['_key']}",
                    "_to": f"ast_nodes/{parse_file_node['_key']}",
                    "relationship_type": "calls",
                    "source_function": "calculate_metrics",
                    "target_function": "parse_file",
                    "source_file": "main.py",
                    "target_file": "main.py",
                    "call_count": 1,
                    "confidence": 0.95,
                    "analysis_timestamp": datetime.now().isoformat()
                })
            
            if calculate_metrics_node and analyze_complexity_node:
                sample_relationships.append({
                    "_from": f"ast_nodes/{calculate_metrics_node['_key']}",
                    "_to": f"ast_nodes/{analyze_complexity_node['_key']}",
                    "relationship_type": "calls",
                    "source_function": "calculate_metrics",
                    "target_function": "analyze_complexity",
                    "source_file": "main.py",
                    "target_file": "utils.py",
                    "call_count": 1,
                    "confidence": 0.95,
                    "analysis_timestamp": datetime.now().isoformat()
                })
            
            # Store sample relationships
            for rel in sample_relationships:
                try:
                    rel_collection.insert(rel)
                    total_relationships += 1
                except Exception as e:
                    print(f"Failed to insert sample relationship: {e}")
        
        print(f"✅ Sample data populated:")
        print(f"   - {total_nodes} AST nodes created")
        print(f"   - {total_relationships} relationships created")
        print(f"   - Data available in AST Graph Dashboard")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to populate sample data: {e}")
        return False

if __name__ == "__main__":
    print("AST Parser Service - Populating Sample Data")
    print("=" * 50)
    success = populate_sample_data()
    if success:
        print("\n🎉 Sample data ready! Visit http://localhost:3002/ast-graph to explore.")
    else:
        print("\n❌ Failed to populate sample data.")
