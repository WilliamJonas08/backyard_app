"""Tests for the SQLite persistence layer that need a real database file."""

from __future__ import annotations

from pathlib import Path

from app.storage import Repository


def _repo(tmp_path: Path) -> Repository:
    return Repository(tmp_path / "test.db")


def test_reset_wipes_participants_and_results(tmp_path: Path):
    repo = _repo(tmp_path)
    runner = repo.add_participant("Jean Dupont")
    repo.insert_result(
        participant_id=runner.id,
        loop_number=1,
        participated=True,
        loop_type="4km",
        time_seconds=24 * 60,
        extras={},
    )

    repo.reset()

    assert repo.list_participants() == []
    assert repo.list_results() == []


def test_reset_restarts_id_counter(tmp_path: Path):
    repo = _repo(tmp_path)
    repo.add_participant("First")
    repo.reset()
    fresh = repo.add_participant("Second")
    # Ids start again from 1 after a reset.
    assert fresh.id == 1
