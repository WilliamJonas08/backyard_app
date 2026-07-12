"""Shared FastAPI dependencies (wiring layer)."""

from __future__ import annotations

from functools import lru_cache

from .config import DATABASE_PATH, EventConfig, get_settings
from .storage import Repository


@lru_cache
def get_repository() -> Repository:
    """Return the process-wide repository (one SQLite file, one instance)."""
    return Repository(DATABASE_PATH)


def get_event() -> EventConfig:
    return get_settings().event
