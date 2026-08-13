"""
meetings.py  (router)
---------------------
REST API endpoints for meeting lifecycle management.

Endpoints:
  POST   /api/meetings/instant          → create & return a new instant meeting
  POST   /api/meetings/schedule         → schedule a future meeting
  GET    /api/meetings/upcoming         → list upcoming scheduled meetings
  GET    /api/meetings/recent           → list recent/ended meetings
  GET    /api/meetings/{code}           → validate a meeting code (for join flow)
  POST   /api/meetings/{id}/join        → record a participant joining
  POST   /api/meetings/{id}/leave       → record a participant leaving
  POST   /api/meetings/{id}/end         → host ends a meeting (status → ended)
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db
from app.websocket_manager import manager

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


# ---------------------------------------------------------------------------
# Create instant meeting
# ---------------------------------------------------------------------------
@router.post("/instant", response_model=schemas.MeetingSchema)
def create_instant_meeting(
    meeting: schemas.MeetingCreate,
    db: Session = Depends(get_db),
):
    """
    Called when user clicks 'New Meeting' on the dashboard.
    Generates a formatted meeting code and immediately sets status=active.
    """
    return crud.create_meeting(db, meeting)


# ---------------------------------------------------------------------------
# Schedule a future meeting
# ---------------------------------------------------------------------------
@router.post("/schedule", response_model=schemas.MeetingSchema)
def create_scheduled_meeting(
    meeting: schemas.ScheduleMeetingCreate,
    db: Session = Depends(get_db),
):
    """
    Called from the Schedule Meeting form.
    Sets status=scheduled so it appears in the Upcoming Meetings tab.
    """
    return crud.schedule_meeting(db, meeting)


# ---------------------------------------------------------------------------
# List upcoming meetings (scheduled, future date)
# ---------------------------------------------------------------------------
@router.get("/upcoming", response_model=List[schemas.MeetingSchema])
def list_upcoming_meetings(
    user_id: Optional[int] = Query(default=None, description="Filter by host or participant user ID"),
    db: Session = Depends(get_db),
):
    """Return upcoming scheduled meetings. Filtered to a specific user when user_id is provided."""
    return crud.get_upcoming_meetings(db, user_id=user_id)


# ---------------------------------------------------------------------------
# List recent meetings (ended or active)
# ---------------------------------------------------------------------------
@router.get("/recent", response_model=List[schemas.MeetingSchema])
def list_recent_meetings(
    user_id: Optional[int] = Query(default=None, description="Filter by host or participant user ID"),
    db: Session = Depends(get_db),
):
    """Return recent meetings. Filtered to a specific user when user_id is provided."""
    return crud.get_recent_meetings(db, user_id=user_id)


# ---------------------------------------------------------------------------
# Validate / fetch meeting by code (join flow)
# ---------------------------------------------------------------------------
@router.get("/{code}", response_model=schemas.MeetingValidationResponse)
def get_meeting_by_code(code: str, db: Session = Depends(get_db)):
    """
    Called from the frontend join flow to verify the meeting code.
    Returns valid=False if not found so the UI can show an error.
    """
    meeting = crud.get_meeting_by_code(db, code)
    if not meeting:
        return schemas.MeetingValidationResponse(valid=False)
    return schemas.MeetingValidationResponse(
        valid=True,
        meeting_id=meeting.id,
        title=meeting.title,
        status=meeting.status,
        meeting_code=meeting.meeting_code,
    )


# ---------------------------------------------------------------------------
# Join a meeting — record participant entry
# ---------------------------------------------------------------------------
@router.post("/{meeting_id}/join", response_model=schemas.ParticipantSchema)
def join_meeting(
    meeting_id: int,
    payload: schemas.JoinMeetingRequest,
    db: Session = Depends(get_db),
):
    """
    Called just before a user enters the live room.
    user_id=None is fully valid for guest participants.
    """
    meeting = crud.get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participant_data = schemas.ParticipantCreate(
        meeting_id=meeting_id,
        user_id=payload.user_id,       # None for guests — nullable FK
        display_name=payload.display_name,
        role=payload.role,
    )
    return crud.add_participant(db, participant_data)


# ---------------------------------------------------------------------------
# Leave a meeting — record participant exit timestamp
# ---------------------------------------------------------------------------
@router.post("/{meeting_id}/leave/{participant_id}", response_model=schemas.ParticipantSchema)
def leave_meeting(
    meeting_id: int,
    participant_id: int,
    db: Session = Depends(get_db),
):
    p = crud.mark_participant_left(db, participant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    return p


# ---------------------------------------------------------------------------
# End meeting (host action)
# ---------------------------------------------------------------------------
@router.post("/{meeting_id}/end", response_model=schemas.MeetingSchema)
async def end_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Transition meeting status to 'ended'. Broadcasts end-meeting to active room."""
    meeting = crud.update_meeting_status(
        db, meeting_id, models.MeetingStatus.ended
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.meeting_code:
        await manager.broadcast_to_all(
            {"type": "host-action", "action": "end-meeting"},
            meeting.meeting_code,
        )
    return meeting
