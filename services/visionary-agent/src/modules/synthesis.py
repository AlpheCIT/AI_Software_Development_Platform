"""
Full-stack synthesis and audit DSPy modules.

Connects frontend, backend, and middleware behavioral specs into end-to-end
flow descriptions and identifies integration mismatches.
"""

import dspy
import json


# =============================================================================
# Signatures
# =============================================================================

class SynthesizeFullStack(dspy.Signature):
    """Connect frontend behavioral specs, backend endpoint specs, and middleware
    maps into end-to-end flow descriptions showing how data moves from the UI
    through middleware into backend handlers and the database."""
    frontend_specs: str = dspy.InputField(desc="JSON array of frontend BehavioralSpec objects")
    backend_specs: str = dspy.InputField(desc="JSON array of backend endpoint specs")
    middleware_map: str = dspy.InputField(desc="JSON middleware-to-route map and auth flows")
    flows: str = dspy.OutputField(
        desc=(
            "JSON array of {flowName, description, trigger, "
            "steps: [{stepNumber, layer, component, action, dataIn, dataOut}]}"
        )
    )


class CompareStacks(dspy.Signature):
    """Compare frontend expectations against backend reality and find
    mismatches: endpoints the frontend calls that don't exist, fields the
    frontend sends that the backend ignores, response shapes that differ."""
    frontend_specs: str = dspy.InputField(desc="JSON array of frontend specs with element.targetEndpoint")
    backend_specs: str = dspy.InputField(desc="JSON array of backend endpoint specs with path and responseShape")
    mismatches: str = dspy.OutputField(
        desc=(
            "JSON array of {type, frontendComponent, backendEndpoint, "
            "expected, actual, severity, recommendation}"
        )
    )


class FindIntegrationGaps(dspy.Signature):
    """Identify integration gaps: unhandled error paths, missing client-side
    validation for server-side constraints, field name mismatches between
    frontend payloads and backend schemas, missing CORS or auth headers."""
    mismatches: str = dspy.InputField(desc="JSON array of stack mismatches already found")
    frontend_specs: str = dspy.InputField(desc="JSON array of frontend specs")
    backend_specs: str = dspy.InputField(desc="JSON array of backend endpoint specs")
    middleware_map: str = dspy.InputField(desc="JSON middleware map")
    gaps: str = dspy.OutputField(
        desc=(
            "JSON array of {gapType, description, affectedEndpoints, "
            "affectedComponents, severity, suggestedFix}"
        )
    )


# =============================================================================
# Modules
# =============================================================================

class FullStackSynthesis(dspy.Module):
    """Single-step module that synthesizes frontend + backend + middleware
    into coherent end-to-end flow descriptions."""

    def __init__(self):
        self.synthesize = dspy.ChainOfThought(SynthesizeFullStack)

    def forward(
        self,
        frontend_specs: str,
        backend_specs: str,
        middleware_map: str,
    ) -> dspy.Prediction:
        try:
            result = self.synthesize(
                frontend_specs=frontend_specs[:15000],
                backend_specs=backend_specs[:15000],
                middleware_map=middleware_map[:15000],
            )
            flows = json.loads(result.flows)
        except Exception as e:
            flows = []
            return dspy.Prediction(
                flows=json.dumps(flows),
                error=f"Synthesis failed: {str(e)}",
            )

        return dspy.Prediction(flows=json.dumps(flows))


class FullStackAudit(dspy.Module):
    """2-step audit that finds mismatches between frontend expectations
    and backend reality, then identifies deeper integration gaps."""

    def __init__(self):
        self.compare = dspy.ChainOfThought(CompareStacks)
        self.find_gaps = dspy.ChainOfThought(FindIntegrationGaps)

    def forward(
        self,
        frontend_specs: str,
        backend_specs: str,
        middleware_map: str,
    ) -> dspy.Prediction:
        mismatches = []
        gaps = []

        # Step 1: Compare stacks
        try:
            cmp_result = self.compare(
                frontend_specs=frontend_specs[:15000],
                backend_specs=backend_specs[:15000],
            )
            mismatches = json.loads(cmp_result.mismatches)
        except Exception as e:
            return dspy.Prediction(
                mismatches=json.dumps([]),
                gaps=json.dumps([]),
                error=f"Step 1 (CompareStacks) failed: {str(e)}",
            )

        # Step 2: Find integration gaps
        try:
            gap_result = self.find_gaps(
                mismatches=json.dumps(mismatches),
                frontend_specs=frontend_specs[:15000],
                backend_specs=backend_specs[:15000],
                middleware_map=middleware_map[:15000],
            )
            gaps = json.loads(gap_result.gaps)
        except Exception:
            gaps = []

        return dspy.Prediction(
            mismatches=json.dumps(mismatches),
            gaps=json.dumps(gaps),
        )
