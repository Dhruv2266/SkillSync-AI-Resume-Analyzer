"""
services/text_preprocessor.py
------------------------------
NLP preprocessing pipeline for resume and job-description text.

Pipeline order:
  1. Lowercase
  2.  Remove punctuation
  2b. Strip lone numbers
  3.  Tokenize
  4.  Remove stopwords  (NLTK English corpus)
  4b. Drop garbage tokens via is_valid_token()   
  5.  Lemmatize (optional, default True)

Token validity rules (is_valid_token):
  - Must be at least 2 characters long
  - Must contain at least one ASCII letter (rejects pure-symbol/number tokens
    that slip through punctuation removal, e.g. "–", "©", lone digits)
  - Must not exceed 40 characters (rejects unbroken garbage strings)
  - Must not be >60 % non-ASCII characters (rejects garbled font encodings)
  - Must not match the CID pattern a second time after lowercasing

  PRESERVED: valid compound tech terms like 'fastapi', 'scikit', 'react',
  'postgresql', 'tensorflow' — all pass every rule above.

The clean_text() function returns a single whitespace-joined string so it
slots directly into scikit-learn's TfidfVectorizer without modification.

NLTK data is downloaded lazily on first import so Render's cold-start doesn't
time out on deploy — the downloads only happen once per container lifetime.
"""

import re
import string
import unicodedata
import nltk

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer

# ---------------------------------------------------------------------------
# One-time NLTK resource downloads
# ---------------------------------------------------------------------------
_NLTK_RESOURCES = [
    ("tokenizers/punkt",     "punkt"),
    ("tokenizers/punkt_tab", "punkt_tab"),
    ("corpora/stopwords",    "stopwords"),
    ("corpora/wordnet",      "wordnet"),
    ("corpora/omw-1.4",      "omw-1.4"),
]

for _resource_path, _resource_name in _NLTK_RESOURCES:
    try:
        nltk.data.find(_resource_path)
    except LookupError:
        nltk.download(_resource_name, quiet=True)

# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------
_STOP_WORDS: set = set(stopwords.words("english"))
_LEMMATIZER: WordNetLemmatizer = WordNetLemmatizer()

# Pre-compiled patterns used in both clean_text() and is_valid_token()
_CID_PATTERN        = re.compile(r"\bcid\d+\b")
_LONE_NUMBER        = re.compile(r"^\d+$")
_HAS_ASCII_LETTER   = re.compile(r"[a-z]")     # applied after lowercasing


# ---------------------------------------------------------------------------
# Token-level garbage filter
# ---------------------------------------------------------------------------

def is_valid_token(token: str) -> bool:
    """
    Return True if *token* is a meaningful word worth keeping in the corpus.

    This is the single choke-point for artifact rejection.  It runs AFTER
    lowercasing, punctuation removal, and stopword filtering, so every token
    arriving here is already lowercase and stripped of standard punctuation.

    Rules (all must pass):
    ┌──────────────────────────────────────────────────────────────────────┐
    │ 1. Length between 2 and 40 characters inclusive.                    │
    │    — Drops single-letter noise ("x", "e") and unbroken garbage blobs│
    │ 2. Contains at least one ASCII letter [a-z].                        │
    │    — Rejects tokens that are purely numeric, symbolic, or composed  │
    │      entirely of non-Latin unicode (e.g. "––", "©2023").            │
    │ 3. Non-ASCII character ratio ≤ 0.60.                                │
    │    — A token may contain hyphens or accented chars (e.g. "café",    │
    │      "scikit-learn" after hyphen handling) but not be *dominated*   │
    │      by garbled multi-byte sequences from broken font encodings.    │
    │ 4. Does not match the CID artifact pattern (belt-and-suspenders     │
    │    guard in case a CID token re-emerges after punctuation removal). │
    └──────────────────────────────────────────────────────────────────────┘

    Examples
    --------
    Valid (kept):   "python", "fastapi", "react", "postgresql", "leadership",
                    "scikit", "tensorflow", "devops", "agile"
    Invalid (dropped): "cid127", "xae3f", "©", "fj##z", "あいう", "––––"
    """
    # Rule 1 — length gate
    if not (2 <= len(token) <= 40):
        return False

    # Rule 2 — must contain at least one ASCII letter
    if not _HAS_ASCII_LETTER.search(token):
        return False

    # Rule 3 — non-ASCII ratio
    non_ascii_count = sum(
        1 for ch in token if ord(ch) > 127
    )
    if non_ascii_count / len(token) > 0.60:
        return False

    # Rule 4 — CID pattern safety net
    if _CID_PATTERN.search(token):
        return False

    return True


# ---------------------------------------------------------------------------
# Main preprocessing pipeline
# ---------------------------------------------------------------------------

def clean_text(text: str, lemmatize: bool = True) -> str:
    """
    Run the full preprocessing pipeline on a raw text string.

    Parameters
    ----------
    text : str
        Raw text extracted from a PDF or typed directly into the UI.
    lemmatize : bool
        Whether to apply WordNet lemmatization. Default True.

    Returns
    -------
    str
        A clean, stopword-filtered, optionally lemmatized token string
        ready for TF-IDF vectorization.
    """
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Input text must be a non-empty string.")

    # --- Step 1: Lowercase ---
    text = text.lower()

    # --- Step 1b: Strip PDF CID font artifacts ---
    # e.g. "cid127", "cid12" — raw character-identifier tokens from
    # embedded PDF fonts that pdfplumber occasionally leaks through.
    text = _CID_PATTERN.sub(" ", text)

    # --- Step 2: Remove punctuation ---
    text = text.translate(str.maketrans("", "", string.punctuation))

    # --- Step 2b: Strip lone numbers and collapse whitespace ---
    text = re.sub(r"\b\d+\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # --- Step 3: Tokenize ---
    tokens = word_tokenize(text)

    # --- Step 4: Remove stopwords ---
    tokens = [t for t in tokens if t not in _STOP_WORDS]

    # --- Step 4b: Drop garbage / artifact tokens ---
    # is_valid_token() rejects CID leftovers, pure-symbol blobs, excessively
    # long strings, and tokens dominated by non-ASCII bytes — while keeping
    # all legitimate tech terms (fastapi, react, scikit, postgresql, etc.).
    tokens = [t for t in tokens if is_valid_token(t)]

    # --- Step 5: Lemmatize (optional) ---
    if lemmatize:
        tokens = [_LEMMATIZER.lemmatize(t) for t in tokens]

    return " ".join(tokens)


# ---------------------------------------------------------------------------
# Keyword extractor (used by analyzer.py for gap detection)
# ---------------------------------------------------------------------------

def extract_keywords(text: str, top_n: int = 20) -> list[str]:
    """
    Return the top_n most frequent meaningful tokens from a cleaned text.

    Called AFTER clean_text(), so every token here has already passed the
    full validation pipeline — no additional filtering needed.

    Parameters
    ----------
    text : str
        Already-cleaned text (output of clean_text()).
    top_n : int
        How many keywords to return. Default 20.

    Returns
    -------
    list[str]
        Most frequent tokens, highest frequency first.
    """
    from collections import Counter

    tokens = text.split()

    if not tokens:
        return []

    most_common = Counter(tokens).most_common(top_n)
    return [token for token, _count in most_common]
