"""
auth.py  (router)
-----------------
Authentication endpoints — register, login, and get current user.

Endpoints:
  POST  /api/auth/register  → create user, return JWT + user info
  POST  /api/auth/login     → verify credentials, return JWT + user info
  GET   /api/auth/me        → decode JWT from Authorization header, return user
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app import models, schemas
from app.auth_utils import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------
@router.post("/register", response_model=schemas.AuthResponse)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """
    Create a new user account.
    Returns a JWT access token and the created user's info.
    """
    # Check for duplicate email
    existing = db.query(models.User).filter(
        models.User.email == payload.email.lower().strip()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate inputs
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not payload.display_name.strip():
        raise HTTPException(status_code=400, detail="Display name is required")

    # Create user row
    user = models.User(
        display_name=payload.display_name.strip(),
        email=payload.email.lower().strip(),
        hashed_password=hash_password(payload.password),
        is_guest=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(f"[Auth] New user registered: {user.email}")

    token = create_access_token({"sub": str(user.id)})
    return schemas.AuthResponse(
        access_token=token,
        user=schemas.AuthUserResponse(
            id=user.id,
            display_name=user.display_name,
            email=user.email,
        ),
    )


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate with email + password. Returns a JWT on success.
    """
    user = db.query(models.User).filter(
        models.User.email == payload.email.lower().strip()
    ).first()

    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    logger.info(f"[Auth] User logged in: {user.email}")

    token = create_access_token({"sub": str(user.id)})
    return schemas.AuthResponse(
        access_token=token,
        user=schemas.AuthUserResponse(
            id=user.id,
            display_name=user.display_name,
            email=user.email,
        ),
    )


# ---------------------------------------------------------------------------
# Get current user (token validation)
# ---------------------------------------------------------------------------
@router.get("/me", response_model=schemas.AuthUserResponse)
def get_me(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """
    Decode the Bearer token from the Authorization header.
    Used by the frontend on page load to re-hydrate the auth state.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token is invalid or expired")

    user_id = int(payload["sub"])
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return schemas.AuthUserResponse(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
    )
