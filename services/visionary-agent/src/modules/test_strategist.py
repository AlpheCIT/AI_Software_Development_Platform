"""
Test Strategist Chain — 4-step test strategy analysis using DSPy ChainOfThought.

Steps:
1. CoverageMap — Map existing test coverage: what is tested, what is not
2. RiskPrioritization — Prioritize untested areas by business risk and complexity
3. TestQuality — Audit existing test quality: assertions, mocking, edge cases
4. Strategy — Produce a comprehensive test strategy with effort estimates
"""

import dspy
import json
from typing import List, Dict, Any


# =============================================================================
# Signatures
# =============================================================================

class CoverageMap(dspy.Signature):
    """Map existing test coverage across the codebase. Identify: which files have tests,
    which functions/endpoints are tested, which are untested. Distinguish unit tests,
    integration tests, and e2e tests. Note test framework used."""
    source_files: str = dspy.InputField(desc="Source code files with paths and content (includes test files)")
    coverage: str = dspy.OutputField(
        desc="JSON array of {file, hasTests, testFile, testedFunctions: [], untestedFunctions: [], testType (unit|integration|e2e)}"
    )
    coverage_summary: str = dspy.OutputField(
        desc="JSON object with {total_files, files_with_tests, coverage_percentage, test_framework, test_types_found: [], total_test_files}"
    )


class RiskPrioritization(dspy.Signature):
    """Prioritize untested code areas by risk. Consider: business criticality (auth, payments,
    data mutations), complexity (cyclomatic complexity, dependency count), change frequency
    (recently modified files), blast radius (how many other modules depend on it)."""
    coverage: str = dspy.InputField(desc="JSON array of coverage data from step 1")
    coverage_summary: str = dspy.InputField(desc="Coverage summary from step 1")
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    prioritized_gaps: str = dspy.OutputField(
        desc="JSON array of {file, function, risk_score (1-10), risk_factors: [], business_impact, recommended_test_type}"
    )
    risk_summary: str = dspy.OutputField(
        desc="JSON object with {critical_untested: int, high_risk_untested: int, total_untested_functions: int, highest_risk_area}"
    )


class TestQualityAudit(dspy.Signature):
    """Audit the quality of existing tests. Check for: meaningful assertions (not just
    'toBeDefined'), proper mocking (over-mocking vs under-mocking), edge case coverage,
    test isolation, flaky test indicators, test naming conventions, arrange-act-assert pattern."""
    source_files: str = dspy.InputField(desc="Source code files with paths and content (test files)")
    coverage: str = dspy.InputField(desc="JSON array of coverage data from step 1")
    test_quality_issues: str = dspy.OutputField(
        desc="JSON array of {testFile, issue, severity, description, recommendation}"
    )
    test_quality_scores: str = dspy.OutputField(
        desc="JSON object with {assertion_quality: 0-100, mocking_quality: 0-100, edge_case_coverage: 0-100, isolation: 0-100, naming: 0-100, overall: 0-100}"
    )


class TestStrategy(dspy.Signature):
    """Produce a comprehensive test strategy. Include: what to test first (prioritized),
    recommended test types for each area, testing tools to add, mocking strategy,
    CI integration plan, coverage targets, and effort estimates per phase."""
    prioritized_gaps: str = dspy.InputField(desc="JSON array of prioritized gaps from step 2")
    risk_summary: str = dspy.InputField(desc="Risk summary from step 2")
    test_quality_issues: str = dspy.InputField(desc="JSON array of test quality issues from step 3")
    test_quality_scores: str = dspy.InputField(desc="Test quality scores from step 3")
    coverage_summary: str = dspy.InputField(desc="Coverage summary from step 1")
    strategy: str = dspy.OutputField(
        desc="JSON array of {phase, description, tests_to_write: [{file, function, test_type, priority}], tools_needed, effort_hours}"
    )
    report: str = dspy.OutputField(
        desc="JSON object with {executive_summary, current_coverage, target_coverage, total_tests_needed, total_effort_hours, phases: int, critical_first_tests: [...]}"
    )


# =============================================================================
# Module
# =============================================================================

class TestStrategistChain(dspy.Module):
    """4-step test strategist chain. Each step feeds into the next."""

    def __init__(self):
        super().__init__()
        self.map_coverage = dspy.ChainOfThought(CoverageMap)
        self.prioritize_risk = dspy.ChainOfThought(RiskPrioritization)
        self.audit_quality = dspy.ChainOfThought(TestQualityAudit)
        self.produce_strategy = dspy.ChainOfThought(TestStrategy)

    def forward(self, source_files: str) -> dspy.Prediction:
        steps = []
        truncated = source_files[:100000]

        # Step 1: Coverage map
        try:
            s1 = self.map_coverage(source_files=truncated)
            steps.append({
                "name": "coverage_map", "type": "observe",
                "output_summary": s1.coverage_summary[:500],
            })
        except Exception as e:
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 1 failed: {str(e)}"}),
                steps=[{"name": "coverage_map", "type": "observe", "error": str(e)}],
                sub_agents_needed="[]",
            )

        # Step 2: Risk prioritization
        try:
            s2 = self.prioritize_risk(
                coverage=s1.coverage,
                coverage_summary=s1.coverage_summary,
                source_files=truncated,
            )
            steps.append({
                "name": "risk_prioritization", "type": "prioritize",
                "output_summary": s2.risk_summary[:500],
            })
        except Exception as e:
            steps.append({"name": "risk_prioritization", "type": "prioritize", "error": str(e)})
            s2 = type("Fallback", (), {"prioritized_gaps": "[]", "risk_summary": "{}"})()

        # Step 3: Test quality audit
        try:
            s3 = self.audit_quality(source_files=truncated, coverage=s1.coverage)
            steps.append({
                "name": "test_quality_audit", "type": "audit",
                "output_summary": s3.test_quality_scores[:500],
            })
        except Exception as e:
            steps.append({"name": "test_quality_audit", "type": "audit", "error": str(e)})
            s3 = type("Fallback", (), {"test_quality_issues": "[]", "test_quality_scores": "{}"})()

        # Step 4: Strategy
        try:
            s4 = self.produce_strategy(
                prioritized_gaps=s2.prioritized_gaps,
                risk_summary=s2.risk_summary,
                test_quality_issues=s3.test_quality_issues,
                test_quality_scores=s3.test_quality_scores,
                coverage_summary=s1.coverage_summary,
            )
            steps.append({
                "name": "test_strategy", "type": "report",
                "output_summary": s4.report[:500],
            })
        except Exception as e:
            steps.append({"name": "test_strategy", "type": "report", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({
                    "coverage_summary": s1.coverage_summary,
                    "risk_summary": s2.risk_summary,
                    "test_quality_scores": s3.test_quality_scores,
                    "error": f"Step 4 failed: {str(e)}",
                }),
                steps=steps,
                sub_agents_needed="[]",
            )

        # Calibrate score based on actual findings
        _final_report = s4.report
        try:
            _report = json.loads(_final_report) if isinstance(_final_report, str) else _final_report
            if isinstance(_report, dict):
                _findings = _report.get('findings', _report.get('critical_first_tests', _report.get('test_quality_issues', [])))
                if isinstance(_findings, list) and len(_findings) > 0:
                    _sev = {'critical': 15, 'high': 10, 'medium': 5, 'low': 2}
                    _deduction = sum(_sev.get(str(f.get('severity', f.get('priority', 'medium'))).lower(), 3) for f in _findings if isinstance(f, dict))
                    _calibrated = max(20, min(100, 100 - _deduction))
                    for _key in ['overall_score', 'quality_score', 'health_score', 'coverage_score', 'risk_score']:
                        if _key in _report:
                            _report[_key] = _calibrated
                            break
                    else:
                        _report['calibrated_score'] = _calibrated
                    _final_report = json.dumps(_report)
        except Exception:
            pass  # Non-fatal: keep original score if calibration fails

        return dspy.Prediction(
            report=_final_report,
            steps=steps,
            sub_agents_needed="[]",
        )
