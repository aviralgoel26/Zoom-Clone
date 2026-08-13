"""
models.py
---------
SQLAlchemy ORM models mapping to SQLite tables.

Relationships:
  User      (1) ──── (N)  Meeting    [host_id FK]
  Meeting   (1) ──── (N)  Participant [meeting_id FK]
  User      (1) ──── (N)  Participant [user_id FK, NULLABLE for guests]

Design Decision:
  - Participant.user_id is nullable=True so guest users (no account) can
    join a meeting without violating the FK constraint. Their identity is
    stored purely via display_name on the Participant row itself.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.database import Base


class MeetingStatus(str, enum.Enum):
    """Lifecycle states for a meeting record."""
    scheduled = "scheduled"
    active = "active"
    ended = "ended"


class ParticipantRole(str, enum.Enum):
    """Role assigned to each meeting participant."""
    host = "host"
    participant = "participant"


# ---------------------------------------------------------------------------
# User — Persistent registered user. Guests bypass this table entirely.
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    display_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=True)   # None for guest/OAuth users
    is_guest = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Meetings this user created/hosts
    hosted_meetings = relationship("Meeting", back_populates="host")
    # Participation records for this user
    participations = relationship("Participant", back_populates="user")


# ---------------------------------------------------------------------------
# Meeting — Core entity for both instant and scheduled meetings.
# ---------------------------------------------------------------------------
class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    # Human-readable code shown in the UI, e.g. "847-392-156"
    meeting_code = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False, default="Instant Meeting")
    description = Column(String, nullable=True)
    # FK to registered host — nullable to allow truly anonymous host flows
    host_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(MeetingStatus), default=MeetingStatus.scheduled, nullable=False)
    scheduled_at = Column(DateTime, nullable=True)   # None for instant meetings
    duration_minutes = Column(Integer, nullable=True, default=60)
    created_at = Column(DateTime, default=datetime.utcnow)

    host = relationship("User", back_populates="hosted_meetings")
    participants = relationship("Participant", back_populates="meeting")


# ---------------------------------------------------------------------------
# Participant — Join-table tracking every user/guest inside a meeting.
# ---------------------------------------------------------------------------
class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)

    # CRITICAL: nullable=True supports guest users who have no User account.
    # A guest row will have user_id=None and rely solely on display_name.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    display_name = Column(String, nullable=False)
    role = Column(Enum(ParticipantRole), default=ParticipantRole.participant, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)    # None while active in meeting

    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User", back_populates="participations")
