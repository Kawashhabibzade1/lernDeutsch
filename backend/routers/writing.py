from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from models import WritingTopic, WritingSession
from services.ai_service import analyze_writing

router = APIRouter(prefix="/writing", tags=["writing"])


class AnalyzeRequest(BaseModel):
    user_id: str
    topic_id: Optional[str] = None
    user_text: str
    user_level: str = "B1"


@router.get("/topics")
def list_topics(
    level: Optional[str] = None,
    writing_type: Optional[str] = None,
    exam: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(WritingTopic)
    if level:
        q = q.filter(WritingTopic.level == level)
    if writing_type:
        q = q.filter(WritingTopic.writing_type == writing_type)
    if exam == "__none__":
        q = q.filter(WritingTopic.exam.is_(None))
    elif exam:
        q = q.filter(WritingTopic.exam == exam)
    topics = q.order_by(WritingTopic.level, WritingTopic.writing_type).all()
    return [_topic_dict(t) for t in topics]


@router.post("/analyze")
async def analyze(req: AnalyzeRequest, db: Session = Depends(get_db)):
    topic = None
    topic_title = "Free Writing"
    topic_prompt = req.user_text[:200]
    level = req.user_level
    writing_type = "Freies Schreiben"
    exam = None

    if req.topic_id:
        topic = db.query(WritingTopic).filter(WritingTopic.id == req.topic_id).first()
        if not topic:
            raise HTTPException(404, "Topic not found")
        topic_title = topic.title
        topic_prompt = topic.prompt
        level = topic.level
        writing_type = topic.writing_type
        exam = topic.exam

    try:
        feedback = await analyze_writing(
            user_text=req.user_text,
            topic_title=topic_title,
            topic_prompt=topic_prompt,
            level=level,
            writing_type=writing_type,
            exam=exam,
            user_level=req.user_level,
        )
    except Exception as e:
        raise HTTPException(500, f"AI analysis failed: {str(e)}")

    score = feedback.get("overall_score")

    session = WritingSession(
        user_id=req.user_id,
        topic_id=req.topic_id,
        user_text=req.user_text,
        feedback=feedback,
        score=score,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "feedback": feedback,
        "topic": _topic_dict(topic) if topic else None,
    }


@router.get("/sessions")
def list_sessions(user_id: str, db: Session = Depends(get_db)):
    sessions = (
        db.query(WritingSession)
        .filter(WritingSession.user_id == user_id)
        .order_by(WritingSession.created_at.desc())
        .all()
    )
    result = []
    for s in sessions:
        d = _session_dict(s)
        if s.topic:
            d["topic"] = _topic_dict(s.topic)
        result.append(d)
    return result


@router.delete("/sessions")
def delete_sessions(user_id: str, db: Session = Depends(get_db)):
    deleted = (
        db.query(WritingSession)
        .filter(WritingSession.user_id == user_id)
        .delete()
    )
    db.commit()
    return {"ok": True, "deleted": deleted}


def _topic_dict(t: WritingTopic) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "prompt": t.prompt,
        "level": t.level,
        "writing_type": t.writing_type,
        "exam": t.exam,
        "word_count_min": t.word_count_min,
        "word_count_max": t.word_count_max,
        "time_limit_min": t.time_limit_min,
    }


def _session_dict(s: WritingSession) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "topic_id": s.topic_id,
        "user_text": s.user_text,
        "feedback": s.feedback,
        "score": s.score,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
