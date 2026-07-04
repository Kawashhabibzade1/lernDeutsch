import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

load_dotenv()

# Fallback to local SQLite if DATABASE_URL is not set
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deutschpath.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# psycopg2 driver might need 'postgresql://' instead of 'postgres://' depending on version, 
# but SQLAlchemy handles postgresql:// correctly.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False, Postgres does not.
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Base
    Base.metadata.create_all(bind=engine)
    _seed_if_empty()


def _seed_if_empty():
    """Insert missing seed records and update existing ones with new fields."""
    from models import GrammarRule, Scenario, WritingTopic
    from seed_data import GRAMMAR_RULES, SCENARIOS, WRITING_TOPICS

    db = SessionLocal()
    try:
        existing_rules = {r.name for r in db.query(GrammarRule.name).all()}
        for r in GRAMMAR_RULES:
            if r["name"] not in existing_rules:
                db.add(GrammarRule(**r))
        db.commit()

        existing_map = {s.name: s for s in db.query(Scenario).all()}
        for s in SCENARIOS:
            if s["name"] not in existing_map:
                db.add(Scenario(**s))
            else:
                # Update new fields on existing rows
                row = existing_map[s["name"]]
                for field in ("subject", "scenario_type", "opening_message"):
                    if field in s and getattr(row, field, None) is None:
                        setattr(row, field, s[field])
        db.commit()

        existing_topics = {t.id for t in db.query(WritingTopic.id).all()}
        for t in WRITING_TOPICS:
            if t["id"] not in existing_topics:
                db.add(WritingTopic(**t))
        db.commit()
    finally:
        db.close()
