from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta
from sqlalchemy.orm import Session
from database import get_db
from models import Word
from services.ai_service import analyze_word as ai_analyze_word, batch_analyze_words as ai_batch_analyze

router = APIRouter(prefix="/words", tags=["words"])


class AnalyzeRequest(BaseModel):
    german_text: str
    context_sentence: str = ""
    user_level: str = "A1"


class SaveWordRequest(BaseModel):
    user_id: str
    book_id: Optional[str] = None
    source_page: Optional[int] = None
    analysis: dict


class BatchAnalyzeRequest(BaseModel):
    words: list[str]
    user_level: str = "B1"
    translation_languages: list[dict] = [{"code": "en", "name": "English"}, {"code": "fa", "name": "Persian"}]


class ReviewRequest(BaseModel):
    user_id: str
    quality: int


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    try:
        return await ai_analyze_word(req.german_text, req.context_sentence, req.user_level)
    except Exception as e:
        raise HTTPException(500, f"AI analysis failed: {str(e)}")


@router.post("/batch-analyze")
async def batch_analyze(req: BatchAnalyzeRequest):
    if not req.words:
        raise HTTPException(400, "No words provided")
    if len(req.words) > 30:
        raise HTTPException(400, "Maximum 30 words per request")
    try:
        return await ai_batch_analyze(req.words, req.user_level, req.translation_languages)
    except Exception as e:
        raise HTTPException(500, f"Batch analysis failed: {str(e)}")


@router.post("/save")
def save_word(req: SaveWordRequest, db: Session = Depends(get_db)):
    a = req.analysis
    existing = db.query(Word).filter(Word.user_id == req.user_id, Word.german == a.get("german", "")).first()
    if existing:
        return {"word": _word_dict(existing), "already_exists": True}

    extra = dict(a.get("extra_info") or {})
    if a.get("translations"):
        extra["translations"] = a["translations"]
    if a.get("example_translations"):
        extra["example_translations"] = a["example_translations"]

    word = Word(
        user_id=req.user_id,
        book_id=req.book_id,
        source_page=req.source_page,
        german=a.get("german"),
        word_type=a.get("word_type"),
        gender=a.get("gender"),
        cefr_level=a.get("cefr_level"),
        english=a.get("english") or (a.get("translations") or {}).get("en", ""),
        persian=a.get("persian") or (a.get("translations") or {}).get("fa", ""),
        example_de=a.get("example_de"),
        example_en=a.get("example_en") or (a.get("example_translations") or {}).get("en", ""),
        example_fa=a.get("example_fa") or (a.get("example_translations") or {}).get("fa", ""),
        extra_info=extra,
        next_review=date.today().isoformat(),
    )
    db.add(word)
    db.commit()
    db.refresh(word)
    return {"word": _word_dict(word), "already_exists": False}


@router.get("/due")
def get_due_words(user_id: str, limit: int = 20, db: Session = Depends(get_db)):
    today = date.today().isoformat()
    words = (
        db.query(Word)
        .filter(Word.user_id == user_id, Word.next_review <= today)
        .order_by(Word.next_review)
        .limit(limit)
        .all()
    )
    return [_word_dict(w) for w in words]


@router.get("/")
def list_words(user_id: str, word_type: Optional[str] = None, cefr_level: Optional[str] = None,
               db: Session = Depends(get_db)):
    q = db.query(Word).filter(Word.user_id == user_id)
    if word_type:
        q = q.filter(Word.word_type == word_type)
    if cefr_level:
        q = q.filter(Word.cefr_level == cefr_level)
    return [_word_dict(w) for w in q.order_by(Word.created_at.desc()).all()]


@router.patch("/{word_id}/review")
def review_word(word_id: str, req: ReviewRequest, db: Session = Depends(get_db)):
    word = db.query(Word).filter(Word.id == word_id, Word.user_id == req.user_id).first()
    if not word:
        raise HTTPException(404, "Word not found")

    q = max(0, min(5, req.quality))
    easiness = float(word.easiness)
    interval = int(word.interval_days)
    seen = int(word.seen_count) + 1

    easiness = max(1.3, easiness + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if q < 3:
        interval = 1
    elif seen == 1:
        interval = 1
    elif seen == 2:
        interval = 6
    else:
        interval = round(interval * easiness)

    word.easiness = easiness
    word.interval_days = interval
    word.seen_count = seen
    word.next_review = (date.today() + timedelta(days=interval)).isoformat()
    word.confidence = q
    db.commit()
    return {"next_review": word.next_review, "interval_days": interval}


@router.delete("/all")
def delete_all_words(user_id: str, db: Session = Depends(get_db)):
    deleted = db.query(Word).filter(Word.user_id == user_id).delete()
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.patch("/reset-stats")
def reset_word_stats(user_id: str, db: Session = Depends(get_db)):
    today = date.today().isoformat()
    updated = (
        db.query(Word)
        .filter(Word.user_id == user_id)
        .update({
            "confidence": 0,
            "interval_days": 1,
            "easiness": 2.5,
            "seen_count": 0,
            "next_review": today,
        })
    )
    db.commit()
    return {"ok": True, "updated": updated}


@router.delete("/{word_id}")
def delete_word(word_id: str, user_id: str, db: Session = Depends(get_db)):
    word = db.query(Word).filter(Word.id == word_id, Word.user_id == user_id).first()
    if not word:
        raise HTTPException(404, "Word not found")
    db.delete(word)
    db.commit()
    return {"ok": True}


def _word_dict(w: Word) -> dict:
    return {
        "id": w.id, "user_id": w.user_id, "book_id": w.book_id, "source_page": w.source_page,
        "german": w.german, "word_type": w.word_type, "gender": w.gender, "cefr_level": w.cefr_level,
        "english": w.english, "persian": w.persian,
        "example_de": w.example_de, "example_en": w.example_en, "example_fa": w.example_fa,
        "extra_info": w.extra_info or {},
        "confidence": w.confidence, "interval_days": w.interval_days,
        "easiness": w.easiness, "next_review": w.next_review, "seen_count": w.seen_count,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }
