from fastapi import FastAPI
from pydantic import BaseModel
import dspy
import os
import json

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
