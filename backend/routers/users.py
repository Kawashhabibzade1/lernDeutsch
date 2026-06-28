from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import date
from sqlalchemy.orm import Session
from database import get_db
from models import UserProfile, Word, GrammarMastery, ChatSession, Book, WritingSession

router = APIRouter(prefix="/users", tags=["users"])


class ProfileUpdate(BaseModel):
    current_level: Optional[str] = None
    ui_language: Optional[str] = None
    daily_goal_words: Optional[int] = None


def _get_or_create_profile(user_id: str, db: Session) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/{user_id}/profile")
def get_profile(user_id: str, db: Session = Depends(get_db)):
    return _profile_dict(_get_or_create_profile(user_id, db))


@router.patch("/{user_id}/profile")
def update_profile(user_id: str, update: ProfileUpdate, db: Session = Depends(get_db)):
    profile = _get_or_create_profile(user_id, db)
    if update.current_level:
        profile.current_level = update.current_level
    if update.ui_language:
        profile.ui_language = update.ui_language
    if update.daily_goal_words is not None:
        profile.daily_goal_words = update.daily_goal_words
    profile.last_active = date.today().isoformat()
    db.commit()
    db.refresh(profile)
    return _profile_dict(profile)


@router.get("/{user_id}/stats")
def get_stats(user_id: str, db: Session = Depends(get_db)):
    today = date.today().isoformat()
    words = db.query(Word.cefr_level, Word.confidence, Word.word_type, Word.next_review, Word.created_at).filter(Word.user_id == user_id).all()
    grammar = db.query(GrammarMastery.mastered).filter(GrammarMastery.user_id == user_id).all()
    sessions = db.query(ChatSession.completed, ChatSession.context).filter(ChatSession.user_id == user_id).all()
    books = db.query(Book.title, Book.dominant_level).filter(Book.user_id == user_id).all()
    writing = db.query(WritingSession.score, WritingSession.created_at).filter(WritingSession.user_id == user_id).order_by(WritingSession.created_at.desc()).all()

    by_level: dict = {}
    by_type: dict = {}
    mastered_words = 0
    due_count = 0
    words_today = 0
    for w in words:
        by_level[w.cefr_level or "unknown"] = by_level.get(w.cefr_level or "unknown", 0) + 1
        by_type[w.word_type or "unknown"] = by_type.get(w.word_type or "unknown", 0) + 1
        if (w.confidence or 0) >= 4:
            mastered_words += 1
        if (w.next_review or "9999") <= today:
            due_count += 1
        if w.created_at and w.created_at.date().isoformat() == today:
            words_today += 1

    w_scores = [w.score for w in writing if w.score is not None]

    return {
        "words": {
            "total": len(words),
            "mastered": mastered_words,
            "due": due_count,
            "today": words_today,
            "by_level": by_level,
            "by_type": by_type,
        },
        "grammar": {
            "total_rules_seen": len(grammar),
            "mastered": sum(1 for g in grammar if g.mastered),
        },
        "scenarios": {
            "total_sessions": sum(1 for s in sessions if s.context == "scenario"),
            "completed": sum(1 for s in sessions if s.completed and s.context == "scenario"),
        },
        "books": {
            "total": len(books),
            "titles": [b.title for b in books],
        },
        "writing": {
            "total_sessions": len(writing),
            "avg_score": round(sum(w_scores) / len(w_scores), 1) if w_scores else 0.0,
            "best_score": round(max(w_scores), 1) if w_scores else 0.0,
        },
    }


def _profile_dict(p: UserProfile) -> dict:
    return {
        "user_id": p.user_id,
        "current_level": p.current_level,
        "ui_language": p.ui_language,
        "daily_goal_words": p.daily_goal_words,
        "streak_days": p.streak_days,
        "last_active": p.last_active,
    }
