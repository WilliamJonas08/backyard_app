"""SQLite persistence layer.

This is the *only* module that speaks SQL. Everything above it works with the
domain models from :mod:`app.models`, which keeps the business logic free of
database concerns and trivially unit-testable.

SQLite is used deliberately: the whole database is a single file, so there is
no server to run or administer, yet the data survives restarts (given a
persistent disk) well beyond the 24h requirement.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .models import LoopResult, Participant, initials_from_name

SCHEMA = """
CREATE TABLE IF NOT EXISTS participants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    initials    TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loop_results (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    loop_number    INTEGER NOT NULL,
    participated   INTEGER NOT NULL DEFAULT 1,
    loop_type      TEXT,
    time_seconds   INTEGER,
    extras         TEXT    NOT NULL DEFAULT '{}',
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (participant_id, loop_number)
);
"""


class Repository:
    """Thin data-access object over a single SQLite file."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    # Connection helpers ----------------------------------------------------
    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    def reset(self) -> None:
        """Wipe all data — every participant and loop result.

        Used by the super-admin to start from a clean slate before the event.
        The id counters are reset too, so the first new runner is #1 again.
        """
        with self._connect() as conn:
            conn.execute("DELETE FROM loop_results")
            conn.execute("DELETE FROM participants")
            conn.execute(
                "DELETE FROM sqlite_sequence WHERE name IN ('participants', 'loop_results')"
            )

    # Row -> model mappers --------------------------------------------------
    @staticmethod
    def _participant(row: sqlite3.Row) -> Participant:
        return Participant(
            id=row["id"],
            name=row["name"],
            initials=row["initials"],
            created_at=row["created_at"],
        )

    @staticmethod
    def _result(row: sqlite3.Row) -> LoopResult:
        return LoopResult(
            id=row["id"],
            participant_id=row["participant_id"],
            loop_number=row["loop_number"],
            participated=bool(row["participated"]),
            loop_type=row["loop_type"],
            time_seconds=row["time_seconds"],
            extras=json.loads(row["extras"]),
            created_at=row["created_at"],
        )

    # Participants ----------------------------------------------------------
    def add_participant(self, name: str, initials: str | None = None) -> Participant:
        initials = initials or initials_from_name(name)
        with self._connect() as conn:
            cur = conn.execute(
                "INSERT INTO participants (name, initials) VALUES (?, ?)",
                (name, initials),
            )
            row = conn.execute(
                "SELECT * FROM participants WHERE id = ?", (cur.lastrowid,)
            ).fetchone()
        return self._participant(row)

    def get_participant(self, participant_id: int) -> Participant | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM participants WHERE id = ?", (participant_id,)
            ).fetchone()
        return self._participant(row) if row else None

    def find_participant_by_name(self, name: str) -> Participant | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM participants WHERE lower(name) = lower(?)", (name,)
            ).fetchone()
        return self._participant(row) if row else None

    def list_participants(self) -> list[Participant]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM participants ORDER BY name COLLATE NOCASE"
            ).fetchall()
        return [self._participant(r) for r in rows]

    def update_participant(
        self, participant_id: int, *, name: str | None, initials: str | None
    ) -> Participant | None:
        current = self.get_participant(participant_id)
        if current is None:
            return None
        new_name = name if name is not None else current.name
        new_initials = initials if initials is not None else current.initials
        with self._connect() as conn:
            conn.execute(
                "UPDATE participants SET name = ?, initials = ? WHERE id = ?",
                (new_name, new_initials, participant_id),
            )
        return self.get_participant(participant_id)

    def delete_participant(self, participant_id: int) -> bool:
        with self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM participants WHERE id = ?", (participant_id,)
            )
        return cur.rowcount > 0

    # Loop results ----------------------------------------------------------
    def upsert_result(
        self,
        *,
        participant_id: int,
        loop_number: int,
        participated: bool,
        loop_type: str | None,
        time_seconds: int | None,
        extras: dict,
    ) -> LoopResult:
        """Insert a loop result, or replace it if this loop already exists.

        Admins validate a loop once; re-submitting the same (runner, loop)
        overwrites it rather than erroring, which is the forgiving behaviour we
        want on the field.
        """
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO loop_results
                    (participant_id, loop_number, participated, loop_type,
                     time_seconds, extras)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (participant_id, loop_number) DO UPDATE SET
                    participated = excluded.participated,
                    loop_type    = excluded.loop_type,
                    time_seconds = excluded.time_seconds,
                    extras       = excluded.extras
                """,
                (
                    participant_id,
                    loop_number,
                    int(participated),
                    loop_type,
                    time_seconds,
                    json.dumps(extras),
                ),
            )
            row = conn.execute(
                "SELECT * FROM loop_results WHERE participant_id = ? AND loop_number = ?",
                (participant_id, loop_number),
            ).fetchone()
        return self._result(row)

    def insert_result(
        self,
        *,
        participant_id: int,
        loop_number: int,
        participated: bool,
        loop_type: str | None,
        time_seconds: int | None,
        extras: dict,
    ) -> LoopResult:
        """Insert a brand-new loop result.

        Unlike :meth:`upsert_result`, this never overwrites an existing record:
        the ``UNIQUE (participant_id, loop_number)`` constraint raises
        ``sqlite3.IntegrityError`` if the loop is already recorded. Admins go
        through here, so they can only ever *add* the next loop.
        """
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO loop_results
                    (participant_id, loop_number, participated, loop_type,
                     time_seconds, extras)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    participant_id,
                    loop_number,
                    int(participated),
                    loop_type,
                    time_seconds,
                    json.dumps(extras),
                ),
            )
            row = conn.execute(
                "SELECT * FROM loop_results WHERE id = ?", (cur.lastrowid,)
            ).fetchone()
        return self._result(row)

    def recorded_loop_numbers(self, participant_id: int) -> set[int]:
        """Loop numbers already validated for a runner (participation or not)."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT loop_number FROM loop_results WHERE participant_id = ?",
                (participant_id,),
            ).fetchall()
        return {row["loop_number"] for row in rows}

    def get_result(self, result_id: int) -> LoopResult | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM loop_results WHERE id = ?", (result_id,)
            ).fetchone()
        return self._result(row) if row else None

    def list_results(self) -> list[LoopResult]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM loop_results ORDER BY participant_id, loop_number"
            ).fetchall()
        return [self._result(r) for r in rows]

    def update_result(
        self,
        result_id: int,
        *,
        participated: bool | None,
        loop_type: str | None,
        time_seconds: int | None,
        extras: dict | None,
    ) -> LoopResult | None:
        current = self.get_result(result_id)
        if current is None:
            return None
        new_participated = (
            current.participated if participated is None else participated
        )
        new_loop_type = current.loop_type if loop_type is None else loop_type
        new_time = current.time_seconds if time_seconds is None else time_seconds
        new_extras = current.extras if extras is None else extras
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE loop_results
                   SET participated = ?, loop_type = ?, time_seconds = ?, extras = ?
                 WHERE id = ?
                """,
                (
                    int(new_participated),
                    new_loop_type,
                    new_time,
                    json.dumps(new_extras),
                    result_id,
                ),
            )
        return self.get_result(result_id)

    def delete_result(self, result_id: int) -> bool:
        with self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM loop_results WHERE id = ?", (result_id,)
            )
        return cur.rowcount > 0
