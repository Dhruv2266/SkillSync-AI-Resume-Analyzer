"""
services/pdf_extractor.py
--------------------------
Handles all PDF-to-text extraction using pdfplumber.

Design decisions:
- We read from an in-memory SpooledTemporaryFile (FastAPI's UploadFile),
  so no file is ever written to disk — important for stateless Render deploys.
- Page text is joined with a newline so paragraph boundaries are preserved
  for downstream NLP processing.
- Raises a clear ValueError if the PDF yields no extractable text (e.g. a
  scanned image-only PDF), so the router can return a clean 422 to the client.
"""

import io
import pdfplumber
from fastapi import UploadFile


def extract_text_from_pdf(upload_file: UploadFile) -> str:
    """
    Extract raw text from an uploaded PDF file.

    Parameters
    ----------
    upload_file : UploadFile
        The PDF file object received from a FastAPI endpoint.

    Returns
    -------
    str
        Concatenated plain text from all pages.

    Raises
    ------
    ValueError
        If no text could be extracted (scanned / image-only PDF).
    RuntimeError
        If pdfplumber fails to open the file at all.
    """
    # Read the entire file into memory so pdfplumber can seek freely.
    file_bytes = upload_file.file.read()

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages_text = []

            for page_number, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text()

                if page_text:
                    pages_text.append(page_text)
                else:
                    # Non-fatal: some pages (e.g. cover graphics) may be empty.
                    print(f"[pdf_extractor] Page {page_number} yielded no text — skipping.")

    except Exception as exc:
        raise RuntimeError(f"pdfplumber could not open the file: {exc}") from exc

    full_text = "\n".join(pages_text).strip()

    if not full_text:
        raise ValueError(
            "No extractable text found. The PDF may be image-based (scanned). "
            "Please upload a text-selectable PDF."
        )

    return full_text