"""Domain entities and API schemas.

Two layers live here on purpose:

* ``Participant`` / ``LoopResult`` are the domain entities persisted by the
  storage layer and manipulated by the services.
* ``*In`` / ``*Out`` models are the shapes exchanged over HTTP.

Keeping them separate means the wire format can evolve without touching the
storage layer, and vice-versa.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


def initials_from_name(name: str) -> str:
    """Derive up to two uppercase initials from a full name.

    ``"Jean Dupont" -> "JD"``, ``"Zoé" -> "Z"``.
    """
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


# Domain entities ------------------------------------------------------------
class Participant(BaseModel):
    id: int
    name: str
    initials: str
    created_at: str


class LoopResult(BaseModel):
    id: int
    participant_id: int
    loop_number: int
    participated: bool
    loop_type: str | None
    time_seconds: int | None
    extras: dict[str, Any] = Field(default_factory=dict)
    created_at: str


# API input schemas ----------------------------------------------------------
class ParticipantIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le nom ne peut pas être vide.")
        return cleaned


class ParticipantUpdateIn(BaseModel):
    name: str | None = Field(default=None, max_length=60)
    initials: str | None = Field(default=None, max_length=4)


class LoopResultIn(BaseModel):
    """Payload an admin submits when validating a runner's loop.

    Admins never choose the loop number: the server always records the runner's
    next unvalidated loop, so a previously validated loop can never be
    overwritten from the admin panel (that is a super-admin action).
    """

    participant_id: int
    participated: bool = True
    loop_type: str | None = None
    time_seconds: int | None = Field(default=None, ge=0)
    extras: dict[str, Any] = Field(default_factory=dict)


class NextLoopOut(BaseModel):
    """Tells the admin panel which loop it is about to record for a runner."""

    participant_id: int
    next_loop: int | None
    max_loops: int


class LoopResultUpdateIn(BaseModel):
    """Super-admin correction of an existing record (all fields optional)."""

    participated: bool | None = None
    loop_type: str | None = None
    time_seconds: int | None = Field(default=None, ge=0)
    extras: dict[str, Any] | None = None


# API output schemas ---------------------------------------------------------
class LeaderboardEntry(BaseModel):
    rank: int
    participant: Participant
    loops_completed: int
    total_distance_km: float
    total_time_seconds: int
    avg_speed_kmh: float | None


class SeriesPoint(BaseModel):
    loop_number: int
    cumulative_distance_km: float
    total_time_seconds: int
    loop_speed_kmh: float | None
    cumulative_speed_kmh: float | None


class ParticipantSeries(BaseModel):
    participant: Participant
    points: list[SeriesPoint]
