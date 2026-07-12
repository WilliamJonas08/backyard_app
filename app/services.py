"""Business logic: rankings and derived metrics.

Every function here is **pure**: it takes plain domain objects plus the event
config and returns computed values. There is no database or HTTP access, which
makes the interesting logic (ranking, cumulative distance, speeds) easy to test
in isolation and easy to extend — a new metric is just one more function.
"""

from __future__ import annotations

from .config import EventConfig
from .models import (
    LeaderboardEntry,
    LoopResult,
    Participant,
    ParticipantSeries,
    SeriesPoint,
)


def _speed_kmh(distance_km: float, time_seconds: int | None) -> float | None:
    """Average speed in km/h, or ``None`` when it cannot be computed."""
    if not time_seconds or distance_km <= 0:
        return None
    return round(distance_km / (time_seconds / 3600), 2)


def _effective_results(results: list[LoopResult]) -> list[LoopResult]:
    """Keep only loops the runner actually ran, sorted by loop number."""
    ran = [r for r in results if r.participated and r.loop_type]
    return sorted(ran, key=lambda r: r.loop_number)


def build_series(
    participant: Participant,
    results: list[LoopResult],
    event: EventConfig,
) -> ParticipantSeries:
    """Build the per-loop cumulative series used to draw the charts."""
    points: list[SeriesPoint] = []
    cumulative_distance = 0.0
    cumulative_time = 0

    for result in _effective_results(results):
        distance = event.distance_for(result.loop_type)
        cumulative_distance += distance
        cumulative_time += result.time_seconds or 0
        points.append(
            SeriesPoint(
                loop_number=result.loop_number,
                cumulative_distance_km=round(cumulative_distance, 2),
                total_time_seconds=cumulative_time,
                loop_speed_kmh=_speed_kmh(distance, result.time_seconds),
                cumulative_speed_kmh=_speed_kmh(cumulative_distance, cumulative_time),
            )
        )
    return ParticipantSeries(participant=participant, points=points)


def build_all_series(
    participants: list[Participant],
    results: list[LoopResult],
    event: EventConfig,
) -> list[ParticipantSeries]:
    by_participant = _group_results(results)
    return [
        build_series(p, by_participant.get(p.id, []), event) for p in participants
    ]


def build_leaderboard(
    participants: list[Participant],
    results: list[LoopResult],
    event: EventConfig,
) -> list[LeaderboardEntry]:
    """Rank runners: loops completed → total distance → total time.

    More loops always wins (backyard spirit). Ties break on the greater
    cumulative distance, then on the shorter total time.
    """
    by_participant = _group_results(results)
    unranked: list[LeaderboardEntry] = []

    for participant in participants:
        ran = _effective_results(by_participant.get(participant.id, []))
        total_distance = round(
            sum(event.distance_for(r.loop_type) for r in ran), 2
        )
        total_time = sum(r.time_seconds or 0 for r in ran)
        unranked.append(
            LeaderboardEntry(
                rank=0,  # assigned after sorting
                participant=participant,
                loops_completed=len(ran),
                total_distance_km=total_distance,
                total_time_seconds=total_time,
                avg_speed_kmh=_speed_kmh(total_distance, total_time),
            )
        )

    unranked.sort(
        key=lambda e: (
            -e.loops_completed,
            -e.total_distance_km,
            e.total_time_seconds if e.total_time_seconds else float("inf"),
        )
    )
    for position, entry in enumerate(unranked, start=1):
        entry.rank = position
    return unranked


def _group_results(results: list[LoopResult]) -> dict[int, list[LoopResult]]:
    grouped: dict[int, list[LoopResult]] = {}
    for result in results:
        grouped.setdefault(result.participant_id, []).append(result)
    return grouped
