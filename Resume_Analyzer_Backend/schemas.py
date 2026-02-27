"""
schemas.py
----------
Pydantic models for all API request and response payloads.

Keeping schemas in one file makes it easy to version them later and keeps
the router and service layers free of raw dict manipulation.
"""

from pydantic import BaseModel, Field
from typing import Literal


# ---------------------------------------------------------------------------
# Shared response fields
# ---------------------------------------------------------------------------

class BaseAnalysisResponse(BaseModel):
    """Fields returned to both Recruiter and Applier roles."""
    match_percentage: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Cosine similarity score expressed as a percentage (0–100).",
        example=72.5,
    )
    matched_skills: list[str] = Field(
        ...,
        description="Keywords present in both the resume and the job description.",
    )
    missing_skills: list[str] = Field(
        ...,
        description="Keywords in the JD that are absent from the resume.",
    )


# ---------------------------------------------------------------------------
# Role-specific response schemas
# ---------------------------------------------------------------------------

class RecruiterResponse(BaseAnalysisResponse):
    """
    Extended response for the Recruiter role.
    Adds a short 'Why you should hire' summary template.
    """
    hire_summary: str = Field(
        ...,
        description=(
            "Auto-generated summary template explaining candidate fit, "
            "based on matched skills and match percentage."
        ),
    )


class ApplierResponse(BaseAnalysisResponse):
    """
    Extended response for the Job Applier role.
    Replaces the hire summary with actionable improvement advice.
    """
    basic_improvements: list[str] = Field(
        ...,
        description=(
            "Actionable advice items derived from the missing skills. "
            "One suggestion per missing keyword."
        ),
    )


# ---------------------------------------------------------------------------
# Internal (service-layer) intermediate model
# ---------------------------------------------------------------------------

class AnalysisResult(BaseModel):
    """
    Internal model returned by the analysis service before role-specific
    formatting is applied. The router uses this to build the correct
    role response.
    """
    match_percentage: float
    matched_skills: list[str]
    missing_skills: list[str]
    resume_clean: str   # cleaned resume text (passed to summary generators)
    jd_clean: str       # cleaned JD text
