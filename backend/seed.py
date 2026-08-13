"""
seed.py
-------
Seed script for the evaluator to quickly populate the SQLite database
with realistic demo data.

Run:
  cd backend
  python seed.py

Seeds:
  - 1 registered host user (Alice)
  - 1 registered attendee user (Bob)
  - 3 meetings:
      * 1 upcoming scheduled meeting (today + 1 hour)
      * 1 upcoming scheduled meeting (tomorrow)
      * 1 recently ended meeting (yesterday)
  - 2 participant records on the ended meeting
"""

import sys
import os

# Allow running from the backend/ directory
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta

from app.database import SessionLocal, engine, Base
from app import models, crud, schemas

def seed():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("[SEED] Starting seed...")

        # ----------------------------------------------------------------
        # Users
        # ----------------------------------------------------------------
        alice = crud.get_user_by_email(db, "alice@zoomclone.dev")
        if not alice:
            alice = crud.create_user(
                db,
                schemas.UserCreate(
                    display_name="Alice (Host)",
                    email="alice@zoomclone.dev",
                    is_guest=False,
                ),
            )
            print(f"  [OK] Created user: {alice.display_name} (id={alice.id})")
        else:
            print(f"  [SKIP] User alice already exists (id={alice.id})")

        bob = crud.get_user_by_email(db, "bob@zoomclone.dev")
        if not bob:
            bob = crud.create_user(
                db,
                schemas.UserCreate(
                    display_name="Bob (Participant)",
                    email="bob@zoomclone.dev",
                    is_guest=False,
                ),
            )
            print(f"  [OK] Created user: {bob.display_name} (id={bob.id})")
        else:
            print(f"  [SKIP] User bob already exists (id={bob.id})")

        # ----------------------------------------------------------------
        # Upcoming meeting 1 — in 1 hour
        # ----------------------------------------------------------------
        m1 = crud.schedule_meeting(
            db,
            schemas.ScheduleMeetingCreate(
                title="Sprint Planning Q3",
                description="Weekly sprint planning with the engineering team.",
                host_id=alice.id,
                scheduled_at=datetime.utcnow() + timedelta(hours=1),
                duration_minutes=60,
            ),
        )
        print(f"  [OK] Scheduled meeting: '{m1.title}' [{m1.meeting_code}]")

        # ----------------------------------------------------------------
        # Upcoming meeting 2 — tomorrow
        # ----------------------------------------------------------------
        m2 = crud.schedule_meeting(
            db,
            schemas.ScheduleMeetingCreate(
                title="Design Review",
                description="Review new UI mockups for the dashboard.",
                host_id=alice.id,
                scheduled_at=datetime.utcnow() + timedelta(days=1),
                duration_minutes=45,
            ),
        )
        print(f"  [OK] Scheduled meeting: '{m2.title}' [{m2.meeting_code}]")

        # ----------------------------------------------------------------
        # Recent meeting — ended yesterday
        # ----------------------------------------------------------------
        m3 = crud.create_meeting(
            db,
            schemas.MeetingCreate(
                title="All-Hands Meeting",
                description="Company-wide all-hands — July edition.",
                host_id=alice.id,
                scheduled_at=datetime.utcnow() - timedelta(days=1),
                duration_minutes=90,
            ),
        )
        # Mark it as ended
        crud.update_meeting_status(db, m3.id, models.MeetingStatus.ended)
        print(f"  [OK] Ended meeting: '{m3.title}' [{m3.meeting_code}]")

        # ----------------------------------------------------------------
        # Participants on the ended meeting
        # ----------------------------------------------------------------
        p1 = crud.add_participant(
            db,
            schemas.ParticipantCreate(
                meeting_id=m3.id,
                user_id=alice.id,
                display_name=alice.display_name,
                role="host",
            ),
        )
        p2 = crud.add_participant(
            db,
            schemas.ParticipantCreate(
                meeting_id=m3.id,
                user_id=bob.id,
                display_name=bob.display_name,
                role="participant",
            ),
        )
        # Guest with no user account
        p3 = crud.add_participant(
            db,
            schemas.ParticipantCreate(
                meeting_id=m3.id,
                user_id=None,           # Guest — nullable FK
                display_name="Charlie (Guest)",
                role="participant",
            ),
        )
        crud.mark_participant_left(db, p1.id)
        crud.mark_participant_left(db, p2.id)
        crud.mark_participant_left(db, p3.id)
        print(f"  [OK] Added 3 participants to '{m3.title}' (including 1 guest)")

        print("\n[DONE] Seed complete! Database is ready for evaluation.")
        print("\n   Upcoming meeting codes to test with:")
        print(f"   -> {m1.meeting_code}  ({m1.title})")
        print(f"   -> {m2.meeting_code}  ({m2.title})")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
