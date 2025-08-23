"""
Real Embedding Service for code search and analysis.
Connects to Ollama for generating embeddings.
"""

import logging
import hashlib
import time
from typing import List, Dict, Any, Optional
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating embeddings using Ollama."""
    
    def __init__(self, ollama_url: str = "http://localhost:11436", model: str = "nomic-embed-text"):
        """Initialize the embedding service."""
        self.ollama_url = ollama_url.rstrip('/')
        self.model = model
        self.cache = {}  # Simple in-memory cache
        
        # Test connection
        self._test_connection()
    
    def _test_connection(self) -> bool:
        """Test connection to Ollama."""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name") for m in models]
                if self.model in model_names or f"{self.model}:latest" in model_names:
                    logger.info(f"✅ Connected to Ollama. Model {self.model} is available.")
                    return True
                else:
                    logger.warning(f"⚠️ Connected to Ollama, but model {self.model} not found. Available: {model_names}")
                    return False
            else:
                logger.error(f"❌ Ollama responded with status {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"❌ Failed to connect to Ollama at {self.ollama_url}: {e}")
            return False
    
    def get_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for text."""
        if not text.strip():
            return None
            
        # Check cache
        text_hash = hashlib.md5(text.encode()).hexdigest()
        if text_hash in self.cache:
            return self.cache[text_hash]
        
        try:
            # Truncate if too long
            if len(text) > 8000:
                text = text[:8000]
            
            response = requests.post(
                f"{self.ollama_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                embedding = data.get('embedding', [])
                
                if embedding:
                    # Cache the result
                    self.cache[text_hash] = embedding
                    return embedding
                else:
                    logger.error("Empty embedding received from Ollama")
                    return None
            else:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None
    
    def get_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts."""
        embeddings = []
        for text in texts:
            embedding = self.get_embedding(text)
            embeddings.append(embedding)
            # Small delay to avoid overwhelming the service
            time.sleep(0.1)
        return embeddings
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        
        # Calculate dot product and magnitudes
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = sum(a * a for a in vec1) ** 0.5
        magnitude2 = sum(b * b for b in vec2) ** 0.5
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    def search_similar(self, query_text: str, code_snippets: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
        """Search for similar code snippets using embeddings."""
        query_embedding = self.get_embedding(query_text)
        if not query_embedding:
            return []
        
        similarities = []
        for snippet in code_snippets:
            snippet_text = snippet.get('content', snippet.get('code', ''))
            snippet_embedding = self.get_embedding(snippet_text)
            
            if snippet_embedding:
                similarity = self.cosine_similarity(query_embedding, snippet_embedding)
                similarities.append({
                    **snippet,
                    'similarity': similarity,
                    'embedding': snippet_embedding
                })
        
        # Sort by similarity (descending) and return top results
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        return similarities[:limit]
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the current model."""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get("models", [])
                for model in models:
                    if model.get("name") == self.model or model.get("name") == f"{self.model}:latest":
                        return {
                            "name": model.get("name"),
                            "size": model.get("size", "unknown"),
                            "modified": model.get("modified_at"),
                            "provider": "Ollama",
                            "dimensions": 768,  # nomic-embed-text dimensions
                            "status": "available"
                        }
            
            return {
                "name": self.model,
                "provider": "Ollama",
                "dimensions": 768,
                "status": "unknown"
            }
        except Exception as e:
            logger.error(f"Error getting model info: {e}")
            return {
                "name": self.model,
                "provider": "Ollama",
                "status": "error",
                "error": str(e)
            }
    
    def is_available(self) -> bool:
        """Check if the embedding service is available."""
        return self._test_connection()
    
    def clear_cache(self):
        """Clear the embedding cache."""
        cache_size = len(self.cache)
        self.cache.clear()
        logger.info(f"Cleared embedding cache ({cache_size} entries)")
