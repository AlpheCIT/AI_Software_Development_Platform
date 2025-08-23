#!/usr/bin/env python3
"""
Enhanced AST Parser Service - AI-Powered Code Refactoring System
Integrates purpose extraction and multi-dimensional embedding generation

This service extends the basic AST parsing to include:
- Semantic purpose extraction
- Multi-dimensional embeddings
- Enhanced code analysis
- Graph relationship building
"""

import ast
import os
import json
import logging
import hashlib
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import asdict

# Local imports
from api.services.purpose_extractor import PurposeExtractor, PurposeAnalysis
from api.services.embedding_generator import MultiDimensionalEmbeddingEngine, CodeEmbeddings

try:
    from arango import ArangoClient
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False

logger = logging.getLogger(__name__)

class EnhancedASTParserService:
    """Enhanced AST parser with AI-powered semantic analysis."""
    
    def __init__(self, db=None, config: Optional[Dict[str, Any]] = None):
        self.db = db
        self.config = config or {}
        self.parsed_files = set()
        
        # Initialize AI components
        self.purpose_extractor = PurposeExtractor()
        self.embedding_engine = MultiDimensionalEmbeddingEngine(config.get('embeddings', {}))
        
        # Cache for analysis results
        self.analysis_cache = {}
        
        logger.info("Initialized EnhancedASTParserService with AI components")
    
    def parse_python_file(self, file_path: str, repository_id: str, file_content: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Parse a Python file and extract enhanced AST nodes with AI analysis."""
        try:
            # Parse AST
            tree = ast.parse(file_content, filename=file_path)
            
            # Extract file-level context
            file_context = self._extract_file_context(file_path, file_content, tree)
            
            nodes = []
            relationships = []
            
            # Process each significant AST node
            for node in ast.walk(tree):
                if self._is_significant_node(node):
                    # Create enhanced AST node with AI analysis
                    enhanced_node = self._create_enhanced_ast_node(
                        node, file_path, repository_id, file_context
                    )
                    
                    if enhanced_node:
                        nodes.append(enhanced_node)
                        
                        # Extract relationships for this node
                        node_relationships = self._extract_enhanced_relationships(
                            node, file_path, repository_id, enhanced_node['_key']
                        )
                        relationships.extend(node_relationships)
            
            # Add file-level relationships
            file_relationships = self._extract_file_relationships(
                tree, file_path, repository_id, nodes
            )
            relationships.extend(file_relationships)
            
            logger.info(f"Parsed {file_path}: {len(nodes)} nodes, {len(relationships)} relationships")
            return nodes, relationships
            
        except SyntaxError as e:
            logger.warning(f"Syntax error in {file_path}: {e}")
            return [], []
        except Exception as e:
            logger.error(f"Error parsing {file_path}: {e}")
            return [], []
    
    def _extract_file_context(self, file_path: str, file_content: str, tree: ast.AST) -> Dict[str, Any]:
        """Extract file-level context for analysis."""
        context = {
            'file_path': file_path,
            'file_size': len(file_content),
            'line_count': len(file_content.splitlines()),
            'imports': [],
            'global_variables': [],
            'functions': [],
            'classes': []
        }
        
        # Extract imports
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    context['imports'].append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ''
                for alias in node.names:
                    context['imports'].append(f"{module}.{alias.name}")
        
        # Extract top-level definitions
        for node in tree.body:
            if isinstance(node, ast.FunctionDef):
                context['functions'].append(node.name)
            elif isinstance(node, ast.ClassDef):
                context['classes'].append(node.name)
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        context['global_variables'].append(target.id)
        
        return context
    
    def _is_significant_node(self, node: ast.AST) -> bool:
        """Check if AST node is significant for analysis."""
        significant_types = (
            ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef,
            ast.Import, ast.ImportFrom
        )
        return isinstance(node, significant_types)
    
    def _create_enhanced_ast_node(self, node: ast.AST, file_path: str, 
                                repository_id: str, file_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create enhanced AST node with AI analysis."""
        
        # Basic node information
        node_info = self._extract_basic_node_info(node, file_path, repository_id)
        if not node_info:
            return None
        
        # Extract structural features
        structural_features = self._extract_structural_features(node)
        
        # Build context for purpose extraction
        purpose_context = {
            **file_context,
            'node_type': node_info['type'],
            'node_name': node_info['name']
        }
        
        # Extract purpose using AI
        purpose_analysis = self.purpose_extractor.extract_purpose(node, purpose_context)
        
        # Prepare data for embeddings
        purpose_data = asdict(purpose_analysis)
        context_data = self._prepare_context_data(file_context, node_info, structural_features)
        domain_data = self._prepare_domain_data(file_context, purpose_analysis)
        
        # Generate embeddings
        embeddings = self.embedding_engine.generate_all_embeddings(
            purpose_data=purpose_data,
            structural_features=structural_features,
            context_data=context_data,
            domain_data=domain_data
        )
        
        # Calculate additional metrics
        metrics = self._calculate_enhanced_metrics(node, structural_features)
        
        # Build enhanced node document
        enhanced_node = {
            **node_info,
            "embeddings": {
                "code": embeddings.code,
                "purpose": embeddings.purpose,
                "context": embeddings.context,
                "domain": embeddings.domain
            },
            "purpose": purpose_data,
            "structural_features": structural_features,
            "metrics": metrics,
            "metadata": {
                **node_info.get('metadata', {}),
                "analysis_timestamp": datetime.now().isoformat(),
                "embedding_metadata": embeddings.embedding_metadata,
                "analysis_version": "2.0"
            }
        }
        
        return enhanced_node
    
    def _extract_basic_node_info(self, node: ast.AST, file_path: str, repository_id: str) -> Optional[Dict[str, Any]]:
        """Extract basic AST node information."""
        node_types = {
            ast.FunctionDef: "function",
            ast.AsyncFunctionDef: "async_function", 
            ast.ClassDef: "class",
            ast.Import: "import",
            ast.ImportFrom: "import_from"
        }
        
        node_type = node_types.get(type(node))
        if not node_type:
            return None
        
        # Generate unique key
        node_name = getattr(node, 'name', f"{node_type}_{getattr(node, 'lineno', 0)}")
        node_key = f"{node_type}_{node_name}_{os.path.basename(file_path)}_{getattr(node, 'lineno', 0)}"
        node_key = hashlib.md5(node_key.encode()).hexdigest()[:16]
        
        return {
            "_key": node_key,
            "type": node_type,
            "name": node_name,
            "file_path": file_path,
            "repository_id": repository_id,
            "language": "python",
            "line_start": getattr(node, 'lineno', 0),
            "line_end": getattr(node, 'end_lineno', getattr(node, 'lineno', 0)),
            "column_start": getattr(node, 'col_offset', 0),
            "column_end": getattr(node, 'end_col_offset', 0)
        }
    
    def _extract_structural_features(self, node: ast.AST) -> Dict[str, Any]:
        """Extract detailed structural features from AST node."""
        features = {
            'node_types': {},
            'complexity_metrics': {},
            'variable_count': 0,
            'call_count': 0,
            'return_count': 0,
            'parameter_count': 0,
            'decorator_count': 0
        }
        
        # Count different node types
        for child in ast.walk(node):
            node_type = type(child).__name__
            features['node_types'][node_type] = features['node_types'].get(node_type, 0) + 1
        
        # Extract function-specific features
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            features['parameter_count'] = len(node.args.args)
            features['decorator_count'] = len(node.decorator_list)
            
            # Count returns
            for child in ast.walk(node):
                if isinstance(child, ast.Return):
                    features['return_count'] += 1
                elif isinstance(child, ast.Call):
                    features['call_count'] += 1
        
        # Calculate complexity metrics
        features['complexity_metrics'] = self._calculate_complexity_metrics(node)
        
        return features
    
    def _calculate_complexity_metrics(self, node: ast.AST) -> Dict[str, Any]:
        """Calculate complexity metrics for the node."""
        metrics = {
            'cyclomatic_complexity': 1,  # Base complexity
            'nesting_depth': 0,
            'cognitive_complexity': 0
        }
        
        # Calculate cyclomatic complexity
        decision_nodes = (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.Assert)
        for child in ast.walk(node):
            if isinstance(child, decision_nodes):
                metrics['cyclomatic_complexity'] += 1
            elif isinstance(child, ast.BoolOp):  # and, or
                metrics['cyclomatic_complexity'] += len(child.values) - 1
            elif isinstance(child, (ast.ListComp, ast.DictComp, ast.SetComp)):
                metrics['cyclomatic_complexity'] += 1
        
        # Calculate nesting depth
        metrics['nesting_depth'] = self._calculate_nesting_depth(node)
        
        # Cognitive complexity (simplified)
        metrics['cognitive_complexity'] = self._calculate_cognitive_complexity(node)
        
        return metrics
    
    def _calculate_nesting_depth(self, node: ast.AST, current_depth: int = 0) -> int:
        """Calculate maximum nesting depth."""
        max_depth = current_depth
        
        nesting_nodes = (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
        
        for child in ast.iter_child_nodes(node):
            if isinstance(child, nesting_nodes):
                child_depth = self._calculate_nesting_depth(child, current_depth + 1)
                max_depth = max(max_depth, child_depth)
            else:
                child_depth = self._calculate_nesting_depth(child, current_depth)
                max_depth = max(max_depth, child_depth)
        
        return max_depth
    
    def _calculate_cognitive_complexity(self, node: ast.AST) -> int:
        """Calculate cognitive complexity (simplified version)."""
        complexity = 0
        
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For)):
                complexity += 1
            elif isinstance(child, ast.Try):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                complexity += len(child.values) - 1
            elif isinstance(child, (ast.Break, ast.Continue)):
                complexity += 1
        
        return complexity
    
    def _prepare_context_data(self, file_context: Dict[str, Any], 
                            node_info: Dict[str, Any], 
                            structural_features: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare context data for embedding generation."""
        return {
            'file_path': file_context['file_path'],
            'imports': file_context['imports'],
            'call_patterns': [],  # Could be enhanced with call graph analysis
            'dependencies': {
                'incoming': 0,  # Could be calculated from usage analysis
                'outgoing': structural_features.get('call_count', 0)
            },
            'repository_stats': {
                'file_size_percentile': 0.5,  # Could be calculated from repo analysis
                'complexity_percentile': 0.5
            }
        }
    
    def _prepare_domain_data(self, file_context: Dict[str, Any], 
                           purpose_analysis: PurposeAnalysis) -> Dict[str, Any]:
        """Prepare domain data for embedding generation."""
        return {
            'file_path': file_context['file_path'],
            'names': file_context['functions'] + file_context['classes'],
            'imports': file_context['imports'],
            'purpose': asdict(purpose_analysis)
        }
    
    def _calculate_enhanced_metrics(self, node: ast.AST, structural_features: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate enhanced metrics for the node."""
        metrics = {
            'lines_of_code': getattr(node, 'end_lineno', 0) - getattr(node, 'lineno', 0) + 1,
            'complexity': structural_features['complexity_metrics']['cyclomatic_complexity'],
            'cognitive_complexity': structural_features['complexity_metrics']['cognitive_complexity'],
            'nesting_depth': structural_features['complexity_metrics']['nesting_depth'],
            'coupling': 0,  # Could be enhanced with dependency analysis
            'cohesion': 0.5,  # Could be calculated based on variable usage
            'maintainability_index': 0.0
        }
        
        # Calculate maintainability index (simplified)
        loc = metrics['lines_of_code']
        cc = metrics['complexity']
        
        if loc > 0:
            # Simplified maintainability index calculation
            mi = max(0, (171 - 5.2 * np.log(loc) - 0.23 * cc - 16.2 * np.log(loc/10)) * 100 / 171)
            metrics['maintainability_index'] = mi
        
        return metrics
    
    def _extract_enhanced_relationships(self, node: ast.AST, file_path: str, 
                                      repository_id: str, node_key: str) -> List[Dict[str, Any]]:
        """Extract enhanced relationships from AST node."""
        relationships = []
        
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Function call relationships
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    relationship = self._create_call_relationship(
                        child, node_key, file_path, repository_id
                    )
                    if relationship:
                        relationships.append(relationship)
        
        elif isinstance(node, ast.ClassDef):
            # Inheritance relationships
            for base in node.bases:
                relationship = self._create_inheritance_relationship(
                    base, node_key, file_path, repository_id
                )
                if relationship:
                    relationships.append(relationship)
        
        return relationships
    
    def _create_call_relationship(self, call_node: ast.Call, from_key: str, 
                                file_path: str, repository_id: str) -> Optional[Dict[str, Any]]:
        """Create function call relationship."""
        # Extract called function name
        called_name = None
        if isinstance(call_node.func, ast.Name):
            called_name = call_node.func.id
        elif isinstance(call_node.func, ast.Attribute):
            called_name = call_node.func.attr
        
        if not called_name:
            return None
        
        # Generate relationship key
        rel_key = hashlib.md5(f"{from_key}_calls_{called_name}".encode()).hexdigest()[:16]
        
        return {
            "_key": rel_key,
            "_from": f"codeunits/{from_key}",
            "_to": f"codeunits/{called_name}",  # This would need proper resolution
            "relationship_type": "CALLS",
            "strength": 1.0,
            "file_path": file_path,
            "repository_id": repository_id,
            "metadata": {
                "line_number": getattr(call_node, 'lineno', 0),
                "call_type": "direct",
                "created_at": datetime.now().isoformat()
            }
        }
    
    def _create_inheritance_relationship(self, base_node: ast.AST, from_key: str,
                                       file_path: str, repository_id: str) -> Optional[Dict[str, Any]]:
        """Create inheritance relationship."""
        base_name = None
        if isinstance(base_node, ast.Name):
            base_name = base_node.id
        elif isinstance(base_node, ast.Attribute):
            base_name = base_node.attr
        
        if not base_name:
            return None
        
        rel_key = hashlib.md5(f"{from_key}_inherits_{base_name}".encode()).hexdigest()[:16]
        
        return {
            "_key": rel_key,
            "_from": f"codeunits/{from_key}",
            "_to": f"codeunits/{base_name}",  # This would need proper resolution
            "relationship_type": "INHERITS_FROM",
            "strength": 1.0,
            "file_path": file_path,
            "repository_id": repository_id,
            "metadata": {
                "inheritance_type": "direct",
                "created_at": datetime.now().isoformat()
            }
        }
    
    def _extract_file_relationships(self, tree: ast.AST, file_path: str, 
                                  repository_id: str, nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract file-level relationships."""
        relationships = []
        
        # Import relationships
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                rel = self._create_import_relationship(node, file_path, repository_id)
                if rel:
                    relationships.append(rel)
        
        return relationships
    
    def _create_import_relationship(self, import_node: ast.AST, file_path: str, 
                                  repository_id: str) -> Optional[Dict[str, Any]]:
        """Create import relationship."""
        imported_modules = []
        
        if isinstance(import_node, ast.Import):
            imported_modules = [alias.name for alias in import_node.names]
        elif isinstance(import_node, ast.ImportFrom):
            module = import_node.module or ''
            imported_modules = [f"{module}.{alias.name}" for alias in import_node.names]
        
        if not imported_modules:
            return None
        
        # For simplicity, create one relationship per import statement
        rel_key = hashlib.md5(f"{file_path}_imports_{imported_modules[0]}".encode()).hexdigest()[:16]
        
        return {
            "_key": rel_key,
            "_from": f"files/{hashlib.md5(file_path.encode()).hexdigest()[:16]}",
            "_to": f"modules/{imported_modules[0].replace('.', '_')}",
            "relationship_type": "IMPORTS",
            "imported_modules": imported_modules,
            "file_path": file_path,
            "repository_id": repository_id,
            "metadata": {
                "import_type": "module" if isinstance(import_node, ast.Import) else "from",
                "line_number": getattr(import_node, 'lineno', 0),
                "created_at": datetime.now().isoformat()
            }
        }

# For backward compatibility with existing code
class ASTParserService(EnhancedASTParserService):
    """Backward compatibility wrapper."""
    
    def __init__(self, db=None):
        super().__init__(db)
        logger.warning("Using backward compatibility wrapper. Consider upgrading to EnhancedASTParserService.")

# Add numpy import at the top if not present
try:
    import numpy as np
except ImportError:
    # Fallback for maintainability index calculation
    import math
    class np:
        @staticmethod
        def log(x):
            return math.log(x)
