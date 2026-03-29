"""
Gherkin feature-file generation DSPy module.

Takes behavioral specs and produces syntactically valid Gherkin .feature file
content with detailed Given/When/Then scenarios.
"""

import dspy
import json


# =============================================================================
# Signatures
# =============================================================================

class StructureFeature(dspy.Signature):
    """Outline the .feature file structure for a component: Feature title,
    Background steps, and a list of Scenario names with brief descriptions."""
    component_spec: str = dspy.InputField(desc="JSON BehavioralSpec for one frontend component")
    user_flows: str = dspy.InputField(desc="JSON array of user flows that involve this component")
    feature_outline: str = dspy.OutputField(
        desc=(
            "JSON {featureName, background: [step], "
            "scenarios: [{name, description, tags}]}"
        )
    )


class WriteScenarios(dspy.Signature):
    """Write detailed Given/When/Then steps for each scenario in the outline."""
    feature_outline: str = dspy.InputField(desc="JSON feature outline from StructureFeature")
    component_spec: str = dspy.InputField(desc="JSON BehavioralSpec for the component")
    gherkin_content: str = dspy.OutputField(
        desc="Complete Gherkin .feature file content as a plain string"
    )


class ValidateGherkin(dspy.Signature):
    """Check Gherkin syntax validity and completeness. Flag missing scenarios,
    malformed steps, or uncovered interactive elements."""
    gherkin_content: str = dspy.InputField(desc="Gherkin .feature file content")
    component_spec: str = dspy.InputField(desc="JSON BehavioralSpec for the component")
    is_valid: bool = dspy.OutputField(desc="Whether the Gherkin is syntactically valid")
    issues: str = dspy.OutputField(desc="JSON array of {issue, line, suggestion} or empty array")
    corrected_content: str = dspy.OutputField(
        desc="Corrected Gherkin content if issues were found, otherwise same as input"
    )


# =============================================================================
# Module
# =============================================================================

class GherkinGeneration(dspy.Module):
    """3-step Gherkin generation: outline, write, validate."""

    def __init__(self):
        self.structure = dspy.ChainOfThought(StructureFeature)
        self.write = dspy.ChainOfThought(WriteScenarios)
        self.validate = dspy.ChainOfThought(ValidateGherkin)

    def forward(
        self,
        component_specs: list,
        user_flows: str = "[]",
    ) -> dspy.Prediction:
        features = []

        for spec in component_specs[:10]:  # Cap at 10 components
            spec_json = json.dumps(spec) if isinstance(spec, dict) else spec
            component_path = spec.get("componentPath", "") if isinstance(spec, dict) else ""

            # Step 1: Structure the feature
            try:
                outline_result = self.structure(
                    component_spec=spec_json[:15000],
                    user_flows=user_flows[:15000],
                )
                feature_outline = outline_result.feature_outline
            except Exception as e:
                features.append({
                    "featureName": f"Feature for {component_path}",
                    "componentPath": component_path,
                    "gherkinContent": "",
                    "scenarioCount": 0,
                    "error": f"Step 1 (StructureFeature) failed: {str(e)}",
                })
                continue

            # Step 2: Write scenarios
            try:
                write_result = self.write(
                    feature_outline=feature_outline,
                    component_spec=spec_json[:15000],
                )
                gherkin_content = write_result.gherkin_content
            except Exception as e:
                features.append({
                    "featureName": component_path,
                    "componentPath": component_path,
                    "gherkinContent": "",
                    "scenarioCount": 0,
                    "error": f"Step 2 (WriteScenarios) failed: {str(e)}",
                })
                continue

            # Step 3: Validate and correct
            try:
                val_result = self.validate(
                    gherkin_content=gherkin_content,
                    component_spec=spec_json[:15000],
                )
                final_content = val_result.corrected_content if not val_result.is_valid else gherkin_content
                issues = json.loads(val_result.issues) if isinstance(val_result.issues, str) else []
            except Exception:
                final_content = gherkin_content
                issues = []

            # Count scenarios
            scenario_count = final_content.lower().count("scenario:")
            scenario_count += final_content.lower().count("scenario outline:")

            try:
                outline_data = json.loads(feature_outline)
                feature_name = outline_data.get("featureName", component_path)
            except Exception:
                feature_name = component_path

            features.append({
                "featureName": feature_name,
                "componentPath": component_path,
                "gherkinContent": final_content,
                "scenarioCount": scenario_count,
                "validationIssues": issues,
            })

        return dspy.Prediction(features=json.dumps(features))
