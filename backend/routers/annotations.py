from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Annotation

router = APIRouter(prefix="/annotations", tags=["annotations"])


class AnnotationCreate(BaseModel):
    book_id: str
    page_num: int
    x: float
    y: float
    content: str
    color: str = "#EF4444"
    mark_type: str = "text"
    font_size: int = 12
    ann_width: Optional[float] = None
    ann_height: Optional[float] = None


@router.get("/")
def list_annotations(book_id: str, page_num: int, user_id: str, db: Session = Depends(get_db)):
    items = (
        db.query(Annotation)
        .filter(
            Annotation.book_id == book_id,
            Annotation.page_num == page_num,
            Annotation.user_id == user_id,
        )
        .order_by(Annotation.created_at)
        .all()
    )
    return [_dict(a) for a in items]


@router.get("/all")
def list_all_annotations(book_id: str, user_id: str, db: Session = Depends(get_db)):
    """Return all annotations for a book across all pages (used for PDF save)."""
    items = (
        db.query(Annotation)
        .filter(Annotation.book_id == book_id, Annotation.user_id == user_id)
        .order_by(Annotation.page_num, Annotation.created_at)
        .all()
    )
    return [_dict(a) for a in items]


@router.post("/")
def create_annotation(user_id: str, data: AnnotationCreate, db: Session = Depends(get_db)):
    ann = Annotation(
        user_id=user_id,
        book_id=data.book_id,
        page_num=data.page_num,
        x=data.x,
        y=data.y,
        content=data.content,
        color=data.color,
        mark_type=data.mark_type,
        font_size=data.font_size,
        ann_width=data.ann_width,
        ann_height=data.ann_height,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return _dict(ann)


@router.delete("/")
def delete_book_annotations(book_id: str, user_id: str, db: Session = Depends(get_db)):
    """Delete all annotations for a book (called after baking into PDF)."""
    deleted = (
        db.query(Annotation)
        .filter(Annotation.book_id == book_id, Annotation.user_id == user_id)
        .delete()
    )
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.delete("/{annotation_id}")
def delete_annotation(annotation_id: str, user_id: str, db: Session = Depends(get_db)):
    ann = (
        db.query(Annotation)
        .filter(Annotation.id == annotation_id, Annotation.user_id == user_id)
        .first()
    )
    if not ann:
        raise HTTPException(404, "Annotation not found")
    db.delete(ann)
    db.commit()
    return {"ok": True}


def _dict(a: Annotation) -> dict:
    return {
        "id": a.id,
        "book_id": a.book_id,
        "page_num": a.page_num,
        "x": a.x,
        "y": a.y,
        "content": a.content,
        "color": a.color,
        "mark_type": getattr(a, "mark_type", "text") or "text",
        "font_size": getattr(a, "font_size", 12) or 12,
        "ann_width": getattr(a, "ann_width", None),
        "ann_height": getattr(a, "ann_height", None),
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
