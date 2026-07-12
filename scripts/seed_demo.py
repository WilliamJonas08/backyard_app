"""Populate the database with demo runners and loops to preview the app.

Run with the server stopped (it writes to the same SQLite file)::

    python scripts/seed_demo.py

This is purely for local testing / screenshots — never run it against real
event data.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running as a plain script (add project root to the import path).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import DATABASE_PATH, get_settings  # noqa: E402
from app.storage import Repository  # noqa: E402

# (name, [(loop_number, loop_type, minutes, seconds), ...])
DEMO = [
    ("Jean Dupont", [(1, "6.5km", 38, 12), (2, "4km", 22, 5), (3, "6.5km", 40, 30), (4, "4km", 23, 40)]),
    ("Marie Leroy", [(1, "4km", 24, 0), (2, "4km", 23, 30), (3, "4km", 24, 10), (4, "4km", 25, 0), (5, "4km", 26, 15)]),
    ("Alex Martin", [(1, "6.5km", 35, 0), (2, "6.5km", 36, 20), (3, "6.5km", 38, 45)]),
    ("Sofia Nguyen", [(1, "4km", 28, 30), (2, "6.5km", 45, 0)]),
    ("Tom Bernard", [(1, "6.5km", 42, 0), (2, "4km", 26, 0), (3, "4km", 27, 30), (4, "6.5km", 44, 10), (5, "4km", 28, 0), (6, "4km", 29, 15)]),
]


def main() -> None:
    settings = get_settings()
    repo = Repository(DATABASE_PATH)

    for name, loops in DEMO:
        participant = repo.add_participant(name)
        for loop_number, loop_type, minutes, seconds in loops:
            repo.upsert_result(
                participant_id=participant.id,
                loop_number=loop_number,
                participated=True,
                loop_type=loop_type,
                time_seconds=minutes * 60 + seconds,
                extras={},
            )
        print(f"  + {name}: {len(loops)} boucles")

    _ = settings  # touch settings so config import is validated
    print(f"\nDonnées de démo écrites dans {DATABASE_PATH}")


if __name__ == "__main__":
    main()
