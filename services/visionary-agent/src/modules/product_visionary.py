"""
Product Visionary Chain — 5-step product vision analysis using DSPy ChainOfThought.

This expert runs LAST and receives all other expert reports as input.

Steps:
1. UnderstandProduct — Synthesize what the product does from code + expert reports
2. CompetitiveAnalysis — Compare against industry standards and competitors
3. FeatureGaps — Identify missing features and capabilities
4. Innovation — Suggest innovative features leveraging existing architecture
5. Roadmap — Produce a prioritized product roadmap
"""

import dspy
import json
from typing import List, Dict, Any


# =============================================================================
# Signatures
# =============================================================================

class UnderstandProduct(dspy.Signature):
    """Synthesize a comprehensive understanding of the product from source code analysis
    and expert reports. Identify: core value proposition, target users, key workflows,
    data model, integration points, and current maturity level."""
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    expert_reports: str = dspy.InputField(
        desc="JSON object with reports from other experts: {security, frontend, backend, middleware, quality, testing}"
    )
    product_understanding: str = dspy.OutputField(
        desc="JSON object with {name, value_proposition, target_users: [], core_workflows: [], data_model_summary, integrations: [], maturity_level}"
    )
    strengths_weaknesses: str = dspy.OutputField(
        desc="JSON object with {strengths: [{area, description}], weaknesses: [{area, description, severity}]}"
    )


class CompetitiveAnalysis(dspy.Signature):
    """Compare the product against industry standards and common competitor features.
    Based on the tech stack and domain, identify what best-in-class products offer
    that this product lacks or does differently."""
    product_understanding: str = dspy.InputField(desc="Product understanding from step 1")
    strengths_weaknesses: str = dspy.InputField(desc="Strengths and weaknesses from step 1")
    expert_reports: str = dspy.InputField(desc="JSON object with all expert reports")
    competitive_landscape: str = dspy.OutputField(
        desc="JSON object with {industry_standards: [], competitor_features: [], differentiators: [], areas_behind: []}"
    )
    market_position: str = dspy.OutputField(
        desc="JSON object with {current_position, target_position, gap_summary}"
    )


class FeatureGaps(dspy.Signature):
    """Identify missing features and capabilities. Categorize as: table-stakes (must-have
    for the domain), competitive (needed to compete), differentiating (would set apart),
    and nice-to-have. Consider both user-facing and developer-facing gaps."""
    product_understanding: str = dspy.InputField(desc="Product understanding from step 1")
    competitive_landscape: str = dspy.InputField(desc="Competitive landscape from step 2")
    expert_reports: str = dspy.InputField(desc="JSON object with all expert reports")
    feature_gaps: str = dspy.OutputField(
        desc="JSON array of {feature, category (table_stakes|competitive|differentiating|nice_to_have), description, user_impact, technical_complexity, dependencies: []}"
    )
    gap_summary: str = dspy.OutputField(
        desc="JSON object with {total_gaps, table_stakes_missing, competitive_missing, biggest_gap}"
    )


class InnovationSuggestions(dspy.Signature):
    """Suggest innovative features that leverage the existing architecture and tech stack.
    Consider: AI/ML opportunities, automation potential, data insights that could be surfaced,
    developer experience improvements, unique integrations possible with the current stack."""
    product_understanding: str = dspy.InputField(desc="Product understanding from step 1")
    feature_gaps: str = dspy.InputField(desc="JSON array of feature gaps from step 3")
    strengths_weaknesses: str = dspy.InputField(desc="Strengths and weaknesses from step 1")
    expert_reports: str = dspy.InputField(desc="JSON object with all expert reports")
    innovations: str = dspy.OutputField(
        desc="JSON array of {title, description, leverages (what existing capability it builds on), user_value, technical_feasibility, wow_factor (1-10)}"
    )
    innovation_themes: str = dspy.OutputField(
        desc="JSON array of {theme, description, innovations_count}"
    )


class ProductRoadmap(dspy.Signature):
    """Produce a prioritized product roadmap organized into phases. Phase 1 focuses on
    table-stakes and critical fixes, Phase 2 on competitive features, Phase 3 on
    differentiators and innovation. Include effort estimates and dependencies."""
    product_understanding: str = dspy.InputField(desc="Product understanding from step 1")
    feature_gaps: str = dspy.InputField(desc="JSON array of feature gaps from step 3")
    innovations: str = dspy.InputField(desc="JSON array of innovations from step 4")
    gap_summary: str = dspy.InputField(desc="Gap summary from step 3")
    market_position: str = dspy.InputField(desc="Market position from step 2")
    roadmap: str = dspy.OutputField(
        desc="JSON array of {phase, name, description, items: [{title, type (fix|feature|innovation), effort_weeks, dependencies, priority}], total_effort_weeks}"
    )
    report: str = dspy.OutputField(
        desc="JSON object with {executive_summary, product_vision, phases: int, total_effort_weeks, quick_wins: [...], strategic_bets: [...], maturity_target}"
    )


# =============================================================================
# Module
# =============================================================================

class ProductVisionaryChain(dspy.Module):
    """5-step product visionary chain. Receives all other expert reports as input."""

    def __init__(self):
        super().__init__()
        self.understand = dspy.ChainOfThought(UnderstandProduct)
        self.competitive = dspy.ChainOfThought(CompetitiveAnalysis)
        self.gaps = dspy.ChainOfThought(FeatureGaps)
        self.innovate = dspy.ChainOfThought(InnovationSuggestions)
        self.roadmap = dspy.ChainOfThought(ProductRoadmap)

    def forward(self, source_files: str, expert_reports: str = "{}") -> dspy.Prediction:
        steps = []
        truncated = source_files[:100000]

        # Step 1: Understand product
        try:
            s1 = self.understand(source_files=truncated, expert_reports=expert_reports)
            steps.append({
                "name": "understand_product", "type": "observe",
                "output_summary": s1.product_understanding[:500],
            })
        except Exception as e:
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 1 failed: {str(e)}"}),
                steps=[{"name": "understand_product", "type": "observe", "error": str(e)}],
                sub_agents_needed="[]",
            )

        # Step 2: Competitive analysis
        try:
            s2 = self.competitive(
                product_understanding=s1.product_understanding,
                strengths_weaknesses=s1.strengths_weaknesses,
                expert_reports=expert_reports,
            )
            steps.append({
                "name": "competitive_analysis", "type": "analyze",
                "output_summary": s2.market_position[:500],
            })
        except Exception as e:
            steps.append({"name": "competitive_analysis", "type": "analyze", "error": str(e)})
            s2 = type("Fallback", (), {"competitive_landscape": "{}", "market_position": "{}"})()

        # Step 3: Feature gaps
        try:
            s3 = self.gaps(
                product_understanding=s1.product_understanding,
                competitive_landscape=s2.competitive_landscape,
                expert_reports=expert_reports,
            )
            steps.append({
                "name": "feature_gaps", "type": "gap_analysis",
                "output_summary": s3.gap_summary[:500],
            })
        except Exception as e:
            steps.append({"name": "feature_gaps", "type": "gap_analysis", "error": str(e)})
            s3 = type("Fallback", (), {"feature_gaps": "[]", "gap_summary": "{}"})()

        # Step 4: Innovation
        try:
            s4 = self.innovate(
                product_understanding=s1.product_understanding,
                feature_gaps=s3.feature_gaps,
                strengths_weaknesses=s1.strengths_weaknesses,
                expert_reports=expert_reports,
            )
            steps.append({
                "name": "innovation", "type": "innovate",
                "output_summary": s4.innovation_themes[:500],
            })
        except Exception as e:
            steps.append({"name": "innovation", "type": "innovate", "error": str(e)})
            s4 = type("Fallback", (), {"innovations": "[]", "innovation_themes": "[]"})()

        # Step 5: Roadmap
        try:
            s5 = self.roadmap(
                product_understanding=s1.product_understanding,
                feature_gaps=s3.feature_gaps,
                innovations=s4.innovations,
                gap_summary=s3.gap_summary,
                market_position=s2.market_position,
            )
            steps.append({
                "name": "product_roadmap", "type": "report",
                "output_summary": s5.report[:500],
            })
        except Exception as e:
            steps.append({"name": "product_roadmap", "type": "report", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({
                    "product_understanding": s1.product_understanding,
                    "gap_summary": s3.gap_summary,
                    "innovation_themes": s4.innovation_themes,
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
