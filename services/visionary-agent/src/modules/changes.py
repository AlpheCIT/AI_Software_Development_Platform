"""
Change analysis DSPy module.

Compares previous and current behavioral specs to identify what changed,
assess regression risk, and produce an executive summary.
"""

import dspy
import json


# =============================================================================
# Signatures
# =============================================================================

class IdentifyBehavioralChanges(dspy.Signature):
    """Compare previous behavioral specs against current specs and categorize
    each component/endpoint as new, changed, removed, or unchanged. For changed
    items, describe exactly what changed."""
    previous_specs: str = dspy.InputField(desc="JSON array of previous behavioral specs")
    current_specs: str = dspy.InputField(desc="JSON array of current behavioral specs")
    changes: str = dspy.OutputField(
        desc=(
            "JSON array of {componentPath, status: 'new'|'changed'|'removed'|'unchanged', "
            "changeDetails: [{field, previous, current}]}"
        )
    )


class AssessRegressionRisk(dspy.Signature):
    """For each behavioral change, assess whether it introduces regression risk
    based on the nature of the change, affected user flows, and downstream
    dependencies."""
    changes: str = dspy.InputField(desc="JSON array of behavioral changes with status and details")
    user_flows: str = dspy.InputField(desc="JSON array of user flows that may be affected")
    risk_assessments: str = dspy.OutputField(
        desc=(
            "JSON array of {componentPath, riskLevel: 'critical'|'high'|'medium'|'low'|'none', "
            "reason, affectedFlows: [flowName], suggestedTests: [string]}"
        )
    )


class SummarizeChanges(dspy.Signature):
    """Produce an executive summary of all behavioral changes with prioritized
    action items for the development team."""
    changes: str = dspy.InputField(desc="JSON array of behavioral changes")
    risk_assessments: str = dspy.InputField(desc="JSON array of regression risk assessments")
    summary: str = dspy.OutputField(desc="Markdown executive summary of changes")
    prioritized_actions: str = dspy.OutputField(
        desc="JSON array of {priority: number, action, reason, affectedComponents: [string]}"
    )
    stats: str = dspy.OutputField(
        desc="JSON {totalComponents, newCount, changedCount, removedCount, unchangedCount, criticalRisks, highRisks}"
    )


# =============================================================================
# Module
# =============================================================================

class ChangeAnalysis(dspy.Module):
    """3-step change analysis: identify changes, assess risk, summarize."""

    def __init__(self):
        self.identify = dspy.ChainOfThought(IdentifyBehavioralChanges)
        self.assess_risk = dspy.ChainOfThought(AssessRegressionRisk)
        self.summarize = dspy.ChainOfThought(SummarizeChanges)

    def forward(
        self,
        previous_specs: str,
        current_specs: str,
        user_flows: str = "[]",
    ) -> dspy.Prediction:
        changes = []
        risk_assessments = []
        summary = ""
        prioritized_actions = []
        stats = {}

        # Step 1: Identify behavioral changes
        try:
            change_result = self.identify(
                previous_specs=previous_specs[:15000],
                current_specs=current_specs[:15000],
            )
            changes = json.loads(change_result.changes)
        except Exception as e:
            return dspy.Prediction(
                changes=json.dumps([]),
                risk_assessments=json.dumps([]),
                summary="Change identification failed.",
                prioritized_actions=json.dumps([]),
                stats=json.dumps({}),
                error=f"Step 1 (IdentifyBehavioralChanges) failed: {str(e)}",
            )

        # Step 2: Assess regression risk
        try:
            risk_result = self.assess_risk(
                changes=json.dumps(changes),
                user_flows=user_flows[:15000],
            )
            risk_assessments = json.loads(risk_result.risk_assessments)
        except Exception:
            risk_assessments = []

        # Step 3: Summarize
        try:
            summary_result = self.summarize(
                changes=json.dumps(changes),
                risk_assessments=json.dumps(risk_assessments),
            )
            summary = summary_result.summary
            prioritized_actions = json.loads(summary_result.prioritized_actions)
            stats = json.loads(summary_result.stats)
        except Exception:
            summary = f"Found {len(changes)} changes with {len(risk_assessments)} risk assessments."
            prioritized_actions = []
            stats = {"totalComponents": len(changes)}

        return dspy.Prediction(
            changes=json.dumps(changes),
            risk_assessments=json.dumps(risk_assessments),
            summary=summary,
            prioritized_actions=json.dumps(prioritized_actions),
            stats=json.dumps(stats),
        )
