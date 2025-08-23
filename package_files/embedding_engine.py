#!/usr/bin/env python3
"""
Purpose-Aware Embedding Engine
Advanced embedding generation for semantic understanding
Enhanced from repository_analysis_service.py concepts
"""

import logging
import numpy as np
from typing import Dict, List, Any, Optional, Set, Union, Tuple
from datetime import datetime
import asyncio
import hashlib
import json

# Embedding model imports
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import boto3
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False

logger = logging.getLogger(__name__)

class PurposeAwareEmbeddingEngine:
    """
    Advanced embedding generation for semantic understanding
    Supports multiple embedding types for comprehensive code analysis
    """
    
    def __init__(self, 
                 preferred_model: str = "sentence-transformers",
                 model_config: Dict[str, Any] = None):
        """Initialize the purpose-aware embedding engine."""
        
        self.preferred_model = preferred_model
        self.model_config = model_config or {}
        
        # Embedding models
        self.models = {}
        self.available_backends = []
        
        # Initialize available models
        self._initialize_models()
        
        # Purpose categories for targeted embeddings
        self.purpose_categories = {
            'functional': {
                'description': 'What the code does - its functional behavior',
                'keywords': ['function', 'method', 'operation', 'behavior', 'action'],
                'weight': 1.0
            },
            'structural': {
                'description': 'How the code is organized - its structure and patterns',
                'keywords': ['class', 'module', 'structure', 'organization', 'pattern'],
                'weight': 0.8
            },
            'contextual': {
                'description': 'Where and how the code is used - its context',
                'keywords': ['usage', 'context', 'environment', 'integration', 'interaction'],
                'weight': 0.9
            },
            'domain': {
                'description': 'Business domain and problem space',
                'keywords': ['business', 'domain', 'requirement', 'specification', 'goal'],
                'weight': 1.1
            },
            'quality': {
                'description': 'Code quality, patterns, and maintainability',
                'keywords': ['quality', 'maintainability', 'performance', 'security', 'reliability'],
                'weight': 0.7
            }
        }
        
        # Embedding types configuration
        self.embedding_types = {
            'code_content': {
                'description': 'Direct code content embedding',
                'preprocess': self._preprocess_code_content,
                'dimension_expected': 384  # sentence-transformers default
            },
            'purpose_summary': {
                'description': 'Purpose and intent summary embedding',
                'preprocess': self._preprocess_purpose_summary,
                'dimension_expected': 384
            },
            'documentation': {
                'description': 'Documentation and comments embedding',
                'preprocess': self._preprocess_documentation,
                'dimension_expected': 384
            },
            'signature': {
                'description': 'Function/method signature embedding',
                'preprocess': self._preprocess_signature,
                'dimension_expected': 384
            },
            'semantic_context': {
                'description': 'Semantic context and relationships',
                'preprocess': self._preprocess_semantic_context,
                'dimension_expected': 384
            }
        }
        
        # Similarity thresholds for different purposes
        self.similarity_thresholds = {
            'high_similarity': 0.85,
            'medium_similarity': 0.7,
            'low_similarity': 0.5,
            'refactoring_candidate': 0.8,
            'duplicate_detection': 0.9
        }
    
    def _initialize_models(self):
        """Initialize available embedding models."""
        
        # Sentence Transformers (local)
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                model_name = self.model_config.get('sentence_transformer_model', 
                                                 'all-MiniLM-L6-v2')
                self.models['sentence_transformers'] = SentenceTransformer(model_name)
                self.available_backends.append('sentence_transformers')
                logger.info(f"✅ Sentence Transformers model loaded: {model_name}")
            except Exception as e:
                logger.warning(f"Failed to load Sentence Transformers: {str(e)}")
        
        # OpenAI embeddings
        if OPENAI_AVAILABLE and self.model_config.get('openai_api_key'):
            try:
                openai.api_key = self.model_config['openai_api_key']
                self.available_backends.append('openai')
                logger.info("✅ OpenAI embeddings available")
            except Exception as e:
                logger.warning(f"Failed to configure OpenAI: {str(e)}")
        
        # AWS Bedrock embeddings
        if AWS_AVAILABLE and self.model_config.get('aws_region'):
            try:
                self.models['bedrock'] = boto3.client(
                    'bedrock-runtime',
                    region_name=self.model_config['aws_region']
                )
                self.available_backends.append('bedrock')
                logger.info("✅ AWS Bedrock embeddings available")
            except Exception as e:
                logger.warning(f"Failed to configure AWS Bedrock: {str(e)}")
        
        if not self.available_backends:
            logger.error("❌ No embedding backends available")
        else:
            logger.info(f"🎯 Available embedding backends: {self.available_backends}")
    
    async def generate_file_embeddings(self, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive embeddings for a file."""
        try:
            file_path = file_info['file_path']
            content = file_info['content']
            
            logger.info(f"🧠 Generating embeddings for: {file_path}")
            
            # Extract different types of content for embedding
            content_extractions = self._extract_content_types(content, file_info)
            
            # Generate purpose analysis
            purpose_analysis = await self._analyze_purpose(content, file_info)
            
            # Generate embeddings for each type
            embeddings = {}
            
            for embedding_type, config in self.embedding_types.items():
                if embedding_type in content_extractions:
                    text_content = content_extractions[embedding_type]
                    
                    if text_content and text_content.strip():
                        embedding_result = await self._generate_embedding(
                            text_content, embedding_type
                        )
                        
                        if embedding_result['success']:
                            embeddings[embedding_type] = {
                                'vector': embedding_result['vector'],
                                'text': text_content,
                                'metadata': {
                                    'model': embedding_result['model'],
                                    'dimension': len(embedding_result['vector']),
                                    'generated_at': datetime.utcnow().isoformat()
                                }
                            }
            
            # Generate purpose-specific embeddings
            purpose_embeddings = await self._generate_purpose_embeddings(
                purpose_analysis, content_extractions
            )
            
            # Combine all embeddings
            all_embeddings = []
            
            for embedding_type, embedding_data in embeddings.items():
                embedding_record = {
                    'embedding_type': embedding_type,
                    'vector': embedding_data['vector'],
                    'text_content': embedding_data['text'],
                    'purpose_category': self._categorize_embedding_purpose(embedding_type),
                    'metadata': embedding_data['metadata'],
                    'file_path': file_path,
                    'content_hash': self._calculate_content_hash(embedding_data['text'])
                }
                all_embeddings.append(embedding_record)
            
            # Add purpose-specific embeddings
            for purpose_embedding in purpose_embeddings:
                purpose_embedding.update({
                    'file_path': file_path,
                    'embedding_type': 'purpose_specific'
                })
                all_embeddings.append(purpose_embedding)
            
            return {
                'success': True,
                'embeddings': all_embeddings,
                'purpose_analysis': purpose_analysis,
                'embedding_count': len(all_embeddings),
                'types_generated': list(embeddings.keys())
            }
            
        except Exception as e:
            logger.error(f"Embedding generation failed for {file_info.get('file_path', 'unknown')}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'embeddings': []
            }
    
    def _extract_content_types(self, content: str, file_info: Dict[str, Any]) -> Dict[str, str]:
        """Extract different types of content for embedding."""
        extractions = {}
        
        # Code content (full content, cleaned)
        extractions['code_content'] = self._clean_code_content(content)
        
        # Documentation (comments, docstrings)
        extractions['documentation'] = self._extract_documentation(content, file_info)
        
        # Signatures (function/class signatures)
        extractions['signature'] = self._extract_signatures(content, file_info)
        
        # Semantic context (imports, usage patterns)
        extractions['semantic_context'] = self._extract_semantic_context(content, file_info)
        
        return extractions
    
    def _clean_code_content(self, content: str) -> str:
        """Clean code content for embedding."""
        # Remove excessive whitespace
        lines = content.split('\n')
        cleaned_lines = []
        
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith('#'):  # Remove comments
                cleaned_lines.append(stripped)
        
        return '\n'.join(cleaned_lines)
    
    def _extract_documentation(self, content: str, file_info: Dict[str, Any]) -> str:
        """Extract documentation from code."""
        documentation_parts = []
        
        lines = content.split('\n')
        in_docstring = False
        docstring_delimiter = None
        
        for line in lines:
            stripped = line.strip()
            
            # Single-line comments
            if stripped.startswith('#'):
                documentation_parts.append(stripped[1:].strip())
            
            # Multi-line strings/docstrings
            elif '"""' in stripped or "'''" in stripped:
                if not in_docstring:
                    in_docstring = True
                    docstring_delimiter = '"""' if '"""' in stripped else "'''"
                    # Extract content after opening delimiter
                    start_idx = stripped.find(docstring_delimiter) + 3
                    if start_idx < len(stripped):
                        documentation_parts.append(stripped[start_idx:])
                else:
                    # Extract content before closing delimiter
                    end_idx = stripped.find(docstring_delimiter)
                    if end_idx >= 0:
                        if end_idx > 0:
                            documentation_parts.append(stripped[:end_idx])
                        in_docstring = False
                        docstring_delimiter = None
                    else:
                        documentation_parts.append(stripped)
            
            elif in_docstring:
                documentation_parts.append(stripped)
        
        return '\n'.join(documentation_parts).strip()
    
    def _extract_signatures(self, content: str, file_info: Dict[str, Any]) -> str:
        """Extract function and class signatures."""
        signatures = []
        
        lines = content.split('\n')
        for line in lines:
            stripped = line.strip()
            
            # Function definitions
            if stripped.startswith('def ') or stripped.startswith('async def '):
                signatures.append(stripped)
            
            # Class definitions
            elif stripped.startswith('class '):
                signatures.append(stripped)
            
            # Method definitions (indented)
            elif '    def ' in line or '    async def ' in line:
                signatures.append(stripped)
        
        return '\n'.join(signatures)
    
    def _extract_semantic_context(self, content: str, file_info: Dict[str, Any]) -> str:
        """Extract semantic context from code."""
        context_parts = []
        
        lines = content.split('\n')
        for line in lines:
            stripped = line.strip()
            
            # Import statements
            if stripped.startswith('import ') or stripped.startswith('from '):
                context_parts.append(stripped)
            
            # Decorator usage
            elif stripped.startswith('@'):
                context_parts.append(stripped)
        
        return '\n'.join(context_parts)
    
    async def _analyze_purpose(self, content: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the purpose and intent of code."""
        try:
            # Extract structural information
            structural_info = self._analyze_code_structure(content)
            
            # Infer purpose from content
            purpose_inference = self._infer_purpose_from_content(content, file_info)
            
            # Domain classification
            domain_classification = self._classify_domain(content, file_info)
            
            # Intent analysis
            intent_analysis = self._analyze_intent(content, structural_info)
            
            return {
                'structural_info': structural_info,
                'purpose_inference': purpose_inference,
                'domain_classification': domain_classification,
                'intent_analysis': intent_analysis,
                'confidence_score': self._calculate_purpose_confidence(
                    structural_info, purpose_inference, domain_classification
                )
            }
            
        except Exception as e:
            logger.error(f"Purpose analysis failed: {str(e)}")
            return {
                'error': str(e),
                'confidence_score': 0.0
            }
    
    def _analyze_code_structure(self, content: str) -> Dict[str, Any]:
        """Analyze the structural characteristics of code."""
        lines = content.split('\n')
        
        structure = {
            'total_lines': len(lines),
            'code_lines': 0,
            'comment_lines': 0,
            'blank_lines': 0,
            'function_count': 0,
            'class_count': 0,
            'import_count': 0,
            'complexity_indicators': 0
        }
        
        for line in lines:
            stripped = line.strip()
            
            if not stripped:
                structure['blank_lines'] += 1
            elif stripped.startswith('#'):
                structure['comment_lines'] += 1
            else:
                structure['code_lines'] += 1
                
                # Count structural elements
                if stripped.startswith('def ') or stripped.startswith('async def '):
                    structure['function_count'] += 1
                elif stripped.startswith('class '):
                    structure['class_count'] += 1
                elif stripped.startswith('import ') or stripped.startswith('from '):
                    structure['import_count'] += 1
                
                # Complexity indicators
                if any(keyword in stripped for keyword in ['if', 'for', 'while', 'try', 'except']):
                    structure['complexity_indicators'] += 1
        
        return structure
    
    def _infer_purpose_from_content(self, content: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Infer purpose from content analysis."""
        # Keyword-based purpose inference
        purpose_keywords = {
            'data_processing': ['parse', 'process', 'transform', 'filter', 'map', 'reduce'],
            'api_endpoint': ['route', 'endpoint', 'request', 'response', 'api'],
            'database': ['query', 'insert', 'update', 'delete', 'connection', 'model'],
            'testing': ['test', 'assert', 'mock', 'fixture', 'pytest'],
            'configuration': ['config', 'settings', 'environment', 'constant'],
            'utility': ['helper', 'util', 'common', 'shared'],
            'ui_component': ['component', 'render', 'jsx', 'react', 'vue'],
            'authentication': ['auth', 'login', 'token', 'permission', 'security'],
            'logging': ['log', 'debug', 'info', 'error', 'warning'],
            'validation': ['validate', 'check', 'verify', 'sanitize']
        }
        
        content_lower = content.lower()
        file_path_lower = file_info.get('file_path', '').lower()
        
        purpose_scores = {}
        
        for purpose, keywords in purpose_keywords.items():
            score = 0
            for keyword in keywords:
                # Content matches
                score += content_lower.count(keyword) * 1.0
                # File path matches
                if keyword in file_path_lower:
                    score += 2.0
            
            if score > 0:
                purpose_scores[purpose] = score
        
        # Normalize scores
        if purpose_scores:
            max_score = max(purpose_scores.values())
            normalized_scores = {k: v / max_score for k, v in purpose_scores.items()}
        else:
            normalized_scores = {}
        
        return {
            'primary_purpose': max(normalized_scores.keys(), key=normalized_scores.get) if normalized_scores else 'unknown',
            'purpose_scores': normalized_scores,
            'confidence': max(normalized_scores.values()) if normalized_scores else 0.0
        }
    
    def _classify_domain(self, content: str, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Classify the business domain of the code."""
        domain_indicators = {
            'web_development': ['http', 'web', 'server', 'client', 'browser', 'html', 'css'],
            'data_science': ['pandas', 'numpy', 'scikit', 'matplotlib', 'data', 'analysis'],
            'machine_learning': ['model', 'train', 'predict', 'algorithm', 'neural', 'learning'],
            'database': ['sql', 'database', 'table', 'query', 'orm', 'migration'],
            'security': ['encrypt', 'decrypt', 'hash', 'token', 'auth', 'secure'],
            'infrastructure': ['docker', 'kubernetes', 'deploy', 'infrastructure', 'devops'],
            'business_logic': ['business', 'process', 'workflow', 'logic', 'rule'],
            'integration': ['api', 'service', 'integration', 'external', 'third_party']
        }
        
        content_lower = content.lower()
        
        domain_scores = {}
        for domain, indicators in domain_indicators.items():
            score = sum(content_lower.count(indicator) for indicator in indicators)
            if score > 0:
                domain_scores[domain] = score
        
        return {
            'primary_domain': max(domain_scores.keys(), key=domain_scores.get) if domain_scores else 'general',
            'domain_scores': domain_scores,
            'confidence': max(domain_scores.values()) / sum(domain_scores.values()) if domain_scores else 0.0
        }
    
    def _analyze_intent(self, content: str, structural_info: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the intent of the code."""
        # Intent based on structure and patterns
        intent = 'general'
        confidence = 0.5
        
        if structural_info['class_count'] > 0 and structural_info['function_count'] > 3:
            intent = 'object_oriented_design'
            confidence = 0.8
        elif structural_info['function_count'] > 5:
            intent = 'functional_processing'
            confidence = 0.7
        elif 'test' in content.lower():
            intent = 'testing'
            confidence = 0.9
        elif structural_info['import_count'] > 3:
            intent = 'integration_module'
            confidence = 0.6
        
        return {
            'primary_intent': intent,
            'confidence': confidence
        }
    
    def _calculate_purpose_confidence(self, structural_info: Dict[str, Any],
                                    purpose_inference: Dict[str, Any],
                                    domain_classification: Dict[str, Any]) -> float:
        """Calculate overall confidence in purpose analysis."""
        structural_confidence = min(1.0, structural_info['code_lines'] / 50)  # More code = higher confidence
        purpose_confidence = purpose_inference.get('confidence', 0.0)
        domain_confidence = domain_classification.get('confidence', 0.0)
        
        # Weighted average
        overall_confidence = (
            structural_confidence * 0.3 +
            purpose_confidence * 0.4 +
            domain_confidence * 0.3
        )
        
        return round(overall_confidence, 3)
    
    async def _generate_purpose_embeddings(self, purpose_analysis: Dict[str, Any],
                                         content_extractions: Dict[str, str]) -> List[Dict[str, Any]]:
        """Generate purpose-specific embeddings."""
        purpose_embeddings = []
        
        for category, config in self.purpose_categories.items():
            # Create purpose-specific text
            purpose_text = self._create_purpose_text(category, purpose_analysis, content_extractions)
            
            if purpose_text.strip():
                embedding_result = await self._generate_embedding(purpose_text, f'purpose_{category}')
                
                if embedding_result['success']:
                    purpose_embeddings.append({
                        'purpose_category': category,
                        'vector': embedding_result['vector'],
                        'text_content': purpose_text,
                        'weight': config['weight'],
                        'metadata': {
                            'model': embedding_result['model'],
                            'dimension': len(embedding_result['vector']),
                            'generated_at': datetime.utcnow().isoformat(),
                            'purpose_confidence': purpose_analysis.get('confidence_score', 0.0)
                        }
                    })
        
        return purpose_embeddings
    
    def _create_purpose_text(self, category: str, purpose_analysis: Dict[str, Any],
                           content_extractions: Dict[str, str]) -> str:
        """Create purpose-specific text for embedding."""
        parts = []
        
        if category == 'functional':
            # Focus on what the code does
            if 'signature' in content_extractions:
                parts.append(content_extractions['signature'])
            
            purpose_info = purpose_analysis.get('purpose_inference', {})
            if purpose_info.get('primary_purpose'):
                parts.append(f"Primary purpose: {purpose_info['primary_purpose']}")
        
        elif category == 'structural':
            # Focus on how the code is organized
            structural_info = purpose_analysis.get('structural_info', {})
            parts.append(f"Structure: {structural_info.get('function_count', 0)} functions, "
                        f"{structural_info.get('class_count', 0)} classes")
            
            if 'semantic_context' in content_extractions:
                parts.append(content_extractions['semantic_context'])
        
        elif category == 'contextual':
            # Focus on usage context
            if 'semantic_context' in content_extractions:
                parts.append(content_extractions['semantic_context'])
            
            intent_info = purpose_analysis.get('intent_analysis', {})
            if intent_info.get('primary_intent'):
                parts.append(f"Intent: {intent_info['primary_intent']}")
        
        elif category == 'domain':
            # Focus on business domain
            domain_info = purpose_analysis.get('domain_classification', {})
            if domain_info.get('primary_domain'):
                parts.append(f"Domain: {domain_info['primary_domain']}")
            
            if 'documentation' in content_extractions:
                parts.append(content_extractions['documentation'])
        
        elif category == 'quality':
            # Focus on quality aspects
            structural_info = purpose_analysis.get('structural_info', {})
            parts.append(f"Quality metrics: {structural_info.get('complexity_indicators', 0)} complexity indicators")
            
            if 'documentation' in content_extractions:
                parts.append(content_extractions['documentation'])
        
        return '\n'.join(parts)
    
    async def _generate_embedding(self, text: str, embedding_type: str) -> Dict[str, Any]:
        """Generate embedding for text using available models."""
        try:
            # Choose best available model
            backend = self._choose_best_backend()
            
            if backend == 'sentence_transformers':
                vector = self.models['sentence_transformers'].encode([text])[0]
                return {
                    'success': True,
                    'vector': vector.tolist(),
                    'model': 'sentence_transformers'
                }
            
            elif backend == 'openai':
                response = await openai.Embedding.acreate(
                    model="text-embedding-ada-002",
                    input=text
                )
                vector = response['data'][0]['embedding']
                return {
                    'success': True,
                    'vector': vector,
                    'model': 'openai_ada_002'
                }
            
            elif backend == 'bedrock':
                # AWS Bedrock embedding implementation would go here
                # This is a placeholder
                return {
                    'success': False,
                    'error': 'Bedrock implementation not complete'
                }
            
            else:
                return {
                    'success': False,
                    'error': 'No embedding backend available'
                }
                
        except Exception as e:
            logger.error(f"Embedding generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _choose_best_backend(self) -> str:
        """Choose the best available embedding backend."""
        # Priority order: sentence_transformers (local) > openai > bedrock
        for backend in ['sentence_transformers', 'openai', 'bedrock']:
            if backend in self.available_backends:
                return backend
        
        raise RuntimeError("No embedding backend available")
    
    async def calculate_similarities(self, repo_id: str) -> List[Dict[str, Any]]:
        """Calculate similarities between code elements in a repository."""
        similarities = []
        
        # This would query the database for all embeddings in the repository
        # and calculate pairwise similarities
        
        # Placeholder implementation
        # In a real implementation, this would:
        # 1. Query all embeddings for the repository
        # 2. Calculate cosine similarities between embeddings
        # 3. Filter by similarity thresholds
        # 4. Create similarity records
        
        return similarities
    
    def _categorize_embedding_purpose(self, embedding_type: str) -> str:
        """Categorize embedding type into purpose categories."""
        if embedding_type == 'code_content':
            return 'functional'
        elif embedding_type == 'documentation':
            return 'domain'
        elif embedding_type == 'signature':
            return 'structural'
        elif embedding_type == 'semantic_context':
            return 'contextual'
        else:
            return 'general'
    
    def _calculate_content_hash(self, content: str) -> str:
        """Calculate hash for content deduplication."""
        return hashlib.md5(content.encode()).hexdigest()
    
    # Preprocessing methods for different embedding types
    def _preprocess_code_content(self, text: str) -> str:
        """Preprocess code content for embedding."""
        return self._clean_code_content(text)
    
    def _preprocess_purpose_summary(self, text: str) -> str:
        """Preprocess purpose summary for embedding."""
        return text.strip()
    
    def _preprocess_documentation(self, text: str) -> str:
        """Preprocess documentation for embedding."""
        return text.strip()
    
    def _preprocess_signature(self, text: str) -> str:
        """Preprocess signatures for embedding."""
        return text.strip()
    
    def _preprocess_semantic_context(self, text: str) -> str:
        """Preprocess semantic context for embedding."""
        return text.strip()
