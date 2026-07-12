"""Application configuration.

Everything that an organiser might want to tweak for their edition of the race
lives here (or is overridable through environment variables). Keeping it in a
single, well-typed place makes the app easy to read and re-use next year.
"""

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

# Project layout -------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("BACKYARD_DATA_DIR", BASE_DIR / "data"))
FRONTEND_DIR = BASE_DIR / "frontend"
DATABASE_PATH = DATA_DIR / "backyard.db"


class LoopType(BaseModel):
    """A kind of loop a runner can complete (e.g. the short or the long one)."""

    key: str
    label: str
    distance_km: float
    map_id: str | None = None   # calculitineraires.fr route id, used to embed the course map (optional).


class EventConfig(BaseModel):
    """Static description of the event, exposed to the frontend via /api/event."""

    name: str
    subtitle: str
    max_loops: int
    loop_types: list[LoopType]
    presentation: str
    todolist: list[str]

    def distance_for(self, loop_key: str | None) -> float:
        """Return the distance (km) for a loop key, or 0 when no loop was run."""
        if not loop_key:
            return 0.0
        for loop in self.loop_types:
            if loop.key == loop_key:
                return loop.distance_km
        raise ValueError(f"Unknown loop type: {loop_key!r}")

    @property
    def loop_keys(self) -> set[str]:
        return {loop.key for loop in self.loop_types}


class Settings(BaseModel):
    """Runtime settings. Passwords come from the environment (never committed)."""

    admin_password: str
    superadmin_password: str
    event: EventConfig


# Default event definition ---------------------------------------------------
# Edit these values to configure the race. Passwords are read from env vars so
# they stay out of source control (see .env.example / PERSONAL_TODO.md).
DEFAULT_EVENT = EventConfig(
    name="Backyard",
    subtitle="1ère édition ❤️",
    max_loops=10,
    loop_types=[
        LoopType(key="4km", label="Petit mollet (4 km)", distance_km=4.0, map_id="1597475"),
        LoopType(key="6.5km", label="Gros mollet (6,5 km)", distance_km=6.5, map_id="1597473"),
    ],
    presentation=(
        "Bienvenue à la Backyard ! Le principe est simple : une journée conviviale et sportive entre copains avec un départ sur une boucle à chaque heure, jusqu'à 10 boucles ! "
        "Tu choisis initialement ta boucle au début de l'évènement (petit ou gros mollet) et tu pourras éventuellement changer ou te reposer à certains moments. " 
        "À toi de gérer ton effort et de grimper au classement au fil de la journée !"
    ),
    todolist=[
        "Inscris-toi avec ton prénom et nom.",
        "Au top de chaque heure, pars pour ta boucle (ou repose-toi).",
        "À la fin de ta boucle, va voir un·e 'admin' avec ton temps et ta boucle.",
        "L'admin enregistre ton résultat : suis le classement en live !",
    ],
)


@lru_cache
def get_settings() -> Settings:
    """Load settings once. Passwords fall back to dev defaults if unset."""
    return Settings(
        admin_password=os.getenv("ADMIN_PASSWORD", "admin"),
        superadmin_password=os.getenv("SUPERADMIN_PASSWORD", "superadmin"),
        event=DEFAULT_EVENT,
    )
