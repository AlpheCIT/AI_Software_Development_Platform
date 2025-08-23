#!/usr/bin/env python3
"""
Multi-Language AST Analyzer
Enhanced AST analysis beyond current Python-only support
Extracted and improved from repository_analyzer.py
"""

import ast
import json
import logging
from typing import Dict, List, Any, Optional, Set, Union
from datetime import datetime
from pathlib import Path
import hashlib

# Language-specific parsers
try:
    import esprima  # JavaScript/TypeScript
    ESPRIMA_AVAILABLE = True
except ImportError:
    ESPRIMA_AVAILABLE = False

try:
    import javalang  # Java
    JAVALANG_AVAILABLE = True
except ImportError:
    JAVALANG_AVAILABLE = False

logger = logging.getLogger(__name__)

class MultiLanguageASTAnalyzer:
    """
    Enhanced AST analysis beyond current Python-only support
    Supports multiple programming languages with semantic relationship extraction
    """
    
    def __init__(self):
        """Initialize the multi-language AST analyzer."""
        
        # Supported languages and their configurations
        self.supported_languages = {
            'python': {
                'extensions': ['.py'],
                'parser': self._parse_python,
                'complexity_calculator': self._calculate_python_complexity,
                'dependency_extractor': self._extract_python_dependencies
            },
            'javascript': {
                'extensions': ['.js', '.jsx', '.mjs'],
                'parser': self._parse_javascript,
                'complexity_calculator': self._calculate_js_complexity,
                'dependency_extractor': self._extract_js_dependencies,
                'available': ESPRIMA_AVAILABLE
            },
            'typescript': {
                'extensions': ['.ts', '.tsx'],
                'parser': self._parse_typescript,
                'complexity_calculator': self._calculate_ts_complexity,
                'dependency_extractor': self._extract_ts_dependencies,
                'available': ESPRIMA_AVAILABLE
            },
            'java': {
                'extensions': ['.java'],
                'parser': self._parse_java,
                'complexity_calculator': self._calculate_java_complexity,
                'dependency_extractor': self._extract_java_dependencies,
                'available': JAVALANG_AVAILABLE
            }
        }
        
        # AST node type mappings for unified analysis
        self.node_type_mappings = {
            'python': {
                ast.FunctionDef: 'function',
                ast.AsyncFunctionDef: 'async_function',
                ast.ClassDef: 'class',
                ast.Import: 'import',
                ast.ImportFrom: 'import_from',
                ast.If: 'conditional',
                ast.For: 'loop',
                ast.While: 'loop',
                ast.Try: 'exception_handling',
                ast.With: 'context_manager'
            }
        }
        
        # Complexity metrics configuration
        self.complexity_weights = {
            'cyclomatic': {
                'conditional': 1,
                'loop': 1,
                'exception_handling': 1,
                'logical_operator': 1
            },
            'cognitive': {
                'nesting_increment': 1,
                'break_flow': 1,
                'recursion': 2
            }
        }
    
    async def analyze_file(self, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a single file and extract AST information."""
        try:
            file_path = file_info['file_path']
            content = file_info['content']
            extension = file_info.get('extension', Path(file_path).suffix.lower())
            
            # Determine language
            language = self._detect_language(extension)
            
            if not language:
                return {
                    'success': False,
                    'error': f'Unsupported file extension: {extension}',
                    'nodes': []
                }
            
            # Check if language parser is available
            lang_config = self.supported_languages[language]
            if not lang_config.get('available', True):
                return {
                    'success': False,
                    'error': f'Parser for {language} is not available',
                    'nodes': []
                }
            
            # Parse the file
            parse_result = await lang_config['parser'](content, file_info)
            
            if not parse_result['success']:
                return parse_result
            
            # Extract AST nodes
            nodes = self._extract_ast_nodes(parse_result['ast'], language, file_info)
            
            # Calculate complexity metrics
            complexity_metrics = await lang_config['complexity_calculator'](
                parse_result['ast'], nodes
            )
            
            # Extract dependencies
            dependencies = await lang_config['dependency_extractor'](
                parse_result['ast'], content, file_info
            )
            
            # Enhance nodes with additional metadata
            enhanced_nodes = self._enhance_nodes(nodes, complexity_metrics, dependencies)
            
            return {
                'success': True,
                'language': language,
                'nodes': enhanced_nodes,
                'complexity_metrics': complexity_metrics,
                'dependencies': dependencies,
                'node_count': len(enhanced_nodes)
            }
            
        except Exception as e:
            logger.error(f"AST analysis failed for {file_info.get('file_path', 'unknown')}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'nodes': []
            }
    
    def _detect_language(self, extension: str) -> Optional[str]:
        """Detect programming language from file extension."""
        for language, config in self.supported_languages.items():
            if extension in config['extensions']:
                return language
        return None
    
    async def _parse_python(self, content: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Python code using the built-in AST module."""
        try:
            tree = ast.parse(content)
            return {
                'success': True,
                'ast': tree,
                'parser_type': 'python_ast'
            }
        except SyntaxError as e:
            return {
                'success': False,
                'error': f'Python syntax error: {str(e)}',
                'ast': None
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Python parsing error: {str(e)}',
                'ast': None
            }
    
    async def _parse_javascript(self, content: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse JavaScript code using esprima."""
        if not ESPRIMA_AVAILABLE:
            return {
                'success': False,
                'error': 'Esprima not available for JavaScript parsing',
                'ast': None
            }
        
        try:
            tree = esprima.parse(content, {
                'range': True,
                'loc': True,
                'attachComments': True
            })
            return {
                'success': True,
                'ast': tree,
                'parser_type': 'esprima'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'JavaScript parsing error: {str(e)}',
                'ast': None
            }
    
    async def _parse_typescript(self, content: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse TypeScript code (using JavaScript parser for now)."""
        # TypeScript parsing would require a TypeScript-specific parser
        # For now, we'll use the JavaScript parser for basic structure
        return await self._parse_javascript(content, file_info)
    
    async def _parse_java(self, content: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Java code using javalang."""
        if not JAVALANG_AVAILABLE:
            return {
                'success': False,
                'error': 'Javalang not available for Java parsing',
                'ast': None
            }
        
        try:
            tree = javalang.parse.parse(content)
            return {
                'success': True,
                'ast': tree,
                'parser_type': 'javalang'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Java parsing error: {str(e)}',
                'ast': None
            }
    
    def _extract_ast_nodes(self, tree: Any, language: str, file_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract AST nodes from the parsed tree."""
        nodes = []
        
        if language == 'python':
            nodes = self._extract_python_nodes(tree, file_info)
        elif language in ['javascript', 'typescript']:
            nodes = self._extract_js_nodes(tree, file_info)
        elif language == 'java':
            nodes = self._extract_java_nodes(tree, file_info)
        
        return nodes
    
    def _extract_python_nodes(self, tree: ast.AST, file_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract nodes from Python AST."""
        nodes = []
        
        class NodeVisitor(ast.NodeVisitor):
            def __init__(self, analyzer):
                self.analyzer = analyzer
                self.depth = 0
                self.parent_stack = []
            
            def visit(self, node):
                # Create node information
                node_info = self._create_python_node_info(node, file_info)
                if node_info:
                    node_info['depth'] = self.depth
                    node_info['parent_id'] = self.parent_stack[-1]['id'] if self.parent_stack else None
                    nodes.append(node_info)
                    
                    # Update parent stack
                    self.parent_stack.append(node_info)
                
                # Visit children with increased depth
                self.depth += 1
                self.generic_visit(node)
                self.depth -= 1
                
                # Remove from parent stack
                if node_info and self.parent_stack and self.parent_stack[-1]['id'] == node_info['id']:
                    self.parent_stack.pop()
            
            def _create_python_node_info(self, node: ast.AST, file_info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
                """Create node information for Python AST node."""
                node_type = type(node)
                mapped_type = self.analyzer.node_type_mappings['python'].get(node_type)
                
                if not mapped_type:
                    return None
                
                # Generate unique node ID
                node_id = self.analyzer._generate_node_id(node, file_info)
                
                # Basic node information
                node_info = {
                    'id': node_id,
                    'type': mapped_type,
                    'language': 'python',
                    'original_type': node_type.__name__,
                    'start_line': getattr(node, 'lineno', 0),
                    'end_line': getattr(node, 'end_lineno', getattr(node, 'lineno', 0)),
                    'start_col': getattr(node, 'col_offset', 0),
                    'end_col': getattr(node, 'end_col_offset', 0)
                }
                
                # Type-specific information
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    node_info.update({
                        'name': node.name,
                        'arguments': [arg.arg for arg in node.args.args],
                        'decorators': [self.analyzer._ast_to_string(dec) for dec in node.decorator_list],
                        'is_async': isinstance(node, ast.AsyncFunctionDef),
                        'returns': self.analyzer._ast_to_string(node.returns) if node.returns else None
                    })
                
                elif isinstance(node, ast.ClassDef):
                    node_info.update({
                        'name': node.name,
                        'bases': [self.analyzer._ast_to_string(base) for base in node.bases],
                        'decorators': [self.analyzer._ast_to_string(dec) for dec in node.decorator_list],
                        'methods': []  # Will be populated by child nodes
                    })
                
                elif isinstance(node, (ast.Import, ast.ImportFrom)):
                    if isinstance(node, ast.Import):
                        node_info.update({
                            'modules': [alias.name for alias in node.names],
                            'import_type': 'import'
                        })
                    else:
                        node_info.update({
                            'module': node.module,
                            'names': [alias.name for alias in node.names],
                            'import_type': 'from_import',
                            'level': node.level
                        })
                
                # Add content hash for deduplication
                node_info['content_hash'] = self.analyzer._calculate_node_hash(node_info)
                
                return node_info
        
        visitor = NodeVisitor(self)
        visitor.visit(tree)
        
        return nodes
    
    def _extract_js_nodes(self, tree: Dict[str, Any], file_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract nodes from JavaScript/TypeScript AST."""
        nodes = []
        
        def traverse_js_node(node, depth=0, parent_id=None):
            if not isinstance(node, dict) or 'type' not in node:
                return
            
            # Create node information
            node_info = self._create_js_node_info(node, file_info, depth, parent_id)
            if node_info:
                nodes.append(node_info)
                current_id = node_info['id']
            else:
                current_id = parent_id
            
            # Traverse child nodes
            for key, value in node.items():
                if key in ['type', 'range', 'loc']:
                    continue
                
                if isinstance(value, dict):
                    traverse_js_node(value, depth + 1, current_id)
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict):
                            traverse_js_node(item, depth + 1, current_id)
        
        traverse_js_node(tree)
        return nodes
    
    def _create_js_node_info(self, node: Dict[str, Any], file_info: Dict[str, Any], 
                           depth: int, parent_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Create node information for JavaScript/TypeScript AST node."""
        node_type = node.get('type')
        
        # Map JavaScript node types to our unified types
        js_type_mapping = {
            'FunctionDeclaration': 'function',
            'FunctionExpression': 'function',
            'ArrowFunctionExpression': 'function',
            'ClassDeclaration': 'class',
            'MethodDefinition': 'method',
            'ImportDeclaration': 'import',
            'IfStatement': 'conditional',
            'ForStatement': 'loop',
            'WhileStatement': 'loop',
            'TryStatement': 'exception_handling'
        }
        
        mapped_type = js_type_mapping.get(node_type)
        if not mapped_type:
            return None
        
        # Generate unique node ID
        node_id = self._generate_js_node_id(node, file_info)
        
        # Basic node information
        node_info = {
            'id': node_id,
            'type': mapped_type,
            'language': 'javascript',
            'original_type': node_type,
            'depth': depth,
            'parent_id': parent_id
        }
        
        # Extract location information
        loc = node.get('loc', {})
        if loc:
            start = loc.get('start', {})
            end = loc.get('end', {})
            node_info.update({
                'start_line': start.get('line', 0),
                'end_line': end.get('line', 0),
                'start_col': start.get('column', 0),
                'end_col': end.get('column', 0)
            })
        
        # Type-specific information
        if mapped_type == 'function':
            node_info.update({
                'name': node.get('id', {}).get('name', 'anonymous'),
                'is_async': node.get('async', False),
                'is_generator': node.get('generator', False)
            })
        
        elif mapped_type == 'class':
            node_info.update({
                'name': node.get('id', {}).get('name', 'anonymous')
            })
        
        elif mapped_type == 'import':
            node_info.update({
                'source': node.get('source', {}).get('value', ''),
                'specifiers': [spec.get('local', {}).get('name', '') 
                              for spec in node.get('specifiers', [])]
            })
        
        # Add content hash
        node_info['content_hash'] = self._calculate_node_hash(node_info)
        
        return node_info
    
    def _extract_java_nodes(self, tree: Any, file_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract nodes from Java AST."""
        # Java node extraction would be implemented here
        # This is a placeholder for Java support
        return []
    
    async def _calculate_python_complexity(self, tree: ast.AST, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate complexity metrics for Python code."""
        complexity = {
            'cyclomatic_complexity': 0,
            'cognitive_complexity': 0,
            'halstead_metrics': {},
            'maintainability_index': 0
        }
        
        # Count complexity-contributing nodes
        for node_info in nodes:
            node_type = node_info['type']
            
            if node_type in ['conditional', 'loop', 'exception_handling']:
                complexity['cyclomatic_complexity'] += 1
                
                # Cognitive complexity includes nesting penalty
                nesting_penalty = node_info.get('depth', 0)
                complexity['cognitive_complexity'] += 1 + nesting_penalty
        
        return complexity
    
    async def _calculate_js_complexity(self, tree: Dict[str, Any], nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate complexity metrics for JavaScript code."""
        return await self._calculate_python_complexity(None, nodes)
    
    async def _calculate_ts_complexity(self, tree: Dict[str, Any], nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate complexity metrics for TypeScript code."""
        return await self._calculate_js_complexity(tree, nodes)
    
    async def _calculate_java_complexity(self, tree: Any, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate complexity metrics for Java code."""
        return await self._calculate_python_complexity(None, nodes)
    
    async def _extract_python_dependencies(self, tree: ast.AST, content: str, file_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract dependencies from Python code."""
        dependencies = []
        
        class DependencyVisitor(ast.NodeVisitor):
            def visit_Import(self, node):
                for alias in node.names:
                    dependencies.append({
                        'type': 'import',
                        'module': alias.name,
                        'alias': alias.asname,
                        'line': node.lineno
                    })
            
            def visit_ImportFrom(self, node):
                module = node.module or ''
                for alias in node.names:
                    dependencies.append({
                        'type': 'from_import',
                        'module': module,
                        'name': alias.name,
                        'alias': alias.asname,
                        'level': node.level,
                        'line': node.lineno
                    })
        
        visitor = DependencyVisitor()
        visitor.visit(tree)
        
        return dependencies
    
    async def _extract_js_dependencies(self, tree: Dict[str, Any], content: str, file_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract dependencies from JavaScript code."""
        dependencies = []
        
        def find_imports(node):
            if isinstance(node, dict) and node.get('type') == 'ImportDeclaration':
                source = node.get('source', {}).get('value', '')
                specifiers = []
                
                for spec in node.get('specifiers', []):
                    spec_type = spec.get('type')
                    if spec_type == 'ImportDefaultSpecifier':
                        specifiers.append({
                            'type': 'default',
                            'name': spec.get('local', {}).get('name', '')
                        })
                    elif spec_type == 'ImportSpecifier':
                        specifiers.append({
                            'type': 'named',
                            'name': spec.get('imported', {}).get('name', ''),
                            'alias': spec.get('local', {}).get('name', '')
                        })
                
                dependencies.append({
                    'type': 'import',
                    'source': source,
                    'specifiers': specifiers,
                    'line': node.get('loc', {}).get('start', {}).get('line', 0)
                })
            
            # Recursively search for imports
            if isinstance(node, dict):
                for value in node.values():
                    if isinstance(value, dict):
                        find_imports(value)
                    elif isinstance(value, list):
                        for item in value:
                            if isinstance(item, dict):
                                find_imports(item)
        
        find_imports(tree)
        return dependencies
    
    async def _extract_ts_dependencies(self, tree: Dict[str, Any], content: str, file_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract dependencies from TypeScript code."""
        return await self._extract_js_dependencies(tree, content, file_info)
    
    async def _extract_java_dependencies(self, tree: Any, content: str, file_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract dependencies from Java code."""
        # Java dependency extraction would be implemented here
        return []
    
    def _enhance_nodes(self, nodes: List[Dict[str, Any]], 
                      complexity_metrics: Dict[str, Any], 
                      dependencies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enhance nodes with additional metadata and relationships."""
        enhanced_nodes = []
        
        for node in nodes:
            enhanced_node = {
                **node,
                'analysis_timestamp': datetime.utcnow().isoformat(),
                'complexity_contribution': self._calculate_node_complexity_contribution(node),
                'semantic_category': self._categorize_node_semantically(node),
                'relationships': self._identify_node_relationships(node, nodes)
            }
            
            enhanced_nodes.append(enhanced_node)
        
        return enhanced_nodes
    
    def _calculate_node_complexity_contribution(self, node: Dict[str, Any]) -> int:
        """Calculate how much this node contributes to overall complexity."""
        base_contribution = 1 if node['type'] in ['conditional', 'loop', 'exception_handling'] else 0
        nesting_penalty = node.get('depth', 0)
        return base_contribution + nesting_penalty
    
    def _categorize_node_semantically(self, node: Dict[str, Any]) -> str:
        """Categorize node based on its semantic purpose."""
        node_type = node['type']
        
        if node_type in ['function', 'async_function', 'method']:
            return 'behavioral'
        elif node_type in ['class']:
            return 'structural'
        elif node_type in ['import', 'import_from']:
            return 'dependency'
        elif node_type in ['conditional', 'loop']:
            return 'control_flow'
        else:
            return 'other'
    
    def _identify_node_relationships(self, node: Dict[str, Any], all_nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify relationships between this node and others."""
        relationships = []
        
        # Parent-child relationships
        if node.get('parent_id'):
            relationships.append({
                'type': 'child_of',
                'target_id': node['parent_id'],
                'confidence': 1.0
            })
        
        # Find children
        children = [n for n in all_nodes if n.get('parent_id') == node['id']]
        for child in children:
            relationships.append({
                'type': 'parent_of',
                'target_id': child['id'],
                'confidence': 1.0
            })
        
        return relationships
    
    async def analyze_dependencies(self, repo_id: str) -> List[Dict[str, Any]]:
        """Analyze cross-file dependencies for a repository."""
        # This would query the database for all files in the repository
        # and analyze their dependencies to create cross-file relationships
        dependencies = []
        
        # Placeholder implementation
        # In a real implementation, this would:
        # 1. Query all files for the repository
        # 2. Analyze import/dependency statements
        # 3. Resolve dependencies to actual files
        # 4. Create relationship records
        
        return dependencies
    
    def _generate_node_id(self, node: ast.AST, file_info: Dict[str, Any]) -> str:
        """Generate a unique ID for an AST node."""
        content_parts = [
            file_info['file_path'],
            str(getattr(node, 'lineno', 0)),
            str(getattr(node, 'col_offset', 0)),
            type(node).__name__
        ]
        
        if hasattr(node, 'name'):
            content_parts.append(node.name)
        
        content = '|'.join(content_parts)
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def _generate_js_node_id(self, node: Dict[str, Any], file_info: Dict[str, Any]) -> str:
        """Generate a unique ID for a JavaScript/TypeScript AST node."""
        loc = node.get('loc', {}).get('start', {})
        content_parts = [
            file_info['file_path'],
            str(loc.get('line', 0)),
            str(loc.get('column', 0)),
            node.get('type', 'unknown')
        ]
        
        if node.get('id', {}).get('name'):
            content_parts.append(node['id']['name'])
        
        content = '|'.join(content_parts)
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def _calculate_node_hash(self, node_info: Dict[str, Any]) -> str:
        """Calculate a hash for node content to enable deduplication."""
        # Remove volatile fields
        stable_fields = {k: v for k, v in node_info.items() 
                        if k not in ['id', 'analysis_timestamp', 'parent_id']}
        
        content = json.dumps(stable_fields, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()
    
    def _ast_to_string(self, node: ast.AST) -> str:
        """Convert AST node to string representation."""
        try:
            if isinstance(node, ast.Name):
                return node.id
            elif isinstance(node, ast.Constant):
                return str(node.value)
            elif isinstance(node, ast.Attribute):
                return f"{self._ast_to_string(node.value)}.{node.attr}"
            else:
                return ast.unparse(node) if hasattr(ast, 'unparse') else str(node)
        except:
            return str(node)
