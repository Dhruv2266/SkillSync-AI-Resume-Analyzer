"""
services/analyzer.py
---------------------
The core ML engine for the AI Resume Analyzer.

Responsibilities:
  1. TF-IDF vectorization of cleaned resume and JD texts
  2. Cosine Similarity scoring → match percentage
  3. Keyword gap detection → matched_skills / missing_skills
  4. Role-specific output generators:
       - generate_hire_summary()    → Recruiter view
       - generate_improvements()   → Applier view

All functions are pure (no side effects) and receive already-cleaned text,
so they compose cleanly with the preprocessing pipeline in text_preprocessor.py.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from services.text_preprocessor import extract_keywords
from schemas import AnalysisResult


# ---------------------------------------------------------------------------
# 1. TF-IDF Vectorization + Cosine Similarity
# ---------------------------------------------------------------------------

def compute_match_score(clean_resume: str, clean_jd: str) -> float:
    """
    Vectorize both texts with TF-IDF and compute their cosine similarity.

    Why TF-IDF over raw counts?
    - Rewards terms that are distinctive to a document (high TF) but not
      so common across all documents that they carry no signal (low IDF).
      e.g. "python" in a Python JD ranks higher than "experience".

    Parameters
    ----------
    clean_resume : str
        Preprocessed resume text (output of clean_text()).
    clean_jd : str
        Preprocessed job description text (output of clean_text()).

    Returns
    -------
    float
        Cosine similarity expressed as a percentage, rounded to 2 dp.
        Range: 0.0 – 100.0
    """
    # The vectorizer is fitted on both documents together so the vocabulary
    # (and therefore IDF weights) reflects both texts, not just one.
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform([clean_resume, clean_jd])

    # cosine_similarity returns a 2×2 matrix; [0][1] is resume ↔ JD score.
    score = cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])[0][0]

    # Convert to a human-readable percentage.
    return round(float(score) * 100, 2)


# ---------------------------------------------------------------------------
# 2. Keyword Gap Detection
# ---------------------------------------------------------------------------

def detect_keyword_gap(
    clean_resume: str,
    clean_jd: str,
    top_n: int = 20,
) -> tuple[list[str], list[str]]:
    """
    Compare the top keywords from the JD against the resume text to
    produce matched and missing skill lists.

    Strategy:
    - Extract the top_n most frequent tokens from the cleaned JD.
      (Frequency is a reasonable proxy for importance in JDs.)
    - A keyword is "matched" if it appears anywhere in the cleaned resume.
    - A keyword is "missing" if it does not appear in the resume at all.

    Parameters
    ----------
    clean_resume : str
        Preprocessed resume text.
    clean_jd : str
        Preprocessed job description text.
    top_n : int
        Number of top JD keywords to evaluate. Default 20.

    Returns
    -------
    tuple[list[str], list[str]]
        (matched_skills, missing_skills)
    """
    jd_keywords = extract_keywords(clean_jd, top_n=top_n)

    # Build a set of unique tokens from the resume for O(1) lookups.
    resume_token_set = set(clean_resume.split())

    matched_skills: list[str] = []
    missing_skills: list[str] = []

    for keyword in jd_keywords:
        if keyword in resume_token_set:
            matched_skills.append(keyword)
        else:
            missing_skills.append(keyword)

    return matched_skills, missing_skills


# ---------------------------------------------------------------------------
# 3. Main Analysis Orchestrator
# ---------------------------------------------------------------------------

def run_analysis(clean_resume: str, clean_jd: str, top_n: int = 20) -> AnalysisResult:
    """
    Run the full ML pipeline and return a role-agnostic AnalysisResult.

    The router calls this once, then passes the result to the appropriate
    role-specific generator (generate_hire_summary or generate_improvements).

    Parameters
    ----------
    clean_resume : str
        Preprocessed resume text.
    clean_jd : str
        Preprocessed job description text.
    top_n : int
        Number of JD keywords to surface for gap analysis.

    Returns
    -------
    AnalysisResult
        Pydantic model containing match_percentage, matched_skills,
        missing_skills, and the cleaned texts for downstream generators.
    """
    match_percentage = compute_match_score(clean_resume, clean_jd)
    matched_skills, missing_skills = detect_keyword_gap(clean_resume, clean_jd, top_n)

    return AnalysisResult(
        match_percentage=match_percentage,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        resume_clean=clean_resume,
        jd_clean=clean_jd,
    )


# ---------------------------------------------------------------------------
# 4. Role-Specific Output Generators
# ---------------------------------------------------------------------------

def generate_hire_summary(result: AnalysisResult) -> str:
    """
    Generate a short 'Why you should hire' summary for the Recruiter view.

    The summary is a deterministic template filled with analysis data —
    no LLM required. It gives recruiters a quick, scannable verdict.

    Parameters
    ----------
    result : AnalysisResult
        The output of run_analysis().

    Returns
    -------
    str
        A two-sentence hiring recommendation string.
    """
    score = result.match_percentage
    matched = result.matched_skills
    missing = result.missing_skills

    # --- Determine fit tier based on score ---
    if score >= 75:
        fit_label = "a strong fit"
        recommendation = "We recommend proceeding to the interview stage."
    elif score >= 50:
        fit_label = "a moderate fit"
        recommendation = "Consider a screening call to assess the skill gaps."
    else:
        fit_label = "a weak fit"
        recommendation = "The candidate may need significant upskilling before being considered."

    # --- Build matched/missing summaries ---
    if matched:
        # Show up to 5 matched skills to keep the summary concise.
        skills_preview = ", ".join(matched[:5])
        matched_clause = f"demonstrating proficiency in: {skills_preview}"
    else:
        matched_clause = "with limited overlap with the required skill set"

    if missing:
        gap_preview = ", ".join(missing[:3])
        gap_clause = f"Notable gaps include: {gap_preview}."
    else:
        gap_clause = "No significant skill gaps were detected."

    summary = (
        f"This candidate is {fit_label} for the role ({score:.1f}% match), "
        f"{matched_clause}. "
        f"{gap_clause} "
        f"{recommendation}"
    )

    return summary


def generate_improvements(result: AnalysisResult) -> list[str]:
    """
    Generate actionable improvement suggestions for the Job Applier view.

    One concrete suggestion is produced per missing skill, giving the
    applicant a clear, prioritized to-do list rather than a vague score.

    Parameters
    ----------
    result : AnalysisResult
        The output of run_analysis().

    Returns
    -------
    list[str]
        A list of actionable advice strings, one per missing skill.
        Returns a positive message if no skills are missing.
    """
    missing = result.missing_skills

    if not missing:
        return ["Your resume is well-aligned with this job description. No critical gaps detected!"]

    # --- Skill-category heuristics for richer suggestions ---
    # Maps common keyword patterns to tailored advice templates.
    # Falls back to a generic template for unrecognised keywords.
    SKILL_ADVICE_MAP = {
        # Languages & frameworks
        "python":        "Add Python projects or certifications (e.g. Python Institute PCEP/PCAP) to your resume.",
        "sql":           "Highlight SQL experience — include any database projects or query optimization work.",
        "java":          "Showcase Java experience; consider adding a Spring Boot or Android project.",
        "javascript":    "Include JavaScript projects; frameworks like React or Node.js are highly valued.",
        "react":         "Add a React project to your portfolio or mention any component-library experience.",
        "docker":        "Get hands-on with Docker: containerize one of your existing projects and document it.",
        "kubernetes":    "Add Kubernetes to your skill set — 'CKA' certification is widely recognized.",
        "aws":           "Pursue an AWS Cloud Practitioner certification and include any cloud projects.",
        "azure":         "Add Azure experience; Microsoft's AZ-900 certification is a good starting point.",
        "git":           "Ensure your GitHub profile is active and link it in your resume.",
        "machine learning": "Add an ML project (e.g. Kaggle competition) or an online course certificate.",
        "deep learning": "Highlight any neural-network projects; mention frameworks like TensorFlow or PyTorch.",
        "nlp":           "Add NLP work — even a sentiment analysis or text classification project counts.",
        "agile":         "Mention Agile/Scrum experience in your work history or list a relevant certification.",
        "api":           "Highlight any REST API design or consumption experience in your project descriptions.",
        # Soft / generic skills
        "communication": "Strengthen your resume with examples of cross-functional collaboration or presentations.",
        "leadership":    "Include any mentoring, team-lead, or project-ownership experience.",
        "management":    "Add examples of project or people management responsibilities to your experience section.",
    }

    improvements = []

    for skill in missing:
        # Check the map (case-insensitive partial match for flexibility).
        advice = next(
            (template for keyword, template in SKILL_ADVICE_MAP.items() if keyword in skill),
            None,
        )

        if advice is None:
            # Generic fallback template.
            advice = (
                f"Your resume is missing '{skill}' — add relevant projects, "
                f"coursework, or certifications that demonstrate this skill."
            )

        improvements.append(advice)

    return improvements
