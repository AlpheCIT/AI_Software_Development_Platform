#!/usr/bin/env python3
"""
Purpose Extractor - Extracts semantic purpose and intent from code structures
Part of the AI-Powered Code Refactoring System

This module implements sophisticated pattern matching to understand the business
logic and intent behind code, enabling purpose-based similarity analysis.
"""

import ast
import re
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

@dataclass
class PurposeAnalysis:
    """Structured representation of extracted code purpose."""
    intent: str
    domain: str
    operation_type: str
    side_effects: str
    data_flow: str
    business_rule: str
    confidence_score: float
    evidence: List[str]

class PatternMatcher(ABC):
    """Abstract base class for purpose pattern matchers."""
    
    @abstractmethod
    def match(self, ast_node: ast.AST, context: Dict[str, Any]) -> float:
        """Return confidence score (0.0-1.0) for pattern match."""
        pass
    
    @abstractmethod
    def get_evidence(self) -> List[str]:
        """Return list of evidence supporting the match."""
        pass

class ValidationPatternMatcher(PatternMatcher):
    """Matches validation and input checking patterns."""
    
    def __init__(self):
        self.evidence = []
        self.validation_keywords = [
            'validate', 'check', 'verify', 'assert', 'ensure', 'confirm',
            'sanitize', 'test', 'inspect', 'audit', 'review'
        ]
        self.validation_libraries = [
            'joi', 'yup', 'validator', 'ajv', 'cerberus', 'marshmallow',
            'pydantic', 'voluptuous', 'schema', 'jsonschema'
        ]
    
    def match(self, ast_node: ast.AST, context: Dict[str, Any]) -> float:
        self.evidence = []
        score = 0.0
        
        # Check function/method names
        if hasattr(ast_node, 'name'):
            name_lower = ast_node.name.lower()
            if any(keyword in name_lower for keyword in self.validation_keywords):
                score += 0.4
                self.evidence.append(f'validation_naming: {ast_node.name}')
        
        # Check for early return patterns (common in validation)
        if isinstance(ast_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if self._has_early_return_pattern(ast_node):
                score += 0.3
                self.evidence.append('early_return_validation_pattern')
            
            # Check for exception throwing
            if self._has_exception_throwing(ast_node):
                score += 0.2
                self.evidence.append('exception_throwing_pattern')
            
            # Check for boolean return with conditions
            if self._has_boolean_return_pattern(ast_node):
                score += 0.2
                self.evidence.append('boolean_return_pattern')
        
        # Check library usage in imports
        imports = context.get('imports', [])
        for imp in imports:
            if any(lib in imp.lower() for lib in self.validation_libraries):
                score += 0.3
                self.evidence.append(f'validation_library: {imp}')
                break
        
        # Check for regex patterns (common in validation)
        if self._has_regex_usage(ast_node):
            score += 0.2
            self.evidence.append('regex_validation_pattern')
        
        return min(score, 1.0)
    
    def _has_early_return_pattern(self, node: ast.FunctionDef) -> bool:
        """Check if function has early return pattern typical of validation."""
        for child in ast.walk(node):
            if isinstance(child, ast.If):
                # Look for if statements that return or raise
                for stmt in child.body:
                    if isinstance(stmt, (ast.Return, ast.Raise)):
                        return True
        return False
    
    def _has_exception_throwing(self, node: ast.FunctionDef) -> bool:
        """Check if function throws exceptions."""
        for child in ast.walk(node):
            if isinstance(child, ast.Raise):
                return True
        return False
    
    def _has_boolean_return_pattern(self, node: ast.FunctionDef) -> bool:
        """Check if function returns boolean values based on conditions."""
        returns = []
        for child in ast.walk(node):
            if isinstance(child, ast.Return) and child.value:
                if isinstance(child.value, ast.Constant) and isinstance(child.value.value, bool):
                    returns.append(child.value.value)
        return len(set(returns)) > 1  # Returns both True and False
    
    def _has_regex_usage(self, node: ast.AST) -> bool:
        """Check if node uses regex patterns."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if hasattr(child.func, 'attr') and child.func.attr in ['match', 'search', 'findall', 'sub']:
                    return True
                if hasattr(child.func, 'id') and child.func.id == 're':
                    return True
        return False
    
    def get_evidence(self) -> List[str]:
        return self.evidence

class TransformationPatternMatcher(PatternMatcher):
    """Matches data transformation and processing patterns."""
    
    def __init__(self):
        self.evidence = []
        self.transform_keywords = [
            'transform', 'convert', 'parse', 'format', 'serialize', 'deserialize',
            'encode', 'decode', 'process', 'map', 'reduce', 'filter', 'sort'
        ]
    
    def match(self, ast_node: ast.AST, context: Dict[str, Any]) -> float:
        self.evidence = []
        score = 0.0
        
        # Check naming patterns
        if hasattr(ast_node, 'name'):
            name_lower = ast_node.name.lower()
            if any(keyword in name_lower for keyword in self.transform_keywords):
                score += 0.4
                self.evidence.append(f'transformation_naming: {ast_node.name}')
        
        if isinstance(ast_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Check for data manipulation patterns
            if self._has_data_manipulation(ast_node):
                score += 0.3
                self.evidence.append('data_manipulation_pattern')
            
            # Check for list/dict comprehensions
            if self._has_comprehensions(ast_node):
                score += 0.2
                self.evidence.append('comprehension_pattern')
            
            # Check for map/filter/reduce usage
            if self._has_functional_patterns(ast_node):
                score += 0.2
                self.evidence.append('functional_programming_pattern')
        
        return min(score, 1.0)
    
    def _has_data_manipulation(self, node: ast.FunctionDef) -> bool:
        """Check for data manipulation patterns."""
        for child in ast.walk(node):
            # Look for dictionary/list operations
            if isinstance(child, ast.Subscript):
                return True
            if isinstance(child, ast.Call):
                if hasattr(child.func, 'attr') and child.func.attr in ['append', 'extend', 'insert', 'pop', 'remove']:
                    return True
        return False
    
    def _has_comprehensions(self, node: ast.FunctionDef) -> bool:
        """Check for list/dict comprehensions."""
        for child in ast.walk(node):
            if isinstance(child, (ast.ListComp, ast.DictComp, ast.SetComp, ast.GeneratorExp)):
                return True
        return False
    
    def _has_functional_patterns(self, node: ast.FunctionDef) -> bool:
        """Check for functional programming patterns."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if hasattr(child.func, 'id') and child.func.id in ['map', 'filter', 'reduce']:
                    return True
        return False
    
    def get_evidence(self) -> List[str]:
        return self.evidence

class PersistencePatternMatcher(PatternMatcher):
    """Matches database and storage access patterns."""
    
    def __init__(self):
        self.evidence = []
        self.persistence_keywords = [
            'save', 'store', 'persist', 'insert', 'update', 'delete', 'remove',
            'fetch', 'load', 'retrieve', 'query', 'find', 'search', 'get'
        ]
        self.persistence_libraries = [
            'sqlalchemy', 'django', 'pymongo', 'redis', 'postgresql', 'mysql',
            'sqlite', 'elasticsearch', 'mongodb', 'cassandra'
        ]
    
    def match(self, ast_node: ast.AST, context: Dict[str, Any]) -> float:
        self.evidence = []
        score = 0.0
        
        # Check naming patterns
        if hasattr(ast_node, 'name'):
            name_lower = ast_node.name.lower()
            if any(keyword in name_lower for keyword in self.persistence_keywords):
                score += 0.4
                self.evidence.append(f'persistence_naming: {ast_node.name}')
        
        # Check for database library usage
        imports = context.get('imports', [])
        for imp in imports:
            if any(lib in imp.lower() for lib in self.persistence_libraries):
                score += 0.3
                self.evidence.append(f'persistence_library: {imp}')
                break
        
        if isinstance(ast_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Check for SQL-like operations
            if self._has_sql_patterns(ast_node):
                score += 0.2
                self.evidence.append('sql_pattern')
            
            # Check for CRUD operations
            if self._has_crud_patterns(ast_node):
                score += 0.2
                self.evidence.append('crud_pattern')
        
        return min(score, 1.0)
    
    def _has_sql_patterns(self, node: ast.FunctionDef) -> bool:
        """Check for SQL-like patterns in code."""
        for child in ast.walk(node):
            if isinstance(child, ast.Constant) and isinstance(child.value, str):
                sql_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE']
                if any(keyword in child.value.upper() for keyword in sql_keywords):
                    return True
        return False
    
    def _has_crud_patterns(self, node: ast.FunctionDef) -> bool:
        """Check for CRUD operation patterns."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if hasattr(child.func, 'attr'):
                    crud_methods = ['save', 'create', 'update', 'delete', 'find', 'get']
                    if child.func.attr in crud_methods:
                        return True
        return False
    
    def get_evidence(self) -> List[str]:
        return self.evidence

class CalculationPatternMatcher(PatternMatcher):
    """Matches mathematical calculation and computation patterns."""
    
    def __init__(self):
        self.evidence = []
        self.calc_keywords = [
            'calculate', 'compute', 'sum', 'total', 'average', 'mean', 'median',
            'count', 'measure', 'analyze', 'process', 'aggregate'
        ]
    
    def match(self, ast_node: ast.AST, context: Dict[str, Any]) -> float:
        self.evidence = []
        score = 0.0
        
        # Check naming patterns
        if hasattr(ast_node, 'name'):
            name_lower = ast_node.name.lower()
            if any(keyword in name_lower for keyword in self.calc_keywords):
                score += 0.4
                self.evidence.append(f'calculation_naming: {ast_node.name}')
        
        if isinstance(ast_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Check for mathematical operations
            if self._has_math_operations(ast_node):
                score += 0.3
                self.evidence.append('mathematical_operations')
            
            # Check for loops with accumulation
            if self._has_accumulation_loops(ast_node):
                score += 0.2
                self.evidence.append('accumulation_loop_pattern')
        
        return min(score, 1.0)
    
    def _has_math_operations(self, node: ast.FunctionDef) -> bool:
        """Check for mathematical operations."""
        math_ops = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow)
        for child in ast.walk(node):
            if isinstance(child, ast.BinOp) and isinstance(child.op, math_ops):
                return True
        return False
    
    def _has_accumulation_loops(self, node: ast.FunctionDef) -> bool:
        """Check for loops that accumulate values."""
        for child in ast.walk(node):
            if isinstance(child, (ast.For, ast.While)):
                # Look for augmented assignment in loop
                for stmt in ast.walk(child):
                    if isinstance(stmt, ast.AugAssign):
                        return True
        return False
    
    def get_evidence(self) -> List[str]:
        return self.evidence

class CommunicationPatternMatcher(PatternMatcher):
    """Matches API calls, HTTP requests, and external communication patterns."""
    
    def __init__(self):
        self.evidence = []
        self.comm_keywords = [
            'request', 'response', 'call', 'invoke', 'send', 'receive',
            'get', 'post', 'put', 'delete', 'patch', 'fetch', 'api'
        ]
        self.comm_libraries = [
            'requests', 'urllib', 'httpx', 'aiohttp', 'flask', 'fastapi',
            'tornado', 'grpc', 'rabbitmq', 'kafka'
        ]
    
    def match(self, ast_node: ast.AST, context: Dict[str, Any]) -> float:
        self.evidence = []
        score = 0.0
        
        # Check naming patterns
        if hasattr(ast_node, 'name'):
            name_lower = ast_node.name.lower()
            if any(keyword in name_lower for keyword in self.comm_keywords):
                score += 0.4
                self.evidence.append(f'communication_naming: {ast_node.name}')
        
        # Check for communication library usage
        imports = context.get('imports', [])
        for imp in imports:
            if any(lib in imp.lower() for lib in self.comm_libraries):
                score += 0.3
                self.evidence.append(f'communication_library: {imp}')
                break
        
        if isinstance(ast_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Check for HTTP method calls
            if self._has_http_calls(ast_node):
                score += 0.2
                self.evidence.append('http_call_pattern')
        
        return min(score, 1.0)
    
    def _has_http_calls(self, node: ast.FunctionDef) -> bool:
        """Check for HTTP method calls."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if hasattr(child.func, 'attr'):
                    http_methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']
                    if child.func.attr in http_methods:
                        return True
        return False
    
    def get_evidence(self) -> List[str]:
        return self.evidence

class OrchestrationPatternMatcher(PatternMatcher):
    """Matches workflow orchestration and business logic coordination patterns."""
    
    def __init__(self):
        self.evidence = []
        self.orchestration_keywords = [
            'orchestrate', 'coordinate', 'manage', 'handle', 'process', 'execute',
            'workflow', 'pipeline', 'chain', 'sequence', 'schedule'
        ]
    
    def match(self, ast_node: ast.AST, context: Dict[str, Any]) -> float:
        self.evidence = []
        score = 0.0
        
        # Check naming patterns
        if hasattr(ast_node, 'name'):
            name_lower = ast_node.name.lower()
            if any(keyword in name_lower for keyword in self.orchestration_keywords):
                score += 0.4
                self.evidence.append(f'orchestration_naming: {ast_node.name}')
        
        if isinstance(ast_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Check for multiple function calls (orchestration pattern)
            if self._has_multiple_function_calls(ast_node):
                score += 0.3
                self.evidence.append('multiple_function_calls')
            
            # Check for conditional workflow
            if self._has_conditional_workflow(ast_node):
                score += 0.2
                self.evidence.append('conditional_workflow_pattern')
        
        return min(score, 1.0)
    
    def _has_multiple_function_calls(self, node: ast.FunctionDef) -> bool:
        """Check for multiple function calls indicating orchestration."""
        call_count = 0
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                call_count += 1
                if call_count >= 3:
                    return True
        return False
    
    def _has_conditional_workflow(self, node: ast.FunctionDef) -> bool:
        """Check for conditional workflow patterns."""
        for child in ast.walk(node):
            if isinstance(child, ast.If):
                # Check if if-block contains function calls
                for stmt in child.body:
                    if isinstance(stmt, ast.Call):
                        return True
        return False
    
    def get_evidence(self) -> List[str]:
        return self.evidence

class PurposeExtractor:
    """Main purpose extraction engine that coordinates all pattern matchers."""
    
    def __init__(self):
        self.intent_classifiers = {
            'validation': ValidationPatternMatcher(),
            'transformation': TransformationPatternMatcher(),
            'persistence': PersistencePatternMatcher(),
            'calculation': CalculationPatternMatcher(),
            'communication': CommunicationPatternMatcher(),
            'orchestration': OrchestrationPatternMatcher()
        }
    
    def extract_purpose(self, ast_node: ast.AST, context: Dict[str, Any]) -> PurposeAnalysis:
        """Extract semantic purpose from code structure."""
        purposes = []
        
        # Analyze function/method names for intent indicators
        name_intent = self._analyze_naming_patterns(ast_node)
        
        # Run all pattern matchers
        for classifier_name, classifier in self.intent_classifiers.items():
            confidence = classifier.match(ast_node, context)
            if confidence > 0.3:  # Minimum confidence threshold
                purposes.append({
                    'type': classifier_name,
                    'confidence': confidence,
                    'evidence': classifier.get_evidence()
                })
        
        # Analyze docstrings and comments
        documentation_intent = self._analyze_documentation(ast_node)
        
        # Analyze data flow patterns
        data_flow_intent = self._analyze_data_flow(ast_node)
        
        # Synthesize final purpose analysis
        return self._synthesize_purpose(purposes, name_intent, documentation_intent, data_flow_intent, context)
    
    def _analyze_naming_patterns(self, ast_node: ast.AST) -> Dict[str, Any]:
        """Analyze naming patterns for intent indicators."""
        if not hasattr(ast_node, 'name'):
            return {}
        
        name = ast_node.name.lower()
        
        # Common naming patterns
        patterns = {
            'getter': name.startswith('get_') or name.startswith('fetch_'),
            'setter': name.startswith('set_') or name.startswith('update_'),
            'validator': 'valid' in name or 'check' in name,
            'converter': 'convert' in name or 'transform' in name,
            'handler': 'handle' in name or 'process' in name,
            'helper': 'help' in name or 'util' in name or 'assist' in name
        }
        
        return {k: v for k, v in patterns.items() if v}
    
    def _analyze_documentation(self, ast_node: ast.AST) -> Dict[str, Any]:
        """Analyze docstrings and comments for intent indicators."""
        intent_info = {}
        
        if isinstance(ast_node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            docstring = ast.get_docstring(ast_node)
            if docstring:
                intent_info['has_docstring'] = True
                intent_info['docstring_length'] = len(docstring)
                
                # Look for intent keywords in docstring
                intent_keywords = {
                    'validation': ['validate', 'check', 'verify', 'ensure'],
                    'transformation': ['convert', 'transform', 'parse', 'format'],
                    'persistence': ['save', 'store', 'load', 'persist'],
                    'calculation': ['calculate', 'compute', 'sum', 'average'],
                    'communication': ['request', 'call', 'api', 'send'],
                    'orchestration': ['orchestrate', 'manage', 'coordinate']
                }
                
                docstring_lower = docstring.lower()
                for intent_type, keywords in intent_keywords.items():
                    if any(keyword in docstring_lower for keyword in keywords):
                        intent_info[f'{intent_type}_documented'] = True
        
        return intent_info
    
    def _analyze_data_flow(self, ast_node: ast.AST) -> Dict[str, Any]:
        """Analyze data flow patterns."""
        data_flow = {
            'has_parameters': False,
            'has_return': False,
            'modifies_external_state': False,
            'reads_external_state': False
        }
        
        if isinstance(ast_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Check parameters
            if ast_node.args.args:
                data_flow['has_parameters'] = True
            
            # Check for return statements
            for child in ast.walk(ast_node):
                if isinstance(child, ast.Return):
                    data_flow['has_return'] = True
                    break
            
            # Check for global/nonlocal statements (external state modification)
            for child in ast.walk(ast_node):
                if isinstance(child, (ast.Global, ast.Nonlocal)):
                    data_flow['modifies_external_state'] = True
                    break
        
        return data_flow
    
    def _synthesize_purpose(self, purposes: List[Dict], name_intent: Dict, 
                          documentation_intent: Dict, data_flow_intent: Dict,
                          context: Dict[str, Any]) -> PurposeAnalysis:
        """Synthesize all analysis into final purpose determination."""
        
        # Determine primary intent
        if purposes:
            primary_purpose = max(purposes, key=lambda x: x['confidence'])
            intent = primary_purpose['type']
            confidence_score = primary_purpose['confidence']
            evidence = []
            for purpose in purposes:
                evidence.extend(purpose['evidence'])
        else:
            intent = 'general'
            confidence_score = 0.5
            evidence = ['no_specific_pattern_detected']
        
        # Determine domain from context
        file_path = context.get('file_path', '')
        domain = self._extract_domain_from_path(file_path)
        
        # Determine operation type
        operation_type = self._determine_operation_type(intent, name_intent, data_flow_intent)
        
        # Determine side effects
        side_effects = 'none'
        if data_flow_intent.get('modifies_external_state'):
            side_effects = 'modifies_state'
        elif intent in ['persistence', 'communication']:
            side_effects = 'external_interaction'
        
        # Determine data flow
        data_flow = 'input_transformation'
        if data_flow_intent.get('has_parameters') and data_flow_intent.get('has_return'):
            data_flow = 'input_transformation'
        elif data_flow_intent.get('has_parameters') and not data_flow_intent.get('has_return'):
            data_flow = 'input_processing'
        elif not data_flow_intent.get('has_parameters') and data_flow_intent.get('has_return'):
            data_flow = 'data_generation'
        
        # Determine business rule
        business_rule = f"{intent}_{operation_type}"
        
        return PurposeAnalysis(
            intent=intent,
            domain=domain,
            operation_type=operation_type,
            side_effects=side_effects,
            data_flow=data_flow,
            business_rule=business_rule,
            confidence_score=confidence_score,
            evidence=evidence
        )
    
    def _extract_domain_from_path(self, file_path: str) -> str:
        """Extract business domain from file path."""
        path_parts = file_path.lower().split('/')
        
        # Common domain indicators
        domain_keywords = {
            'user': ['user', 'auth', 'login', 'account'],
            'payment': ['payment', 'billing', 'invoice', 'transaction'],
            'inventory': ['inventory', 'product', 'catalog', 'stock'],
            'order': ['order', 'cart', 'checkout', 'purchase'],
            'analytics': ['analytics', 'stats', 'metrics', 'report'],
            'notification': ['notification', 'alert', 'message', 'email'],
            'admin': ['admin', 'management', 'config', 'settings']
        }
        
        for domain, keywords in domain_keywords.items():
            if any(keyword in part for part in path_parts for keyword in keywords):
                return domain
        
        # Fallback to directory name
        if len(path_parts) > 1:
            return path_parts[-2]  # Parent directory
        
        return 'general'
    
    def _determine_operation_type(self, intent: str, name_intent: Dict, data_flow_intent: Dict) -> str:
        """Determine the specific operation type."""
        
        # Use name-based patterns first
        if name_intent.get('getter'):
            return 'retrieval'
        elif name_intent.get('setter'):
            return 'modification'
        elif name_intent.get('validator'):
            return 'validation'
        elif name_intent.get('converter'):
            return 'transformation'
        elif name_intent.get('handler'):
            return 'processing'
        elif name_intent.get('helper'):
            return 'utility'
        
        # Use intent-based patterns
        operation_mapping = {
            'validation': 'validation',
            'transformation': 'transformation',
            'persistence': 'storage',
            'calculation': 'computation',
            'communication': 'integration',
            'orchestration': 'coordination'
        }
        
        return operation_mapping.get(intent, 'general')
