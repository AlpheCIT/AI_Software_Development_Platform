#!/usr/bin/env python3
"""
Dynamic Documentation Generator for Code Repositories
Leverages ArangoDB data with AST nodes, embeddings, and natural language descriptions
"""

import logging
import json
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from dataclasses import dataclass
import asyncio
from pathlib import Path
import re

from core.database_manager import UnifiedDatabaseManager
from analysis.embedding_engine import PurposeAwareEmbeddingEngine

logger = logging.getLogger(__name__)

@dataclass
class DocumentationConfig:
    """Configuration for documentation generation"""
    include_api_endpoints: bool = True
    include_database_schema: bool = True
    include_service_architecture: bool = True
    include_code_structure: bool = True
    include_embeddings_analysis: bool = True
    include_purpose_analysis: bool = True
    include_complexity_metrics: bool = True
    output_format: str = "markdown"  # markdown, json, html
    detail_level: str = "comprehensive"  # basic, detailed, comprehensive
    similarity_threshold: float = 0.8
    max_similarity_groups: int = 10
    include_code_samples: bool = False

class DynamicRepositoryDocumentationGenerator:
    """
    Generate comprehensive documentation from your ArangoDB code analysis data
    Uses actual AST nodes, embeddings, and natural language descriptions
    """
    
    def __init__(self, db_manager: UnifiedDatabaseManager):
        self.db = db_manager
        
        # API endpoint detection patterns
        self.api_patterns = {
            'fastapi': {
                'decorators': ['@app.get', '@app.post', '@app.put', '@app.delete', '@app.patch', '@router.get', '@router.post'],
                'keywords': ['FastAPI', 'APIRouter', 'router', 'endpoint', 'api'],
                'imports': ['fastapi', 'fastapi.routing', 'fastapi.responses']
            },
            'flask': {
                'decorators': ['@app.route', '@bp.route', '@blueprint.route'],
                'keywords': ['Flask', 'Blueprint', 'route', 'app.route'],
                'imports': ['flask', 'flask.blueprint']
            },
            'django': {
                'decorators': ['@api_view', '@action'],
                'keywords': ['ViewSet', 'APIView', 'django.urls', 'path('],
                'imports': ['django.views', 'rest_framework']
            },
            'express': {
                'keywords': ['app.get', 'app.post', 'router.get', 'express', 'req.params'],
                'imports': ['express']
            }
        }
        
        # Service detection patterns
        self.service_patterns = {
            'database_service': ['database', 'db', 'repository', 'dao', 'model', 'schema'],
            'api_service': ['api', 'endpoint', 'route', 'controller', 'handler'],
            'business_service': ['service', 'business', 'logic', 'manager', 'engine'],
            'utility_service': ['util', 'helper', 'common', 'shared', 'tools'],
            'integration_service': ['client', 'integration', 'external', 'third_party', 'connector'],
            'analysis_service': ['analyzer', 'analysis', 'processor', 'parser', 'embedding'],
            'security_service': ['auth', 'security', 'permission', 'token', 'validation']
        }

    async def generate_complete_documentation(
        self, 
        repository_id: str, 
        config: DocumentationConfig = None
    ) -> Dict[str, Any]:
        """Generate complete documentation for a repository"""
        
        config = config or DocumentationConfig()
        
        logger.info(f"🔍 Generating documentation for repository: {repository_id}")
        
        # Gather all repository data from ArangoDB
        repo_data = await self._gather_repository_data(repository_id)
        
        if not repo_data['success']:
            return {'success': False, 'error': repo_data['error']}
        
        # Generate different documentation sections
        sections = {}
        
        if config.include_api_endpoints:
            sections['api_endpoints'] = await self._generate_api_endpoint_documentation(
                repository_id, repo_data, config
            )
        
        if config.include_service_architecture:
            sections['service_architecture'] = await self._generate_service_architecture_documentation(
                repository_id, repo_data, config
            )
        
        if config.include_code_structure:
            sections['code_structure'] = await self._generate_code_structure_documentation(
                repository_id, repo_data, config
            )
        
        if config.include_embeddings_analysis:
            sections['embeddings_analysis'] = await self._generate_embeddings_documentation(
                repository_id, repo_data, config.similarity_threshold
            )
        
        if config.include_purpose_analysis:
            sections['purpose_analysis'] = await self._generate_purpose_analysis_documentation(
                repository_id, repo_data
            )
        
        if config.include_database_schema:
            sections['database_schema'] = await self._generate_database_schema_documentation(
                repository_id, repo_data
            )
        
        if config.include_complexity_metrics:
            sections['complexity_analysis'] = await self._generate_complexity_documentation(
                repository_id, repo_data
            )
        
        # Generate final documentation
        documentation = {
            'repository_info': repo_data['repository'],
            'generated_at': datetime.now().isoformat(),
            'config': config.__dict__,
            'sections': sections,
            'metadata': {
                'total_files': len(repo_data['files']),
                'total_nodes': len(repo_data['ast_nodes']),
                'total_embeddings': len(repo_data['embeddings']),
                'analysis_completeness': self._calculate_completeness(sections),
                'frameworks_detected': self._detect_frameworks(repo_data['ast_nodes']),
                'languages_detected': self._detect_languages(repo_data['files'])
            }
        }
        
        # Format output based on config
        if config.output_format == "markdown":
            return await self._format_as_markdown(documentation)
        elif config.output_format == "json":
            return documentation
        elif config.output_format == "html":
            return await self._format_as_html(documentation)
        
        return documentation

    async def _gather_repository_data(self, repository_id: str) -> Dict[str, Any]:
        """Gather all data for a repository from ArangoDB collections"""
        try:
            # Repository metadata
            repo_query = """
            FOR repo IN repositories
                FILTER repo._key == @repo_id OR repo.repository_id == @repo_id
                RETURN repo
            """
            cursor = self.db.db.aql.execute(repo_query, bind_vars={'repo_id': repository_id})
            repositories = list(cursor)
            
            if not repositories:
                return {'success': False, 'error': f'Repository {repository_id} not found'}
            
            repository = repositories[0]
            
            # Get all files for this repository
            files_query = """
            FOR file IN code_files
                FILTER file.repository_id == @repo_id
                RETURN file
            """
            cursor = self.db.db.aql.execute(files_query, bind_vars={'repo_id': repository_id})
            files = list(cursor)
            
            # Get all AST nodes with their embeddings and natural language descriptions
            ast_nodes_query = """
            FOR node IN ast_nodes
                FILTER node.repository_id == @repo_id
                
                // Get embeddings for this node
                LET node_embeddings = (
                    FOR emb IN embedding_metadata
                        FILTER emb.repository_id == @repo_id
                        FILTER emb.file_path == node.file_path
                        RETURN emb
                )
                
                // Get codeunits (enhanced analysis) if available
                LET enhanced_data = (
                    FOR unit IN codeunits
                        FILTER unit.repository_id == @repo_id
                        FILTER unit.file_path == node.file_path
                        FILTER unit.type == node.type
                        RETURN unit
                )
                
                RETURN MERGE(node, {
                    embeddings: node_embeddings,
                    enhanced_analysis: FIRST(enhanced_data),
                    natural_language_description: node.purpose_description || node.description
                })
            """
            
            cursor = self.db.db.aql.execute(ast_nodes_query, bind_vars={'repo_id': repository_id})
            ast_nodes = list(cursor)
            
            # Get all relationships
            relationships_query = """
            FOR rel IN relationships
                FILTER rel.repository_id == @repo_id
                RETURN rel
            """
            cursor = self.db.db.aql.execute(relationships_query, bind_vars={'repo_id': repository_id})
            relationships = list(cursor)
            
            # Get embeddings metadata
            embeddings_query = """
            FOR emb IN embedding_metadata
                FILTER emb.repository_id == @repo_id
                RETURN emb
            """
            cursor = self.db.db.aql.execute(embeddings_query, bind_vars={'repo_id': repository_id})
            embeddings = list(cursor)
            
            # Get enhanced codeunits data
            codeunits_query = """
            FOR unit IN codeunits
                FILTER unit.repository_id == @repo_id
                RETURN unit
            """
            cursor = self.db.db.aql.execute(codeunits_query, bind_vars={'repo_id': repository_id})
            codeunits = list(cursor)
            
            return {
                'success': True,
                'repository': repository,
                'files': files,
                'ast_nodes': ast_nodes,
                'relationships': relationships,
                'embeddings': embeddings,
                'codeunits': codeunits
            }
            
        except Exception as e:
            logger.error(f"Failed to gather repository data: {str(e)}")
            return {'success': False, 'error': str(e)}

    async def _generate_api_endpoint_documentation(
        self, repository_id: str, repo_data: Dict[str, Any], config: DocumentationConfig
    ) -> Dict[str, Any]:
        """Generate API endpoint documentation from AST nodes"""
        
        api_endpoints = []
        
        try:
            # Use the AST nodes we already have and filter for API endpoints
            for node in repo_data['ast_nodes']:
                if self._is_api_endpoint(node):
                    endpoint_info = await self._extract_api_endpoint_info(node, repo_data, config)
                    if endpoint_info:
                        api_endpoints.append(endpoint_info)
            
            # Sort endpoints by file and then by line number
            api_endpoints.sort(key=lambda x: (x['file_path'], x.get('start_line', 0)))
            
            return {
                'success': True,
                'endpoints': api_endpoints,
                'total_endpoints': len(api_endpoints),
                'frameworks_detected': self._detect_api_frameworks(repo_data['ast_nodes']),
                'security_analysis': self._analyze_api_security(api_endpoints),
                'complexity_analysis': self._analyze_api_complexity(api_endpoints)
            }
            
        except Exception as e:
            logger.error(f"API endpoint documentation generation failed: {str(e)}")
            return {'success': False, 'error': str(e), 'endpoints': []}

    def _is_api_endpoint(self, node: Dict[str, Any]) -> bool:
        """Determine if an AST node represents an API endpoint"""
        
        # Check function/method nodes
        if node.get('type') not in ['function', 'async_function', 'method']:
            return False
        
        # Check decorators for API patterns
        decorators = node.get('decorators', [])
        for decorator in decorators:
            decorator_str = str(decorator).lower()
            for framework, patterns in self.api_patterns.items():
                for pattern in patterns['decorators']:
                    if pattern.replace('@', '').lower() in decorator_str:
                        return True
        
        # Check natural language description
        description = node.get('natural_language_description', '') or node.get('description', '')
        api_keywords = ['endpoint', 'api', 'http', 'route', 'request', 'response', 'handler']
        if any(keyword in description.lower() for keyword in api_keywords):
            return True
        
        # Check function name patterns
        name = node.get('name', '').lower()
        api_name_patterns = ['api_', 'endpoint_', 'route_', 'handler_', 'get_', 'post_', 'put_', 'delete_']
        if any(pattern in name for pattern in api_name_patterns):
            return True
        
        # Check enhanced analysis if available
        enhanced = node.get('enhanced_analysis', {})
        if enhanced:
            purpose = enhanced.get('purpose', {})
            if purpose.get('operation_type') in ['api_endpoint', 'route_handler', 'http_handler']:
                return True
        
        # Check file path for API indicators
        file_path = node.get('file_path', '').lower()
        if any(indicator in file_path for indicator in ['api', 'route', 'endpoint', 'handler']):
            # Additional check: function should have parameters suggesting HTTP handling
            arguments = node.get('arguments', [])
            if any(arg.get('name', '').lower() in ['request', 'req', 'response', 'res'] for arg in arguments):
                return True
        
        return False

    async def _extract_api_endpoint_info(self, node: Dict[str, Any], repo_data: Dict[str, Any], config: DocumentationConfig) -> Dict[str, Any]:
        """Extract detailed API endpoint information"""
        
        endpoint_info = {
            'endpoint_name': node.get('name', 'unnamed'),
            'file_path': node.get('file_path', ''),
            'start_line': node.get('start_line', 0),
            'end_line': node.get('end_line', 0),
            'http_method': self._extract_http_method(node),
            'route_path': self._extract_route_path(node),
            'description': node.get('natural_language_description', node.get('description', '')),
            'line_range': f"{node.get('start_line', 0)}-{node.get('end_line', 0)}",
            'decorators': node.get('decorators', []),
            'parameters': self._extract_endpoint_parameters(node),
            'is_async': node.get('is_async', False),
            'auth_required': self._detect_auth_requirement(node),
            'rate_limit': self._extract_rate_limit(node),
            'response_type': self._extract_response_type(node),
            'request_schema': self._extract_request_schema(node),
            'complexity_score': node.get('complexity_contribution', 0),
            'purpose_analysis': self._extract_purpose_analysis(node),
            'error_handling': self._analyze_error_handling(node),
            'dependencies': self._extract_endpoint_dependencies(node, repo_data)
        }
        
        if config.include_code_samples:
            endpoint_info['code_sample'] = self._extract_code_sample(node)
        
        return endpoint_info

    def _extract_http_method(self, node: Dict[str, Any]) -> str:
        """Extract HTTP method from decorators or description"""
        decorators = node.get('decorators', [])
        
        # Check decorators first
        for decorator in decorators:
            decorator_str = str(decorator).lower()
            if any(method in decorator_str for method in ['get', 'post', 'put', 'delete', 'patch']):
                if 'get' in decorator_str:
                    return 'GET'
                elif 'post' in decorator_str:
                    return 'POST'
                elif 'put' in decorator_str:
                    return 'PUT'
                elif 'delete' in decorator_str:
                    return 'DELETE'
                elif 'patch' in decorator_str:
                    return 'PATCH'
        
        # Check function name
        name = node.get('name', '').lower()
        if name.startswith('get_'):
            return 'GET'
        elif name.startswith('post_'):
            return 'POST'
        elif name.startswith('put_'):
            return 'PUT'
        elif name.startswith('delete_'):
            return 'DELETE'
        elif name.startswith('patch_'):
            return 'PATCH'
        
        # Check description
        description = node.get('natural_language_description', '').lower()
        http_methods = ['get', 'post', 'put', 'delete', 'patch']
        for method in http_methods:
            if f'{method} ' in description or f'{method}s ' in description:
                return method.upper()
        
        return 'GET'  # Default

    def _extract_route_path(self, node: Dict[str, Any]) -> str:
        """Extract route path from decorators or infer from function name"""
        decorators = node.get('decorators', [])
        
        # Look for route paths in decorators
        for decorator in decorators:
            decorator_str = str(decorator)
            # FastAPI style: @app.get("/users/{id}")
            route_patterns = [
                r'["\'](/[^"\']*)["\']',  # "/api/users" or '/api/users'
                r'path\s*=\s*["\']([^"\']*)["\']',  # path="/api/users"
            ]
            
            for pattern in route_patterns:
                match = re.search(pattern, decorator_str)
                if match:
                    return match.group(1)
        
        # Infer from function name
        name = node.get('name', '')
        if name.startswith(('get_', 'post_', 'put_', 'delete_', 'patch_')):
            method_part = name.split('_', 1)[0]
            resource_part = name[len(method_part)+1:] if len(name) > len(method_part)+1 else ''
            return f"/{resource_part.replace('_', '/')}" if resource_part else "/"
        
        return f"/{name.replace('_', '/')}"

    def _detect_auth_requirement(self, node: Dict[str, Any]) -> str:
        """Detect if endpoint requires authentication"""
        decorators = node.get('decorators', [])
        description = node.get('natural_language_description', '').lower()
        
        # Check decorators for auth patterns
        auth_decorators = ['auth', 'login_required', 'authenticated', 'token_required', 'depends', 'security']
        for decorator in decorators:
            decorator_str = str(decorator).lower()
            if any(auth_dec in decorator_str for auth_dec in auth_decorators):
                return '✅'
        
        # Check function parameters for auth-related objects
        arguments = node.get('arguments', [])
        auth_params = ['token', 'user', 'auth', 'credentials', 'session']
        for arg in arguments:
            if any(auth_param in arg.get('name', '').lower() for auth_param in auth_params):
                return '✅'
        
        # Check description for auth keywords
        auth_keywords = ['authentication', 'auth', 'login', 'token', 'protected', 'secure']
        if any(keyword in description for keyword in auth_keywords):
            return '✅'
        
        return '❌'

    def _extract_endpoint_parameters(self, node: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract and analyze endpoint parameters"""
        parameters = []
        arguments = node.get('arguments', [])
        
        for arg in arguments:
            param_info = {
                'name': arg.get('name', ''),
                'type': arg.get('type_annotation', 'Any'),
                'default': arg.get('default_value'),
                'required': arg.get('default_value') is None,
                'source': self._determine_parameter_source(arg)
            }
            parameters.append(param_info)
        
        return parameters

    def _determine_parameter_source(self, arg: Dict[str, Any]) -> str:
        """Determine if parameter comes from path, query, body, etc."""
        name = arg.get('name', '').lower()
        
        if name in ['request', 'req']:
            return 'request_object'
        elif name in ['response', 'res']:
            return 'response_object'
        elif 'id' in name or 'key' in name:
            return 'path'
        elif name.startswith('query_'):
            return 'query'
        elif name.endswith('_body') or name == 'body':
            return 'body'
        else:
            return 'query'  # Default assumption

    async def _generate_service_architecture_documentation(
        self, repository_id: str, repo_data: Dict[str, Any], config: DocumentationConfig
    ) -> Dict[str, Any]:
        """Generate service architecture documentation"""
        
        services = []
        
        try:
            # Group files by service patterns
            service_files = {}
            
            for file_data in repo_data['files']:
                file_path = file_data.get('file_path', '')
                service_type = self._classify_service_type(file_path, file_data)
                
                if service_type not in service_files:
                    service_files[service_type] = []
                
                service_files[service_type].append(file_data)
            
            # Analyze each service
            for service_type, files in service_files.items():
                service_info = await self._analyze_service(service_type, files, repo_data)
                services.append(service_info)
            
            # Analyze service dependencies
            dependencies = await self._analyze_service_dependencies(repo_data)
            
            return {
                'success': True,
                'services': services,
                'dependencies': dependencies,
                'service_count': len(services),
                'architecture_patterns': self._detect_architecture_patterns(repo_data),
                'technology_stack': self._analyze_technology_stack(repo_data)
            }
            
        except Exception as e:
            logger.error(f"Service architecture documentation failed: {str(e)}")
            return {'success': False, 'error': str(e)}

    def _classify_service_type(self, file_path: str, file_data: Dict[str, Any]) -> str:
        """Classify file into service type based on path and content"""
        
        file_path_lower = file_path.lower()
        
        # Check path patterns
        for service_type, keywords in self.service_patterns.items():
            if any(keyword in file_path_lower for keyword in keywords):
                return service_type
        
        # Check natural language description if available
        description = file_data.get('natural_language_description', '').lower()
        for service_type, keywords in self.service_patterns.items():
            if any(keyword in description for keyword in keywords):
                return service_type
        
        # Check file name patterns
        filename = Path(file_path).name.lower()
        if 'test' in filename:
            return 'test_service'
        elif 'config' in filename:
            return 'configuration_service'
        elif 'main' in filename or 'app' in filename:
            return 'application_service'
        
        return 'general'

    async def _analyze_service(self, service_type: str, files: List[Dict[str, Any]], repo_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a specific service type"""
        
        # Get all AST nodes for these files
        service_nodes = [
            node for node in repo_data['ast_nodes']
            if any(node.get('file_path') == file_data.get('file_path') for file_data in files)
        ]
        
        # Analyze components
        components = []
        for node in service_nodes:
            if node.get('type') in ['class', 'function', 'async_function']:
                components.append({
                    'name': node.get('name', ''),
                    'type': node.get('type', ''),
                    'file_path': node.get('file_path', ''),
                    'description': node.get('natural_language_description', ''),
                    'complexity': node.get('complexity_contribution', 0)
                })
        
        return {
            'type': service_type,
            'file_count': len(files),
            'component_count': len(components),
            'components': components[:10],  # Top 10 components
            'description': self._generate_service_description(service_type, components),
            'complexity_total': sum(comp['complexity'] for comp in components),
            'main_files': [f.get('file_path', '') for f in files[:5]]
        }

    def _generate_service_description(self, service_type: str, components: List[Dict[str, Any]]) -> str:
        """Generate a description for the service based on its components"""
        
        if not components:
            return f"Service of type {service_type} with no analyzed components"
        
        # Analyze component types
        classes = [c for c in components if c['type'] == 'class']
        functions = [c for c in components if c['type'] in ['function', 'async_function']]
        
        description_parts = []
        
        if classes:
            description_parts.append(f"{len(classes)} classes")
        if functions:
            description_parts.append(f"{len(functions)} functions")
        
        # Add complexity assessment
        total_complexity = sum(c['complexity'] for c in components)
        if total_complexity > 50:
            complexity_level = "high"
        elif total_complexity > 20:
            complexity_level = "medium"
        else:
            complexity_level = "low"
        
        base_description = f"Service containing {', '.join(description_parts)} with {complexity_level} complexity"
        
        # Add service-specific details
        service_descriptions = {
            'database_service': f"{base_description}. Handles data persistence and database operations.",
            'api_service': f"{base_description}. Provides HTTP API endpoints and request handling.",
            'business_service': f"{base_description}. Contains core business logic and domain operations.",
            'utility_service': f"{base_description}. Provides shared utilities and helper functions.",
            'integration_service': f"{base_description}. Manages external service integrations.",
            'analysis_service': f"{base_description}. Performs code analysis and processing operations.",
            'security_service': f"{base_description}. Handles authentication, authorization, and security."
        }
        
        return service_descriptions.get(service_type, base_description)

    async def _generate_embeddings_documentation(
        self, repository_id: str, repo_data: Dict[str, Any], similarity_threshold: float
    ) -> Dict[str, Any]:
        """Generate documentation about embeddings and semantic similarities"""
        
        embeddings_analysis = {
            'total_embeddings': len(repo_data['embeddings']),
            'embedding_types': {},
            'similarity_groups': [],
            'purpose_categories': {},
            'semantic_clusters': []
        }
        
        try:
            # Analyze embedding types
            for embedding in repo_data['embeddings']:
                emb_type = embedding.get('embedding_type', 'unknown')
                if emb_type not in embeddings_analysis['embedding_types']:
                    embeddings_analysis['embedding_types'][emb_type] = 0
                embeddings_analysis['embedding_types'][emb_type] += 1
            
            # Find similarity groups using vector similarity (simplified approach)
            # In production, you'd use proper vector similarity functions
            similarity_groups = await self._find_similarity_groups(repo_data['embeddings'], similarity_threshold)
            embeddings_analysis['similarity_groups'] = similarity_groups[:10]  # Top 10
            
            # Analyze purpose categories from codeunits
            for codeunit in repo_data['codeunits']:
                purpose = codeunit.get('purpose', {})
                domain = purpose.get('domain', 'unknown')
                operation_type = purpose.get('operation_type', 'unknown')
                
                key = f"{domain}:{operation_type}"
                if key not in embeddings_analysis['purpose_categories']:
                    embeddings_analysis['purpose_categories'][key] = 0
                embeddings_analysis['purpose_categories'][key] += 1
            
            return embeddings_analysis
            
        except Exception as e:
            logger.warning(f"Embeddings analysis failed: {str(e)}")
            return embeddings_analysis

    async def _find_similarity_groups(self, embeddings: List[Dict[str, Any]], threshold: float) -> List[Dict[str, Any]]:
        """Find groups of similar embeddings (simplified implementation)"""
        
        # This is a simplified implementation
        # In production, you'd use proper vector similarity calculations
        similarity_groups = []
        
        # Group by embedding type and file extension
        type_groups = {}
        for emb in embeddings:
            emb_type = emb.get('embedding_type', 'unknown')
            file_ext = Path(emb.get('file_path', '')).suffix
            key = f"{emb_type}_{file_ext}"
            
            if key not in type_groups:
                type_groups[key] = []
            type_groups[key].append(emb)
        
        # Create similarity groups for each type
        for group_key, group_embeddings in type_groups.items():
            if len(group_embeddings) > 1:
                similarity_groups.append({
                    'group_type': group_key,
                    'count': len(group_embeddings),
                    'files': [emb.get('file_path', '') for emb in group_embeddings[:5]],
                    'similarity_score': 0.85  # Placeholder
                })
        
        return similarity_groups

    async def _format_as_markdown(self, documentation: Dict[str, Any]) -> str:
        """Convert documentation to markdown format"""
        
        repo_info = documentation['repository_info']
        sections = documentation['sections']
        metadata = documentation['metadata']
        
        markdown = f"""# {repo_info.get('url', 'Repository')} - Dynamic Documentation

**Generated:** {documentation['generated_at']}
**Repository URL:** {repo_info.get('url', 'N/A')}
**Analysis Date:** {repo_info.get('analysis_timestamp', 'N/A')}
**Total Files:** {metadata['total_files']}
**Total AST Nodes:** {metadata['total_nodes']}
**Total Embeddings:** {metadata['total_embeddings']}
**Analysis Completeness:** {metadata['analysis_completeness']:.1%}

**Frameworks Detected:** {', '.join(metadata.get('frameworks_detected', []))}
**Languages Detected:** {', '.join(metadata.get('languages_detected', []))}

---

"""
        
        # Table of Contents
        markdown += "## Table of Contents\n\n"
        if 'api_endpoints' in sections:
            markdown += "- [API Endpoints](#api-endpoints)\n"
        if 'service_architecture' in sections:
            markdown += "- [Service Architecture](#service-architecture)\n"
        if 'code_structure' in sections:
            markdown += "- [Code Structure](#code-structure)\n"
        if 'embeddings_analysis' in sections:
            markdown += "- [Embeddings & Semantic Analysis](#embeddings--semantic-analysis)\n"
        if 'purpose_analysis' in sections:
            markdown += "- [Purpose Analysis](#purpose-analysis)\n"
        if 'complexity_analysis' in sections:
            markdown += "- [Complexity Analysis](#complexity-analysis)\n"
        markdown += "\n---\n\n"
        
        # API Endpoints section
        if 'api_endpoints' in sections:
            markdown += self._format_api_endpoints_markdown(sections['api_endpoints'])
        
        # Service Architecture section
        if 'service_architecture' in sections:
            markdown += self._format_service_architecture_markdown(sections['service_architecture'])
        
        # Code Structure section
        if 'code_structure' in sections:
            markdown += self._format_code_structure_markdown(sections['code_structure'])
        
        # Embeddings Analysis section
        if 'embeddings_analysis' in sections:
            markdown += self._format_embeddings_analysis_markdown(sections['embeddings_analysis'])
        
        # Purpose Analysis section
        if 'purpose_analysis' in sections:
            markdown += self._format_purpose_analysis_markdown(sections['purpose_analysis'])
        
        # Complexity Analysis section
        if 'complexity_analysis' in sections:
            markdown += self._format_complexity_analysis_markdown(sections['complexity_analysis'])
        
        return markdown

    def _format_api_endpoints_markdown(self, endpoints_data: Dict[str, Any]) -> str:
        """Format API endpoints as markdown table"""
        
        if not endpoints_data.get('success') or not endpoints_data.get('endpoints'):
            return "## API Endpoints\n\nNo API endpoints detected.\n\n"
        
        markdown = "## API Endpoints\n\n"
        markdown += f"**Total Endpoints:** {endpoints_data['total_endpoints']}\n"
        markdown += f"**Frameworks Detected:** {', '.join(endpoints_data.get('frameworks_detected', []))}\n\n"
        
        # Security Summary
        security_analysis = endpoints_data.get('security_analysis', {})
        if security_analysis:
            markdown += "### Security Analysis\n"
            markdown += f"- **Authenticated Endpoints:** {security_analysis.get('authenticated_count', 0)}\n"
            markdown += f"- **Public Endpoints:** {security_analysis.get('public_count', 0)}\n"
            markdown += f"- **Security Score:** {security_analysis.get('security_score', 'N/A')}\n\n"
        
        # Create table
        markdown += "### Endpoint Details\n\n"
        markdown += "| Endpoint | Method | Route | Description | Auth | Complexity | File | Lines |\n"
        markdown += "|----------|--------|-------|-------------|------|------------|------|-------|\n"
        
        for endpoint in endpoints_data['endpoints']:
            description = endpoint.get('description', '')[:50]
            if len(endpoint.get('description', '')) > 50:
                description += "..."
            
            markdown += f"| `{endpoint['endpoint_name']}` | {endpoint['http_method']} | `{endpoint['route_path']}` | {description} | {endpoint['auth_required']} | {endpoint['complexity_score']} | `{Path(endpoint['file_path']).name}` | {endpoint['line_range']} |\n"
        
        markdown += "\n"
        return markdown

    def _format_service_architecture_markdown(self, service_data: Dict[str, Any]) -> str:
        """Format service architecture as markdown"""
        
        if not service_data.get('success'):
            return "## Service Architecture\n\nService analysis failed.\n\n"
        
        markdown = "## Service Architecture\n\n"
        markdown += f"**Total Services:** {service_data['service_count']}\n\n"
        
        # Technology Stack
        tech_stack = service_data.get('technology_stack', {})
        if tech_stack:
            markdown += "### Technology Stack\n"
            for category, technologies in tech_stack.items():
                markdown += f"- **{category.title()}:** {', '.join(technologies)}\n"
            markdown += "\n"
        
        # Services table
        markdown += "### Service Breakdown\n\n"
        markdown += "| Service Type | Files | Components | Complexity | Description |\n"
        markdown += "|--------------|-------|------------|------------|--------------|\n"
        
        for service in service_data.get('services', []):
            service_type = service.get('type', 'unknown').replace('_', ' ').title()
            description = service.get('description', 'N/A')[:60]
            if len(service.get('description', '')) > 60:
                description += "..."
            
            markdown += f"| {service_type} | {service.get('file_count', 0)} | {service.get('component_count', 0)} | {service.get('complexity_total', 0)} | {description} |\n"
        
        markdown += "\n"
        return markdown

    def _format_code_structure_markdown(self, structure_data: Dict[str, Any]) -> str:
        """Format code structure as markdown"""
        
        markdown = "## Code Structure Analysis\n\n"
        
        # Language breakdown
        if structure_data.get('language_breakdown'):
            markdown += "### Language Distribution\n\n"
            total_files = sum(structure_data['language_breakdown'].values())
            for lang, count in sorted(structure_data['language_breakdown'].items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_files) * 100 if total_files > 0 else 0
                markdown += f"- **{lang}**: {count} files ({percentage:.1f}%)\n"
            markdown += "\n"
        
        # Node distribution
        if structure_data.get('node_distribution'):
            markdown += "### AST Node Distribution\n\n"
            total_nodes = sum(structure_data['node_distribution'].values())
            for node_type, count in sorted(structure_data['node_distribution'].items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_nodes) * 100 if total_nodes > 0 else 0
                markdown += f"- **{node_type}**: {count} nodes ({percentage:.1f}%)\n"
            markdown += "\n"
        
        # Complexity distribution
        if structure_data.get('complexity_distribution'):
            markdown += "### Complexity Distribution\n\n"
            for bucket, count in structure_data['complexity_distribution'].items():
                markdown += f"- **{bucket.title()} Complexity**: {count} components\n"
            markdown += "\n"
        
        return markdown

    def _format_embeddings_analysis_markdown(self, embeddings_data: Dict[str, Any]) -> str:
        """Format embeddings analysis as markdown"""
        
        markdown = "## Embeddings & Semantic Analysis\n\n"
        markdown += f"**Total Embeddings:** {embeddings_data['total_embeddings']}\n\n"
        
        # Embedding types
        if embeddings_data.get('embedding_types'):
            markdown += "### Embedding Types\n\n"
            for emb_type, count in embeddings_data['embedding_types'].items():
                markdown += f"- **{emb_type}**: {count} embeddings\n"
            markdown += "\n"
        
        # Similarity groups
        if embeddings_data.get('similarity_groups'):
            markdown += "### Similarity Groups\n\n"
            markdown += "| Group Type | Count | Similarity | Sample Files |\n"
            markdown += "|------------|-------|------------|-------------|\n"
            
            for group in embeddings_data['similarity_groups']:
                files_sample = ', '.join([Path(f).name for f in group.get('files', [])[:3]])
                markdown += f"| {group.get('group_type', 'Unknown')} | {group.get('count', 0)} | {group.get('similarity_score', 0):.2f} | {files_sample} |\n"
            markdown += "\n"
        
        # Purpose categories
        if embeddings_data.get('purpose_categories'):
            markdown += "### Purpose Categories\n\n"
            for purpose, count in sorted(embeddings_data['purpose_categories'].items(), key=lambda x: x[1], reverse=True):
                domain, operation = purpose.split(':') if ':' in purpose else (purpose, 'unknown')
                markdown += f"- **{domain} → {operation}**: {count} code units\n"
            markdown += "\n"
        
        return markdown

    # Helper methods for analysis
    def _calculate_completeness(self, sections: Dict[str, Any]) -> float:
        """Calculate documentation completeness score"""
        if not sections:
            return 0.0
        
        successful_sections = sum(1 for section in sections.values() 
                                 if isinstance(section, dict) and section.get('success', True))
        total_sections = len(sections)
        return (successful_sections / total_sections) if total_sections > 0 else 0.0

    def _detect_frameworks(self, ast_nodes: List[Dict[str, Any]]) -> List[str]:
        """Detect which frameworks are being used"""
        frameworks = set()
        
        for node in ast_nodes:
            # Check imports
            if node.get('type') in ['import', 'import_from']:
                module = node.get('module', '').lower()
                for framework, patterns in self.api_patterns.items():
                    for import_pattern in patterns.get('imports', []):
                        if import_pattern in module:
                            frameworks.add(framework.title())
            
            # Check decorators and code content
            decorators = node.get('decorators', [])
            for decorator in decorators:
                decorator_str = str(decorator).lower()
                for framework, patterns in self.api_patterns.items():
                    for keyword in patterns.get('keywords', []):
                        if keyword.lower() in decorator_str:
                            frameworks.add(framework.title())
        
        return list(frameworks)

    def _detect_languages(self, files: List[Dict[str, Any]]) -> List[str]:
        """Detect programming languages from file extensions"""
        extensions = set()
        for file_data in files:
            ext = file_data.get('extension', '').lower()
            if ext:
                extensions.add(ext)
        
        # Map extensions to language names
        language_map = {
            '.py': 'Python',
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.go': 'Go',
            '.rs': 'Rust',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.cs': 'C#',
            '.kt': 'Kotlin',
            '.swift': 'Swift',
            '.scala': 'Scala',
            '.r': 'R',
            '.sql': 'SQL',
            '.json': 'JSON',
            '.yaml': 'YAML',
            '.yml': 'YAML',
            '.xml': 'XML',
            '.html': 'HTML',
            '.css': 'CSS',
            '.md': 'Markdown'
        }
        
        languages = []
        for ext in extensions:
            if ext in language_map:
                languages.append(language_map[ext])
            else:
                languages.append(ext.upper())
        
        return sorted(languages)

    def _analyze_api_security(self, endpoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze API security characteristics"""
        if not endpoints:
            return {}
        
        authenticated_count = sum(1 for ep in endpoints if ep.get('auth_required') == '✅')
        public_count = len(endpoints) - authenticated_count
        
        # Calculate security score
        auth_ratio = authenticated_count / len(endpoints) if endpoints else 0
        security_score = "High" if auth_ratio > 0.7 else "Medium" if auth_ratio > 0.3 else "Low"
        
        return {
            'authenticated_count': authenticated_count,
            'public_count': public_count,
            'security_score': security_score,
            'auth_ratio': auth_ratio
        }

    def _analyze_api_complexity(self, endpoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze API complexity metrics"""
        if not endpoints:
            return {}
        
        complexities = [ep.get('complexity_score', 0) for ep in endpoints]
        avg_complexity = sum(complexities) / len(complexities) if complexities else 0
        
        return {
            'average_complexity': avg_complexity,
            'max_complexity': max(complexities) if complexities else 0,
            'min_complexity': min(complexities) if complexities else 0,
            'complexity_level': 'High' if avg_complexity > 5 else 'Medium' if avg_complexity > 2 else 'Low'
        }

    # Placeholder methods for additional functionality
    def _extract_rate_limit(self, node: Dict[str, Any]) -> str:
        """Extract rate limiting information"""
        # Placeholder - implement based on your rate limiting patterns
        return "Not specified"

    def _extract_response_type(self, node: Dict[str, Any]) -> str:
        """Extract response type information"""
        # Look for return type annotations
        return_type = node.get('return_type_annotation', 'Any')
        return return_type if return_type else "Not specified"

    def _extract_request_schema(self, node: Dict[str, Any]) -> str:
        """Extract request schema information"""
        # Analyze parameters to infer request schema
        parameters = node.get('arguments', [])
        if parameters:
            body_params = [p for p in parameters if 'body' in p.get('name', '').lower()]
            if body_params:
                return body_params[0].get('type_annotation', 'Unknown')
        return "Not specified"

    def _extract_purpose_analysis(self, node: Dict[str, Any]) -> Dict[str, Any]:
        """Extract purpose analysis from enhanced data"""
        enhanced = node.get('enhanced_analysis', {})
        if enhanced:
            return enhanced.get('purpose', {})
        return {}

    def _analyze_error_handling(self, node: Dict[str, Any]) -> List[str]:
        """Analyze error handling patterns"""
        # Placeholder - implement based on try/catch analysis
        return []

    def _extract_endpoint_dependencies(self, node: Dict[str, Any], repo_data: Dict[str, Any]) -> List[str]:
        """Extract endpoint dependencies"""
        # Placeholder - implement based on relationship analysis
        return []

    def _extract_code_sample(self, node: Dict[str, Any]) -> str:
        """Extract code sample for the endpoint"""
        # Placeholder - would need to fetch actual code content
        return f"def {node.get('name', 'function')}(): ..."

    async def _analyze_service_dependencies(self, repo_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze dependencies between services"""
        # Placeholder - implement based on relationship analysis
        return {'dependencies': [], 'circular_dependencies': []}

    def _detect_architecture_patterns(self, repo_data: Dict[str, Any]) -> List[str]:
        """Detect architectural patterns in the codebase"""
        patterns = []
        
        # Look for common patterns based on file structure and names
        files = [f.get('file_path', '') for f in repo_data['files']]
        
        if any('controller' in f.lower() for f in files):
            patterns.append('MVC Pattern')
        if any('repository' in f.lower() for f in files):
            patterns.append('Repository Pattern')
        if any('service' in f.lower() for f in files):
            patterns.append('Service Layer Pattern')
        if any('factory' in f.lower() for f in files):
            patterns.append('Factory Pattern')
        
        return patterns

    def _analyze_technology_stack(self, repo_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """Analyze the technology stack used"""
        stack = {
            'frameworks': [],
            'databases': [],
            'libraries': [],
            'tools': []
        }
        
        # Analyze imports and dependencies from AST nodes
        for node in repo_data['ast_nodes']:
            if node.get('type') in ['import', 'import_from']:
                module = node.get('module', '').lower()
                
                # Frameworks
                if any(fw in module for fw in ['flask', 'django', 'fastapi', 'express']):
                    if 'flask' in module:
                        stack['frameworks'].append('Flask')
                    elif 'django' in module:
                        stack['frameworks'].append('Django')
                    elif 'fastapi' in module:
                        stack['frameworks'].append('FastAPI')
                    elif 'express' in module:
                        stack['frameworks'].append('Express.js')
                
                # Databases
                if any(db in module for db in ['sqlite', 'mysql', 'postgres', 'mongo', 'arango']):
                    if 'sqlite' in module:
                        stack['databases'].append('SQLite')
                    elif 'mysql' in module:
                        stack['databases'].append('MySQL')
                    elif 'postgres' in module:
                        stack['databases'].append('PostgreSQL')
                    elif 'mongo' in module:
                        stack['databases'].append('MongoDB')
                    elif 'arango' in module:
                        stack['databases'].append('ArangoDB')
        
        # Remove duplicates
        for category in stack:
            stack[category] = list(set(stack[category]))
        
        return stack

    # Additional placeholder methods for complete implementation
    async def _generate_purpose_analysis_documentation(self, repository_id: str, repo_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate purpose analysis documentation"""
        return {'success': True, 'analysis': 'Purpose analysis would be implemented here'}

    async def _generate_database_schema_documentation(self, repository_id: str, repo_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate database schema documentation"""
        return {'success': True, 'schema': 'Database schema analysis would be implemented here'}

    async def _generate_complexity_documentation(self, repository_id: str, repo_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate complexity analysis documentation"""
        complexity_analysis = {
            'total_complexity': 0,
            'average_complexity': 0,
            'complexity_hotspots': [],
            'complexity_distribution': {}
        }
        
        # Calculate complexity metrics from AST nodes
        complexities = []
        hotspots = []
        
        for node in repo_data['ast_nodes']:
            complexity = node.get('complexity_contribution', 0)
            if complexity > 0:
                complexities.append(complexity)
                
                if complexity > 5:  # High complexity threshold
                    hotspots.append({
                        'name': node.get('name', ''),
                        'file_path': node.get('file_path', ''),
                        'complexity': complexity,
                        'type': node.get('type', ''),
                        'line_range': f"{node.get('start_line', 0)}-{node.get('end_line', 0)}"
                    })
        
        complexity_analysis['total_complexity'] = sum(complexities)
        complexity_analysis['average_complexity'] = sum(complexities) / len(complexities) if complexities else 0
        complexity_analysis['complexity_hotspots'] = sorted(hotspots, key=lambda x: x['complexity'], reverse=True)[:10]
        
        # Complexity distribution
        for complexity in complexities:
            bucket = self._get_complexity_bucket(complexity)
            if bucket not in complexity_analysis['complexity_distribution']:
                complexity_analysis['complexity_distribution'][bucket] = 0
            complexity_analysis['complexity_distribution'][bucket] += 1
        
        return {
            'success': True,
            'analysis': complexity_analysis
        }

    def _get_complexity_bucket(self, complexity: int) -> str:
        """Categorize complexity score into buckets"""
        if complexity <= 1:
            return 'low'
        elif complexity <= 3:
            return 'medium'
        elif complexity <= 5:
            return 'high'
        else:
            return 'very_high'

    def _format_purpose_analysis_markdown(self, purpose_data: Dict[str, Any]) -> str:
        """Format purpose analysis as markdown"""
        return "## Purpose Analysis\n\nPurpose analysis formatting would be implemented here.\n\n"

    def _format_complexity_analysis_markdown(self, complexity_data: Dict[str, Any]) -> str:
        """Format complexity analysis as markdown"""
        if not complexity_data.get('success'):
            return "## Complexity Analysis\n\nComplexity analysis failed.\n\n"
        
        analysis = complexity_data.get('analysis', {})
        markdown = "## Complexity Analysis\n\n"
        
        markdown += f"**Total Complexity:** {analysis.get('total_complexity', 0)}\n"
        markdown += f"**Average Complexity:** {analysis.get('average_complexity', 0):.2f}\n\n"
        
        # Complexity hotspots
        hotspots = analysis.get('complexity_hotspots', [])
        if hotspots:
            markdown += "### Complexity Hotspots\n\n"
            markdown += "| Component | Type | Complexity | File | Lines |\n"
            markdown += "|-----------|------|------------|------|-------|\n"
            
            for hotspot in hotspots:
                markdown += f"| `{hotspot['name']}` | {hotspot['type']} | {hotspot['complexity']} | `{Path(hotspot['file_path']).name}` | {hotspot['line_range']} |\n"
            markdown += "\n"
        
        # Complexity distribution
        distribution = analysis.get('complexity_distribution', {})
        if distribution:
            markdown += "### Complexity Distribution\n\n"
            for bucket, count in distribution.items():
                markdown += f"- **{bucket.title()}**: {count} components\n"
            markdown += "\n"
        
        return markdown

    async def _format_as_html(self, documentation: Dict[str, Any]) -> str:
        """Convert documentation to HTML format"""
        # Placeholder - implement HTML formatting
        return "<html><body><h1>HTML Documentation</h1><p>HTML formatting would be implemented here.</p></body></html>"
