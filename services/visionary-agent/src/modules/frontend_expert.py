"""
Frontend Expert Chain — 4-step UI/UX analysis using DSPy ChainOfThought.

Steps:
1. ComponentInventory — Map every screen, component, route, state store
2. TraceUserFlows — Trace user journeys (click -> API -> state -> render)
3. QualityAudit — Audit responsiveness, loading states, error handling, a11y
4. EnhancementSuggestions — Suggest specific enhancements with effort/impact
"""

import dspy
import json
from typing import List, Dict, Any


# =============================================================================
# Signatures
# =============================================================================

class ComponentInventory(dspy.Signature):
    """Map every screen, component, route, and state store in the frontend codebase.
    Identify page components vs shared components vs layout components vs hooks."""
    source_files: str = dspy.InputField(desc="Frontend source code files with paths and content")
    components: str = dspy.OutputField(
        desc="JSON array of {name, filePath, type (page|shared|layout|hook|store), route, props, stateStores, apiCalls}"
    )
    architecture_summary: str = dspy.OutputField(
        desc="Summary of frontend architecture: framework, state management, routing, UI library"
    )


class TraceFrontendUserFlows(dspy.Signature):
    """Trace end-to-end user journeys through the frontend. For each flow, track:
    user action -> component handler -> API call -> state update -> re-render -> navigation."""
    components: str = dspy.InputField(desc="JSON array of component inventory from step 1")
    source_files: str = dspy.InputField(desc="Frontend source code files with paths and content")
    user_flows: str = dspy.OutputField(
        desc="JSON array of {flowName, description, steps: [{screen, userAction, handler, apiCall, stateChange, nextScreen}], happy_path: bool}"
    )
    data_flow_diagram: str = dspy.OutputField(
        desc="JSON object describing data flow: {stores: [...], apiLayer, dataTransformations}"
    )


class FrontendQualityAudit(dspy.Signature):
    """Audit frontend quality across multiple dimensions: responsiveness (media queries,
    breakpoints), loading states (spinners, skeletons, suspense), error handling (error
    boundaries, try-catch, fallback UI), accessibility (ARIA, keyboard nav, contrast),
    performance (lazy loading, memoization, virtualization)."""
    components: str = dspy.InputField(desc="JSON array of component inventory")
    user_flows: str = dspy.InputField(desc="JSON array of user flows from step 2")
    source_files: str = dspy.InputField(desc="Frontend source code files with paths and content")
    quality_issues: str = dspy.OutputField(
        desc="JSON array of {category, severity, component, file, line, description, recommendation}"
    )
    quality_scores: str = dspy.OutputField(
        desc="JSON object with {responsiveness: 0-100, loadingStates: 0-100, errorHandling: 0-100, accessibility: 0-100, performance: 0-100, overall: 0-100}"
    )


class FrontendEnhancementSuggestions(dspy.Signature):
    """Suggest specific frontend enhancements ranked by effort vs impact. Consider:
    UX improvements, missing features, performance optimizations, a11y fixes,
    component refactoring opportunities, state management improvements."""
    quality_issues: str = dspy.InputField(desc="JSON array of quality issues from step 3")
    quality_scores: str = dspy.InputField(desc="Quality scores from step 3")
    architecture_summary: str = dspy.InputField(desc="Architecture summary from step 1")
    user_flows: str = dspy.InputField(desc="JSON array of user flows from step 2")
    enhancements: str = dspy.OutputField(
        desc="JSON array of {title, description, category, impact (high|medium|low), effort (hours|days|weeks), files_affected, priority_rank}"
    )
    report: str = dspy.OutputField(
        desc="JSON object with {executive_summary, total_issues, critical_count, enhancement_count, estimated_total_effort}"
    )


# =============================================================================
# Module
# =============================================================================

class FrontendExpertChain(dspy.Module):
    """4-step frontend expert chain. Each step feeds into the next."""

    def __init__(self):
        super().__init__()
        self.inventory = dspy.ChainOfThought(ComponentInventory)
        self.trace_flows = dspy.ChainOfThought(TraceFrontendUserFlows)
        self.quality_audit = dspy.ChainOfThought(FrontendQualityAudit)
        self.suggest = dspy.ChainOfThought(FrontendEnhancementSuggestions)

    def forward(self, source_files: str) -> dspy.Prediction:
        steps = []
        truncated = source_files[:100000]

        # Step 1: Component inventory
        try:
            s1 = self.inventory(source_files=truncated)
            steps.append({
                "name": "component_inventory", "type": "observe",
                "output_summary": s1.architecture_summary[:500],
            })
        except Exception as e:
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 1 failed: {str(e)}"}),
                steps=[{"name": "component_inventory", "type": "observe", "error": str(e)}],
                sub_agents_needed="[]",
            )

        # Step 2: Trace user flows
        try:
            s2 = self.trace_flows(components=s1.components, source_files=truncated)
            steps.append({
                "name": "trace_user_flows", "type": "trace",
                "output_summary": s2.data_flow_diagram[:500],
            })
        except Exception as e:
            steps.append({"name": "trace_user_flows", "type": "trace", "error": str(e)})
            s2 = type("Fallback", (), {"user_flows": "[]", "data_flow_diagram": "{}"})()

        # Step 3: Quality audit
        try:
            s3 = self.quality_audit(
                components=s1.components,
                user_flows=s2.user_flows,
                source_files=truncated,
            )
            steps.append({
                "name": "quality_audit", "type": "audit",
                "output_summary": s3.quality_scores[:500],
            })
        except Exception as e:
            steps.append({"name": "quality_audit", "type": "audit", "error": str(e)})
            s3 = type("Fallback", (), {"quality_issues": "[]", "quality_scores": "{}"})()

        # Step 4: Enhancement suggestions
        try:
            s4 = self.suggest(
                quality_issues=s3.quality_issues,
                quality_scores=s3.quality_scores,
                architecture_summary=s1.architecture_summary,
                user_flows=s2.user_flows,
            )
            steps.append({
                "name": "enhancement_suggestions", "type": "recommend",
                "output_summary": s4.report[:500],
            })
        except Exception as e:
            steps.append({"name": "enhancement_suggestions", "type": "recommend", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({
                    "architecture": s1.architecture_summary,
                    "quality_scores": s3.quality_scores,
                    "error": f"Step 4 failed: {str(e)}",
                }),
                steps=steps,
                sub_agents_needed="[]",
            )

        return dspy.Prediction(
            report=s4.report,
            steps=steps,
            sub_agents_needed="[]",
        )
