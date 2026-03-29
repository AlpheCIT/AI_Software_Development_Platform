from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional
import dspy
import os
import json

from modules.behavioral import FrontendBehavioralAnalysis, BackendBehavioralAnalysis, MiddlewareAnalysis
from modules.synthesis import FullStackSynthesis, FullStackAudit
from modules.gherkin import GherkinGeneration
from modules.changes import ChangeAnalysis

app = FastAPI(title="Visionary Agent", version="2.0.0")

# Configure DSPy with Claude
lm = dspy.LM(
    model=os.getenv("ANTHROPIC_MODEL", "anthropic/claude-sonnet-4-20250514"),
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    max_tokens=8192
)
dspy.configure(lm=lm)

# --- Signatures -----------------------------------------------------------

class IdentifySecurityRisks(dspy.Signature):
    """Given a file list and business context, identify security-critical files and global mitigations."""
    file_list: str = dspy.InputField(desc="List of all files in the repo")
    business_context: str = dspy.InputField(desc="What the application does")
    risk_files: str = dspy.OutputField(desc="JSON array of {path, risk_type, reason}")
    global_mitigations: str = dspy.OutputField(desc="Auth middleware, rate limiting, etc. found in entry files")

class AnalyzeFileForVulnerabilities(dspy.Signature):
    """Deeply analyze a single file for security vulnerabilities with evidence."""
    file_path: str = dspy.InputField()
    file_content: str = dspy.InputField()
    risk_type: str = dspy.InputField(desc="e.g., auth, injection, secrets")
    business_context: str = dspy.InputField()
    vulnerabilities: str = dspy.OutputField(desc="JSON array of {type, severity, line, evidence, description, remediation}")

class VerifyVulnerability(dspy.Signature):
    """Verify if a reported vulnerability is real or a false positive."""
    vulnerability: str = dspy.InputField(desc="The claimed vulnerability")
    file_content: str = dspy.InputField(desc="Full source code of the file")
    mitigations_context: str = dspy.InputField(desc="Known global mitigations")
    is_real: bool = dspy.OutputField(desc="True if vulnerability is confirmed real")
    confidence: float = dspy.OutputField(desc="0.0-1.0 confidence score")
    evidence: str = dspy.OutputField(desc="Why it is/isn't real")

class AssessBusinessImpact(dspy.Signature):
    """Assess the business impact of a confirmed vulnerability."""
    vulnerability: str = dspy.InputField()
    business_context: str = dspy.InputField()
    blast_radius: str = dspy.InputField(desc="Files affected by this vulnerability")
    business_impact: str = dspy.OutputField(desc="How this affects business operations")
    priority: str = dspy.OutputField(desc="critical/high/medium/low")
    remediation_effort: str = dspy.OutputField(desc="Estimated effort: hours/days/weeks")

class CompareArchitecture(dspy.Signature):
    """Compare codebase architecture against industry best practices."""
    codebase_summary: str = dspy.InputField()
    framework_stack: str = dspy.InputField()
    industry_context: str = dspy.InputField()
    comparison_report: str = dspy.OutputField()

class IdentifyGaps(dspy.Signature):
    """Identify gaps between current patterns and industry standards."""
    detected_patterns: str = dspy.InputField()
    standards: str = dspy.InputField()
    gap_analysis: str = dspy.OutputField()

class RecommendImprovements(dspy.Signature):
    """Recommend concrete improvements based on gap analysis."""
    gap_analysis: str = dspy.InputField()
    industry_context: str = dspy.InputField()
    recommendations: str = dspy.OutputField()

# --- Modules ---------------------------------------------------------------

class SecurityDeepDive(dspy.Module):
    def __init__(self):
        self.identify = dspy.ChainOfThought(IdentifySecurityRisks)
        self.analyze = dspy.ChainOfThought(AnalyzeFileForVulnerabilities)
        self.verify = dspy.ChainOfThought(VerifyVulnerability)
        self.impact = dspy.ChainOfThought(AssessBusinessImpact)

    def forward(self, file_list, file_contents, business_context):
        # Step 1: Identify risk areas
        risks = self.identify(file_list=file_list, business_context=business_context)

        # Step 2-4: Analyze, verify, assess each risk file
        findings = []
        try:
            risk_files = json.loads(risks.risk_files)
        except Exception:
            risk_files = []

        for risk in risk_files[:10]:  # Limit to 10 files
            path = risk.get('path', '')
            content = file_contents.get(path, '')
            if not content:
                continue

            analysis = self.analyze(
                file_path=path,
                file_content=content[:15000],  # Limit per-file context
                risk_type=risk.get('risk_type', 'general'),
                business_context=business_context
            )

            try:
                vulns = json.loads(analysis.vulnerabilities)
            except Exception:
                vulns = []

            for vuln in vulns:
                verification = self.verify(
                    vulnerability=json.dumps(vuln),
                    file_content=content[:10000],
                    mitigations_context=risks.global_mitigations
                )

                if verification.is_real:
                    impact_assessment = self.impact(
                        vulnerability=json.dumps(vuln),
                        business_context=business_context,
                        blast_radius=str(risk.get('dependents', []))
                    )
                    findings.append({
                        **vuln,
                        'verified': True,
                        'confidence': verification.confidence,
                        'verification_evidence': verification.evidence,
                        'business_impact': impact_assessment.business_impact,
                        'priority': impact_assessment.priority,
                        'remediation_effort': impact_assessment.remediation_effort
                    })

        return dspy.Prediction(findings=json.dumps(findings))


class VisionaryAnalyzer(dspy.Module):
    def __init__(self):
        self.compare = dspy.ChainOfThought(CompareArchitecture)
        self.gap_analysis = dspy.ChainOfThought(IdentifyGaps)
        self.recommend = dspy.ChainOfThought(RecommendImprovements)

    def forward(self, codebase_summary, framework_stack, industry_context):
        comparison = self.compare(
            codebase_summary=codebase_summary,
            framework_stack=framework_stack,
            industry_context=industry_context
        )
        gaps = self.gap_analysis(
            detected_patterns=codebase_summary,
            standards=comparison.comparison_report
        )
        recommendations = self.recommend(
            gap_analysis=gaps.gap_analysis,
            industry_context=industry_context
        )
        return dspy.Prediction(
            comparison=comparison.comparison_report,
            gaps=gaps.gap_analysis,
            recommendations=recommendations.recommendations
        )


# --- Endpoints -------------------------------------------------------------

class VisionaryRequest(BaseModel):
    codebase_summary: str
    framework_stack: str
    industry_context: str = "general software development"

class SecurityDeepDiveRequest(BaseModel):
    file_list: str
    file_contents: dict  # path -> content
    business_context: str

@app.get("/health")
def health():
    return {"status": "healthy", "service": "visionary-agent", "dspy_configured": True}

@app.post("/analyze/vision")
def analyze_vision(req: VisionaryRequest):
    analyzer = VisionaryAnalyzer()
    result = analyzer(
        codebase_summary=req.codebase_summary,
        framework_stack=req.framework_stack,
        industry_context=req.industry_context
    )
    return {
        "comparison": result.comparison,
        "gaps": result.gaps,
        "recommendations": result.recommendations
    }

@app.post("/analyze/security-deep-dive")
def security_deep_dive(req: SecurityDeepDiveRequest):
    analyzer = SecurityDeepDive()
    result = analyzer(
        file_list=req.file_list,
        file_contents=req.file_contents,
        business_context=req.business_context
    )
    try:
        findings = json.loads(result.findings)
    except Exception:
        findings = []
    return {"findings": findings, "total": len(findings)}


# --- Behavioral Analysis Request Models ------------------------------------

class FrontendBehavioralRequest(BaseModel):
    file_list: str = Field(description="Newline-separated list of all files in the repository")
    routes: str = Field(default="", description="Route definitions or router config content")
    file_contents: dict = Field(description="Map of file path -> file content for screen components")
    handler_code: Optional[str] = Field(default=None, description="Backend handler code to verify frontend claims against")


class BackendBehavioralRequest(BaseModel):
    file_list: str = Field(description="Newline-separated list of all files in the repository")
    file_contents: dict = Field(description="Map of file path -> file content for route files")
    framework_hint: str = Field(default="", description="Framework name hint (Express, Fastify, Django, etc.)")


class MiddlewareRequest(BaseModel):
    entry_file_content: str = Field(description="Content of the server entry file (app.ts/index.ts)")
    middleware_files: list = Field(default=[], description="Array of {path, content} for middleware files")
    route_files_summary: str = Field(default="", description="Summary of route files and their prefixes")
    auth_middleware_code: str = Field(default="", description="Auth middleware source code")
    auth_route_code: str = Field(default="", description="Auth route handler code")


class SynthesisRequest(BaseModel):
    frontend_specs: str = Field(description="JSON string of frontend behavioral specs")
    backend_specs: str = Field(description="JSON string of backend endpoint specs")
    middleware_map: str = Field(default="{}", description="JSON string of middleware-to-route map")


class GherkinRequest(BaseModel):
    component_specs: list = Field(description="Array of BehavioralSpec objects (dicts)")
    user_flows: str = Field(default="[]", description="JSON string of user flows")


class ChangeAnalysisRequest(BaseModel):
    previous_specs: str = Field(description="JSON string of previous behavioral specs")
    current_specs: str = Field(description="JSON string of current behavioral specs")
    user_flows: str = Field(default="[]", description="JSON string of user flows")


class FullStackAuditRequest(BaseModel):
    frontend_specs: str = Field(description="JSON string of frontend behavioral specs")
    backend_specs: str = Field(description="JSON string of backend endpoint specs")
    middleware_map: str = Field(default="{}", description="JSON string of middleware map")


# --- Behavioral Analysis Endpoints -----------------------------------------

@app.post("/analyze/behavioral-frontend")
def analyze_behavioral_frontend(req: FrontendBehavioralRequest):
    analyzer = FrontendBehavioralAnalysis()
    result = analyzer(
        file_list=req.file_list,
        routes=req.routes,
        file_contents=req.file_contents,
        handler_code=req.handler_code,
    )
    try:
        specs = json.loads(result.specs)
    except Exception:
        specs = []
    try:
        user_flows = json.loads(result.user_flows)
    except Exception:
        user_flows = []
    try:
        verified_claims = json.loads(result.verified_claims)
    except Exception:
        verified_claims = []
    response = {
        "specs": specs,
        "userFlows": user_flows,
        "verifiedClaims": verified_claims,
        "totalScreens": len(specs),
    }
    if hasattr(result, "error"):
        response["error"] = result.error
    return response


@app.post("/analyze/behavioral-backend")
def analyze_behavioral_backend(req: BackendBehavioralRequest):
    analyzer = BackendBehavioralAnalysis()
    result = analyzer(
        file_list=req.file_list,
        file_contents=req.file_contents,
        framework_hint=req.framework_hint,
    )
    try:
        endpoints = json.loads(result.endpoints)
    except Exception:
        endpoints = []
    try:
        db_operations = json.loads(result.db_operations)
    except Exception:
        db_operations = []
    response = {
        "endpoints": endpoints,
        "dbOperations": db_operations,
        "totalEndpoints": len(endpoints),
        "totalDbOperations": len(db_operations),
    }
    if hasattr(result, "error"):
        response["error"] = result.error
    return response


@app.post("/analyze/middleware")
def analyze_middleware(req: MiddlewareRequest):
    analyzer = MiddlewareAnalysis()
    result = analyzer(
        entry_file_content=req.entry_file_content,
        middleware_files=req.middleware_files,
        route_files_summary=req.route_files_summary,
        auth_middleware_code=req.auth_middleware_code,
        auth_route_code=req.auth_route_code,
    )
    try:
        middleware = json.loads(result.middleware)
    except Exception:
        middleware = []
    try:
        route_map = json.loads(result.route_middleware_map)
    except Exception:
        route_map = []
    try:
        auth_flows = json.loads(result.auth_flows)
    except Exception:
        auth_flows = []
    response = {
        "middleware": middleware,
        "routeMiddlewareMap": route_map,
        "authFlows": auth_flows,
    }
    if hasattr(result, "error"):
        response["error"] = result.error
    return response


@app.post("/analyze/synthesis")
def analyze_synthesis(req: SynthesisRequest):
    analyzer = FullStackSynthesis()
    result = analyzer(
        frontend_specs=req.frontend_specs,
        backend_specs=req.backend_specs,
        middleware_map=req.middleware_map,
    )
    try:
        flows = json.loads(result.flows)
    except Exception:
        flows = []
    response = {"flows": flows, "totalFlows": len(flows)}
    if hasattr(result, "error"):
        response["error"] = result.error
    return response


@app.post("/analyze/gherkin")
def analyze_gherkin(req: GherkinRequest):
    analyzer = GherkinGeneration()
    result = analyzer(
        component_specs=req.component_specs,
        user_flows=req.user_flows,
    )
    try:
        features = json.loads(result.features)
    except Exception:
        features = []
    total_scenarios = sum(f.get("scenarioCount", 0) for f in features)
    return {
        "features": features,
        "totalFeatures": len(features),
        "totalScenarios": total_scenarios,
    }


@app.post("/analyze/changes")
def analyze_changes(req: ChangeAnalysisRequest):
    analyzer = ChangeAnalysis()
    result = analyzer(
        previous_specs=req.previous_specs,
        current_specs=req.current_specs,
        user_flows=req.user_flows,
    )
    try:
        changes = json.loads(result.changes)
    except Exception:
        changes = []
    try:
        risk_assessments = json.loads(result.risk_assessments)
    except Exception:
        risk_assessments = []
    try:
        prioritized_actions = json.loads(result.prioritized_actions)
    except Exception:
        prioritized_actions = []
    try:
        stats = json.loads(result.stats)
    except Exception:
        stats = {}
    response = {
        "changes": changes,
        "riskAssessments": risk_assessments,
        "summary": result.summary,
        "prioritizedActions": prioritized_actions,
        "stats": stats,
    }
    if hasattr(result, "error"):
        response["error"] = result.error
    return response


@app.post("/analyze/fullstack-audit")
def analyze_fullstack_audit(req: FullStackAuditRequest):
    analyzer = FullStackAudit()
    result = analyzer(
        frontend_specs=req.frontend_specs,
        backend_specs=req.backend_specs,
        middleware_map=req.middleware_map,
    )
    try:
        mismatches = json.loads(result.mismatches)
    except Exception:
        mismatches = []
    try:
        gaps = json.loads(result.gaps)
    except Exception:
        gaps = []
    response = {
        "mismatches": mismatches,
        "gaps": gaps,
        "totalMismatches": len(mismatches),
        "totalGaps": len(gaps),
    }
    if hasattr(result, "error"):
        response["error"] = result.error
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
