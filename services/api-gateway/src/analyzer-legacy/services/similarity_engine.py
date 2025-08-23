#!/usr/bin/env python3
"""
Similarity Analysis Engine
Part of the AI-Powered Code Refactoring System

This module provides sophisticated similarity analysis using multi-dimensional
embeddings to identify code patterns suitable for refactoring.
"""

import logging
import json
import hashlib
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import numpy as np

try:
    from arango import ArangoClient
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False

logger = logging.getLogger(__name__)

@dataclass
class SimilarityResult:
    """Result of similarity analysis between code units."""
    source_id: str
    target_id: str
    similarity_scores: Dict[str, float]
    combined_score: float
    similarity_type: str
    confidence: float
    evidence: List[str]

@dataclass
class SimilarityGroup:
    """Group of similar code units identified for potential refactoring."""
    group_id: str
    similarity_type: str
    members: List[Dict[str, Any]]
    average_similarity: float
    refactoring_potential: float
    priority: str
    analysis: Dict[str, Any]

class SimilarityEngine:
    """Engine for computing and analyzing code similarities."""
    
    def __init__(self, db, config: Optional[Dict[str, Any]] = None):
        self.db = db
        self.config = config or {}
        
        # Similarity thresholds
        self.thresholds = {
            'purpose': self.config.get('purpose_threshold', 0.85),
            'code': self.config.get('code_threshold', 0.7),
            'context': self.config.get('context_threshold', 0.6),
            'domain': self.config.get('domain_threshold', 0.8),
            'combined': self.config.get('combined_threshold', 0.75)
        }
        
        # Similarity weights for combined score
        self.weights = {
            'purpose': self.config.get('purpose_weight', 0.4),
            'code': self.config.get('code_weight', 0.3),
            'context': self.config.get('context_weight', 0.2),
            'domain': self.config.get('domain_weight', 0.1)
        }
        
        logger.info("Initialized SimilarityEngine")
        logger.info(f"Thresholds: {self.thresholds}")
        logger.info(f"Weights: {self.weights}")
    
    def find_similar_by_purpose(self, target_node_id: str, threshold: float = None, 
                               limit: int = 10) -> List[SimilarityResult]:
        """Find code units with similar purpose to the target."""
        threshold = threshold or self.thresholds['purpose']
        
        query = """
        FOR target IN codeunits
            FILTER target._key == @target_id
            FOR candidate IN codeunits
                FILTER candidate._key != @target_id
                LET purpose_sim = COSINE_SIMILARITY(target.embeddings.purpose, candidate.embeddings.purpose)
                LET code_sim = COSINE_SIMILARITY(target.embeddings.code, candidate.embeddings.code)
                LET context_sim = COSINE_SIMILARITY(target.embeddings.context, candidate.embeddings.context)
                LET domain_sim = COSINE_SIMILARITY(target.embeddings.domain, candidate.embeddings.domain)
                LET combined_sim = (purpose_sim * @purpose_weight + 
                                  code_sim * @code_weight + 
                                  context_sim * @context_weight + 
                                  domain_sim * @domain_weight)
                FILTER purpose_sim >= @threshold
                SORT purpose_sim DESC, combined_sim DESC
                LIMIT @limit
                RETURN {
                    source_id: target._key,
                    target_id: candidate._key,
                    source_node: target,
                    target_node: candidate,
                    similarity_scores: {
                        purpose: purpose_sim,
                        code: code_sim,
                        context: context_sim,
                        domain: domain_sim,
                        combined: combined_sim
                    }
                }
        """
        
        try:
            cursor = self.db.aql.execute(query, bind_vars={
                'target_id': target_node_id,
                'threshold': threshold,
                'limit': limit,
                'purpose_weight': self.weights['purpose'],
                'code_weight': self.weights['code'],
                'context_weight': self.weights['context'],
                'domain_weight': self.weights['domain']
            })
            
            results = []
            for result in cursor:
                similarity_result = self._create_similarity_result(result)
                results.append(similarity_result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error finding similar code by purpose: {e}")
            return []
    
    def find_refactoring_candidates(self, min_group_size: int = 3, 
                                  similarity_threshold: float = None) -> List[SimilarityGroup]:
        """Identify groups of similar code that could be refactored together."""
        similarity_threshold = similarity_threshold or self.thresholds['combined']
        
        query = """
        FOR node IN codeunits
            FILTER node.type IN ["function", "async_function"]
            FOR similar IN codeunits
                FILTER similar._key != node._key AND similar.type IN ["function", "async_function"]
                LET purpose_sim = COSINE_SIMILARITY(node.embeddings.purpose, similar.embeddings.purpose)
                LET domain_sim = COSINE_SIMILARITY(node.embeddings.domain, similar.embeddings.domain)
                LET combined_sim = (purpose_sim * @purpose_weight + 
                                  COSINE_SIMILARITY(node.embeddings.code, similar.embeddings.code) * @code_weight + 
                                  COSINE_SIMILARITY(node.embeddings.context, similar.embeddings.context) * @context_weight + 
                                  domain_sim * @domain_weight)
                FILTER combined_sim >= @threshold
                COLLECT group = {
                    purpose_type: node.purpose.operation_type,
                    domain: node.purpose.domain,
                    intent: node.purpose.intent
                } INTO candidates = {
                    node: node,
                    similar: similar,
                    similarity: combined_sim,
                    purpose_sim: purpose_sim,
                    domain_sim: domain_sim
                }
                FILTER LENGTH(candidates) >= @min_group_size
                RETURN {
                    group_info: group,
                    members: candidates,
                    avg_similarity: AVG(candidates[*].similarity),
                    max_similarity: MAX(candidates[*].similarity),
                    member_count: LENGTH(candidates)
                }
        """
        
        try:
            cursor = self.db.aql.execute(query, bind_vars={
                'threshold': similarity_threshold,
                'min_group_size': min_group_size,
                'purpose_weight': self.weights['purpose'],
                'code_weight': self.weights['code'],
                'context_weight': self.weights['context'],
                'domain_weight': self.weights['domain']
            })
            
            groups = []
            for result in cursor:
                group = self._create_similarity_group(result)
                groups.append(group)
            
            # Sort by refactoring potential
            groups.sort(key=lambda g: g.refactoring_potential, reverse=True)
            
            return groups
            
        except Exception as e:
            logger.error(f"Error finding refactoring candidates: {e}")
            return []
    
    def find_duplicate_logic(self, threshold: float = 0.9) -> List[SimilarityGroup]:
        """Find code segments that implement essentially the same logic."""
        query = """
        FOR node IN codeunits
            FILTER node.type IN ["function", "async_function"]
            FOR similar IN codeunits
                FILTER similar._key != node._key AND similar.type IN ["function", "async_function"]
                LET purpose_sim = COSINE_SIMILARITY(node.embeddings.purpose, similar.embeddings.purpose)
                LET code_sim = COSINE_SIMILARITY(node.embeddings.code, similar.embeddings.code)
                FILTER purpose_sim >= @threshold AND code_sim >= (@threshold - 0.1)
                COLLECT group = {
                    intent: node.purpose.intent,
                    operation_type: node.purpose.operation_type,
                    domain: node.purpose.domain,
                    business_rule: node.purpose.business_rule
                } INTO duplicates = {
                    node: node,
                    similar: similar,
                    purpose_sim: purpose_sim,
                    code_sim: code_sim,
                    combined_sim: (purpose_sim + code_sim) / 2
                }
                FILTER LENGTH(duplicates) >= 2
                RETURN {
                    group_info: group,
                    members: duplicates,
                    avg_similarity: AVG(duplicates[*].combined_sim),
                    duplicate_count: LENGTH(duplicates),
                    refactor_potential: LENGTH(duplicates) * AVG(duplicates[*].purpose_sim)
                }
        """
        
        try:
            cursor = self.db.aql.execute(query, bind_vars={
                'threshold': threshold
            })
            
            groups = []
            for result in cursor:
                group = self._create_duplicate_group(result)
                groups.append(group)
            
            return groups
            
        except Exception as e:
            logger.error(f"Error finding duplicate logic: {e}")
            return []
    
    def find_architectural_inconsistencies(self) -> List[Dict[str, Any]]:
        """Find architectural inconsistencies across the codebase."""
        query = """
        FOR node IN codeunits
            FILTER node.purpose.domain != "general"
            COLLECT domain = node.purpose.domain INTO domain_nodes
            LET operations = (
                FOR n IN domain_nodes[*].node
                    COLLECT op = n.purpose.operation_type INTO op_nodes
                    RETURN {
                        operation: op,
                        implementations: op_nodes[*].node,
                        count: LENGTH(op_nodes)
                    }
            )
            LET inconsistent_ops = (
                FOR op IN operations
                    FILTER op.count > 1
                    LET similarities = (
                        FOR i IN 0..LENGTH(op.implementations)-2
                            FOR j IN (i+1)..LENGTH(op.implementations)-1
                                LET sim = COSINE_SIMILARITY(
                                    op.implementations[i].embeddings.purpose, 
                                    op.implementations[j].embeddings.purpose
                                )
                                RETURN sim
                    )
                    LET avg_sim = AVG(similarities)
                    FILTER avg_sim < 0.8  // Low similarity indicates inconsistency
                    RETURN {
                        operation: op.operation,
                        implementations: op.implementations,
                        avg_similarity: avg_sim,
                        inconsistency_score: 1 - avg_sim
                    }
            )
            FILTER LENGTH(inconsistent_ops) > 0
            RETURN {
                domain: domain,
                inconsistencies: inconsistent_ops,
                total_inconsistencies: LENGTH(inconsistent_ops)
            }
        """
        
        try:
            cursor = self.db.aql.execute(query)
            return list(cursor)
        except Exception as e:
            logger.error(f"Error finding architectural inconsistencies: {e}")
            return []
    
    def analyze_dependency_patterns(self) -> List[Dict[str, Any]]:
        """Analyze dependency patterns for refactoring opportunities."""
        query = """
        FOR node IN codeunits
            FILTER node.type IN ["function", "async_function"]
            LET outgoing = (
                FOR rel IN relationships
                    FILTER rel._from == CONCAT("codeunits/", node._key)
                    RETURN rel
            )
            LET incoming = (
                FOR rel IN relationships
                    FILTER rel._to == CONCAT("codeunits/", node._key)
                    RETURN rel
            )
            LET coupling_score = LENGTH(outgoing) + LENGTH(incoming)
            FILTER coupling_score > 5  // High coupling threshold
            RETURN {
                node: node,
                outgoing_dependencies: LENGTH(outgoing),
                incoming_dependencies: LENGTH(incoming),
                coupling_score: coupling_score,
                dependencies: {
                    outgoing: outgoing,
                    incoming: incoming
                }
            }
        """
        
        try:
            cursor = self.db.aql.execute(query)
            return list(cursor)
        except Exception as e:
            logger.error(f"Error analyzing dependency patterns: {e}")
            return []
    
    def _create_similarity_result(self, result: Dict[str, Any]) -> SimilarityResult:
        """Create SimilarityResult from query result."""
        scores = result['similarity_scores']
        
        # Determine similarity type based on highest scoring dimension
        max_dimension = max(scores, key=lambda k: scores[k] if k != 'combined' else 0)
        
        # Generate evidence
        evidence = []
        if scores['purpose'] > 0.8:
            evidence.append("high_purpose_similarity")
        if scores['code'] > 0.7:
            evidence.append("similar_code_structure")
        if scores['domain'] > 0.8:
            evidence.append("same_business_domain")
        if scores['context'] > 0.6:
            evidence.append("similar_usage_context")
        
        return SimilarityResult(
            source_id=result['source_id'],
            target_id=result['target_id'],
            similarity_scores=scores,
            combined_score=scores['combined'],
            similarity_type=max_dimension,
            confidence=scores['combined'],
            evidence=evidence
        )
    
    def _create_similarity_group(self, result: Dict[str, Any]) -> SimilarityGroup:
        """Create SimilarityGroup from query result."""
        group_info = result['group_info']
        members = result['members']
        
        # Generate group ID
        group_id = hashlib.md5(
            f"{group_info['domain']}_{group_info['purpose_type']}_{group_info['intent']}".encode()
        ).hexdigest()[:16]
        
        # Calculate refactoring potential
        member_count = len(members)
        avg_similarity = result['avg_similarity']
        refactoring_potential = member_count * avg_similarity * 0.8
        
        # Determine priority
        if refactoring_potential > 3.0:
            priority = "high"
        elif refactoring_potential > 2.0:
            priority = "medium"
        else:
            priority = "low"
        
        # Create analysis
        analysis = {
            "consolidation_opportunity": member_count > 3,
            "estimated_effort": self._estimate_refactoring_effort(members),
            "risk_level": self._assess_risk_level(members, avg_similarity),
            "potential_savings": {
                "lines_of_code": sum(m['node'].get('metrics', {}).get('lines_of_code', 0) for m in members) * 0.6,
                "complexity_reduction": avg_similarity * member_count * 0.3
            }
        }
        
        return SimilarityGroup(
            group_id=group_id,
            similarity_type="purpose_based",
            members=[m['node'] for m in members],
            average_similarity=avg_similarity,
            refactoring_potential=refactoring_potential,
            priority=priority,
            analysis=analysis
        )
    
    def _create_duplicate_group(self, result: Dict[str, Any]) -> SimilarityGroup:
        """Create SimilarityGroup for duplicate logic."""
        group_info = result['group_info']
        members = result['members']
        
        group_id = hashlib.md5(
            f"duplicate_{group_info['intent']}_{group_info['operation_type']}".encode()
        ).hexdigest()[:16]
        
        member_count = len(members)
        avg_similarity = result['avg_similarity']
        refactoring_potential = result['refactor_potential']
        
        # High priority for duplicates
        priority = "high" if avg_similarity > 0.95 else "medium"
        
        analysis = {
            "duplicate_logic": True,
            "consolidation_strategy": "extract_common_function",
            "estimated_effort": self._estimate_duplicate_refactoring_effort(members),
            "risk_level": "low",  # Duplicates are usually safe to refactor
            "potential_savings": {
                "lines_of_code": sum(m['node'].get('metrics', {}).get('lines_of_code', 0) for m in members) * 0.8,
                "maintenance_burden_reduction": member_count * 0.5
            }
        }
        
        return SimilarityGroup(
            group_id=group_id,
            similarity_type="duplicate_logic",
            members=[m['node'] for m in members],
            average_similarity=avg_similarity,
            refactoring_potential=refactoring_potential,
            priority=priority,
            analysis=analysis
        )
    
    def _estimate_refactoring_effort(self, members: List[Dict[str, Any]]) -> str:
        """Estimate effort required for refactoring."""
        total_complexity = sum(
            m['node'].get('metrics', {}).get('complexity', 1) for m in members
        )
        member_count = len(members)
        
        if total_complexity > 20 or member_count > 5:
            return "high"
        elif total_complexity > 10 or member_count > 3:
            return "medium"
        else:
            return "low"
    
    def _estimate_duplicate_refactoring_effort(self, members: List[Dict[str, Any]]) -> str:
        """Estimate effort for duplicate logic refactoring."""
        max_complexity = max(
            m['node'].get('metrics', {}).get('complexity', 1) for m in members
        )
        
        if max_complexity > 10:
            return "medium"
        else:
            return "low"
    
    def _assess_risk_level(self, members: List[Dict[str, Any]], similarity: float) -> str:
        """Assess risk level for refactoring."""
        # Check for external dependencies
        has_external_deps = any(
            len(m['node'].get('dependencies', {}).get('incoming', [])) > 3 for m in members
        )
        
        # Check complexity
        high_complexity = any(
            m['node'].get('metrics', {}).get('complexity', 1) > 15 for m in members
        )
        
        if has_external_deps or high_complexity:
            return "high"
        elif similarity < 0.8:
            return "medium"
        else:
            return "low"
    
    def compute_pairwise_similarity(self, node1_id: str, node2_id: str) -> Optional[SimilarityResult]:
        """Compute similarity between two specific nodes."""
        query = """
        FOR node1 IN codeunits
            FILTER node1._key == @node1_id
            FOR node2 IN codeunits
                FILTER node2._key == @node2_id
                RETURN {
                    node1: node1,
                    node2: node2,
                    similarity_scores: {
                        purpose: COSINE_SIMILARITY(node1.embeddings.purpose, node2.embeddings.purpose),
                        code: COSINE_SIMILARITY(node1.embeddings.code, node2.embeddings.code),
                        context: COSINE_SIMILARITY(node1.embeddings.context, node2.embeddings.context),
                        domain: COSINE_SIMILARITY(node1.embeddings.domain, node2.embeddings.domain)
                    }
                }
        """
        
        try:
            cursor = self.db.aql.execute(query, bind_vars={
                'node1_id': node1_id,
                'node2_id': node2_id
            })
            
            results = list(cursor)
            if not results:
                return None
            
            result = results[0]
            scores = result['similarity_scores']
            
            # Calculate combined score
            combined_score = sum(
                scores[dim] * self.weights[dim] 
                for dim in ['purpose', 'code', 'context', 'domain']
            )
            scores['combined'] = combined_score
            
            return self._create_similarity_result({
                'source_id': node1_id,
                'target_id': node2_id,
                'similarity_scores': scores
            })
            
        except Exception as e:
            logger.error(f"Error computing pairwise similarity: {e}")
            return None
