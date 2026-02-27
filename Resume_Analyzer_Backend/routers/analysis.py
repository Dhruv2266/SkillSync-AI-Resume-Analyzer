"""
routers/analysis.py  
-----------------------------------------
Full end-to-end pipeline with two-layer document validation 

Flow:
  POST /api/v1/analyze
       │
       ├─ 1. Validate file types (MIME)
       ├─ 2. Extract text (pdfplumber)
       ├─ 3. Two-layer document validation  ← ENHANCED
       │      ├─ Layer A: keyword signal check  (validate_document_intent)
       │      └─ Layer B: structural regex check (validate_resume_structure /
       │                                          validate_jd_structure)
       ├─ 4. Clean text  (NLTK pipeline + artifact filtering)
       ├─ 5. Guard against empty-after-preprocessing edge cases
       ├─ 6. Run ML analysis (TF-IDF + Cosine Similarity + Gap Detection)
       ├─ 7. Generate role-specific extras (hire_summary / basic_improvements)
       └─ 8. Return typed Pydantic response
"""

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from typing import Literal
import re

from services.pdf_extractor import extract_text_from_pdf
from services.text_preprocessor import clean_text
from services.analyzer import run_analysis, generate_hire_summary, generate_improvements
from schemas import RecruiterResponse, ApplierResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# Document intent validation
# ---------------------------------------------------------------------------

# Keywords that strongly signal a genuine resume.
# We check against the *raw* lowercased text so we catch them before
# stopword removal strips words like "of", "and" from section headers.
_RESUME_SIGNAL_KEYWORDS: list[str] = [
    "experience",
    "education",
    "skills",
    "projects",
    "university",
    "college",
    "employment",
    "work history",
    "certifications",
    "summary",
    "objective",
    "internship",
    "volunteer",
    "bachelor",
    "master",
    "degree",
    "gpa",
    "resume",
    "cv",
    "curriculum vitae",
]

# Keywords that strongly signal a genuine job description.
_JD_SIGNAL_KEYWORDS: list[str] = [
    "requirements",
    "qualifications",
    "responsibilities",
    "role",
    "experience",
    "job description",
    "we are looking",
    "you will",
    "must have",
    "nice to have",
    "preferred",
    "position",
    "hiring",
    "salary",
    "benefits",
    "team",
    "company",
    "employer",
    "apply",
]

# Minimum number of signal keywords that must appear for a document to pass.
_MIN_SIGNAL_MATCHES: int = 4


def validate_document_intent(
    raw_text: str,
    signal_keywords: list[str],
    doc_label: str,
    min_matches: int = _MIN_SIGNAL_MATCHES,
) -> None:
    """
    Heuristically verify that *raw_text* is the kind of document we expect.

    Strategy:
      Lowercase the raw extracted text once, then count how many of the
      signal keywords appear as substrings.  Substring matching (rather than
      whole-word) is intentional: "responsibilities" catches "key responsibilities",
      "experience" catches "5+ years of experience", etc.

      If fewer than *min_matches* signals are found, the document is likely
      the wrong type (e.g. a recipe, a bank statement, a blank page) and we
      raise an HTTP 400 with a clear, user-facing message.

    Parameters
    ----------
    raw_text : str
        The raw text as returned by pdfplumber — NOT yet cleaned/lemmatized.
        We validate on raw text so we capture natural-language section headers
        that would be stripped by the NLP pipeline.
    signal_keywords : list[str]
        The vocabulary list appropriate to the document type.
    doc_label : str
        Human-readable label for error messages, e.g. "Resume" or "Job Description".
    min_matches : int
        Minimum number of signal keywords required to pass. Default is 4.

    Raises
    ------
    HTTPException (400)
        If fewer than *min_matches* signal keywords are found.
    """
    lowered = raw_text.lower()

    matched_signals = [kw for kw in signal_keywords if kw in lowered]

    if len(matched_signals) < min_matches:
        raise HTTPException(
            status_code=400,
            detail=(
                f"The uploaded file does not look like a valid {doc_label}. "
                f"Only {len(matched_signals)} of the expected section keywords were detected "
                f"(minimum required: {min_matches}). "
                f"Please upload a real {doc_label} PDF."
            ),
        )


# ---------------------------------------------------------------------------
# Layer B — structural / regex validators 
#
# These run AFTER Layer A (keyword signals) and add a second, independent
# signal dimension.  A document that passes both layers is very unlikely to
# be the wrong type.
#
# Design choices:
#   • All patterns are compiled once at module load (not per-request).
#   • Checks run on the raw lowercased text — same as Layer A — so PDF
#     formatting artefacts don't interfere.
#   • The "resume looks like a JD" cross-check is done inside
#     validate_jd_structure to avoid the reverse: uploading a real JD in
#     the resume slot and having it score like a resume.
# ---------------------------------------------------------------------------

# ── Resume structural patterns ─────────────────────────────────────────────

# Standard email: local@domain.tld  (handles subdomains, dots, +, -)
_RE_EMAIL = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)

# Phone: covers international (+1, +91…), US (555-555-5555), and common
# Indian formats (98765 43210), allowing spaces/dashes/dots as separators.
_RE_PHONE = re.compile(
    r"(\+?\d[\d\s\-\.]{7,}\d)"
)

# LinkedIn profile URL (full or partial slug)
_RE_LINKEDIN = re.compile(
    r"linkedin\.com/in/[\w\-]+"
)

# GitHub profile or repo URL
_RE_GITHUB = re.compile(
    r"github\.com/[\w\-]+"
)

# Resumes are personal documents — typically 200–800 words for a 1-pager,
# up to ~2000 for senior engineers.  Anything above 3 000 words is almost
# certainly a lengthy JD, report, or article, not a resume.
_RESUME_MAX_WORDS: int = 3_000


def validate_resume_structure(raw_text: str) -> None:
    """
    Layer B structural check for resumes.

    Passes if ALL of the following are true:
      1. Word count ≤ _RESUME_MAX_WORDS  (rules out multi-page JDs / reports)
      2. At least ONE of: email address, phone number, LinkedIn URL, GitHub URL
         is present in the text.

    A real resume — even a barebones one — will virtually always contain a
    contact email or phone.  A recipe, bank statement, or JD accidentally
    uploaded in the resume slot will almost never have both a short word
    count AND personal contact details.

    Parameters
    ----------
    raw_text : str
        Raw pdfplumber output (not yet NLP-cleaned).

    Raises
    ------
    HTTPException (400)
        With a specific, actionable message indicating which check failed.
    """
    word_count = len(raw_text.split())

    # ── Check 1: length ──────────────────────────────────────────────────
    if word_count > _RESUME_MAX_WORDS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This document does not appear to be a valid Resume. "
                f"It contains {word_count:,} words, which exceeds the maximum "
                f"expected length for a resume ({_RESUME_MAX_WORDS:,} words). "
                f"Please upload a standard 1–2 page resume PDF."
            ),
        )

    # ── Check 2: personal contact marker ────────────────────────────────
    has_contact = (
        _RE_EMAIL.search(raw_text)
        or _RE_PHONE.search(raw_text)
        or _RE_LINKEDIN.search(raw_text.lower())
        or _RE_GITHUB.search(raw_text.lower())
    )

    if not has_contact:
        raise HTTPException(
            status_code=400,
            detail=(
                "This document does not appear to be a valid Resume. "
                "No contact information was detected (email address, phone number, "
                "LinkedIn profile, or GitHub URL). "
                "Please upload a resume that includes your contact details."
            ),
        )


# ── JD structural patterns ─────────────────────────────────────────────────

# "X+ years of experience" / "X-Y years of experience" — the single most
# reliable structural marker of a JD.
_RE_YEARS_EXP = re.compile(
    r"\d+\+?\s*(?:to\s*\d+\s*)?years?\s+of\s+(?:\w+\s+)?experience",
    re.IGNORECASE,
)

# Salary / compensation indicators
_RE_SALARY = re.compile(
    r"(\$[\d,]+|\d[\d,]+\s*(?:usd|lpa|lakh|per\s+annum|per\s+year|per\s+month|k\b))",
    re.IGNORECASE,
)

# Common JD section-header phrases
_JD_STRUCTURAL_PHRASES: list[re.Pattern] = [
    re.compile(r"\brequirements\b",       re.IGNORECASE),
    re.compile(r"\bqualifications\b",     re.IGNORECASE),
    re.compile(r"\bresponsibilities\b",   re.IGNORECASE),
    re.compile(r"\bwhat you.ll do\b",     re.IGNORECASE),
    re.compile(r"\bwhat we.re looking\b", re.IGNORECASE),
    re.compile(r"\bjob\s+description\b",  re.IGNORECASE),
    re.compile(r"\bequal opportunity\b",  re.IGNORECASE),
    re.compile(r"\bwe offer\b",           re.IGNORECASE),
    re.compile(r"\bbenefits\b",           re.IGNORECASE),
    re.compile(r"\bapply now\b",          re.IGNORECASE),
]

# How many of the above structural phrases must match
_JD_MIN_STRUCTURAL_PHRASES: int = 2

# JDs that have been accidentally uploaded as resumes are common.
# If the text looks like a resume (has contact info AND is short), reject it.
_RESUME_MAX_WORDS_FOR_JD_CROSSCHECK: int = 1_200


def validate_jd_structure(raw_text: str) -> None:
    """
    Layer B structural check for job descriptions.

    Two sub-checks run in order:

    Sub-check A — cross-check: reject if the document looks like a resume.
      A document is flagged as "probably a resume" if it:
        • Has a word count below 1 200 (typical JDs are 300–1 000 words, but
          so are resumes — so word count alone is not enough)  AND
        • Contains personal contact info (email / phone / LinkedIn / GitHub).
      If both conditions are true, the user likely swapped the upload slots.

    Sub-check B — positive JD signal: must match at least
    _JD_MIN_STRUCTURAL_PHRASES of the JD structural phrase patterns  OR
    contain a "X years of experience" expression  OR  a salary indicator.
    Any one of these three is sufficient.

    Parameters
    ----------
    raw_text : str
        Raw pdfplumber output (not yet NLP-cleaned).

    Raises
    ------
    HTTPException (400)
        With a specific, actionable message indicating which check failed.
    """
    word_count = len(raw_text.split())

    # ── Sub-check A: is this actually a resume? ──────────────────────────
    looks_short = word_count <= _RESUME_MAX_WORDS_FOR_JD_CROSSCHECK
    has_contact = bool(
        _RE_EMAIL.search(raw_text)
        or _RE_PHONE.search(raw_text)
        or _RE_LINKEDIN.search(raw_text.lower())
        or _RE_GITHUB.search(raw_text.lower())
    )

    if looks_short and has_contact:
        raise HTTPException(
            status_code=400,
            detail=(
                "The file uploaded as a Job Description appears to be a Resume "
                f"(it is {word_count:,} words long and contains personal contact "
                "information). Please check that you uploaded the files in the "
                "correct slots."
            ),
        )

    # ── Sub-check B: positive JD structural signals ──────────────────────
    matched_phrases = sum(
        1 for pattern in _JD_STRUCTURAL_PHRASES if pattern.search(raw_text)
    )
    has_years_exp = bool(_RE_YEARS_EXP.search(raw_text))
    has_salary    = bool(_RE_SALARY.search(raw_text))

    passes_positive_check = (
        matched_phrases >= _JD_MIN_STRUCTURAL_PHRASES
        or has_years_exp
        or has_salary
    )

    if not passes_positive_check:
        raise HTTPException(
            status_code=400,
            detail=(
                "This document does not appear to be a valid Job Description. "
                "None of the expected structural markers were detected "
                "(e.g. 'requirements', 'qualifications', 'X years of experience', "
                "salary information). "
                "Please upload a real Job Description PDF."
            ),
        )


# ---------------------------------------------------------------------------
# /analyze  — full ML pipeline endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/analyze",
    response_model=None,
    summary="Analyze a resume against a job description",
    description=(
        "Accepts a resume PDF, a job description PDF, and a user role. "
        "Returns a role-specific analysis: match percentage, skill gaps, "
        "and either a hire summary (recruiter) or improvement tips (applier)."
    ),
)
async def analyze_resume(
    role: Literal["recruiter", "applier"] = Form(
        ...,
        description="User role — determines response shape: 'recruiter' or 'applier'.",
    ),
    resume: UploadFile = File(
        ...,
        description="Candidate's resume as a PDF.",
    ),
    job_description: UploadFile = File(
        ...,
        description="Target job description as a PDF.",
    ),
) -> RecruiterResponse | ApplierResponse:
    """
    Full analysis endpoint — returns a Pydantic-validated response object
    whose shape depends on the `role` form field.

    Recruiter  → { match_percentage, matched_skills, missing_skills, hire_summary }
    Applier    → { match_percentage, matched_skills, missing_skills, basic_improvements }
    """

    # ------------------------------------------------------------------
    # Step 1: Validate uploaded file types (MIME check)
    # ------------------------------------------------------------------
    ALLOWED_CONTENT_TYPES = {"application/pdf", "application/octet-stream"}

    for upload, label in [(resume, "resume"), (job_description, "job_description")]:
        if upload.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=415,
                detail=(
                    f"'{label}' must be a PDF. "
                    f"Received content-type: '{upload.content_type}'."
                ),
            )

    # ------------------------------------------------------------------
    # Step 2: Extract raw text from both PDFs
    # ------------------------------------------------------------------
    try:
        raw_resume = extract_text_from_pdf(resume)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract text from the resume: {exc}",
        )

    try:
        raw_jd = extract_text_from_pdf(job_description)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract text from the job description: {exc}",
        )

    # ------------------------------------------------------------------
    # Step 3: Two-layer document validation
    #
    # Layer A — keyword signal check (validate_document_intent):
    #   Counts how many domain-specific section-header words appear in the
    #   raw text.  Catches clearly wrong document types (recipes, invoices).
    #
    # Layer B — structural regex check (validate_resume_structure /
    #                                   validate_jd_structure):
    #   Applies regex patterns for contact info, word-count limits, salary
    #   indicators, and "X years of experience" expressions.  Catches subtler
    #   mismatches (e.g. a JD uploaded in the resume slot, or vice versa).
    #
    # Both layers run on raw (un-cleaned) text so natural-language headers
    # and contact details are intact.  Either layer can raise HTTP 400 with
    # a clear, user-facing message that the React Toast will display.
    # ------------------------------------------------------------------

    # Layer A
    validate_document_intent(
        raw_text=raw_resume,
        signal_keywords=_RESUME_SIGNAL_KEYWORDS,
        doc_label="Resume",
    )
    validate_document_intent(
        raw_text=raw_jd,
        signal_keywords=_JD_SIGNAL_KEYWORDS,
        doc_label="Job Description",
    )

    # Layer B
    validate_resume_structure(raw_resume)
    validate_jd_structure(raw_jd)

    # ------------------------------------------------------------------
    # Step 4: Preprocess both texts through the NLTK pipeline
    # (includes CID artifact stripping + is_valid_token garbage filter)
    # ------------------------------------------------------------------
    try:
        clean_resume = clean_text(raw_resume, lemmatize=True)
        clean_jd = clean_text(raw_jd, lemmatize=True)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Text preprocessing failed: {exc}",
        )

    # ------------------------------------------------------------------
    # Step 5: Guard against empty-after-preprocessing edge cases
    # ------------------------------------------------------------------
    if not clean_resume.strip():
        raise HTTPException(
            status_code=422,
            detail="Resume text is empty after preprocessing. Please upload a richer document.",
        )
    if not clean_jd.strip():
        raise HTTPException(
            status_code=422,
            detail="Job description text is empty after preprocessing. Please upload a richer document.",
        )

    # ------------------------------------------------------------------
    # Step 6: Run the core ML analysis (TF-IDF + cosine + gap detection)
    # ------------------------------------------------------------------
    analysis_result = run_analysis(clean_resume, clean_jd, top_n=20)

    # ------------------------------------------------------------------
    # Step 7 & 8: Generate role-specific extras and return typed response
    # ------------------------------------------------------------------
    if role == "recruiter":
        hire_summary = generate_hire_summary(analysis_result)

        return RecruiterResponse(
            match_percentage=analysis_result.match_percentage,
            matched_skills=analysis_result.matched_skills,
            missing_skills=analysis_result.missing_skills,
            hire_summary=hire_summary,
        )

    else:  # role == "applier"
        basic_improvements = generate_improvements(analysis_result)

        return ApplierResponse(
            match_percentage=analysis_result.match_percentage,
            matched_skills=analysis_result.matched_skills,
            missing_skills=analysis_result.missing_skills,
            basic_improvements=basic_improvements,
        )
