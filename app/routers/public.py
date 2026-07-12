"""Public endpoints: event info, self-registration, leaderboard, chart series.

These are the read-only (plus self-registration) routes any participant reaches
by scanning the QR code. No authentication.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import EventConfig
from ..dependencies import get_event, get_repository
from ..models import (
    LeaderboardEntry,
    Participant,
    ParticipantIn,
    ParticipantSeries,
)
from ..services import build_all_series, build_leaderboard
from ..storage import Repository

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/event")
def get_event_info(event: EventConfig = Depends(get_event)) -> EventConfig:
    return event


@router.post("/participants", response_model=Participant, status_code=status.HTTP_201_CREATED)
def register_participant(
    payload: ParticipantIn,
    repo: Repository = Depends(get_repository),
) -> Participant:
    """Self-registration on first scan.

    If someone with the same name already registered, we return that record
    instead of creating a duplicate — friendlier when a runner re-scans.
    """
    existing = repo.find_participant_by_name(payload.name)
    if existing is not None:
        return existing
    return repo.add_participant(payload.name)


@router.get("/participants", response_model=list[Participant])
def list_participants(repo: Repository = Depends(get_repository)) -> list[Participant]:
    return repo.list_participants()


@router.get("/participants/{participant_id}", response_model=Participant)
def get_participant(
    participant_id: int,
    repo: Repository = Depends(get_repository),
) -> Participant:
    participant = repo.get_participant(participant_id)
    if participant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Participant introuvable.")
    return participant


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(
    repo: Repository = Depends(get_repository),
    event: EventConfig = Depends(get_event),
) -> list[LeaderboardEntry]:
    return build_leaderboard(repo.list_participants(), repo.list_results(), event)


@router.get("/series", response_model=list[ParticipantSeries])
def get_series(
    repo: Repository = Depends(get_repository),
    event: EventConfig = Depends(get_event),
) -> list[ParticipantSeries]:
    return build_all_series(repo.list_participants(), repo.list_results(), event)
