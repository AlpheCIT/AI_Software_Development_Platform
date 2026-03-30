"""
Security Expert Chain — 5-step deep security analysis using DSPy ChainOfThought.

Steps:
1. MapAttackSurface — Identify all entry points (HTTP, WS, uploads, cron)
2. IdentifySecurityFocusAreas — Prioritize high-risk areas, suggest sub-agents
3. DeepSecurityAnalysis — Find candidate vulnerabilities with evidence
4. VerifySecurityFindings — Filter false positives by checking mitigations
5. ProduceSecurityReport — Structured report with only verified findings
"""

import dspy
import json
from typing import List, Dict, Any


# =============================================================================
# Signatures
# =============================================================================

class MapAttackSurface(dspy.Signature):
    """Identify all entry points in the codebase: HTTP endpoints, WebSocket handlers,
    file upload routes, cron jobs, CLI commands, and message queue consumers."""
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    endpoints: str = dspy.OutputField(
        desc="JSON array of all HTTP/WS/upload endpoints with method, path, file, line"
    )
    entry_points_summary: str = dspy.OutputField(desc="Summary of attack surface")


class IdentifySecurityFocusAreas(dspy.Signature):
    """Given the attack surface, identify areas that need deeper analysis.
    Rank by risk: auth endpoints, file uploads, user input handlers, admin routes."""
    endpoints: str = dspy.InputField(desc="JSON array of endpoints from step 1")
    entry_points_summary: str = dspy.InputField(desc="Attack surface summary from step 1")
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    high_risk_areas: str = dspy.OutputField(
        desc="JSON array of {area, files, risk_level, reason} needing deep analysis"
    )
    sub_agents_needed: str = dspy.OutputField(
        desc="JSON array of {task, domain, context} for sub-agent tasks to spawn"
    )


class DeepSecurityAnalysis(dspy.Signature):
    """Perform deep security analysis on identified high-risk areas. Check for real
    vulnerabilities: SQL/NoSQL injection, XSS, SSRF, path traversal, auth bypass,
    insecure deserialization, secrets in code, broken access control."""
    high_risk_areas: str = dspy.InputField(desc="JSON array of high-risk areas from step 2")
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    candidate_findings: str = dspy.OutputField(
        desc="JSON array of {type, severity, file, line, evidence, description} potential vulnerabilities"
    )


class VerifySecurityFindings(dspy.Signature):
    """For each candidate finding, verify it is real by checking for mitigations:
    global middleware (helmet, cors, rate-limit), input validation (Joi, Zod, class-validator),
    auth checks (JWT verify, session checks), parameterized queries, CSP headers."""
    candidate_findings: str = dspy.InputField(
        desc="JSON array of potential vulnerabilities from step 3"
    )
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    verified_findings: str = dspy.OutputField(
        desc="JSON array of {type, severity, file, line, evidence, description, confidence} verified vulnerabilities"
    )
    false_positives_removed: str = dspy.OutputField(
        desc="JSON array of {type, file, reason_dismissed, mitigation_evidence} false positives with mitigation evidence"
    )


class ProduceSecurityReport(dspy.Signature):
    """Produce a structured security report with only verified findings, ranked by severity.
    Include executive summary, finding details, remediation plan with effort estimates."""
    verified_findings: str = dspy.InputField(desc="JSON array of verified vulnerabilities")
    false_positives_removed: str = dspy.InputField(desc="JSON array of dismissed false positives")
    entry_points_summary: str = dspy.InputField(desc="Attack surface summary")
    report: str = dspy.OutputField(
        desc="JSON object with {summary, risk_score, findings: [...], remediation_plan: [...], false_positives_dismissed: int}"
    )


# =============================================================================
# Module
# =============================================================================

class SecurityExpertChain(dspy.Module):
    """5-step security expert chain. Each step feeds into the next."""

    def __init__(self):
        super().__init__()
        self.map_surface = dspy.ChainOfThought(MapAttackSurface)
        self.identify_focus = dspy.ChainOfThought(IdentifySecurityFocusAreas)
        self.deep_analysis = dspy.ChainOfThought(DeepSecurityAnalysis)
        self.verify = dspy.ChainOfThought(VerifySecurityFindings)
        self.report = dspy.ChainOfThought(ProduceSecurityReport)

    def forward(self, source_files: str) -> dspy.Prediction:
        steps = []
        truncated = source_files[:100000]

        # Step 1: Map attack surface
        try:
            s1 = self.map_surface(source_files=truncated)
            steps.append({
                "name": "map_attack_surface", "type": "observe",
                "output_summary": s1.entry_points_summary[:500],
            })
        except Exception as e:
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 1 failed: {str(e)}"}),
                steps=[{"name": "map_attack_surface", "type": "observe", "error": str(e)}],
                sub_agents_needed="[]",
            )

        # Step 2: Identify focus areas
        try:
            s2 = self.identify_focus(
                endpoints=s1.endpoints,
                entry_points_summary=s1.entry_points_summary,
                source_files=truncated,
            )
            steps.append({
                "name": "identify_focus_areas", "type": "focus",
                "output_summary": s2.high_risk_areas[:500],
            })
        except Exception as e:
            steps.append({"name": "identify_focus_areas", "type": "focus", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 2 failed: {str(e)}", "partial_surface": s1.entry_points_summary[:500]}),
                steps=steps,
                sub_agents_needed="[]",
            )

        # Step 3: Deep analysis
        try:
            s3 = self.deep_analysis(high_risk_areas=s2.high_risk_areas, source_files=truncated)
            steps.append({
                "name": "deep_analysis", "type": "analyze",
                "output_summary": s3.candidate_findings[:500],
            })
        except Exception as e:
            steps.append({"name": "deep_analysis", "type": "analyze", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 3 failed: {str(e)}"}),
                steps=steps,
                sub_agents_needed=s2.sub_agents_needed,
            )

        # Step 4: Verify findings
        try:
            s4 = self.verify(candidate_findings=s3.candidate_findings, source_files=truncated)
            steps.append({
                "name": "verify_findings", "type": "verify",
                "output_summary": f"Verified: {s4.verified_findings[:200]}... FP removed: {s4.false_positives_removed[:200]}",
            })
        except Exception as e:
            steps.append({"name": "verify_findings", "type": "verify", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 4 failed: {str(e)}", "unverified_candidates": s3.candidate_findings[:1000]}),
                steps=steps,
                sub_agents_needed=s2.sub_agents_needed,
            )

        # Step 5: Produce report
        try:
            s5 = self.report(
                verified_findings=s4.verified_findings,
                false_positives_removed=s4.false_positives_removed,
                entry_points_summary=s1.entry_points_summary,
            )
            steps.append({
                "name": "produce_report", "type": "report",
                "output_summary": s5.report[:500],
            })
        except Exception as e:
            steps.append({"name": "produce_report", "type": "report", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({"verified_findings": s4.verified_findings, "error": f"Report generation failed: {str(e)}"}),
                steps=steps,
                sub_agents_needed=s2.sub_agents_needed,
            )

        return dspy.Prediction(
            report=s5.report,
            steps=steps,
            sub_agents_needed=s2.sub_agents_needed,
        )
