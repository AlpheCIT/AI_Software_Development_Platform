"""
Quality Architect Chain — 5-step code quality and architecture analysis using DSPy ChainOfThought.

Steps:
1. PatternAnalysis — Identify design patterns, anti-patterns, and coding conventions
2. ComplexityMap — Map cyclomatic complexity, coupling, and cohesion across modules
3. DuplicationScan — Find code duplication, near-duplicates, and copy-paste patterns
4. ArchitectureReview — Evaluate layering, separation of concerns, dependency direction
5. TechDebtEstimate — Quantify technical debt with remediation cost estimates
"""

import dspy
import json
from typing import List, Dict, Any


# =============================================================================
# Signatures
# =============================================================================

class PatternAnalysis(dspy.Signature):
    """Identify design patterns and anti-patterns in the codebase. Look for:
    patterns (singleton, factory, observer, repository, MVC/MVVM, middleware chain),
    anti-patterns (god classes, spaghetti code, circular dependencies, magic numbers,
    deep nesting, callback hell, mixed concerns)."""
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    patterns_found: str = dspy.OutputField(
        desc="JSON array of {pattern, type (design|anti), files: [], description, impact}"
    )
    coding_conventions: str = dspy.OutputField(
        desc="JSON object with {naming, formatting, importStyle, errorStyle, consistency_score: 0-100}"
    )


class ComplexityMap(dspy.Signature):
    """Map complexity across the codebase. For each module/file estimate:
    cyclomatic complexity (branching depth), coupling (dependencies in/out),
    cohesion (how focused is the module), and cognitive complexity (how hard to understand)."""
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    patterns_found: str = dspy.InputField(desc="JSON array of patterns from step 1")
    complexity_map: str = dspy.OutputField(
        desc="JSON array of {file, module, cyclomaticComplexity, couplingIn, couplingOut, cohesionScore, cognitiveComplexity, hotspot: bool}"
    )
    hotspots: str = dspy.OutputField(
        desc="JSON array of {file, reason, complexity_score, recommendation} for the most complex areas"
    )


class DuplicationScan(dspy.Signature):
    """Find code duplication and near-duplicates. Identify: exact duplicates (copy-paste),
    structural duplicates (same logic different names), pattern duplicates (repeated patterns
    that could be abstracted). Estimate lines of duplicated code."""
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    complexity_map: str = dspy.InputField(desc="JSON array of complexity data from step 2")
    duplications: str = dspy.OutputField(
        desc="JSON array of {type (exact|structural|pattern), files: [{file, startLine, endLine}], duplicated_lines, abstraction_suggestion}"
    )
    duplication_stats: str = dspy.OutputField(
        desc="JSON object with {total_duplicated_lines, duplication_percentage, worst_offenders: [{file, duplicated_lines}]}"
    )


class ArchitectureReview(dspy.Signature):
    """Evaluate the overall architecture: layering (presentation/business/data),
    separation of concerns, dependency direction (do lower layers depend on higher?),
    module boundaries, API surface consistency, configuration management."""
    patterns_found: str = dspy.InputField(desc="JSON array of patterns from step 1")
    complexity_map: str = dspy.InputField(desc="JSON array of complexity data from step 2")
    duplications: str = dspy.InputField(desc="JSON array of duplications from step 3")
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    architecture_assessment: str = dspy.OutputField(
        desc="JSON object with {layers: [...], dependency_violations: [...], module_boundaries: [...], consistency_issues: [...]}"
    )
    architecture_score: str = dspy.OutputField(
        desc="JSON object with {layering: 0-100, separation: 0-100, dependency_direction: 0-100, modularity: 0-100, overall: 0-100}"
    )


class TechDebtEstimate(dspy.Signature):
    """Quantify technical debt based on all previous analysis. For each debt item,
    estimate remediation cost in developer-hours and assign a priority. Calculate
    total tech debt ratio (debt hours / estimated codebase build hours)."""
    patterns_found: str = dspy.InputField(desc="JSON array of patterns from step 1")
    hotspots: str = dspy.InputField(desc="JSON array of complexity hotspots from step 2")
    duplication_stats: str = dspy.InputField(desc="Duplication statistics from step 3")
    architecture_assessment: str = dspy.InputField(desc="Architecture assessment from step 4")
    architecture_score: str = dspy.InputField(desc="Architecture scores from step 4")
    tech_debt_items: str = dspy.OutputField(
        desc="JSON array of {category, description, files_affected, remediation_hours, priority (critical|high|medium|low), impact_if_ignored}"
    )
    report: str = dspy.OutputField(
        desc="JSON object with {executive_summary, total_debt_hours, debt_ratio, critical_items, high_items, architecture_score, quality_grade (A-F)}"
    )


# =============================================================================
# Module
# =============================================================================

class QualityArchitectChain(dspy.Module):
    """5-step quality architect chain. Each step feeds into the next."""

    def __init__(self):
        super().__init__()
        self.analyze_patterns = dspy.ChainOfThought(PatternAnalysis)
        self.map_complexity = dspy.ChainOfThought(ComplexityMap)
        self.scan_duplication = dspy.ChainOfThought(DuplicationScan)
        self.review_architecture = dspy.ChainOfThought(ArchitectureReview)
        self.estimate_debt = dspy.ChainOfThought(TechDebtEstimate)

    def forward(self, source_files: str) -> dspy.Prediction:
        steps = []
        truncated = source_files[:100000]

        # Step 1: Pattern analysis
        try:
            s1 = self.analyze_patterns(source_files=truncated)
            steps.append({
                "name": "pattern_analysis", "type": "observe",
                "output_summary": s1.coding_conventions[:500],
            })
        except Exception as e:
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 1 failed: {str(e)}"}),
                steps=[{"name": "pattern_analysis", "type": "observe", "error": str(e)}],
                sub_agents_needed="[]",
            )

        # Step 2: Complexity map
        try:
            s2 = self.map_complexity(source_files=truncated, patterns_found=s1.patterns_found)
            steps.append({
                "name": "complexity_map", "type": "analyze",
                "output_summary": s2.hotspots[:500],
            })
        except Exception as e:
            steps.append({"name": "complexity_map", "type": "analyze", "error": str(e)})
            s2 = type("Fallback", (), {"complexity_map": "[]", "hotspots": "[]"})()

        # Step 3: Duplication scan
        try:
            s3 = self.scan_duplication(source_files=truncated, complexity_map=s2.complexity_map)
            steps.append({
                "name": "duplication_scan", "type": "scan",
                "output_summary": s3.duplication_stats[:500],
            })
        except Exception as e:
            steps.append({"name": "duplication_scan", "type": "scan", "error": str(e)})
            s3 = type("Fallback", (), {"duplications": "[]", "duplication_stats": "{}"})()

        # Step 4: Architecture review
        try:
            s4 = self.review_architecture(
                patterns_found=s1.patterns_found,
                complexity_map=s2.complexity_map,
                duplications=s3.duplications,
                source_files=truncated,
            )
            steps.append({
                "name": "architecture_review", "type": "review",
                "output_summary": s4.architecture_score[:500],
            })
        except Exception as e:
            steps.append({"name": "architecture_review", "type": "review", "error": str(e)})
            s4 = type("Fallback", (), {"architecture_assessment": "{}", "architecture_score": "{}"})()

        # Step 5: Tech debt estimate
        try:
            s5 = self.estimate_debt(
                patterns_found=s1.patterns_found,
                hotspots=s2.hotspots,
                duplication_stats=s3.duplication_stats,
                architecture_assessment=s4.architecture_assessment,
                architecture_score=s4.architecture_score,
            )
            steps.append({
                "name": "tech_debt_estimate", "type": "report",
                "output_summary": s5.report[:500],
            })
        except Exception as e:
            steps.append({"name": "tech_debt_estimate", "type": "report", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({
                    "architecture_score": s4.architecture_score,
                    "duplication_stats": s3.duplication_stats,
                    "error": f"Step 5 failed: {str(e)}",
                }),
                steps=steps,
                sub_agents_needed="[]",
            )

        return dspy.Prediction(
            report=s5.report,
            steps=steps,
            sub_agents_needed="[]",
        )
