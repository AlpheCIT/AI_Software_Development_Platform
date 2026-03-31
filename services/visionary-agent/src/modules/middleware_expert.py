"""
Middleware Expert Chain — 4-step middleware analysis using DSPy ChainOfThought.

Steps:
1. PipelineMap — Map what middleware runs on which routes, in what order
2. CoverageAnalysis — Which routes LACK protection (auth, validation, rate-limit)
3. ConfigAudit — Are middleware configs production-ready (CORS, helmet, CSP, etc.)
4. Recommendations — Specific recommendations with priority ranking
"""

import dspy
import json
from typing import List, Dict, Any


# =============================================================================
# Signatures
# =============================================================================

class PipelineMap(dspy.Signature):
    """Map the complete middleware pipeline: which middleware runs on which routes,
    in what order. Include global middleware, route-level middleware, and error handlers.
    Identify the middleware type: auth, validation, logging, rate-limit, CORS, etc."""
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    pipeline: str = dspy.OutputField(
        desc="JSON array of {route, method, middlewareChain: [{name, type, order, file, configSummary}]}"
    )
    global_middleware: str = dspy.OutputField(
        desc="JSON array of {name, type, file, order, configSummary} for globally-applied middleware"
    )


class CoverageAnalysis(dspy.Signature):
    """Analyze which routes LACK critical middleware protection. Check for:
    routes without authentication, routes without input validation,
    routes without rate limiting, routes without CORS protection,
    admin routes without authorization checks, file upload routes without size limits."""
    pipeline: str = dspy.InputField(desc="JSON array of route middleware pipelines from step 1")
    global_middleware: str = dspy.InputField(desc="JSON array of global middleware from step 1")
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    unprotected_routes: str = dspy.OutputField(
        desc="JSON array of {route, method, missing_middleware: [], risk_level, description}"
    )
    coverage_scores: str = dspy.OutputField(
        desc="JSON object with {auth_coverage: 0-100, validation_coverage: 0-100, rate_limit_coverage: 0-100, error_handling_coverage: 0-100}"
    )


class ConfigAudit(dspy.Signature):
    """Audit middleware configurations for production readiness. Check:
    CORS (overly permissive origins?), helmet/CSP (headers missing?),
    rate limiter (limits too high?), session config (secure cookies?),
    body parser (size limits?), logging (PII leaking?), error handler (stack traces exposed?)."""
    global_middleware: str = dspy.InputField(desc="JSON array of global middleware from step 1")
    pipeline: str = dspy.InputField(desc="JSON array of route middleware pipelines from step 1")
    source_files: str = dspy.InputField(desc="Source code files with paths and content")
    config_issues: str = dspy.OutputField(
        desc="JSON array of {middleware, issue, severity, current_config, recommended_config, file, line}"
    )
    production_readiness: str = dspy.OutputField(
        desc="JSON object with {overall_score: 0-100, cors_safe: bool, headers_safe: bool, rate_limits_set: bool, sessions_secure: bool, errors_safe: bool}"
    )


class MiddlewareRecommendations(dspy.Signature):
    """Produce specific middleware recommendations based on coverage gaps and config issues.
    Prioritize by security impact. Include code snippets for implementation."""
    unprotected_routes: str = dspy.InputField(desc="JSON array of unprotected routes from step 2")
    coverage_scores: str = dspy.InputField(desc="Coverage scores from step 2")
    config_issues: str = dspy.InputField(desc="JSON array of config issues from step 3")
    production_readiness: str = dspy.InputField(desc="Production readiness scores from step 3")
    recommendations: str = dspy.OutputField(
        desc="JSON array of {title, description, priority (critical|high|medium|low), effort, implementation_hint, routes_affected}"
    )
    report: str = dspy.OutputField(
        desc="JSON object with {executive_summary, total_routes, unprotected_count, config_issues_count, recommendations_count, overall_middleware_score: 0-100}"
    )


# =============================================================================
# Module
# =============================================================================

class MiddlewareExpertChain(dspy.Module):
    """4-step middleware expert chain. Each step feeds into the next."""

    def __init__(self):
        super().__init__()
        self.map_pipeline = dspy.ChainOfThought(PipelineMap)
        self.analyze_coverage = dspy.ChainOfThought(CoverageAnalysis)
        self.audit_config = dspy.ChainOfThought(ConfigAudit)
        self.recommend = dspy.ChainOfThought(MiddlewareRecommendations)

    def forward(self, source_files: str) -> dspy.Prediction:
        steps = []
        truncated = source_files[:100000]

        # Step 1: Pipeline map
        try:
            s1 = self.map_pipeline(source_files=truncated)
            steps.append({
                "name": "pipeline_map", "type": "observe",
                "output_summary": s1.global_middleware[:500],
            })
        except Exception as e:
            return dspy.Prediction(
                report=json.dumps({"error": f"Step 1 failed: {str(e)}"}),
                steps=[{"name": "pipeline_map", "type": "observe", "error": str(e)}],
                sub_agents_needed="[]",
            )

        # Step 2: Coverage analysis
        try:
            s2 = self.analyze_coverage(
                pipeline=s1.pipeline,
                global_middleware=s1.global_middleware,
                source_files=truncated,
            )
            steps.append({
                "name": "coverage_analysis", "type": "analyze",
                "output_summary": s2.coverage_scores[:500],
            })
        except Exception as e:
            steps.append({"name": "coverage_analysis", "type": "analyze", "error": str(e)})
            s2 = type("Fallback", (), {"unprotected_routes": "[]", "coverage_scores": "{}"})()

        # Step 3: Config audit
        try:
            s3 = self.audit_config(
                global_middleware=s1.global_middleware,
                pipeline=s1.pipeline,
                source_files=truncated,
            )
            steps.append({
                "name": "config_audit", "type": "audit",
                "output_summary": s3.production_readiness[:500],
            })
        except Exception as e:
            steps.append({"name": "config_audit", "type": "audit", "error": str(e)})
            s3 = type("Fallback", (), {"config_issues": "[]", "production_readiness": "{}"})()

        # Step 4: Recommendations
        try:
            s4 = self.recommend(
                unprotected_routes=s2.unprotected_routes,
                coverage_scores=s2.coverage_scores,
                config_issues=s3.config_issues,
                production_readiness=s3.production_readiness,
            )
            steps.append({
                "name": "recommendations", "type": "recommend",
                "output_summary": s4.report[:500],
            })
        except Exception as e:
            steps.append({"name": "recommendations", "type": "recommend", "error": str(e)})
            return dspy.Prediction(
                report=json.dumps({
                    "coverage_scores": s2.coverage_scores,
                    "production_readiness": s3.production_readiness,
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
                _findings = _report.get('findings', _report.get('config_issues', _report.get('unprotected_routes', [])))
                if isinstance(_findings, list) and len(_findings) > 0:
                    _sev = {'critical': 15, 'high': 10, 'medium': 5, 'low': 2}
                    _deduction = sum(_sev.get(str(f.get('severity', f.get('risk_level', 'medium'))).lower(), 3) for f in _findings if isinstance(f, dict))
                    _calibrated = max(20, min(100, 100 - _deduction))
                    for _key in ['overall_middleware_score', 'overall_score', 'health_score', 'quality_score', 'risk_score']:
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
