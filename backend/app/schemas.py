"""
schemas.py
----------
Pydantic v2 schemas used for:
  - Validating incoming HTTP request bodies.
  - Serialising ORM model instances into HTTP response JSON.

Naming convention:
  <Entity>Base    — shared fields (no id, timestamps)
  <Entity>Create  — fields required to create the entity
  <Entity>        — full response schema (includes id, timestamps)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    display_name: str
    email: Optional[str] = None
    is_guest: bool = False


class UserCreate(UserBase):
    pass


class UserSchema(UserBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Meeting schemas
# ---------------------------------------------------------------------------
class MeetingBase(BaseModel):
    title: str = "Instant Meeting"
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = 60


class MeetingCreate(MeetingBase):
    host_id: Optional[int] = None   # None for anonymous/guest hosts


class ScheduleMeetingCreate(MeetingBase):
    """Used by the Schedule Meeting form."""
    title: str
    host_id: Optional[int] = None


class MeetingSchema(MeetingBase):
    id: int
    meeting_code: str
    host_id: Optional[int]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Participant schemas
# ---------------------------------------------------------------------------
class ParticipantBase(BaseModel):
    display_name: str
    role: str = "participant"


class ParticipantCreate(ParticipantBase):
    meeting_id: int
    user_id: Optional[int] = None   # None for guests


class ParticipantSchema(ParticipantBase):
    id: int
    meeting_id: int
    user_id: Optional[int]
    joined_at: datetime
    left_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Request/Response helpers
# ---------------------------------------------------------------------------
class JoinMeetingRequest(BaseModel):
    """Payload sent when a user clicks 'Join Meeting' from the lobby."""
    display_name: str
    user_id: Optional[int] = None   # registered user; None = guest
    role: str = "participant"


class MeetingValidationResponse(BaseModel):
    """Minimal response to confirm a meeting_code is valid."""
    valid: bool
    meeting_id: Optional[int] = None
    title: Optional[str] = None
    status: Optional[str] = None
    meeting_code: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    """Payload for POST /api/auth/register."""
    display_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    """Payload for POST /api/auth/login."""
    email: str
    password: str


class AuthUserResponse(BaseModel):
    """Embedded user info returned inside auth responses."""
    id: int
    display_name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    """Full response for login / register — carries the JWT."""
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse
