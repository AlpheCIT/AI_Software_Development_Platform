#!/usr/bin/env python3
"""
AI Refactoring Decision Engine
Part of the AI-Powered Code Refactoring System

This module implements the main decision-making logic for automated refactoring
suggestions using AI analysis of code patterns and similarities.
"""

import logging
import json
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

from api.services.similarity_engine import SimilarityEngine, SimilarityGroup
from api.services.purpose_extractor import PurposeAnalysis

logger = logging.getLogger(__name__)

class RefactoringType(Enum):
    """Types of refactoring operations."""
    EXTRACT_FUNCTION = "extract_function"
    EXTRACT_CLASS = "extract_class"
    CONSOLIDATE_DUPLICATES = "consolidate_duplicates"
    INTRODUCE_INTERFACE = "introduce_interface"
    MOVE_METHOD = "move_method"
    REPLACE_CONDITIONAL = "replace_conditional"
    EXTRACT_VARIABLE = "extract_variable"
    INLINE_FUNCTION = "inline_function"
    RENAME_SYMBOL = "rename_symbol"
    SPLIT_CLASS = "split_class"

class Priority(Enum):
    """Priority levels for refactoring opportunities."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

@dataclass
class RefactoringOpportunity:
    """Represents a potential refactoring opportunity."""
    id: str
    type: RefactoringType
    priority: Priority
    title: str
    description: str
    affected_files: List[str]
    affected_components: List[Dict[str, Any]]
    estimated_effort: str
    potential_savings: Dict[str, Any]
    risk_level: str
    implementation_strategy: str
    ai_analysis: Dict[str, Any]
    similarity_data: Optional[SimilarityGroup] = None
    created_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

@dataclass
class ImpactAnalysis:
    """Analysis of the potential impact of a refactoring."""
    affected_components: List[Dict[str, Any]]
    risk_assessment: Dict[str, Any]
    effort_estimation: Dict[str, Any]
    benefits_analysis: Dict[str, Any]
    test_impact: Dict[str, Any]
    dependency_impact: List[Dict[str, Any]]

class RefactoringStrategy:
    """Base class for refactoring strategies."""
    
    def __init__(self, name: str):
        self.name = name
    
    def can_apply(self, opportunity_data: Dict[str, Any]) -> bool:
        """Check if this strategy can be applied to the given data."""
        return True
    
    def create_opportunity(self, data: Dict[str, Any]) -> RefactoringOpportunity:
        """Create a refactoring opportunity from the given data."""
        raise NotImplementedError

class ExtractFunctionStrategy(RefactoringStrategy):
    """Strategy for extracting common code into functions."""
    
    def __init__(self):
        super().__init__("Extract Function")
    
    def can_apply(self, opportunity_data: Dict[str, Any]) -> bool:
        """Check if extract function is applicable."""
        similarity_group = opportunity_data.get('similarity_group')
        if not similarity_group:
            return False
        
        member_count = len(similarity_group.members)
        avg_similarity = similarity_group.average_similarity
        
        # Good for small groups with high similarity
        return member_count <= 4 and avg_similarity > 0.85
    
    def create_opportunity(self, data: Dict[str, Any]) -> RefactoringOpportunity:
        """Create extract function opportunity."""
        similarity_group = data['similarity_group']
        
        # Calculate affected files
        affected_files = list(set(
            member.get('file_path', '') for member in similarity_group.members
        ))
        
        # Calculate potential savings
        total_loc = sum(
            member.get('metrics', {}).get('lines_of_code', 0) 
            for member in similarity_group.members
        )
        
        potential_savings = {
            'lines_of_code_reduction': total_loc * 0.6,
            'complexity_reduction': len(similarity_group.members) * 0.3,
            'maintenance_burden_reduction': len(similarity_group.members) * 0.4
        }
        
        return RefactoringOpportunity(
            id=f"extract_func_{similarity_group.group_id}",
            type=RefactoringType.EXTRACT_FUNCTION,
            priority=Priority(similarity_group.priority),
            title=f"Extract common function from {len(similarity_group.members)} similar implementations",
            description=f"Extract shared logic from {len(similarity_group.members)} functions "
                       f"with {similarity_group.average_similarity:.1%} similarity",
            affected_files=affected_files,
            affected_components=similarity_group.members,
            estimated_effort=similarity_group.analysis.get('estimated_effort', 'medium'),
            potential_savings=potential_savings,
            risk_level=similarity_group.analysis.get('risk_level', 'medium'),
            implementation_strategy=self._create_implementation_strategy(similarity_group),
            ai_analysis=similarity_group.analysis,
            similarity_data=similarity_group
        )
    
    def _create_implementation_strategy(self, similarity_group: SimilarityGroup) -> str:
        """Create implementation strategy for extract function."""
        return f"""
        1. Analyze common patterns across {len(similarity_group.members)} functions
        2. Identify the core logic that can be extracted
        3. Create a new function with appropriate parameters
        4. Replace duplicated code with calls to the new function
        5. Update tests to cover the extracted function
        6. Verify all existing functionality is preserved
        """

class ConsolidateDuplicatesStrategy(RefactoringStrategy):
    """Strategy for consolidating duplicate code."""
    
    def __init__(self):
        super().__init__("Consolidate Duplicates")
    
    def can_apply(self, opportunity_data: Dict[str, Any]) -> bool:
        """Check if duplicate consolidation is applicable."""
        similarity_group = opportunity_data.get('similarity_group')
        if not similarity_group:
            return False
        
        return (similarity_group.similarity_type == "duplicate_logic" or 
                similarity_group.average_similarity > 0.9)
    
    def create_opportunity(self, data: Dict[str, Any]) -> RefactoringOpportunity:
        """Create consolidate duplicates opportunity."""
        similarity_group = data['similarity_group']
        
        affected_files = list(set(
            member.get('file_path', '') for member in similarity_group.members
        ))
        
        total_loc = sum(
            member.get('metrics', {}).get('lines_of_code', 0) 
            for member in similarity_group.members
        )
        
        potential_savings = {
            'lines_of_code_reduction': total_loc * 0.8,  # Higher savings for duplicates
            'complexity_reduction': len(similarity_group.members) * 0.5,
            'maintenance_burden_reduction': len(similarity_group.members) * 0.8,
            'bug_fix_efficiency': len(similarity_group.members) * 0.7
        }
        
        return RefactoringOpportunity(
            id=f"consolidate_{similarity_group.group_id}",
            type=RefactoringType.CONSOLIDATE_DUPLICATES,
            priority=Priority.HIGH,  # Duplicates are usually high priority
            title=f"Consolidate {len(similarity_group.members)} duplicate implementations",
            description=f"Merge {len(similarity_group.members)} nearly identical functions "
                       f"({similarity_group.average_similarity:.1%} similarity) into a single implementation",
            affected_files=affected_files,
            affected_components=similarity_group.members,
            estimated_effort="low",  # Duplicates are usually easier to refactor
            potential_savings=potential_savings,
            risk_level="low",
            implementation_strategy=self._create_implementation_strategy(similarity_group),
            ai_analysis=similarity_group.analysis,
            similarity_data=similarity_group
        )
    
    def _create_implementation_strategy(self, similarity_group: SimilarityGroup) -> str:
        """Create implementation strategy for consolidating duplicates."""
        return f"""
        1. Compare {len(similarity_group.members)} duplicate implementations
        2. Identify the most complete/robust version as the base
        3. Merge any unique functionality from other versions
        4. Replace all duplicates with calls to the consolidated function
        5. Update all call sites to use the new consolidated function
        6. Remove the duplicate implementations
        7. Update documentation and tests
        """

class ExtractClassStrategy(RefactoringStrategy):
    """Strategy for extracting classes from related functions."""
    
    def __init__(self):
        super().__init__("Extract Class")
    
    def can_apply(self, opportunity_data: Dict[str, Any]) -> bool:
        """Check if extract class is applicable."""
        similarity_group = opportunity_data.get('similarity_group')
        if not similarity_group:
            return False
        
        member_count = len(similarity_group.members)
        same_domain = all(
            member.get('purpose', {}).get('domain') == similarity_group.members[0].get('purpose', {}).get('domain')
            for member in similarity_group.members
        )
        
        # Good for larger groups in the same domain
        return member_count > 4 and same_domain
    
    def create_opportunity(self, data: Dict[str, Any]) -> RefactoringOpportunity:
        """Create extract class opportunity."""
        similarity_group = data['similarity_group']
        
        domain = similarity_group.members[0].get('purpose', {}).get('domain', 'Unknown')
        operation_type = similarity_group.members[0].get('purpose', {}).get('operation_type', 'processing')
        
        affected_files = list(set(
            member.get('file_path', '') for member in similarity_group.members
        ))
        
        potential_savings = {
            'code_organization_improvement': len(similarity_group.members) * 0.6,
            'reusability_increase': len(similarity_group.members) * 0.4,
            'maintainability_improvement': len(similarity_group.members) * 0.5
        }
        
        return RefactoringOpportunity(
            id=f"extract_class_{similarity_group.group_id}",
            type=RefactoringType.EXTRACT_CLASS,
            priority=Priority(similarity_group.priority),
            title=f"Extract {domain.title()} class from {len(similarity_group.members)} related functions",
            description=f"Create a cohesive class for {operation_type} operations in the {domain} domain",
            affected_files=affected_files,
            affected_components=similarity_group.members,
            estimated_effort="high",
            potential_savings=potential_savings,
            risk_level=similarity_group.analysis.get('risk_level', 'medium'),
            implementation_strategy=self._create_implementation_strategy(similarity_group, domain),
            ai_analysis=similarity_group.analysis,
            similarity_data=similarity_group
        )
    
    def _create_implementation_strategy(self, similarity_group: SimilarityGroup, domain: str) -> str:
        """Create implementation strategy for extract class."""
        return f"""
        1. Design a cohesive {domain.title()} class interface
        2. Identify shared state and behavior among the {len(similarity_group.members)} functions
        3. Create the new class with appropriate methods and properties
        4. Migrate functions to become methods of the new class
        5. Update all call sites to use the new class
        6. Implement proper initialization and cleanup
        7. Add comprehensive tests for the new class
        """

class RefactoringStrategyRegistry:
    """Registry for managing refactoring strategies."""
    
    def __init__(self):
        self.strategies = {
            RefactoringType.EXTRACT_FUNCTION: ExtractFunctionStrategy(),
            RefactoringType.CONSOLIDATE_DUPLICATES: ConsolidateDuplicatesStrategy(),
            RefactoringType.EXTRACT_CLASS: ExtractClassStrategy(),
            # Add more strategies as needed
        }
    
    def select_strategy(self, opportunity_data: Dict[str, Any]) -> Optional[RefactoringStrategy]:
        """Select the best refactoring strategy for the given data."""
        similarity_group = opportunity_data.get('similarity_group')
        if not similarity_group:
            return None
        
        # Check for duplicate logic first (highest priority)
        if similarity_group.similarity_type == "duplicate_logic":
            return self.strategies[RefactoringType.CONSOLIDATE_DUPLICATES]
        
        # Check each strategy in order of preference
        strategy_order = [
            RefactoringType.CONSOLIDATE_DUPLICATES,
            RefactoringType.EXTRACT_FUNCTION,
            RefactoringType.EXTRACT_CLASS
        ]
        
        for strategy_type in strategy_order:
            strategy = self.strategies[strategy_type]
            if strategy.can_apply(opportunity_data):
                return strategy
        
        # Default to extract function if nothing else matches
        return self.strategies[RefactoringType.EXTRACT_FUNCTION]

class ImpactAnalysisEngine:
    """Engine for analyzing the impact of proposed refactorings."""
    
    def __init__(self, db):
        self.db = db
    
    def analyze_refactoring_impact(self, refactoring_plan: RefactoringOpportunity) -> ImpactAnalysis:
        """Analyze the potential impact of a refactoring operation."""
        
        affected_components = self._find_affected_components(refactoring_plan)
        risk_assessment = self._assess_risk(refactoring_plan)
        effort_estimation = self._estimate_effort(refactoring_plan)
        benefits_analysis = self._analyze_benefits(refactoring_plan)
        test_impact = self._analyze_test_impact(refactoring_plan)
        dependency_impact = self._analyze_dependency_impact(refactoring_plan)
        
        return ImpactAnalysis(
            affected_components=affected_components,
            risk_assessment=risk_assessment,
            effort_estimation=effort_estimation,
            benefits_analysis=benefits_analysis,
            test_impact=test_impact,
            dependency_impact=dependency_impact
        )
    
    def _find_affected_components(self, plan: RefactoringOpportunity) -> List[Dict[str, Any]]:
        """Find all components affected by the refactoring."""
        if not plan.affected_components:
            return []
        
        # Get keys of target components
        target_keys = [comp.get('_key') for comp in plan.affected_components if comp.get('_key')]
        
        query = """
        FOR target_key IN @target_keys
            FOR vertex, edge, path IN 1..3 OUTBOUND 
                CONCAT("codeunits/", target_key) 
                GRAPH "code_graph"
                RETURN DISTINCT {
                    component: vertex,
                    relationship: edge,
                    distance: LENGTH(path.edges)
                }
        """
        
        try:
            cursor = self.db.aql.execute(query, bind_vars={'target_keys': target_keys})
            return list(cursor)
        except Exception as e:
            logger.warning(f"Could not analyze affected components: {e}")
            return plan.affected_components
    
    def _assess_risk(self, plan: RefactoringOpportunity) -> Dict[str, Any]:
        """Assess the risk level of the refactoring."""
        risk_factors = {
            'complexity': self._assess_complexity_risk(plan),
            'dependencies': self._assess_dependency_risk(plan),
            'test_coverage': self._assess_test_coverage_risk(plan),
            'team_familiarity': 0.5  # Default medium risk
        }
        
        # Calculate overall risk
        overall_risk = sum(risk_factors.values()) / len(risk_factors)
        
        risk_level = "low"
        if overall_risk > 0.7:
            risk_level = "high"
        elif overall_risk > 0.4:
            risk_level = "medium"
        
        return {
            'overall_risk': overall_risk,
            'risk_level': risk_level,
            'risk_factors': risk_factors,
            'mitigation_strategies': self._suggest_risk_mitigation(risk_factors)
        }
    
    def _assess_complexity_risk(self, plan: RefactoringOpportunity) -> float:
        """Assess risk based on code complexity."""
        if not plan.affected_components:
            return 0.5
        
        complexities = [
            comp.get('metrics', {}).get('complexity', 1) 
            for comp in plan.affected_components
        ]
        
        avg_complexity = sum(complexities) / len(complexities)
        
        # Normalize to 0-1 scale
        return min(avg_complexity / 20.0, 1.0)
    
    def _assess_dependency_risk(self, plan: RefactoringOpportunity) -> float:
        """Assess risk based on dependency complexity."""
        # For now, use a simple heuristic based on number of files
        file_count = len(plan.affected_files)
        
        # Normalize to 0-1 scale
        return min(file_count / 10.0, 1.0)
    
    def _assess_test_coverage_risk(self, plan: RefactoringOpportunity) -> float:
        """Assess risk based on test coverage."""
        # This would need integration with test coverage tools
        # For now, return a default medium risk
        return 0.5
    
    def _suggest_risk_mitigation(self, risk_factors: Dict[str, float]) -> List[str]:
        """Suggest strategies to mitigate identified risks."""
        strategies = []
        
        if risk_factors['complexity'] > 0.6:
            strategies.append("Break down complex refactoring into smaller steps")
            strategies.append("Add comprehensive unit tests before refactoring")
        
        if risk_factors['dependencies'] > 0.6:
            strategies.append("Carefully map all dependencies before starting")
            strategies.append("Consider gradual migration approach")
        
        if risk_factors['test_coverage'] > 0.6:
            strategies.append("Improve test coverage before refactoring")
            strategies.append("Add integration tests for affected components")
        
        return strategies
    
    def _estimate_effort(self, plan: RefactoringOpportunity) -> Dict[str, Any]:
        """Estimate effort required for the refactoring."""
        base_effort_hours = {
            'low': 4,
            'medium': 12,
            'high': 24
        }
        
        base_hours = base_effort_hours.get(plan.estimated_effort, 12)
        
        # Adjust based on complexity and scope
        component_count = len(plan.affected_components)
        file_count = len(plan.affected_files)
        
        # Add overhead for multiple files/components
        overhead_multiplier = 1 + (component_count - 1) * 0.2 + (file_count - 1) * 0.1
        
        estimated_hours = base_hours * overhead_multiplier
        
        return {
            'estimated_hours': estimated_hours,
            'effort_level': plan.estimated_effort,
            'breakdown': {
                'analysis': estimated_hours * 0.2,
                'implementation': estimated_hours * 0.5,
                'testing': estimated_hours * 0.2,
                'documentation': estimated_hours * 0.1
            }
        }
    
    def _analyze_benefits(self, plan: RefactoringOpportunity) -> Dict[str, Any]:
        """Analyze the benefits of the refactoring."""
        return {
            'quantified_benefits': plan.potential_savings,
            'qualitative_benefits': [
                "Improved code maintainability",
                "Reduced duplication",
                "Better code organization",
                "Enhanced reusability"
            ],
            'long_term_benefits': [
                "Faster feature development",
                "Reduced bug fixing time",
                "Improved team productivity"
            ]
        }
    
    def _analyze_test_impact(self, plan: RefactoringOpportunity) -> Dict[str, Any]:
        """Analyze the impact on tests."""
        return {
            'tests_requiring_updates': len(plan.affected_files),  # Simplified
            'new_tests_needed': len(plan.affected_components),
            'test_strategy': self._create_test_strategy(plan)
        }
    
    def _analyze_dependency_impact(self, plan: RefactoringOpportunity) -> List[Dict[str, Any]]:
        """Analyze impact on dependencies."""
        # This would need more sophisticated dependency analysis
        return [
            {
                'type': 'direct_callers',
                'count': 'unknown',
                'impact': 'medium'
            }
        ]
    
    def _create_test_strategy(self, plan: RefactoringOpportunity) -> str:
        """Create a testing strategy for the refactoring."""
        strategy_map = {
            RefactoringType.EXTRACT_FUNCTION: "Add unit tests for extracted function, verify existing tests pass",
            RefactoringType.CONSOLIDATE_DUPLICATES: "Verify all existing test cases pass with consolidated implementation",
            RefactoringType.EXTRACT_CLASS: "Create comprehensive test suite for new class, update existing tests"
        }
        
        return strategy_map.get(plan.type, "Create appropriate test coverage for refactored code")

class RefactoringDecisionEngine:
    """Main engine for making refactoring decisions."""
    
    def __init__(self, db, similarity_engine: SimilarityEngine, config: Optional[Dict[str, Any]] = None):
        self.db = db
        self.similarity_engine = similarity_engine
        self.config = config or {}
        self.strategy_registry = RefactoringStrategyRegistry()
        self.impact_engine = ImpactAnalysisEngine(db)
        
        logger.info("Initialized RefactoringDecisionEngine")
    
    def analyze_refactoring_opportunities(self, scope: str = 'global') -> List[RefactoringOpportunity]:
        """Main entry point for refactoring analysis."""
        opportunities = []
        
        try:
            # 1. Find duplicate/similar logic
            logger.info("Finding duplicate logic...")
            duplicates = self.similarity_engine.find_duplicate_logic()
            opportunities.extend(self._create_consolidation_opportunities(duplicates))
            
            # 2. Find general refactoring candidates
            logger.info("Finding refactoring candidates...")
            candidates = self.similarity_engine.find_refactoring_candidates()
            opportunities.extend(self._create_refactoring_opportunities(candidates))
            
            # 3. Identify architectural inconsistencies
            logger.info("Finding architectural inconsistencies...")
            inconsistencies = self.similarity_engine.find_architectural_inconsistencies()
            opportunities.extend(self._create_standardization_opportunities(inconsistencies))
            
            # 4. Analyze dependency issues
            logger.info("Analyzing dependency patterns...")
            dependency_issues = self.similarity_engine.analyze_dependency_patterns()
            opportunities.extend(self._create_dependency_refactoring_opportunities(dependency_issues))
            
            # 5. Prioritize opportunities
            prioritized_opportunities = self._prioritize_opportunities(opportunities)
            
            logger.info(f"Found {len(prioritized_opportunities)} refactoring opportunities")
            return prioritized_opportunities
            
        except Exception as e:
            logger.error(f"Error analyzing refactoring opportunities: {e}")
            return []
    
    def _create_consolidation_opportunities(self, duplicates: List[SimilarityGroup]) -> List[RefactoringOpportunity]:
        """Create opportunities from duplicate logic groups."""
        opportunities = []
        
        for group in duplicates:
            strategy = self.strategy_registry.select_strategy({'similarity_group': group})
            if strategy:
                opportunity = strategy.create_opportunity({'similarity_group': group})
                opportunities.append(opportunity)
        
        return opportunities
    
    def _create_refactoring_opportunities(self, candidates: List[SimilarityGroup]) -> List[RefactoringOpportunity]:
        """Create opportunities from similarity groups."""
        opportunities = []
        
        for group in candidates:
            # Skip if already handled as duplicates
            if group.similarity_type == "duplicate_logic":
                continue
                
            strategy = self.strategy_registry.select_strategy({'similarity_group': group})
            if strategy:
                opportunity = strategy.create_opportunity({'similarity_group': group})
                opportunities.append(opportunity)
        
        return opportunities
    
    def _create_standardization_opportunities(self, inconsistencies: List[Dict[str, Any]]) -> List[RefactoringOpportunity]:
        """Create opportunities from architectural inconsistencies."""
        opportunities = []
        
        for inconsistency in inconsistencies:
            domain = inconsistency['domain']
            inconsistent_ops = inconsistency['inconsistencies']
            
            for op in inconsistent_ops:
                opportunity = RefactoringOpportunity(
                    id=f"standardize_{domain}_{op['operation']}",
                    type=RefactoringType.INTRODUCE_INTERFACE,
                    priority=Priority.MEDIUM,
                    title=f"Standardize {op['operation']} operations in {domain} domain",
                    description=f"Create consistent interface for {op['operation']} operations "
                               f"(currently {op['inconsistency_score']:.1%} inconsistent)",
                    affected_files=[impl.get('file_path', '') for impl in op['implementations']],
                    affected_components=op['implementations'],
                    estimated_effort="medium",
                    potential_savings={
                        'consistency_improvement': len(op['implementations']) * 0.5,
                        'maintainability_improvement': op['inconsistency_score']
                    },
                    risk_level="medium",
                    implementation_strategy=f"Analyze {len(op['implementations'])} implementations and create unified interface",
                    ai_analysis={
                        'inconsistency_score': op['inconsistency_score'],
                        'recommendation': 'introduce_common_interface'
                    }
                )
                opportunities.append(opportunity)
        
        return opportunities
    
    def _create_dependency_refactoring_opportunities(self, dependency_issues: List[Dict[str, Any]]) -> List[RefactoringOpportunity]:
        """Create opportunities from dependency analysis."""
        opportunities = []
        
        for issue in dependency_issues:
            node = issue['node']
            coupling_score = issue['coupling_score']
            
            if coupling_score > 10:  # High coupling threshold
                opportunity = RefactoringOpportunity(
                    id=f"decouple_{node.get('_key', 'unknown')}",
                    type=RefactoringType.SPLIT_CLASS,
                    priority=Priority.MEDIUM,
                    title=f"Reduce coupling for {node.get('name', 'unknown')}",
                    description=f"Reduce high coupling (score: {coupling_score}) by splitting responsibilities",
                    affected_files=[node.get('file_path', '')],
                    affected_components=[node],
                    estimated_effort="high",
                    potential_savings={
                        'coupling_reduction': coupling_score * 0.5,
                        'maintainability_improvement': 0.6
                    },
                    risk_level="high",
                    implementation_strategy="Analyze dependencies and split into smaller, more focused components",
                    ai_analysis={
                        'coupling_score': coupling_score,
                        'incoming_dependencies': issue['incoming_dependencies'],
                        'outgoing_dependencies': issue['outgoing_dependencies']
                    }
                )
                opportunities.append(opportunity)
        
        return opportunities
    
    def _prioritize_opportunities(self, opportunities: List[RefactoringOpportunity]) -> List[RefactoringOpportunity]:
        """Prioritize refactoring opportunities based on multiple factors."""
        
        def priority_score(opp: RefactoringOpportunity) -> float:
            # Base score from priority level
            priority_scores = {
                Priority.CRITICAL: 100,
                Priority.HIGH: 75,
                Priority.MEDIUM: 50,
                Priority.LOW: 25
            }
            
            base_score = priority_scores.get(opp.priority, 25)
            
            # Adjust based on potential savings
            savings_score = 0
            if opp.potential_savings:
                loc_reduction = opp.potential_savings.get('lines_of_code_reduction', 0)
                complexity_reduction = opp.potential_savings.get('complexity_reduction', 0)
                savings_score = (loc_reduction * 0.1) + (complexity_reduction * 5)
            
            # Adjust based on risk (lower risk = higher score)
            risk_adjustment = {
                'low': 10,
                'medium': 0,
                'high': -15
            }
            
            risk_score = risk_adjustment.get(opp.risk_level, 0)
            
            # Adjust based on effort (lower effort = higher score)
            effort_adjustment = {
                'low': 10,
                'medium': 0,
                'high': -5
            }
            
            effort_score = effort_adjustment.get(opp.estimated_effort, 0)
            
            return base_score + savings_score + risk_score + effort_score
        
        # Sort by priority score (descending)
        opportunities.sort(key=priority_score, reverse=True)
        
        return opportunities
