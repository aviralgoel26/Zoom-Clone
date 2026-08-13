"""
auth_utils.py
-------------
Utility functions for password hashing (bcrypt) and JWT creation/verification.

All secrets are loaded from the .env file via python-dotenv so they never
appear in source code.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

load_dotenv()

# ---------------------------------------------------------------------------
# Config — read from .env
# ---------------------------------------------------------------------------
SECRET_KEY: str = os.getenv("SECRET_KEY", "fallback-insecure-key")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_DAYS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "7"))

# ---------------------------------------------------------------------------
# Bcrypt password context
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return bcrypt hash of a plaintext password."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored bcrypt hash."""
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Encode a JWT containing `data` with an expiry.
    The `sub` claim should be the user's ID (as a string).
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
