"""
auth_utils.py
-------------
Utility functions for password hashing (native bcrypt) and JWT creation/verification.

Avoids passlib Python 3.13 / bcrypt 4+ compatibility issues by using the standard
bcrypt library directly.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from dotenv import load_dotenv
from jose import JWTError, jwt

load_dotenv()

# ---------------------------------------------------------------------------
# Config — read from .env
# ---------------------------------------------------------------------------
SECRET_KEY: str = os.getenv("SECRET_KEY", "fallback-insecure-key")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_DAYS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "7"))


# ---------------------------------------------------------------------------
# Native bcrypt password hashing
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    """Return bcrypt hash of a plaintext password."""
    password_bytes = plain.encode("utf-8")[:72]   # bcrypt max 72 bytes
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored bcrypt hash."""
    try:
        password_bytes = plain.encode("utf-8")[:72]
        hashed_bytes = hashed.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Encode a JWT containing `data` with an expiry.
    The `sub` claim is the user's ID (as a string).
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT. Returns the payload dict or None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
