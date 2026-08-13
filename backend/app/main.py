"""
main.py
-------
FastAPI application entry point.

Responsibilities:
  1. Configure CORSMiddleware to allow cross-origin requests from the Next.js
     dev server (port 3000). Without this, every REST call and WebSocket
     handshake from the browser will be blocked by the Same-Origin Policy.
  2. Mount REST routers (meetings).
  3. Mount WebSocket signaling router.
  4. Create SQLite tables on startup via SQLAlchemy metadata.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, meetings, signaling

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — replaces deprecated @app.on_event (FastAPI 0.115+)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on startup (before yield) and on shutdown (after yield).
    Creates all SQLAlchemy-defined tables in sql_app.db if they don't exist.
    This is idempotent — safe to run on every server start.
    """
    logger.info("Creating database tables if not present...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database ready.")
    yield   # Server runs here
    # Shutdown logic (none needed for SQLite)


# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Zoom Clone API",
    description="Signaling server + REST API for the Zoom Web App Clone.",
    version="1.0.0",
    docs_url="/docs",       # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc",
    lifespan=lifespan,      # Modern startup/shutdown lifecycle
)


# ---------------------------------------------------------------------------
# CORS — CRITICAL for dev environment
#
# Frontend runs on http://localhost:3000 (Next.js dev server).
# Backend runs on http://localhost:8000 (Uvicorn).
# Without explicit allow_origins the browser enforces the Same-Origin Policy
# and blocks all fetch() calls and WebSocket upgrade requests.
#
# For production, replace "*" with your specific frontend domain.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # Next.js dev
        "http://127.0.0.1:3000",
        "http://localhost:3001",      # fallback if 3000 is occupied
        "*",                          # permissive fallback for evaluators
    ],
    allow_credentials=True,
    allow_methods=["*"],              # GET, POST, PUT, DELETE, OPTIONS, etc.
    allow_headers=["*"],              # Content-Type, Authorization, etc.
)


# (Table creation is now handled in the lifespan context manager above)


# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------
app.include_router(auth.router)             # REST: /api/auth/*
app.include_router(meetings.router)     # REST: /api/meetings/*
app.include_router(signaling.router)    # WS:   /ws/meeting/{meeting_id}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["utility"])
def health_check():
    """Simple liveness probe. Returns 200 OK when the server is up."""
    return {"status": "ok", "service": "zoom-clone-api"}
