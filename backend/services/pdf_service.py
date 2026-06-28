import pdfplumber
import base64
import io


def extract_pages(file_bytes: bytes) -> list[dict]:
    """Extract text and thumbnail from each page of a PDF."""
    pages = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""

            img = page.to_image(resolution=120)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            thumbnail_b64 = base64.b64encode(buf.getvalue()).decode()

            pages.append({
                "page_number": i + 1,
                "text": text,
                "thumbnail": thumbnail_b64,
                "width": float(page.width),
                "height": float(page.height),
            })
    return pages


def get_page_text(file_bytes: bytes, page_num: int) -> tuple[str, bytes]:
    """Return (extracted_text, page_image_bytes) for one page (1-indexed)."""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        page = pdf.pages[page_num - 1]
        text = page.extract_text() or ""

        img = page.to_image(resolution=200)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image_bytes = buf.getvalue()

    return text, image_bytes


def detect_book_level(pages: list[dict]) -> str:
    """Very simple heuristic: count B1/B2 grammar markers."""
    full_text = " ".join(p["text"] for p in pages[:10]).lower()
    if any(w in full_text for w in ["konjunktiv", "partizip", "genitiv", "obwohl", "während"]):
        return "B1"
    if any(w in full_text for w in ["würde", "hätte", "wäre", "sobald", "seitdem"]):
        return "B1"
    if any(w in full_text for w in ["perfekt", "modalverb", "weil", "dass", "wenn"]):
        return "A2"
    return "A1"
