#!/usr/bin/env python3
"""
Multi-Dimensional Embedding Generator
Part of the AI-Powered Code Refactoring System

This module generates different types of embeddings for code analysis:
- Purpose embeddings: Based on extracted semantic intent
- Code structure embeddings: Based on AST patterns
- Context embeddings: Based on usage patterns and relationships
- Domain embeddings: Based on business domain classification
"""

import ast
import json
import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import hashlib
from abc import ABC, abstractmethod

# Try to import sentence transformers for semantic embeddings
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

# Try to import sklearn for structural embeddings
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger(__name__)

@dataclass
class CodeEmbeddings:
    """Container for all embedding types of a code unit."""
    code: List[float]
    purpose: List[float]
    context: List[float]
    domain: List[float]
    embedding_metadata: Dict[str, Any]

class EmbeddingGenerator(ABC):
    """Abstract base class for embedding generators."""
    
    @abstractmethod
    def generate_embedding(self, input_data: Any) -> List[float]:
        """Generate embedding vector from input data."""
        pass
    
    @abstractmethod
    def get_dimension(self) -> int:
        """Return the dimension of generated embeddings."""
        pass

class PurposeEmbeddingGenerator(EmbeddingGenerator):
    """Generates embeddings based on extracted semantic purpose."""
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.model_name = model_name
        self.model = None
        self.fallback_dimension = 384
        
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.model = SentenceTransformer(model_name)
                logger.info(f"Loaded SentenceTransformer model: {model_name}")
            except Exception as e:
                logger.warning(f"Failed to load SentenceTransformer model: {e}")
                self.model = None
        else:
            logger.warning("SentenceTransformers not available, using fallback embedding")
    
    def generate_embedding(self, purpose_data: Dict[str, Any]) -> List[float]:
        """Generate embedding based on extracted purpose information."""
        purpose_text = self._create_purpose_description(purpose_data)
        
        if self.model:
            try:
                embedding = self.model.encode(purpose_text)
                return embedding.tolist()
            except Exception as e:
                logger.warning(f"Failed to generate semantic embedding: {e}")
                return self._generate_fallback_embedding(purpose_text)
        else:
            return self._generate_fallback_embedding(purpose_text)
    
    def _create_purpose_description(self, purpose_data: Dict[str, Any]) -> str:
        """Convert structured purpose data into natural language description."""
        description_parts = []
        
        # Core intent
        intent = purpose_data.get('intent', 'general')
        description_parts.append(f"This code performs {intent} operations")
        
        # Operation type
        operation_type = purpose_data.get('operation_type', 'processing')
        description_parts.append(f"specifically handling {operation_type}")
        
        # Domain context
        domain = purpose_data.get('domain', 'general')
        description_parts.append(f"in the {domain} business domain")
        
        # Business rule
        business_rule = purpose_data.get('business_rule', '')
        if business_rule:
            description_parts.append(f"implementing {business_rule}")
        
        # Side effects
        side_effects = purpose_data.get('side_effects', 'none')
        if side_effects != 'none':
            description_parts.append(f"with {side_effects}")
        
        # Data flow
        data_flow = purpose_data.get('data_flow', '')
        if data_flow:
            description_parts.append(f"following {data_flow} pattern")
        
        # Evidence context
        evidence = purpose_data.get('evidence', [])
        if evidence:
            description_parts.append(f"evidenced by {', '.join(evidence[:3])}")
        
        return " ".join(description_parts)
    
    def _generate_fallback_embedding(self, text: str) -> List[float]:
        """Generate simple hash-based embedding as fallback."""
        # Create a simple hash-based embedding
        hash_bytes = hashlib.sha256(text.encode()).digest()
        
        # Convert to normalized float vector
        embedding = []
        for i in range(0, len(hash_bytes), 4):
            chunk = hash_bytes[i:i+4]
            if len(chunk) == 4:
                value = int.from_bytes(chunk, byteorder='big')
                normalized_value = (value / (2**32 - 1)) * 2 - 1  # Normalize to [-1, 1]
                embedding.append(normalized_value)
        
        # Pad or truncate to target dimension
        while len(embedding) < self.fallback_dimension:
            embedding.extend(embedding[:min(len(embedding), self.fallback_dimension - len(embedding))])
        
        return embedding[:self.fallback_dimension]
    
    def get_dimension(self) -> int:
        if self.model:
            return self.model.get_sentence_embedding_dimension()
        return self.fallback_dimension

class CodeStructureEmbeddingGenerator(EmbeddingGenerator):
    """Generates embeddings based on code structure and AST patterns."""
    
    def __init__(self, dimension: int = 256):
        self.dimension = dimension
        self.feature_names = [
            'function_count', 'class_count', 'import_count', 'loop_count',
            'conditional_count', 'try_except_count', 'complexity_score',
            'depth_score', 'variable_count', 'call_count', 'return_count',
            'parameter_count', 'decorator_count', 'comprehension_count',
            'generator_count', 'async_count', 'lambda_count', 'global_count'
        ]
    
    def generate_embedding(self, structural_features: Dict[str, Any]) -> List[float]:
        """Generate embedding based on code structure features."""
        # Extract numerical features
        feature_vector = self._extract_feature_vector(structural_features)
        
        # Normalize and pad to target dimension
        normalized_vector = self._normalize_features(feature_vector)
        
        # Expand to target dimension using feature engineering
        expanded_vector = self._expand_to_dimension(normalized_vector)
        
        return expanded_vector
    
    def _extract_feature_vector(self, structural_features: Dict[str, Any]) -> List[float]:
        """Extract numerical feature vector from structural data."""
        vector = []
        
        # Node type counts
        node_types = structural_features.get('node_types', {})
        vector.extend([
            node_types.get('FunctionDef', 0),
            node_types.get('ClassDef', 0),
            node_types.get('Import', 0) + node_types.get('ImportFrom', 0),
            node_types.get('For', 0) + node_types.get('While', 0),
            node_types.get('If', 0),
            node_types.get('Try', 0),
        ])
        
        # Complexity metrics
        complexity = structural_features.get('complexity_metrics', {})
        vector.extend([
            complexity.get('cyclomatic_complexity', 0),
            complexity.get('nesting_depth', 0),
        ])
        
        # Other structural features
        vector.extend([
            structural_features.get('variable_count', 0),
            structural_features.get('call_count', 0),
            structural_features.get('return_count', 0),
            structural_features.get('parameter_count', 0),
            structural_features.get('decorator_count', 0),
            node_types.get('ListComp', 0) + node_types.get('DictComp', 0),
            node_types.get('GeneratorExp', 0),
            node_types.get('AsyncFunctionDef', 0),
            node_types.get('Lambda', 0),
            node_types.get('Global', 0) + node_types.get('Nonlocal', 0),
        ])
        
        return vector
    
    def _normalize_features(self, feature_vector: List[float]) -> List[float]:
        """Normalize feature vector."""
        if not feature_vector:
            return [0.0] * len(self.feature_names)
        
        # Simple min-max normalization with log scaling for counts
        normalized = []
        for value in feature_vector:
            if value > 0:
                normalized.append(np.log1p(value) / 10.0)  # Log scaling
            else:
                normalized.append(0.0)
        
        return normalized
    
    def _expand_to_dimension(self, normalized_vector: List[float]) -> List[float]:
        """Expand feature vector to target dimension using feature engineering."""
        if len(normalized_vector) >= self.dimension:
            return normalized_vector[:self.dimension]
        
        expanded = normalized_vector.copy()
        
        # Add polynomial features (interactions)
        base_features = normalized_vector[:min(8, len(normalized_vector))]
        for i in range(len(base_features)):
            for j in range(i + 1, len(base_features)):
                if len(expanded) < self.dimension:
                    expanded.append(base_features[i] * base_features[j])
        
        # Add squared features
        for value in normalized_vector:
            if len(expanded) < self.dimension:
                expanded.append(value * value)
        
        # Pad with zeros if still too short
        while len(expanded) < self.dimension:
            expanded.append(0.0)
        
        return expanded[:self.dimension]
    
    def get_dimension(self) -> int:
        return self.dimension

class ContextEmbeddingGenerator(EmbeddingGenerator):
    """Generates embeddings based on usage patterns and code context."""
    
    def __init__(self, dimension: int = 256):
        self.dimension = dimension
    
    def generate_embedding(self, context_data: Dict[str, Any]) -> List[float]:
        """Generate embedding based on usage context."""
        # Extract contextual features
        features = self._extract_context_features(context_data)
        
        # Convert to embedding vector
        embedding = self._features_to_embedding(features)
        
        return embedding
    
    def _extract_context_features(self, context_data: Dict[str, Any]) -> Dict[str, float]:
        """Extract contextual features from usage patterns."""
        features = {}
        
        # File-level context
        file_path = context_data.get('file_path', '')
        features['is_test_file'] = 1.0 if 'test' in file_path.lower() else 0.0
        features['is_config_file'] = 1.0 if 'config' in file_path.lower() else 0.0
        features['is_utility_file'] = 1.0 if any(word in file_path.lower() for word in ['util', 'helper', 'common']) else 0.0
        
        # Import patterns
        imports = context_data.get('imports', [])
        features['import_count'] = len(imports)
        features['has_stdlib_imports'] = 1.0 if any('os' in imp or 'sys' in imp for imp in imports) else 0.0
        features['has_external_imports'] = 1.0 if len(imports) > 5 else 0.0
        
        # Usage patterns
        call_patterns = context_data.get('call_patterns', [])
        features['external_calls'] = len([c for c in call_patterns if c.get('is_external', False)])
        features['internal_calls'] = len([c for c in call_patterns if not c.get('is_external', True)])
        
        # Dependency metrics
        dependencies = context_data.get('dependencies', {})
        features['incoming_dependencies'] = dependencies.get('incoming', 0)
        features['outgoing_dependencies'] = dependencies.get('outgoing', 0)
        features['dependency_ratio'] = features['incoming_dependencies'] / max(features['outgoing_dependencies'], 1)
        
        # Repository context
        repo_stats = context_data.get('repository_stats', {})
        features['file_size_percentile'] = repo_stats.get('file_size_percentile', 0.5)
        features['complexity_percentile'] = repo_stats.get('complexity_percentile', 0.5)
        
        return features
    
    def _features_to_embedding(self, features: Dict[str, float]) -> List[float]:
        """Convert contextual features to embedding vector."""
        # Create base vector from features
        base_vector = list(features.values())
        
        # Normalize
        max_val = max(base_vector) if base_vector else 1.0
        if max_val > 0:
            normalized_vector = [v / max_val for v in base_vector]
        else:
            normalized_vector = base_vector
        
        # Expand to target dimension
        embedding = normalized_vector.copy()
        
        # Add feature combinations
        feature_list = list(features.values())
        for i in range(len(feature_list)):
            for j in range(i + 1, len(feature_list)):
                if len(embedding) < self.dimension:
                    embedding.append(feature_list[i] * feature_list[j])
        
        # Pad with computed features based on existing values
        while len(embedding) < self.dimension:
            if len(embedding) > 0:
                # Add some variation based on existing values
                new_val = sum(embedding[-3:]) / 3.0 if len(embedding) >= 3 else 0.0
                embedding.append(new_val)
            else:
                embedding.append(0.0)
        
        return embedding[:self.dimension]
    
    def get_dimension(self) -> int:
        return self.dimension

class DomainEmbeddingGenerator(EmbeddingGenerator):
    """Generates embeddings based on business domain classification."""
    
    def __init__(self, dimension: int = 128):
        self.dimension = dimension
        self.domain_keywords = {
            'user_management': ['user', 'auth', 'login', 'account', 'profile', 'credential'],
            'payment': ['payment', 'billing', 'invoice', 'transaction', 'money', 'price'],
            'inventory': ['inventory', 'product', 'catalog', 'stock', 'item', 'warehouse'],
            'order': ['order', 'cart', 'checkout', 'purchase', 'buy', 'sale'],
            'analytics': ['analytics', 'stats', 'metrics', 'report', 'dashboard', 'chart'],
            'notification': ['notification', 'alert', 'message', 'email', 'sms', 'push'],
            'content': ['content', 'article', 'blog', 'post', 'media', 'document'],
            'security': ['security', 'encrypt', 'hash', 'token', 'permission', 'access'],
            'integration': ['api', 'webhook', 'service', 'client', 'external', 'third_party'],
            'infrastructure': ['database', 'cache', 'queue', 'storage', 'backup', 'deployment']
        }
    
    def generate_embedding(self, domain_data: Dict[str, Any]) -> List[float]:
        """Generate embedding based on business domain information."""
        # Analyze domain from multiple sources
        domain_scores = self._calculate_domain_scores(domain_data)
        
        # Convert to embedding vector
        embedding = self._domain_scores_to_embedding(domain_scores)
        
        return embedding
    
    def _calculate_domain_scores(self, domain_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate confidence scores for different business domains."""
        scores = {domain: 0.0 for domain in self.domain_keywords.keys()}
        
        # Analyze file path
        file_path = domain_data.get('file_path', '').lower()
        for domain, keywords in self.domain_keywords.items():
            for keyword in keywords:
                if keyword in file_path:
                    scores[domain] += 0.3
        
        # Analyze function/class names
        names = domain_data.get('names', [])
        for name in names:
            name_lower = name.lower()
            for domain, keywords in self.domain_keywords.items():
                for keyword in keywords:
                    if keyword in name_lower:
                        scores[domain] += 0.2
        
        # Analyze imports and dependencies
        imports = domain_data.get('imports', [])
        for imp in imports:
            imp_lower = imp.lower()
            for domain, keywords in self.domain_keywords.items():
                for keyword in keywords:
                    if keyword in imp_lower:
                        scores[domain] += 0.1
        
        # Analyze extracted purpose
        purpose = domain_data.get('purpose', {})
        purpose_domain = purpose.get('domain', '')
        if purpose_domain in scores:
            scores[purpose_domain] += 0.4
        
        # Normalize scores
        max_score = max(scores.values()) if scores.values() else 1.0
        if max_score > 0:
            scores = {k: v / max_score for k, v in scores.items()}
        
        return scores
    
    def _domain_scores_to_embedding(self, domain_scores: Dict[str, float]) -> List[float]:
        """Convert domain scores to embedding vector."""
        # Start with raw domain scores
        embedding = list(domain_scores.values())
        
        # Add domain interaction features
        domain_list = list(domain_scores.keys())
        for i, domain1 in enumerate(domain_list):
            for j, domain2 in enumerate(domain_list):
                if i < j and len(embedding) < self.dimension:
                    # Add interaction between domains
                    interaction = domain_scores[domain1] * domain_scores[domain2]
                    embedding.append(interaction)
        
        # Add aggregated features
        if len(embedding) < self.dimension:
            embedding.extend([
                sum(domain_scores.values()),  # Total domain confidence
                max(domain_scores.values()),  # Max domain confidence
                len([s for s in domain_scores.values() if s > 0.1]),  # Number of relevant domains
            ])
        
        # Pad or truncate to target dimension
        while len(embedding) < self.dimension:
            if len(embedding) > 0:
                # Add computed features based on existing values
                new_val = np.mean(embedding[-5:]) if len(embedding) >= 5 else 0.0
                embedding.append(new_val)
            else:
                embedding.append(0.0)
        
        return embedding[:self.dimension]
    
    def get_dimension(self) -> int:
        return self.dimension

class MultiDimensionalEmbeddingEngine:
    """Main engine that coordinates all embedding generators."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Initialize embedding generators
        self.purpose_generator = PurposeEmbeddingGenerator(
            model_name=self.config.get('purpose_model', 'all-MiniLM-L6-v2')
        )
        self.code_generator = CodeStructureEmbeddingGenerator(
            dimension=self.config.get('code_dimension', 256)
        )
        self.context_generator = ContextEmbeddingGenerator(
            dimension=self.config.get('context_dimension', 256)
        )
        self.domain_generator = DomainEmbeddingGenerator(
            dimension=self.config.get('domain_dimension', 128)
        )
        
        logger.info("Initialized MultiDimensionalEmbeddingEngine")
        logger.info(f"Purpose embedding dimension: {self.purpose_generator.get_dimension()}")
        logger.info(f"Code structure embedding dimension: {self.code_generator.get_dimension()}")
        logger.info(f"Context embedding dimension: {self.context_generator.get_dimension()}")
        logger.info(f"Domain embedding dimension: {self.domain_generator.get_dimension()}")
    
    def generate_all_embeddings(self, 
                               purpose_data: Dict[str, Any],
                               structural_features: Dict[str, Any],
                               context_data: Dict[str, Any],
                               domain_data: Dict[str, Any]) -> CodeEmbeddings:
        """Generate all types of embeddings for a code unit."""
        
        try:
            # Generate purpose embedding
            purpose_embedding = self.purpose_generator.generate_embedding(purpose_data)
            
            # Generate code structure embedding
            code_embedding = self.code_generator.generate_embedding(structural_features)
            
            # Generate context embedding
            context_embedding = self.context_generator.generate_embedding(context_data)
            
            # Generate domain embedding
            domain_embedding = self.domain_generator.generate_embedding(domain_data)
            
            # Create metadata
            embedding_metadata = {
                'purpose_dimension': len(purpose_embedding),
                'code_dimension': len(code_embedding),
                'context_dimension': len(context_embedding),
                'domain_dimension': len(domain_embedding),
                'generation_timestamp': str(np.datetime64('now')),
                'purpose_confidence': purpose_data.get('confidence_score', 0.0),
                'primary_domain': max(domain_data.get('purpose', {}).get('domain_scores', {}), 
                                   key=lambda x: domain_data.get('purpose', {}).get('domain_scores', {}).get(x, 0), 
                                   default='general'),
                'embedding_version': '1.0'
            }
            
            return CodeEmbeddings(
                code=code_embedding,
                purpose=purpose_embedding,
                context=context_embedding,
                domain=domain_embedding,
                embedding_metadata=embedding_metadata
            )
            
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            # Return zero embeddings as fallback
            return self._create_fallback_embeddings()
    
    def _create_fallback_embeddings(self) -> CodeEmbeddings:
        """Create fallback zero embeddings."""
        return CodeEmbeddings(
            code=[0.0] * self.code_generator.get_dimension(),
            purpose=[0.0] * self.purpose_generator.get_dimension(),
            context=[0.0] * self.context_generator.get_dimension(),
            domain=[0.0] * self.domain_generator.get_dimension(),
            embedding_metadata={
                'purpose_dimension': self.purpose_generator.get_dimension(),
                'code_dimension': self.code_generator.get_dimension(),
                'context_dimension': self.context_generator.get_dimension(),
                'domain_dimension': self.domain_generator.get_dimension(),
                'generation_timestamp': np.datetime64('now').isoformat(),
                'purpose_confidence': 0.0,
                'primary_domain': 'unknown',
                'embedding_version': '1.0',
                'is_fallback': True
            }
        )
    
    def compute_similarity(self, embeddings1: CodeEmbeddings, embeddings2: CodeEmbeddings,
                          weights: Optional[Dict[str, float]] = None) -> Dict[str, float]:
        """Compute similarity scores between two sets of embeddings."""
        weights = weights or {
            'purpose': 0.4,
            'code': 0.3,
            'context': 0.2,
            'domain': 0.1
        }
        
        similarities = {}
        
        # Compute individual similarities
        similarities['purpose'] = self._cosine_similarity(embeddings1.purpose, embeddings2.purpose)
        similarities['code'] = self._cosine_similarity(embeddings1.code, embeddings2.code)
        similarities['context'] = self._cosine_similarity(embeddings1.context, embeddings2.context)
        similarities['domain'] = self._cosine_similarity(embeddings1.domain, embeddings2.domain)
        
        # Compute weighted combined similarity
        similarities['combined'] = sum(
            similarities[dim] * weights.get(dim, 0.0)
            for dim in ['purpose', 'code', 'context', 'domain']
        )
        
        return similarities
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        
        # Convert to numpy arrays
        a = np.array(vec1)
        b = np.array(vec2)
        
        # Compute cosine similarity
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return np.dot(a, b) / (norm_a * norm_b)
