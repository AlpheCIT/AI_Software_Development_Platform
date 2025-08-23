#!/usr/bin/env python3
"""
Dead Code Similarity Analyzer - Uses embeddings to find similar dead code patterns
Identifies duplicate code, missing integrations, and refactoring opportunities
"""

import os
import json
import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import hashlib

try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False

try:
    from arango import ArangoClient
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DeadCodeSimilarityAnalyzer:
    """Analyzes dead code for similarity patterns using embeddings."""
    
    def __init__(self, db=None, model_name="sentence-transformers/all-MiniLM-L6-v2"):
        self.db = db
        self.model_name = model_name
        self.model = None
        
        if EMBEDDINGS_AVAILABLE:
            try:
                self.model = SentenceTransformer(model_name)
                logger.info(f"Loaded embedding model: {model_name}")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                
    def analyze_semantic_duplicates_with_context(self, similarity_threshold: float = 0.95) -> Dict[str, Any]:
        """
        Perform deep semantic analysis with detailed context comparison.
        Returns precise similarity scores and contextual differences.
        """
        try:
            # Get dead and live code functions
            dead_functions = self._get_dead_code()
            live_functions = self._get_live_code()
            
            if not dead_functions:
                return {"success": False, "error": "No dead code found"}
            
            detailed_comparisons = []
            
            for dead_func in dead_functions:
                # Find semantically similar live functions
                similar_live_functions = self._find_semantically_similar_functions(
                    dead_func, live_functions, similarity_threshold
                )
                
                for live_func, similarity_score in similar_live_functions:
                    # Perform detailed contextual analysis
                    analysis = self._perform_detailed_comparison(dead_func, live_func, similarity_score)
                    if analysis:
                        detailed_comparisons.append(analysis)
            
            # Sort by confidence score (highest first)
            detailed_comparisons.sort(key=lambda x: x.get('removal_confidence', 0), reverse=True)
            
            return {
                "success": True,
                "analysis_type": "semantic_duplicate_analysis_with_context",
                "detailed_comparisons": detailed_comparisons,
                "total_comparisons": len(detailed_comparisons),
                "analysis_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in semantic analysis: {e}")
            return {"success": False, "error": str(e)}
    
    def _get_live_code(self) -> List[Dict[str, Any]]:
        """Retrieve live (used) code functions from the database."""
        try:
            if not self.db:
                return []
                
            # Query for functions WITH incoming relationships (live code)
            query = """
            FOR node IN ast_nodes
                FILTER node.type == "FunctionDeclaration"
                LET incoming = (
                    FOR rel IN relationships
                        FILTER rel._to == CONCAT("ast_nodes/", node._key)
                        RETURN 1
                )
                FILTER LENGTH(incoming) > 0
                RETURN {
                    _key: node._key,
                    name: node.name,
                    file_path: node.file_path,
                    line_start: node.line_start,
                    line_end: node.line_end,
                    code_content: node.code_content,
                    parameters: node.parameters,
                    variables_used: node.variables_used,
                    variables_defined: node.variables_defined,
                    function_calls: node.function_calls,
                    usage_count: LENGTH(incoming)
                }
            """
            
            cursor = self.db.aql.execute(query)
            return list(cursor)
            
        except Exception as e:
            logger.error(f"Error getting live code: {e}")
            return []
    
    def _find_semantically_similar_functions(self, dead_func: Dict, live_functions: List[Dict], threshold: float) -> List[Tuple[Dict, float]]:
        """Find live functions that are semantically similar to the dead function."""
        if not self.model:
            # Fallback to basic text similarity if no embeddings available
            return self._basic_similarity_comparison(dead_func, live_functions, threshold)
        
        try:
            # Generate embedding for dead function
            dead_text = self._function_to_text(dead_func)
            dead_embedding = self.model.encode([dead_text])
            
            similar_functions = []
            
            for live_func in live_functions:
                # Generate embedding for live function
                live_text = self._function_to_text(live_func)
                live_embedding = self.model.encode([live_text])
                
                # Calculate semantic similarity
                similarity = cosine_similarity(dead_embedding, live_embedding)[0][0]
                
                if similarity >= threshold:
                    similar_functions.append((live_func, float(similarity)))
            
            # Sort by similarity score (highest first)
            similar_functions.sort(key=lambda x: x[1], reverse=True)
            return similar_functions[:5]  # Top 5 matches
            
        except Exception as e:
            logger.error(f"Error in semantic similarity calculation: {e}")
            return []
    
    def _perform_detailed_comparison(self, dead_func: Dict, live_func: Dict, similarity_score: float) -> Dict[str, Any]:
        """Perform detailed comparison between dead and live functions."""
        try:
            # Extract code content
            dead_code = dead_func.get('code_content', '')
            live_code = live_func.get('code_content', '')
            
            if not dead_code or not live_code:
                return None
            
            # Analyze variable usage differences
            variable_analysis = self._analyze_variable_differences(dead_func, live_func)
            
            # Calculate removal confidence based on multiple factors
            removal_confidence = self._calculate_removal_confidence(
                dead_func, live_func, similarity_score, variable_analysis
            )
            
            # Generate detailed comparison
            return {
                "comparison_id": f"comp_{dead_func.get('_key', 'unknown')}_{live_func.get('_key', 'unknown')}",
                "semantic_similarity_score": similarity_score,
                "dead_function": {
                    "name": dead_func.get('name', 'unknown'),
                    "file": dead_func.get('file_path', 'unknown'),
                    "lines": f"{dead_func.get('line_start', 0)}-{dead_func.get('line_end', 0)}",
                    "code_content": dead_code,
                    "status": "dead_code",
                    "variables_used": dead_func.get('variables_used', []),
                    "variables_defined": dead_func.get('variables_defined', [])
                },
                "live_function": {
                    "name": live_func.get('name', 'unknown'),
                    "file": live_func.get('file_path', 'unknown'),
                    "lines": f"{live_func.get('line_start', 0)}-{live_func.get('line_end', 0)}",
                    "code_content": live_code,
                    "status": "used_code",
                    "usage_count": live_func.get('usage_count', 0),
                    "variables_used": live_func.get('variables_used', []),
                    "variables_defined": live_func.get('variables_defined', [])
                },
                "contextual_analysis": {
                    "variable_differences": variable_analysis,
                    "root_cause": self._identify_root_cause(variable_analysis),
                    "code_differences": self._highlight_code_differences(dead_code, live_code)
                },
                "removal_confidence": removal_confidence,
                "recommendation": self._generate_recommendation(removal_confidence, variable_analysis),
                "requires_confirmation": removal_confidence < 0.95
            }
            
        except Exception as e:
            logger.error(f"Error in detailed comparison: {e}")
            return None
    
    def _analyze_variable_differences(self, dead_func: Dict, live_func: Dict) -> Dict[str, Any]:
        """Analyze differences in variable usage between functions."""
        dead_vars_used = set(dead_func.get('variables_used', []))
        live_vars_used = set(live_func.get('variables_used', []))
        dead_vars_defined = set(dead_func.get('variables_defined', []))
        live_vars_defined = set(live_func.get('variables_defined', []))
        
        # Find variables that are different
        unique_to_dead = dead_vars_used - live_vars_used
        unique_to_live = live_vars_used - dead_vars_used
        
        # Check variable availability in their respective files
        dead_var_availability = self._check_variable_availability(dead_func, unique_to_dead)
        live_var_availability = self._check_variable_availability(live_func, unique_to_live)
        
        return {
            "unique_to_dead_function": list(unique_to_dead),
            "unique_to_live_function": list(unique_to_live),
            "dead_function_var_availability": dead_var_availability,
            "live_function_var_availability": live_var_availability,
            "common_variables": list(dead_vars_used & live_vars_used),
            "variable_scope_issues": self._identify_scope_issues(dead_var_availability, live_var_availability)
        }
    
    def _check_variable_availability(self, func: Dict, variables: set) -> Dict[str, str]:
        """Check if variables are available in the function's scope."""
        availability = {}
        file_path = func.get('file_path', '')
        
        for var in variables:
            # Query the database to check if variable is defined in the same file or imported
            try:
                query = """
                FOR node IN ast_nodes
                    FILTER node.file_path == @file_path
                    FILTER @var IN (node.variables_defined || [])
                    RETURN node.name
                """
                
                cursor = self.db.aql.execute(query, bind_vars={'file_path': file_path, 'var': var})
                defining_nodes = list(cursor)
                
                if defining_nodes:
                    availability[var] = f"defined_in_file_by_{defining_nodes[0]}"
                else:
                    availability[var] = "not_available_in_scope"
                    
            except Exception as e:
                logger.error(f"Error checking variable availability: {e}")
                availability[var] = "unknown"
        
        return availability
    
    def _calculate_removal_confidence(self, dead_func: Dict, live_func: Dict, similarity: float, var_analysis: Dict) -> float:
        """Calculate confidence score for removing the dead function."""
        confidence = similarity  # Start with semantic similarity
        
        # Penalize if dead function uses unavailable variables
        unavailable_vars = [var for var, status in var_analysis['dead_function_var_availability'].items() 
                          if 'not_available' in status]
        if unavailable_vars:
            confidence += 0.05  # Increase confidence if dead function has scope issues
        
        # Penalize if functions have very different variable usage patterns
        unique_dead = len(var_analysis['unique_to_dead_function'])
        unique_live = len(var_analysis['unique_to_live_function'])
        total_vars = unique_dead + unique_live + len(var_analysis['common_variables'])
        
        if total_vars > 0:
            variable_similarity = len(var_analysis['common_variables']) / total_vars
            confidence = (confidence + variable_similarity) / 2
        
        # Boost confidence if live function is heavily used
        usage_count = live_func.get('usage_count', 0)
        if usage_count > 5:
            confidence += 0.02
        
        return min(confidence, 0.99999)  # Cap at 99.999%
    
    def _identify_root_cause(self, var_analysis: Dict) -> str:
        """Identify the root cause of why the dead function exists."""
        scope_issues = var_analysis.get('variable_scope_issues', [])
        unique_dead = var_analysis.get('unique_to_dead_function', [])
        
        if scope_issues:
            return f"Variable scope issues: {', '.join(scope_issues)}"
        elif unique_dead:
            return f"Dead function uses different variables: {', '.join(unique_dead[:3])}"
        else:
            return "Nearly identical implementation - likely copy-paste code"
    
    def _generate_recommendation(self, confidence: float, var_analysis: Dict) -> str:
        """Generate a specific recommendation based on the analysis."""
        if confidence > 0.95:
            return f"High confidence removal candidate. Confidence: {confidence:.5f}"
        elif confidence > 0.90:
            return f"Good removal candidate with minor review needed. Confidence: {confidence:.5f}"
        else:
            return f"Manual review required - significant differences found. Confidence: {confidence:.5f}"
    
    def _highlight_code_differences(self, dead_code: str, live_code: str) -> Dict[str, Any]:
        """Highlight differences between dead and live code."""
        # Simple diff analysis - in production you'd use difflib
        dead_lines = dead_code.split('\n')
        live_lines = live_code.split('\n')
        
        return {
            "dead_code_lines": len(dead_lines),
            "live_code_lines": len(live_lines),
            "estimated_similarity": len(set(dead_lines) & set(live_lines)) / max(len(dead_lines), len(live_lines)) if dead_lines and live_lines else 0
        }
    
    def _identify_scope_issues(self, dead_var_availability: Dict, live_var_availability: Dict) -> List[str]:
        """Identify specific variable scope issues."""
        issues = []
        
        for var, status in dead_var_availability.items():
            if 'not_available' in status:
                issues.append(f"Variable '{var}' not available in dead function scope")
        
        return issues
    
    def _basic_similarity_comparison(self, dead_func: Dict, live_functions: List[Dict], threshold: float) -> List[Tuple[Dict, float]]:
        """Fallback similarity comparison when embeddings are not available."""
        dead_name = dead_func.get('name', '')
        similar_functions = []
        
        for live_func in live_functions:
            live_name = live_func.get('name', '')
            
            # Simple name-based similarity
            if dead_name == live_name:
                similarity = 0.95  # High similarity for exact name match
            elif dead_name.lower() in live_name.lower() or live_name.lower() in dead_name.lower():
                similarity = 0.75  # Medium similarity for partial match
            else:
                similarity = 0.0
            
            if similarity >= threshold:
                similar_functions.append((live_func, similarity))
        
        return similar_functions
    
    def _function_to_text(self, func: Dict) -> str:
        """Convert function data to text for embedding generation."""
        name = func.get('name', '')
        code = func.get('code_content', '')
        params = ', '.join(func.get('parameters', []))
        
        return f"Function {name}({params}): {code}"
    
    def analyze_dead_code_similarities(self, similarity_threshold: float = 0.7) -> Dict[str, Any]:
        """Find similar patterns in dead code."""
        try:
            # Get all dead code functions
            dead_code = self._get_dead_code()
            if not dead_code:
                return {"success": False, "error": "No dead code found"}
            
            # Generate embeddings for dead code
            dead_code_with_embeddings = self._generate_embeddings_for_dead_code(dead_code)
            
            # Find similar dead code patterns
            similarity_groups = self._find_similarity_groups(dead_code_with_embeddings, similarity_threshold)
            
            # Find potentially missing integrations
            missing_integrations = self._find_missing_integrations(dead_code_with_embeddings)
            
            # Find similar live code that might be duplicates
            potential_duplicates = self._find_potential_duplicates(dead_code_with_embeddings, similarity_threshold)
            
            return {
                "success": True,
                "analysis_results": {
                    "total_dead_functions": len(dead_code),
                    "similarity_groups": similarity_groups,
                    "missing_integrations": missing_integrations,
                    "potential_duplicates": potential_duplicates,
                    "analysis_timestamp": datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing dead code similarities: {e}")
            return {"success": False, "error": str(e)}
    
    def _get_dead_code(self) -> List[Dict[str, Any]]:
        """Retrieve dead code functions from the database."""
        try:
            if not self.db:
                return []
                
            # Query for functions with no incoming relationships
            query = """
            FOR node IN ast_nodes
                FILTER node.type == "FunctionDeclaration"
                LET incoming = (
                    FOR rel IN relationships
                        FILTER rel._to == CONCAT("ast_nodes/", node._key)
                        RETURN 1
                )
                FILTER LENGTH(incoming) == 0
                RETURN {
                    _key: node._key,
                    name: node.name,
                    file_path: node.file_path,
                    repository_id: node.repository_id,
                    line_start: node.line_start,
                    line_end: node.line_end,
                    code_content: node.code_content,
                    parameters: node.parameters,
                    variables_used: node.variables_used,
                    variables_defined: node.variables_defined,
                    function_calls: node.function_calls,
                    complexity: node.complexity,
                    metadata: node.metadata
                }
            """
            
            cursor = self.db.aql.execute(query)
            return list(cursor)
            
        except Exception as e:
            logger.error(f"Error retrieving dead code: {e}")
            return []
    
    def _generate_embeddings_for_dead_code(self, dead_code: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate embeddings for dead code functions."""
        if not self.model:
            logger.warning("Embedding model not available")
            return dead_code
            
        enhanced_dead_code = []
        
        for func in dead_code:
            try:
                # Create a comprehensive text representation
                func_text = self._create_function_text_representation(func)
                
                # Generate embedding
                embedding = self.model.encode(func_text)
                
                # Add embedding to function data
                func_with_embedding = func.copy()
                func_with_embedding["embedding"] = embedding.tolist()
                func_with_embedding["embedding_text"] = func_text
                func_with_embedding["embedding_model"] = self.model_name
                
                enhanced_dead_code.append(func_with_embedding)
                
                # Store embedding in database
                self._store_embedding(func["_key"], embedding, func_text)
                
            except Exception as e:
                logger.error(f"Error generating embedding for {func['name']}: {e}")
                enhanced_dead_code.append(func)
        
        return enhanced_dead_code
    
    def _create_function_text_representation(self, func: Dict[str, Any]) -> str:
        """Create a text representation of a function for embedding."""
        parts = []
        
        # Function name
        parts.append(f"Function: {func['name']}")
        
        # Function metadata if available
        if func.get('metadata'):
            metadata = func['metadata']
            
            # Parameters
            if metadata.get('parameters'):
                params = ", ".join(metadata['parameters'])
                parts.append(f"Parameters: {params}")
            
            # Docstring
            if metadata.get('docstring'):
                parts.append(f"Documentation: {metadata['docstring']}")
            
            # Function type
            if metadata.get('is_async'):
                parts.append("Type: async function")
            else:
                parts.append("Type: function")
        
        # File context
        file_name = os.path.basename(func.get('file_path', ''))
        parts.append(f"File: {file_name}")
        
        # Complexity
        if func.get('complexity'):
            complexity = func['complexity']
            if complexity.get('cyclomatic'):
                parts.append(f"Complexity: {complexity['cyclomatic']}")
        
        return " | ".join(parts)
    
    def _store_embedding(self, function_key: str, embedding: np.ndarray, text: str):
        """Store embedding in the ast_nodes collection."""
        try:
            if not self.db:
                return
                
            collection = self.db.collection('ast_nodes')
            
            # Update the AST node with embedding data
            update_data = {
                "embedding": embedding.tolist(),
                "embedding_text": text,
                "embedding_model": self.model_name,
                "embedding_generated_at": datetime.now().isoformat()
            }
            
            collection.update({"_key": function_key}, update_data)
            logger.debug(f"Stored embedding for function: {function_key}")
            
        except Exception as e:
            logger.error(f"Error storing embedding: {e}")
    
    def _find_similarity_groups(self, functions: List[Dict[str, Any]], threshold: float) -> List[Dict[str, Any]]:
        """Find groups of similar dead code functions."""
        if not functions or len(functions) < 2:
            return []
        
        # Extract embeddings
        embeddings = []
        for func in functions:
            if 'embedding' in func:
                embeddings.append(func['embedding'])
            else:
                return []  # No embeddings available
        
        embeddings = np.array(embeddings)
        
        # Calculate similarity matrix
        similarity_matrix = cosine_similarity(embeddings)
        
        # Find similarity groups
        groups = []
        processed = set()
        
        for i, func1 in enumerate(functions):
            if i in processed:
                continue
                
            similar_functions = [func1]
            processed.add(i)
            
            for j, func2 in enumerate(functions):
                if i != j and j not in processed and similarity_matrix[i][j] >= threshold:
                    similar_functions.append(func2)
                    processed.add(j)
            
            if len(similar_functions) > 1:
                groups.append({
                    "group_id": len(groups) + 1,
                    "similarity_score": float(np.max([similarity_matrix[i][j] for j in range(len(functions)) if j != i and j in [functions.index(f) for f in similar_functions[1:]]])) if len(similar_functions) > 1 else 0.0,
                    "functions": [{
                        "name": f["name"],
                        "file": os.path.basename(f.get("file_path", "")),
                        "lines": f"{f.get('line_start', 0)}-{f.get('line_end', 0)}",
                        "complexity": f.get("complexity", {}).get("cyclomatic", 0),
                        "embedding_text": f.get("embedding_text", "")
                    } for f in similar_functions],
                    "analysis": self._analyze_similarity_group(similar_functions)
                })
        
        return groups
    
    def _analyze_similarity_group(self, similar_functions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze a group of similar functions to determine the pattern."""
        analysis = {
            "pattern_type": "unknown",
            "recommendation": "",
            "confidence": 0.0
        }
        
        # Check if functions have similar names
        names = [f["name"] for f in similar_functions]
        if len(set(names)) == 1:
            analysis["pattern_type"] = "exact_duplicate"
            analysis["recommendation"] = f"Multiple copies of '{names[0]}' function found. Consider consolidating into a single implementation."
            analysis["confidence"] = 0.9
        elif any(name1.lower() in name2.lower() or name2.lower() in name1.lower() for name1 in names for name2 in names if name1 != name2):
            analysis["pattern_type"] = "similar_naming"
            analysis["recommendation"] = "Functions with similar names and functionality. Review for potential consolidation."
            analysis["confidence"] = 0.7
        else:
            analysis["pattern_type"] = "similar_functionality"
            analysis["recommendation"] = "Functions with similar behavior but different names. Consider creating a shared utility function."
            analysis["confidence"] = 0.6
        
        # Check file distribution
        files = [os.path.basename(f.get("file_path", "")) for f in similar_functions]
        if len(set(files)) > 1:
            analysis["file_distribution"] = f"Spread across {len(set(files))} files: {', '.join(set(files))}"
        else:
            analysis["file_distribution"] = f"All in same file: {files[0]}"
        
        return analysis
    
    def _find_missing_integrations(self, dead_functions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find dead functions that might have missing integrations."""
        missing_integrations = []
        
        try:
            if not self.db:
                return missing_integrations
            
            # Get all live functions for comparison
            query = """
            FOR node IN ast_nodes
                FILTER node.type == "FunctionDeclaration"
                LET incoming = (
                    FOR rel IN relationships
                        FILTER rel._to == CONCAT("ast_nodes/", node._key)
                        RETURN 1
                )
                FILTER LENGTH(incoming) > 0
                RETURN {
                    _key: node._key,
                    name: node.name,
                    file_path: node.file_path,
                    embedding: node.embedding
                }
            """
            
            cursor = self.db.aql.execute(query)
            live_functions = list(cursor)
            
            # Find dead functions similar to live functions
            for dead_func in dead_functions:
                if 'embedding' not in dead_func:
                    continue
                    
                dead_embedding = np.array(dead_func['embedding'])
                
                best_matches = []
                for live_func in live_functions:
                    if 'embedding' not in live_func or not live_func['embedding']:
                        continue
                    
                    live_embedding = np.array(live_func['embedding'])
                    similarity = cosine_similarity([dead_embedding], [live_embedding])[0][0]
                    
                    if similarity > 0.5:  # Lower threshold for potential integrations
                        best_matches.append({
                            "live_function": live_func['name'],
                            "live_file": os.path.basename(live_func.get('file_path', '')),
                            "similarity": float(similarity)
                        })
                
                if best_matches:
                    best_matches.sort(key=lambda x: x['similarity'], reverse=True)
                    missing_integrations.append({
                        "dead_function": dead_func['name'],
                        "dead_file": os.path.basename(dead_func.get('file_path', '')),
                        "similar_live_functions": best_matches[:3],  # Top 3 matches
                        "recommendation": self._generate_integration_recommendation(dead_func, best_matches[0])
                    })
            
        except Exception as e:
            logger.error(f"Error finding missing integrations: {e}")
        
        return missing_integrations
    
    def _find_potential_duplicates(self, dead_functions: List[Dict[str, Any]], threshold: float) -> List[Dict[str, Any]]:
        """Find live code that might be duplicates of dead code."""
        potential_duplicates = []
        
        try:
            if not self.db:
                return potential_duplicates
            
            # Get all live functions
            query = """
            FOR node IN ast_nodes
                FILTER node.type == "FunctionDeclaration"
                LET incoming = (
                    FOR rel IN relationships
                        FILTER rel._to == CONCAT("ast_nodes/", node._key)
                        RETURN 1
                )
                FILTER LENGTH(incoming) > 0
                RETURN node
            """
            
            cursor = self.db.aql.execute(query)
            live_functions = list(cursor)
            
            # Compare dead functions with live functions
            for dead_func in dead_functions:
                if 'embedding' not in dead_func:
                    continue
                    
                dead_embedding = np.array(dead_func['embedding'])
                
                for live_func in live_functions:
                    if 'embedding' not in live_func or not live_func.get('embedding'):
                        continue
                    
                    live_embedding = np.array(live_func['embedding'])
                    similarity = cosine_similarity([dead_embedding], [live_embedding])[0][0]
                    
                    if similarity >= threshold:
                        potential_duplicates.append({
                            "dead_function": {
                                "name": dead_func['name'],
                                "file": os.path.basename(dead_func.get('file_path', '')),
                                "lines": f"{dead_func.get('line_start', 0)}-{dead_func.get('line_end', 0)}"
                            },
                            "live_function": {
                                "name": live_func['name'],
                                "file": os.path.basename(live_func.get('file_path', '')),
                                "lines": f"{live_func.get('line_start', 0)}-{live_func.get('line_end', 0)}"
                            },
                            "similarity_score": float(similarity),
                            "recommendation": "Review if the dead function is a duplicate that can be safely removed or if the live function should be using the dead one instead."
                        })
            
        except Exception as e:
            logger.error(f"Error finding potential duplicates: {e}")
        
        return potential_duplicates
    
    def _generate_integration_recommendation(self, dead_func: Dict[str, Any], similar_live: Dict[str, Any]) -> str:
        """Generate a recommendation for potentially missing integration."""
        similarity = similar_live['similarity']
        
        if similarity > 0.8:
            return f"High similarity with '{similar_live['live_function']}'. Consider if this function should be called or if it's a duplicate."
        elif similarity > 0.6:
            return f"Moderate similarity with '{similar_live['live_function']}'. Review if this provides additional functionality that should be integrated."
        else:
            return f"Some similarity with '{similar_live['live_function']}'. May indicate related functionality that could be connected."

def analyze_dead_code_similarities_api(similarity_threshold: float = 0.7):
    """API function to analyze dead code similarities."""
    try:
        # Use same connection parameters as backend
        arango_host = os.getenv('ARANGO_HOST', 'localhost')
        arango_port = int(os.getenv('ARANGO_PORT', '8529'))
        ARANGO_USER = os.getenv('ARANGO_USER', 'root')
        arango_password = os.getenv('ARANGO_PASSWORD', 'password')
        arango_database = os.getenv('ARANGO_DATABASE', 'code_management')
        
        client = ArangoClient(hosts=f'http://{arango_host}:{arango_port}')
        db = client.db(arango_database, username=ARANGO_USER, password=arango_password)
        
        analyzer = DeadCodeSimilarityAnalyzer(db)
        result = analyzer.analyze_dead_code_similarities(similarity_threshold)
        
        return result
        
    except Exception as e:
        logger.error(f"Error in API analysis: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Test the analyzer
    result = analyze_dead_code_similarities_api(0.7)
    print(json.dumps(result, indent=2))
