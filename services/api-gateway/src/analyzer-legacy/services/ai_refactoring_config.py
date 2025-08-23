#!/usr/bin/env python3
"""
Configuration for AI-Powered Code Refactoring System
Centralized configuration management for all AI components
"""

import os
from typing import Dict, Any, List
from pathlib import Path

class AIRefactoringConfig:
    """Configuration manager for AI refactoring system."""
    
    def __init__(self):
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from environment variables and defaults."""
        return {
            # Embedding Configuration
            'embeddings': {
                'purpose': {
                    'model_name': os.getenv('PURPOSE_EMBEDDING_MODEL', 'all-MiniLM-L6-v2'),
                    'dimension': int(os.getenv('PURPOSE_EMBEDDING_DIM', '384')),
                    'batch_size': int(os.getenv('PURPOSE_BATCH_SIZE', '32')),
                    'cache_embeddings': os.getenv('CACHE_PURPOSE_EMBEDDINGS', 'true').lower() == 'true'
                },
                'code': {
                    'dimension': int(os.getenv('CODE_EMBEDDING_DIM', '256')),
                    'feature_engineering': os.getenv('CODE_FEATURE_ENGINEERING', 'true').lower() == 'true',
                    'normalization': os.getenv('CODE_NORMALIZATION', 'minmax')  # minmax, standard, robust
                },
                'context': {
                    'dimension': int(os.getenv('CONTEXT_EMBEDDING_DIM', '256')),
                    'include_file_metrics': os.getenv('INCLUDE_FILE_METRICS', 'true').lower() == 'true',
                    'include_dependency_metrics': os.getenv('INCLUDE_DEP_METRICS', 'true').lower() == 'true'
                },
                'domain': {
                    'dimension': int(os.getenv('DOMAIN_EMBEDDING_DIM', '128')),
                    'custom_domains': os.getenv('CUSTOM_DOMAINS', '').split(',') if os.getenv('CUSTOM_DOMAINS') else []
                }
            },
            
            # Similarity Analysis Configuration
            'similarity': {
                'thresholds': {
                    'purpose': float(os.getenv('SIMILARITY_PURPOSE_THRESHOLD', '0.85')),
                    'code': float(os.getenv('SIMILARITY_CODE_THRESHOLD', '0.7')),
                    'context': float(os.getenv('SIMILARITY_CONTEXT_THRESHOLD', '0.6')),
                    'domain': float(os.getenv('SIMILARITY_DOMAIN_THRESHOLD', '0.8')),
                    'combined': float(os.getenv('SIMILARITY_COMBINED_THRESHOLD', '0.75')),
                    'duplicate': float(os.getenv('SIMILARITY_DUPLICATE_THRESHOLD', '0.9'))
                },
                'weights': {
                    'purpose': float(os.getenv('SIMILARITY_PURPOSE_WEIGHT', '0.4')),
                    'code': float(os.getenv('SIMILARITY_CODE_WEIGHT', '0.3')),
                    'context': float(os.getenv('SIMILARITY_CONTEXT_WEIGHT', '0.2')),
                    'domain': float(os.getenv('SIMILARITY_DOMAIN_WEIGHT', '0.1'))
                },
                'cache_results': os.getenv('CACHE_SIMILARITY_RESULTS', 'true').lower() == 'true',
                'cache_ttl_hours': int(os.getenv('SIMILARITY_CACHE_TTL', '24')),
                'max_results_per_query': int(os.getenv('MAX_SIMILARITY_RESULTS', '100'))
            },
            
            # Refactoring Analysis Configuration
            'refactoring': {
                'min_group_size': int(os.getenv('REFACTORING_MIN_GROUP_SIZE', '3')),
                'max_opportunities': int(os.getenv('REFACTORING_MAX_OPPORTUNITIES', '50')),
                'priority_weights': {
                    'duplicate_penalty': float(os.getenv('DUPLICATE_PENALTY_WEIGHT', '2.0')),
                    'complexity_bonus': float(os.getenv('COMPLEXITY_BONUS_WEIGHT', '1.5')),
                    'risk_penalty': float(os.getenv('RISK_PENALTY_WEIGHT', '0.8')),
                    'effort_penalty': float(os.getenv('EFFORT_PENALTY_WEIGHT', '0.6'))
                },
                'effort_estimation': {
                    'base_hours': {
                        'low': int(os.getenv('EFFORT_LOW_BASE_HOURS', '4')),
                        'medium': int(os.getenv('EFFORT_MEDIUM_BASE_HOURS', '12')),
                        'high': int(os.getenv('EFFORT_HIGH_BASE_HOURS', '24'))
                    },
                    'complexity_multiplier': float(os.getenv('COMPLEXITY_EFFORT_MULTIPLIER', '1.5')),
                    'file_count_multiplier': float(os.getenv('FILE_COUNT_EFFORT_MULTIPLIER', '0.2'))
                }
            },
            
            # Purpose Extraction Configuration
            'purpose_extraction': {
                'confidence_threshold': float(os.getenv('PURPOSE_CONFIDENCE_THRESHOLD', '0.7')),
                'pattern_matching': {
                    'enable_naming_analysis': os.getenv('ENABLE_NAMING_ANALYSIS', 'true').lower() == 'true',
                    'enable_structural_analysis': os.getenv('ENABLE_STRUCTURAL_ANALYSIS', 'true').lower() == 'true',
                    'enable_documentation_analysis': os.getenv('ENABLE_DOC_ANALYSIS', 'true').lower() == 'true',
                    'enable_dataflow_analysis': os.getenv('ENABLE_DATAFLOW_ANALYSIS', 'true').lower() == 'true'
                },
                'domain_keywords': self._get_domain_keywords(),
                'operation_types': [
                    'validation', 'transformation', 'persistence', 'calculation', 
                    'communication', 'orchestration', 'utility', 'processing'
                ]
            },
            
            # AST Analysis Configuration
            'ast_analysis': {
                'max_nesting_depth': int(os.getenv('MAX_NESTING_DEPTH_ANALYSIS', '10')),
                'complexity_thresholds': {
                    'low': int(os.getenv('COMPLEXITY_LOW_THRESHOLD', '5')),
                    'medium': int(os.getenv('COMPLEXITY_MEDIUM_THRESHOLD', '10')),
                    'high': int(os.getenv('COMPLEXITY_HIGH_THRESHOLD', '20'))
                },
                'analyze_imports': os.getenv('ANALYZE_IMPORTS', 'true').lower() == 'true',
                'analyze_docstrings': os.getenv('ANALYZE_DOCSTRINGS', 'true').lower() == 'true',
                'analyze_comments': os.getenv('ANALYZE_COMMENTS', 'false').lower() == 'true'
            },
            
            # Performance Configuration
            'performance': {
                'parallel_processing': os.getenv('ENABLE_PARALLEL_PROCESSING', 'true').lower() == 'true',
                'max_workers': int(os.getenv('MAX_WORKERS', '4')),
                'batch_size': int(os.getenv('ANALYSIS_BATCH_SIZE', '10')),
                'memory_limit_mb': int(os.getenv('MEMORY_LIMIT_MB', '2048')),
                'timeout_seconds': int(os.getenv('ANALYSIS_TIMEOUT_SECONDS', '300'))
            },
            
            # Caching Configuration
            'caching': {
                'enable_analysis_cache': os.getenv('ENABLE_ANALYSIS_CACHE', 'true').lower() == 'true',
                'cache_ttl_days': int(os.getenv('ANALYSIS_CACHE_TTL_DAYS', '7')),
                'max_cache_size_mb': int(os.getenv('MAX_CACHE_SIZE_MB', '1024')),
                'cache_cleanup_interval_hours': int(os.getenv('CACHE_CLEANUP_INTERVAL_HOURS', '24'))
            },
            
            # Logging Configuration
            'logging': {
                'level': os.getenv('AI_REFACTORING_LOG_LEVEL', 'INFO'),
                'enable_metrics': os.getenv('ENABLE_AI_METRICS', 'true').lower() == 'true',
                'metrics_interval_seconds': int(os.getenv('METRICS_INTERVAL_SECONDS', '60')),
                'log_embeddings': os.getenv('LOG_EMBEDDINGS', 'false').lower() == 'true',
                'log_similarity_computations': os.getenv('LOG_SIMILARITY_COMPUTATIONS', 'false').lower() == 'true'
            },
            
            # Development and Debug Configuration
            'debug': {
                'enable_debug_mode': os.getenv('AI_REFACTORING_DEBUG', 'false').lower() == 'true',
                'save_intermediate_results': os.getenv('SAVE_INTERMEDIATE_RESULTS', 'false').lower() == 'true',
                'debug_output_dir': os.getenv('DEBUG_OUTPUT_DIR', 'debug_output'),
                'profile_performance': os.getenv('PROFILE_PERFORMANCE', 'false').lower() == 'true'
            }
        }
    
    def _get_domain_keywords(self) -> Dict[str, List[str]]:
        """Get domain keyword mappings."""
        return {
            'user_management': ['user', 'auth', 'login', 'account', 'profile', 'credential', 'session'],
            'payment': ['payment', 'billing', 'invoice', 'transaction', 'money', 'price', 'cost', 'charge'],
            'inventory': ['inventory', 'product', 'catalog', 'stock', 'item', 'warehouse', 'goods'],
            'order': ['order', 'cart', 'checkout', 'purchase', 'buy', 'sale', 'shopping'],
            'analytics': ['analytics', 'stats', 'metrics', 'report', 'dashboard', 'chart', 'graph'],
            'notification': ['notification', 'alert', 'message', 'email', 'sms', 'push', 'notify'],
            'content': ['content', 'article', 'blog', 'post', 'media', 'document', 'file'],
            'security': ['security', 'encrypt', 'hash', 'token', 'permission', 'access', 'auth'],
            'integration': ['api', 'webhook', 'service', 'client', 'external', 'third_party', 'integration'],
            'infrastructure': ['database', 'cache', 'queue', 'storage', 'backup', 'deployment', 'config'],
            'communication': ['request', 'response', 'http', 'rest', 'graphql', 'websocket', 'rpc'],
            'data_processing': ['etl', 'transform', 'pipeline', 'stream', 'batch', 'process', 'clean'],
            'monitoring': ['monitor', 'health', 'status', 'log', 'trace', 'debug', 'error'],
            'testing': ['test', 'mock', 'stub', 'fixture', 'assertion', 'verify', 'validate']
        }
    
    def get(self, key_path: str, default: Any = None) -> Any:
        """Get configuration value using dot notation (e.g., 'embeddings.purpose.model_name')."""
        keys = key_path.split('.')
        value = self.config
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        
        return value
    
    def get_embedding_config(self, embedding_type: str) -> Dict[str, Any]:
        """Get configuration for a specific embedding type."""
        return self.config.get('embeddings', {}).get(embedding_type, {})
    
    def get_similarity_config(self) -> Dict[str, Any]:
        """Get similarity analysis configuration."""
        return self.config.get('similarity', {})
    
    def get_refactoring_config(self) -> Dict[str, Any]:
        """Get refactoring analysis configuration."""
        return self.config.get('refactoring', {})
    
    def get_purpose_extraction_config(self) -> Dict[str, Any]:
        """Get purpose extraction configuration."""
        return self.config.get('purpose_extraction', {})
    
    def is_debug_enabled(self) -> bool:
        """Check if debug mode is enabled."""
        return self.config.get('debug', {}).get('enable_debug_mode', False)
    
    def get_performance_config(self) -> Dict[str, Any]:
        """Get performance configuration."""
        return self.config.get('performance', {})
    
    def validate_config(self) -> Dict[str, Any]:
        """Validate configuration values."""
        validation_result = {
            'valid': True,
            'warnings': [],
            'errors': []
        }
        
        # Validate similarity weights sum to 1.0
        weights = self.config.get('similarity', {}).get('weights', {})
        weight_sum = sum(weights.values())
        if abs(weight_sum - 1.0) > 0.01:
            validation_result['warnings'].append(
                f"Similarity weights sum to {weight_sum:.3f}, should be 1.0"
            )
        
        # Validate thresholds are in valid range
        thresholds = self.config.get('similarity', {}).get('thresholds', {})
        for name, threshold in thresholds.items():
            if not 0.0 <= threshold <= 1.0:
                validation_result['errors'].append(
                    f"Similarity threshold '{name}' ({threshold}) must be between 0.0 and 1.0"
                )
                validation_result['valid'] = False
        
        # Validate embedding dimensions are positive
        for embedding_type in ['purpose', 'code', 'context', 'domain']:
            dim = self.get(f'embeddings.{embedding_type}.dimension', 0)
            if dim <= 0:
                validation_result['errors'].append(
                    f"Embedding dimension for '{embedding_type}' must be positive, got {dim}"
                )
                validation_result['valid'] = False
        
        # Validate performance settings
        max_workers = self.get('performance.max_workers', 1)
        if max_workers < 1:
            validation_result['errors'].append(
                f"max_workers must be at least 1, got {max_workers}"
            )
            validation_result['valid'] = False
        
        return validation_result
    
    def get_config_summary(self) -> str:
        """Get a human-readable summary of the configuration."""
        summary_lines = [
            "AI-Powered Code Refactoring System Configuration",
            "=" * 50,
            "",
            "Embedding Models:",
            f"  Purpose: {self.get('embeddings.purpose.model_name')} (dim: {self.get('embeddings.purpose.dimension')})",
            f"  Code Structure: Custom (dim: {self.get('embeddings.code.dimension')})",
            f"  Context: Custom (dim: {self.get('embeddings.context.dimension')})",
            f"  Domain: Custom (dim: {self.get('embeddings.domain.dimension')})",
            "",
            "Similarity Analysis:",
            f"  Purpose threshold: {self.get('similarity.thresholds.purpose'):.2f}",
            f"  Combined threshold: {self.get('similarity.thresholds.combined'):.2f}",
            f"  Purpose weight: {self.get('similarity.weights.purpose'):.2f}",
            "",
            "Refactoring Analysis:",
            f"  Min group size: {self.get('refactoring.min_group_size')}",
            f"  Max opportunities: {self.get('refactoring.max_opportunities')}",
            "",
            "Performance:",
            f"  Parallel processing: {self.get('performance.parallel_processing')}",
            f"  Max workers: {self.get('performance.max_workers')}",
            f"  Batch size: {self.get('performance.batch_size')}",
            "",
            f"Debug mode: {self.is_debug_enabled()}"
        ]
        
        return "\n".join(summary_lines)

# Global configuration instance
config = AIRefactoringConfig()

# Convenience functions
def get_embedding_config(embedding_type: str) -> Dict[str, Any]:
    """Get embedding configuration for a specific type."""
    return config.get_embedding_config(embedding_type)

def get_similarity_config() -> Dict[str, Any]:
    """Get similarity analysis configuration."""
    return config.get_similarity_config()

def get_refactoring_config() -> Dict[str, Any]:
    """Get refactoring analysis configuration."""
    return config.get_refactoring_config()

def is_debug_enabled() -> bool:
    """Check if debug mode is enabled."""
    return config.is_debug_enabled()
