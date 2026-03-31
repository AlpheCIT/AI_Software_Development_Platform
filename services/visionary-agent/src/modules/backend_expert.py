"""
Backend Expert Chain — 4-step backend API analysis using DSPy ChainOfThought.

Steps:
1. RouteInventory — Map every endpoint with method, path, handler, middleware
2. HandlerTracing — Trace handlers (validation -> auth -> logic -> DB -> response)
3. QualityAudit — Find quality issues (missing error handling, N+1 queries, no validation)
4. Enhancements — Suggest improvements with effort/impact ranking
"""

import dspy
import json
from typing import List, Dict, Any


# =============================================================================
# Signatures
# =============================================================================

class RouteInventory(dspy.Signature):
    """Map every API endpoint in the backend codebase. For each endpoint identify:
    HTTP method, path, handler function, middleware chain, authentication requirement,
    request validation schema, and response shape."""
    source_files: str = dspy.InputField(desc="Backend source code files with paths and content")
    routes: str = dspy.OutputField(
        desc="JSON array of {method, path, handler, file, line, middleware: [], authRequired, validationSchema, responseShape}"
    )
    architecture_summary: str = dspy.OutputField(
        desc="Summary of backend architecture: framework, ORM/DB driver, auth strategy, middleware stack"
    )


class HandlerTracing(dspy.Signature):
    """For each endpoint handler, trace the full execution flow: input validation ->
    authentication check -> authorization check -> business logic -> database operations ->
    side effects (events, emails, cache) -> response formatting -> error handling."""
    routes: str = dspy.InputField(desc="JSON array of routes from step 1")
    source_files: str = dspy.InputField(desc="Backend source code files with paths and content")
    handler_traces: str = dspy.OutputField(
        desc="JSON array of {endpoint, steps: [{phase, description, file, line, issues}], dbQueries: [], sideEffects: []}"
    )
    cross_cutting_concerns: str = dspy.OutputField(
        desc="JSON object with {errorHandling, logging, caching, eventEmission, transactionManagement}"
    )


class BackendQualityAudit(dspy.Signature):
    """Audit backend quality: missing input validation, unhandled errors, N+1 query patterns,
    missing auth on sensitive endpoints, inconsistent response formats, missing rate limiting,
    hardcoded secrets, SQL/NoSQL injection risks, missing pagination, no request timeouts."""
    handler_traces: str = dspy.InputField(desc="JSON array of handler traces from step 2")
    routes: str = dspy.InputField(desc="JSON array of routes from step 1")
    source_files: str = dspy.InputField(desc="Backend source code files with paths and content")
    quality_issues: str = dspy.OutputField(
        desc="JSON array of {category, severity (critical|high|medium|low), endpoint, file, line, description, recommendation}"
    )
    quality_scores: str = dspy.OutputField(
        desc="JSON object with {inputValidation: 0-100, errorHandling: 0-100, security: 0-100, performance: 0-100, consistency: 0-100, overall: 0-100}"
    )


class BackendEnhancements(dspy.Signature):
    """Suggest specific backend improvements ranked by effort vs impact. Consider:
    missing validation, error handling gaps, performance bottlenecks, security hardening,
    API design improvements, database query optimization, caching opportunities."""
    quality_issues: str = dspy.InputField(desc="JSON array of quality issues from step 3")
    quality_scores: str = dspy.InputField(desc="Quality scores from step 3")
    architecture_summary: str = dspy.InputField(desc="Architecture summary from step 1")
    handler_traces: str = dspy.InputField(desc="JSON array of handler traces from step 2")
    enhancements: str = dspy.OutputField(
        desc="JSON array of {title, description, category, impact (high|medium|low), effort (hours|days|weeks), endpoints_affected, priority_rank}"
    )
    report: str = dspy.OutputField(
        desc="JSON object with {executive_summary, total_endpoints, issues_found, critical_count, enhancement_count, estimated_total_effort}"
    )


# =============================================================================
# Module
# =============================================================================

class BackendExpertChain(dspy.Module):
    """4-step backend expert chain. Each step feeds into the next."""

    def __init__(self):
        super().__init__()
        self.inventory = dspy.ChainOfThought(RouteInventory)
        self.trace_handlers = dspy.ChainOfThought(HandlerTracing)
        self.quality_audit = dspy.ChainOfThought(BackendQualityAudit)
        self.suggest = dspy.ChainOfThought(BackendEnhancements)

    def forward(self, source_files: str) -> dspy.Prediction:
        steps = []
        truncated = source_files[:100000]

        # Step 1: Route inventory
        try:
            s1 = self.inventory(source_files=truncated)
            steps.append({
                "name": "route_inventory", "type": "observe",
                "output_summary": s1.architecture_summary[:500],
            })
        except Exception as e:
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 1 failed: {str(e)}"}),
                steps=[{"name": "route_inventory", "type": "observe", "error": str(e)}],
                sub_agents_needed="[]",
            )

        # Step 2: Handler tracing
        try:
            s2 = self.trace_handlers(routes=s1.routes, source_files=truncated)
            steps.append({
                "name": "handler_tracing", "type": "trace",
                "output_summary": s2.cross_cutting_concerns[:500],
            })
        except Exception as e:
            steps.append({"name": "handler_tracing", "type": "trace", "error": str(e)})
            s2 = type("Fallback", (), {"handler_traces": "[]", "cross_cutting_concerns": "{}"})()

        # Step 3: Quality audit
        try:
            s3 = self.quality_audit(
                handler_traces=s2.handler_traces,
                routes=s1.routes,
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
                handler_traces=s2.handler_traces,
            )
            steps.append({
                "name": "enhancements", "type": "recommend",
                "output_summary": s4.report[:500],
            })
        except Exception as e:
            steps.append({"name": "enhancements", "type": "recommend", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({
                    "architecture": s1.architecture_summary,
                    "quality_scores": s3.quality_scores,
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
                _findings = _report.get('findings', _report.get('issues_found', _report.get('quality_issues', [])))
                if isinstance(_findings, list) and len(_findings) > 0:
                    _sev = {'critical': 15, 'high': 10, 'medium': 5, 'low': 2}
                    _deduction = sum(_sev.get(str(f.get('severity', 'medium')).lower(), 3) for f in _findings if isinstance(f, dict))
                    _calibrated = max(20, min(100, 100 - _deduction))
                    for _key in ['overall_score', 'health_score', 'quality_score', 'risk_score', 'architecture_score']:
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
