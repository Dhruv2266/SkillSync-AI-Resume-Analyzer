"""
main.py
-------

"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analysis

# ---------------------------------------------------------------------------
# App Initialization
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Resume Analyzer API",
    description="Dual-role resume analysis using TF-IDF + Cosine Similarity.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow requests from your Vercel frontend
# In production, replace "*" with your exact Vercel domain.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # e.g. ["https://your-app.vercel.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(analysis.router, prefix="/api/v1", tags=["Analysis"])


@app.get("/health", tags=["Health"])
def health_check():
    """Simple liveness probe for Render's health-check endpoint."""
    return {"status": "ok"}
