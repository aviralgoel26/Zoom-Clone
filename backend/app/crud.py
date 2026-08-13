"""
crud.py
-------
Database access layer (DAL) — all SQLAlchemy queries live here.
Routers ONLY call functions from this module, keeping business logic
cleanly separated from HTTP / transport concerns.
"""

import random
import string
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app import models, schemas


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------
def _generate_meeting_code() -> str:
    """
    Generate a unique 9-digit meeting code formatted as XXX-XXX-XXX.
    Mirrors Zoom's meeting ID format for visual familiarity.
    """
    digits = "".join(random.choices(string.digits, k=9))
    return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------
def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    db_user = models.User(
        display_name=user.display_name,
        email=user.email,
        is_guest=user.is_guest,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


# ---------------------------------------------------------------------------
# Meeting CRUD
# ---------------------------------------------------------------------------
def get_meeting_by_code(db: Session, code: str) -> Optional[models.Meeting]:
    """Lookup a meeting by its formatted code (e.g. '847-392-156')."""
    return (
        db.query(models.Meeting)
        .filter(models.Meeting.meeting_code == code)
        .first()
    )


def get_meeting_by_id(db: Session, meeting_id: int) -> Optional[models.Meeting]:
    return db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()


def get_upcoming_meetings(
    db: Session,
    limit: int = 20,
    user_id: Optional[int] = None,
) -> List[models.Meeting]:
    """
    Return scheduled meetings with a future scheduled_at, ordered by soonest first.
    If user_id is provided, only return meetings hosted by that user OR where they
    appear as a participant.
    """
    now = datetime.now(timezone.utc)
    q = (
        db.query(models.Meeting)
        .filter(
            models.Meeting.status == models.MeetingStatus.scheduled,
            models.Meeting.scheduled_at > now,
        )
    )
    if user_id is not None:
        # meetings hosted by user OR meetings the user joined as participant
        participated_meeting_ids = (
            db.query(models.Participant.meeting_id)
            .filter(models.Participant.user_id == user_id)
            .subquery()
        )
        q = q.filter(
            (models.Meeting.host_id == user_id)
            | models.Meeting.id.in_(participated_meeting_ids)
        )
    return (
        q.order_by(models.Meeting.scheduled_at.asc())
        .limit(limit)
        .all()
    )


def get_recent_meetings(
    db: Session,
    limit: int = 20,
    user_id: Optional[int] = None,
) -> List[models.Meeting]:
    """
    Return recently ended or active meetings, ordered by creation date descending.
    If user_id is provided, filter to meetings hosted by or participated in by that user.
    """
    q = (
        db.query(models.Meeting)
        .filter(
            models.Meeting.status.in_(
                [models.MeetingStatus.ended, models.MeetingStatus.active]
            )
        )
    )
    if user_id is not None:
        participated_meeting_ids = (
            db.query(models.Participant.meeting_id)
            .filter(models.Participant.user_id == user_id)
            .subquery()
        )
        q = q.filter(
            (models.Meeting.host_id == user_id)
            | models.Meeting.id.in_(participated_meeting_ids)
        )
    return (
        q.order_by(models.Meeting.created_at.desc())
        .limit(limit)
        .all()
    )


def get_user_notifications(
    db: Session,
    user_id: Optional[int] = None,
) -> List[dict]:
    """
    Generate reminder notifications for upcoming scheduled meetings.
    Calculates time remaining and sets urgency labels.
    """
    upcoming = get_upcoming_meetings(db, limit=10, user_id=user_id)
    notifications = []
    now = datetime.now(timezone.utc)

    for m in upcoming:
        if not m.scheduled_at:
            continue

        sched = m.scheduled_at
        if sched.tzinfo is None:
            sched = sched.replace(tzinfo=timezone.utc)

        diff_seconds = (sched - now).total_seconds()
        diff_minutes = int(diff_seconds // 60)

        if diff_seconds < -600:  # Past by more than 10 mins, skip
            continue

        if diff_minutes <= 5:
            urgency = "imminent"
            time_until = "Starting now" if diff_minutes <= 0 else f"in {diff_minutes} min"
            msg = f"Meeting '{m.title}' is starting soon! Click to join."
        elif diff_minutes <= 60:
            urgency = "soon"
            time_until = f"in {diff_minutes} mins"
            msg = f"Upcoming meeting '{m.title}' in {diff_minutes} minutes."
        else:
            urgency = "upcoming"
            hours = diff_minutes // 60
            time_until = f"in {hours}h {diff_minutes % 60}m"
            msg = f"Scheduled meeting '{m.title}' coming up."

        notifications.append({
            "id": f"notif-{m.id}-{m.meeting_code}",
            "meeting_id": m.id,
            "meeting_code": m.meeting_code,
            "title": m.title,
            "scheduled_at": m.scheduled_at,
            "message": msg,
            "time_until": time_until,
            "urgency": urgency,
        })

    return notifications


def create_meeting(db: Session, meeting: schemas.MeetingCreate) -> models.Meeting:
    """Create a new instant meeting with a freshly generated meeting code."""
    code = _generate_meeting_code()
    # Ensure uniqueness in the unlikely collision case.
    while get_meeting_by_code(db, code):
        code = _generate_meeting_code()

    db_meeting = models.Meeting(
        meeting_code=code,
        title=meeting.title,
        description=meeting.description,
        host_id=meeting.host_id,
        status=models.MeetingStatus.active,
        scheduled_at=meeting.scheduled_at,
        duration_minutes=meeting.duration_minutes,
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting


def schedule_meeting(
    db: Session, meeting: schemas.ScheduleMeetingCreate
) -> models.Meeting:
    """Create a future-scheduled meeting with status='scheduled'."""
    code = _generate_meeting_code()
    while get_meeting_by_code(db, code):
        code = _generate_meeting_code()

    db_meeting = models.Meeting(
        meeting_code=code,
        title=meeting.title,
        description=meeting.description,
        host_id=meeting.host_id,
        status=models.MeetingStatus.scheduled,
        scheduled_at=meeting.scheduled_at,
        duration_minutes=meeting.duration_minutes,
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting


def update_meeting_status(
    db: Session, meeting_id: int, status: models.MeetingStatus
) -> Optional[models.Meeting]:
    meeting = get_meeting_by_id(db, meeting_id)
    if meeting:
        meeting.status = status
        db.commit()
        db.refresh(meeting)
    return meeting


# ---------------------------------------------------------------------------
# Participant CRUD
# ---------------------------------------------------------------------------
def add_participant(
    db: Session, participant: schemas.ParticipantCreate
) -> models.Participant:
    """
    Record a user joining a meeting.
    user_id is nullable — guests will have user_id=None.
    display_name is always set so we always have a label for the video card.
    """
    db_participant = models.Participant(
        meeting_id=participant.meeting_id,
        user_id=participant.user_id,        # None for guests — no FK violation
        display_name=participant.display_name,
        role=participant.role,
    )
    db.add(db_participant)
    db.commit()
    db.refresh(db_participant)
    return db_participant


def mark_participant_left(
    db: Session, participant_id: int
) -> Optional[models.Participant]:
    p = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if p:
        p.left_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(p)
    return p


def get_active_participants(
    db: Session, meeting_id: int
) -> List[models.Participant]:
    """Return participants who have not yet left (left_at is NULL)."""
    return (
        db.query(models.Participant)
        .filter(
            models.Participant.meeting_id == meeting_id,
            models.Participant.left_at.is_(None),
        )
        .all()
    )
