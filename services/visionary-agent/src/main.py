"""
Visionary Agent - DSPy-powered codebase analysis service
Compares repositories against industry best practices and similar solutions
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import dspy
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Visionary Agent",
    description="DSPy-powered codebase comparison and best practices analysis",
    version="1.0.0"
)

# Configure DSPy with Claude
lm = dspy.LM(
    model=f"anthropic/{os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')}",
    api_key=os.getenv('ANTHROPIC_API_KEY', ''),
    max_tokens=4096
)
dspy.configure(lm=lm)


class CompareArchitecture(dspy.Signature):
    """Compare a codebase's architecture against industry best practices for similar solutions.
    Analyze the technology stack, design patterns, and architectural decisions.
    Provide specific, actionable insights about what's done well and what could be improved."""

    codebase_summary: str = dspy.InputField(desc="Summary of the codebase structure, frameworks, and patterns")
    framework_stack: str = dspy.InputField(desc="Technology stack and framework versions")
    industry_context: str = dspy.InputField(desc="Industry context and similar solutions for comparison")
    comparison_report: str = dspy.OutputField(desc="Detailed comparison report with strengths, gaps, and recommendations")


class IdentifyGaps(dspy.Signature):
    """Identify specific gaps between the current codebase patterns and industry best practices.
    Focus on actionable gaps that would improve code quality, security, and maintainability."""

    detected_patterns: str = dspy.InputField(desc="Current patterns found in the codebase")
    standards: str = dspy.InputField(desc="Applicable industry standards and best practices")
    gap_analysis: str = dspy.OutputField(desc="Specific gaps with severity and recommended fixes")


class RecommendImprovements(dspy.Signature):
    """Recommend concrete, prioritized improvements based on the gap analysis.
    Each recommendation should be specific enough to act on immediately."""

    gap_analysis: str = dspy.InputField(desc="Identified gaps and issues")
    industry_context: str = dspy.InputField(desc="Industry context for prioritization")
    current_maturity: str = dspy.InputField(desc="Current maturity level of the codebase")
    recommendations: str = dspy.OutputField(desc="Prioritized list of specific improvements with effort estimates")


class VisionaryAnalyzer(dspy.Module):
    """Multi-step codebase analysis module using Chain-of-Thought reasoning."""

    def __init__(self):
        super().__init__()
        self.compare = dspy.ChainOfThought(CompareArchitecture)
        self.gap_analysis = dspy.ChainOfThought(IdentifyGaps)
        self.recommend = dspy.ChainOfThought(RecommendImprovements)

    def forward(self, codebase_summary, framework_stack, industry_context):
        # Step 1: Compare architecture
        comparison = self.compare(
            codebase_summary=codebase_summary,
            framework_stack=framework_stack,
            industry_context=industry_context
        )

        # Step 2: Identify gaps
        gaps = self.gap_analysis(
            detected_patterns=codebase_summary,
            standards=comparison.comparison_report
        )

        # Step 3: Recommend improvements
        recommendations = self.recommend(
            gap_analysis=gaps.gap_analysis,
            industry_context=industry_context,
            current_maturity=comparison.comparison_report
        )

        return dspy.Prediction(
            comparison=comparison.comparison_report,
            gaps=gaps.gap_analysis,
            recommendations=recommendations.recommendations
        )


# Initialize the analyzer
analyzer = VisionaryAnalyzer()


class AnalysisRequest(BaseModel):
    repositoryId: str
    codebaseSummary: str
    frameworkStack: str
    industryContext: Optional[str] = "Modern web application development best practices"


class AnalysisResponse(BaseModel):
    repositoryId: str
    comparison: str
    gaps: str
    recommendations: str
    model: str


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "visionary-agent",
        "model": os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
        "dspy_version": dspy.__version__
    }


@app.post("/analyze/vision", response_model=AnalysisResponse)
async def analyze_vision(request: AnalysisRequest):
    try:
        result = analyzer(
            codebase_summary=request.codebaseSummary,
            framework_stack=request.frameworkStack,
            industry_context=request.industryContext
        )

        return AnalysisResponse(
            repositoryId=request.repositoryId,
            comparison=result.comparison,
            gaps=result.gaps,
            recommendations=result.recommendations,
            model=os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("VISIONARY_PORT", "8010"))
    uvicorn.run(app, host="0.0.0.0", port=port)
