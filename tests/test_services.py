"""Unit tests for the pure business logic (ranking + derived metrics)."""

from __future__ import annotations

from app.config import DEFAULT_EVENT
from app.models import LoopResult, Participant
from app.services import build_leaderboard, build_series

EVENT = DEFAULT_EVENT


def participant(pid: int, name: str) -> Participant:
    return Participant(id=pid, name=name, initials="XX", created_at="now")


def result(pid: int, loop: int, loop_type: str | None, seconds: int | None,
           participated: bool = True) -> LoopResult:
    return LoopResult(
        id=loop + pid * 100,
        participant_id=pid,
        loop_number=loop,
        participated=participated,
        loop_type=loop_type,
        time_seconds=seconds,
        extras={},
        created_at="now",
    )


def test_series_accumulates_distance_and_time():
    p = participant(1, "A")
    results = [
        result(1, 1, "6.5km", 40 * 60),
        result(1, 2, "4km", 24 * 60),
    ]
    series = build_series(p, results, EVENT)
    assert [pt.loop_number for pt in series.points] == [1, 2]
    assert series.points[0].cumulative_distance_km == 6.5
    assert series.points[1].cumulative_distance_km == 10.5
    assert series.points[1].total_time_seconds == (40 + 24) * 60


def test_series_skips_non_participation():
    p = participant(1, "A")
    results = [
        result(1, 1, "4km", 24 * 60),
        result(1, 2, None, None, participated=False),
        result(1, 3, "4km", 25 * 60),
    ]
    series = build_series(p, results, EVENT)
    # The skipped loop (2) is absent; distance only counts loops 1 and 3.
    assert [pt.loop_number for pt in series.points] == [1, 3]
    assert series.points[-1].cumulative_distance_km == 8.0


def test_loop_speed_computation():
    p = participant(1, "A")
    # 4 km in exactly 24 min -> 10 km/h.
    series = build_series(p, [result(1, 1, "4km", 24 * 60)], EVENT)
    assert series.points[0].loop_speed_kmh == 10.0


def test_leaderboard_orders_by_loops_then_distance_then_time():
    participants = [participant(1, "A"), participant(2, "B"), participant(3, "C")]
    results = [
        # A: 2 loops, 8 km
        result(1, 1, "4km", 24 * 60),
        result(1, 2, "4km", 24 * 60),
        # B: 3 loops, more loops -> should rank first
        result(2, 1, "4km", 30 * 60),
        result(2, 2, "4km", 30 * 60),
        result(2, 3, "4km", 30 * 60),
        # C: 2 loops but 13 km (two long loops) -> beats A on distance
        result(3, 1, "6.5km", 40 * 60),
        result(3, 2, "6.5km", 40 * 60),
    ]
    board = build_leaderboard(participants, results, EVENT)
    order = [e.participant.name for e in board]
    assert order == ["B", "C", "A"]
    assert [e.rank for e in board] == [1, 2, 3]


def test_leaderboard_tiebreak_on_shorter_time():
    participants = [participant(1, "Fast"), participant(2, "Slow")]
    results = [
        result(1, 1, "4km", 20 * 60),  # same loops & distance, faster
        result(2, 1, "4km", 30 * 60),
    ]
    board = build_leaderboard(participants, results, EVENT)
    assert board[0].participant.name == "Fast"


def test_participant_with_no_results_is_last_with_zeroes():
    participants = [participant(1, "Runner"), participant(2, "Idle")]
    results = [result(1, 1, "4km", 24 * 60)]
    board = build_leaderboard(participants, results, EVENT)
    assert board[-1].participant.name == "Idle"
    assert board[-1].loops_completed == 0
    assert board[-1].total_distance_km == 0.0
    assert board[-1].avg_speed_kmh is None
