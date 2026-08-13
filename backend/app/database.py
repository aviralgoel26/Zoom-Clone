"""
database.py
-----------
SQLAlchemy SQLite engine + session configuration.
Uses a local file-based SQLite DB (`sql_app.db`) so the app is fully
serverless — no external DB process required.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# SQLite file lives alongside the backend directory at runtime.
# check_same_thread=False is required because FastAPI may serve requests
# on different threads while reusing the same SQLite connection.
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Each request gets its own session via dependency injection.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All ORM models inherit from this Base.
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that provides a SQLAlchemy DB session per request
    and guarantees it is closed even on errors.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
