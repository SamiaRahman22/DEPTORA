"""SQLAlchemy database configuration."""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all database tables."""
    from app.models import user, faq, faq_candidate, procedure, document, query_log  # noqa
    Base.metadata.create_all(bind=engine)
    _migrate_query_log_columns()


def _migrate_query_log_columns():
    """
    Lightweight auto-migration: create_all() only creates NEW tables, it never
    alters existing ones. If query_logs already existed before the confidence/
    validation/rating columns were added to the model, add them in place so
    existing databases don't break. Safe to run every startup (checks first).
    """
    import sqlite3
    if "sqlite" not in settings.DATABASE_URL:
        return  # Only handling the sqlite case this project actually uses.

    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if not os.path.exists(db_path):
        return

    needed_columns = {
        "confidence_score": "FLOAT DEFAULT 0.5",
        "is_valid": "BOOLEAN",
        "unverified_claims_count": "INTEGER",
        "admin_rating": "VARCHAR(20)",
    }

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(query_logs)")
        existing = {row[1] for row in cur.fetchall()}
        for col, col_type in needed_columns.items():
            if col not in existing:
                cur.execute(f"ALTER TABLE query_logs ADD COLUMN {col} {col_type}")
        conn.commit()
    except Exception:
        pass  # Table may not exist yet on a fresh DB — create_all already handled that case.
    finally:
        conn.close()
