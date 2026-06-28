from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from models import Scenario, ChatSession
from services.ai_service import chat_with_scenario

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]


class ChatRequest(BaseModel):
    user_id: str
    scenario_id: str
    session_id: Optional[str] = None
    message: str
    user_level: str = "B1"
    correction_mode: bool = True
    translation_languages: list[dict] = [{"code": "en", "name": "English"}]


@router.get("/")
def list_scenarios(user_level: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Scenario)
    if user_level and user_level in LEVELS:
        idx = LEVELS.index(user_level)
        allowed = LEVELS[: idx + 2]
        q = q.filter(Scenario.cefr_level.in_(allowed))
    scenarios = q.order_by(Scenario.cefr_level).all()
    return [_scenario_dict(s) for s in scenarios]


@router.post("/chat")
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == req.scenario_id).first()
    if not scenario:
        raise HTTPException(404, "Scenario not found")

    history = []
    session = None
    if req.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == req.session_id).first()
        if session:
            history = session.transcript or []

    response = await chat_with_scenario(
        scenario_persona=scenario.persona,
        scenario_goal=scenario.goal,
        conversation_history=history,
        user_message=req.message,
        user_level=req.user_level,
        correction_mode=req.correction_mode,
        translation_languages=req.translation_languages,
    )

    history = list(history)
    history.append({"role": "user", "content": req.message})
    history.append({"role": "assistant", "content": response.get("agent_response", "")})

    if session:
        session.transcript = history
        session.completed = response.get("scenario_complete", False)
    else:
        session = ChatSession(
            user_id=req.user_id,
            scenario_id=req.scenario_id,
            context="scenario",
            transcript=history,
            completed=response.get("scenario_complete", False),
        )
        db.add(session)
    db.commit()
    db.refresh(session)

    return {**response, "session_id": session.id}


@router.get("/sessions")
def list_sessions(user_id: str, db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id, ChatSession.context == "scenario")
        .order_by(ChatSession.created_at.desc())
        .all()
    )
    result = []
    for s in sessions:
        d = _session_dict(s)
        if s.scenario:
            d["scenarios"] = _scenario_dict(s.scenario)
        result.append(d)
    return result


@router.delete("/sessions")
def delete_all_sessions(user_id: str, db: Session = Depends(get_db)):
    deleted = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id, ChatSession.context == "scenario")
        .delete()
    )
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.get("/sessions/{session_id}")
def get_session(session_id: str, user_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id, ChatSession.user_id == user_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")
    d = _session_dict(session)
    if session.scenario:
        d["scenarios"] = _scenario_dict(session.scenario)
    return d


def _scenario_dict(s: Scenario) -> dict:
    return {
        "id": s.id, "name": s.name, "description": s.description,
        "cefr_level": s.cefr_level, "goal": s.goal,
        "persona": s.persona, "persona_de": s.persona_de, "avatar_emoji": s.avatar_emoji,
        "subject": s.subject, "scenario_type": s.scenario_type,
        "opening_message": s.opening_message or None,
    }


def _session_dict(s: ChatSession) -> dict:
    return {
        "id": s.id, "user_id": s.user_id, "scenario_id": s.scenario_id,
        "context": s.context, "transcript": s.transcript or [],
        "completed": s.completed,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
