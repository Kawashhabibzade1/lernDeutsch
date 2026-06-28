from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from database import get_db
from models import GrammarRule, GrammarMastery, GrammarNote, ChatSession
from services.ai_service import analyze_grammar as ai_analyze_grammar, chat_grammar_practice, generate_grammar_exercises, translate_text

router = APIRouter(prefix="/grammar", tags=["grammar"])

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]


class AnalyzeGrammarRequest(BaseModel):
    german_text: str
    context_sentence: str = ""
    user_level: str = "A1"


class SaveGrammarNoteRequest(BaseModel):
    user_id: str
    book_id: Optional[str] = None
    source_page: Optional[int] = None
    raw_text: str
    analysis: dict


class PracticeRequest(BaseModel):
    user_id: str
    rule_id: str
    session_id: Optional[str] = None
    message: str
    user_level: str = "A1"
    secondary_language_name: str = "Persian"
    teach_language_name: str = "English"


class ExercisesRequest(BaseModel):
    rule_id: str
    user_level: str = "A1"
    secondary_language_name: str = "Persian"
    secondary_language_code: str = "fa"


@router.post("/analyze")
async def analyze(req: AnalyzeGrammarRequest):
    try:
        return await ai_analyze_grammar(req.german_text, req.context_sentence, req.user_level)
    except Exception as e:
        raise HTTPException(500, f"AI analysis failed: {str(e)}")


@router.post("/save")
def save_grammar_note(req: SaveGrammarNoteRequest, db: Session = Depends(get_db)):
    a = req.analysis
    rule_name = a.get("rule_name", "")

    rule_id = None
    if rule_name:
        rule = db.query(GrammarRule).filter(GrammarRule.name.ilike(f"%{rule_name}%")).first()
        if rule:
            rule_id = rule.id

    note = GrammarNote(
        user_id=req.user_id,
        book_id=req.book_id,
        source_page=req.source_page,
        rule_id=rule_id,
        raw_text=req.raw_text,
        cefr_level=a.get("cefr_level"),
        english_explanation=a.get("english_explanation"),
        persian_explanation=a.get("persian_explanation"),
        example_de=a.get("example_de"),
    )
    db.add(note)

    if rule_id:
        mastery = db.query(GrammarMastery).filter(
            GrammarMastery.user_id == req.user_id,
            GrammarMastery.rule_id == rule_id,
        ).first()
        if not mastery:
            db.add(GrammarMastery(user_id=req.user_id, rule_id=rule_id))

    db.commit()
    db.refresh(note)
    return _note_dict(note)


@router.get("/roadmap")
def get_roadmap(user_id: str, db: Session = Depends(get_db)):
    rules = db.query(GrammarRule).order_by(GrammarRule.cefr_level).all()
    mastery_rows = db.query(GrammarMastery).filter(GrammarMastery.user_id == user_id).all()
    mastery_map = {m.rule_id: m for m in mastery_rows}

    roadmap = {}
    for level in LEVELS:
        level_rules = [r for r in rules if r.cefr_level == level]
        rules_out = []
        for r in level_rules:
            m = mastery_map.get(r.id)
            rules_out.append({
                **_rule_dict(r),
                "mastery": {
                    "attempts": m.attempts if m else 0,
                    "correct": m.correct if m else 0,
                    "mastered": m.mastered if m else False,
                    "last_practiced": m.last_practiced.isoformat() if m and m.last_practiced else None,
                },
            })
        mastered_count = sum(1 for r in rules_out if r["mastery"]["mastered"])
        roadmap[level] = {"rules": rules_out, "total": len(rules_out), "mastered": mastered_count}
    return roadmap


@router.get("/notes")
def get_notes(user_id: str, db: Session = Depends(get_db)):
    notes = db.query(GrammarNote).filter(GrammarNote.user_id == user_id).order_by(GrammarNote.created_at.desc()).all()
    return [_note_dict(n) for n in notes]


@router.post("/exercises")
async def get_exercises(req: ExercisesRequest, db: Session = Depends(get_db)):
    rule = db.query(GrammarRule).filter(GrammarRule.id == req.rule_id).first()
    if not rule:
        raise HTTPException(404, "Grammar rule not found")
    try:
        exercises = await generate_grammar_exercises(
            rule_name=rule.name,
            pattern=rule.pattern or "",
            explanation=rule.english_explanation or "",
            example_de=rule.example_de or "",
            user_level=req.user_level,
            secondary_lang_name=req.secondary_language_name,
            secondary_lang_code=req.secondary_language_code,
        )
        return {"exercises": exercises}
    except Exception as e:
        raise HTTPException(500, f"Exercise generation failed: {str(e)}")


@router.post("/practice")
async def practice_grammar(req: PracticeRequest, db: Session = Depends(get_db)):
    rule = db.query(GrammarRule).filter(GrammarRule.id == req.rule_id).first()
    if not rule:
        raise HTTPException(404, "Grammar rule not found")

    history = []
    session = None
    if req.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == req.session_id).first()
        if session:
            history = session.transcript or []

    response = await chat_grammar_practice(
        rule_name=rule.name,
        rule_explanation=rule.english_explanation or "",
        conversation_history=history,
        user_message=req.message,
        user_level=req.user_level,
        secondary_lang_name=req.secondary_language_name,
        teach_language_name=req.teach_language_name,
    )

    history = list(history)
    history.append({"role": "user", "content": req.message})
    history.append({"role": "assistant", "content": response.get("tutor_response_de", "")})

    if session:
        session.transcript = history
    else:
        session = ChatSession(
            user_id=req.user_id,
            context="grammar_practice",
            context_ref=req.rule_id,
            transcript=history,
        )
        db.add(session)
    db.commit()
    db.refresh(session)

    mastery = db.query(GrammarMastery).filter(
        GrammarMastery.user_id == req.user_id,
        GrammarMastery.rule_id == req.rule_id,
    ).first()
    if mastery:
        mastery.attempts = (mastery.attempts or 0) + 1
        mastery.last_practiced = datetime.utcnow()
    else:
        db.add(GrammarMastery(user_id=req.user_id, rule_id=req.rule_id, attempts=1, last_practiced=datetime.utcnow()))
    db.commit()

    return {**response, "session_id": session.id}


PASS_THRESHOLD = 0.60  # 60 % correct to pass


@router.post("/{rule_id}/complete")
def complete_exercises(
    rule_id: str,
    user_id: str,
    correct: int,
    total: int,
    db: Session = Depends(get_db),
):
    """Record exercise completion. Once mastered, a rule stays mastered forever."""
    passed_this_session = total > 0 and (correct / total) >= PASS_THRESHOLD

    mastery = db.query(GrammarMastery).filter(
        GrammarMastery.user_id == user_id,
        GrammarMastery.rule_id == rule_id,
    ).first()

    already_mastered = bool(mastery and mastery.mastered)

    if mastery:
        mastery.attempts = (mastery.attempts or 0) + 1
        mastery.correct = (mastery.correct or 0) + correct
        mastery.last_practiced = datetime.utcnow()
        # Never demote — only promote
        if passed_this_session and not mastery.mastered:
            mastery.mastered = True
    else:
        mastery = GrammarMastery(
            user_id=user_id,
            rule_id=rule_id,
            attempts=1,
            correct=correct,
            mastered=passed_this_session,
            last_practiced=datetime.utcnow(),
        )
        db.add(mastery)

    db.commit()
    db.refresh(mastery)
    return {
        "mastered": mastery.mastered,
        "already_mastered": already_mastered,
        "passed_this_session": passed_this_session,
        "attempts": mastery.attempts,
    }


@router.delete("/mastery")
def reset_grammar_mastery(user_id: str, db: Session = Depends(get_db)):
    deleted = db.query(GrammarMastery).filter(GrammarMastery.user_id == user_id).delete()
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.get("/{rule_id}/translate")
async def translate_rule_explanation(
    rule_id: str,
    lang_code: str,
    lang_name: str,
    db: Session = Depends(get_db),
):
    import asyncio
    from sqlalchemy.orm.attributes import flag_modified

    rule = db.query(GrammarRule).filter(GrammarRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")

    # Persian: use pre-seeded fields
    if lang_code == "fa" and rule.persian_explanation:
        return {"explanation": rule.persian_explanation, "example": rule.example_fa or ""}

    # Check JSON cache for this language
    cache = rule.translations or {}
    if lang_code in cache:
        return cache[lang_code]

    # Cache miss — call AI, store result
    try:
        tasks = [translate_text(rule.english_explanation or "", lang_name)]
        if rule.example_en:
            tasks.append(translate_text(rule.example_en, lang_name))
        results = await asyncio.gather(*tasks)
        entry = {"explanation": results[0], "example": results[1] if len(results) > 1 else ""}

        rule.translations = {**cache, lang_code: entry}
        flag_modified(rule, "translations")
        db.commit()

        return entry
    except Exception as e:
        raise HTTPException(500, f"Translation failed: {str(e)}")


def _rule_dict(r: GrammarRule) -> dict:
    return {
        "id": r.id, "name": r.name, "pattern": r.pattern, "cefr_level": r.cefr_level,
        "english_explanation": r.english_explanation, "persian_explanation": r.persian_explanation,
        "example_de": r.example_de, "example_en": r.example_en, "example_fa": r.example_fa,
        "prerequisites": r.prerequisites or [],
    }


def _note_dict(n: GrammarNote) -> dict:
    return {
        "id": n.id, "user_id": n.user_id, "rule_id": n.rule_id, "book_id": n.book_id,
        "source_page": n.source_page, "raw_text": n.raw_text, "cefr_level": n.cefr_level,
        "english_explanation": n.english_explanation, "persian_explanation": n.persian_explanation,
        "example_de": n.example_de,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }
