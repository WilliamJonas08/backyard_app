"""Admin and super-admin endpoints.

* Admins (``X-Admin-Password``) record a runner's loop result.
* Super-admins (``X-Superadmin-Password``) can additionally correct or delete
  existing records and edit participants — for fixing data-entry mistakes.

There is also a lightweight ``/auth/check`` endpoint the frontend calls to
verify a password before revealing the admin UI.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import require_admin, require_superadmin
from ..config import EventConfig
from ..dependencies import get_event, get_repository
from ..models import (
    LoopResult,
    LoopResultIn,
    LoopResultUpdateIn,
    Participant,
    ParticipantUpdateIn,
)
from ..storage import Repository

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _validate_loop(payload_loop_type: str | None, participated: bool, event: EventConfig) -> None:
    if participated:
        if payload_loop_type not in event.loop_keys:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Type de boucle invalide. Attendu: {sorted(event.loop_keys)}.",
            )


# Auth check ----------------------------------------------------------------
@router.get("/auth/check", dependencies=[Depends(require_admin)])
def check_admin() -> dict[str, bool]:
    """Return 200 if the admin password header is valid (else 401)."""
    return {"ok": True}


@router.get("/auth/check-super", dependencies=[Depends(require_superadmin)])
def check_superadmin() -> dict[str, bool]:
    return {"ok": True}


# Admin: record a loop result ----------------------------------------------
@router.post(
    "/results",
    response_model=LoopResult,
    dependencies=[Depends(require_admin)],
)
def record_result(
    payload: LoopResultIn,
    repo: Repository = Depends(get_repository),
    event: EventConfig = Depends(get_event),
) -> LoopResult:
    if repo.get_participant(payload.participant_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Participant introuvable.")
    if payload.loop_number > event.max_loops:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Numéro de boucle max = {event.max_loops}.",
        )
    _validate_loop(payload.loop_type, payload.participated, event)

    # A non-participation is stored with no loop/time so the series skips it.
    loop_type = payload.loop_type if payload.participated else None
    time_seconds = payload.time_seconds if payload.participated else None
    return repo.upsert_result(
        participant_id=payload.participant_id,
        loop_number=payload.loop_number,
        participated=payload.participated,
        loop_type=loop_type,
        time_seconds=time_seconds,
        extras=payload.extras,
    )


# Super-admin: correct / delete records ------------------------------------
@router.put(
    "/results/{result_id}",
    response_model=LoopResult,
    dependencies=[Depends(require_superadmin)],
)
def update_result(
    result_id: int,
    payload: LoopResultUpdateIn,
    repo: Repository = Depends(get_repository),
    event: EventConfig = Depends(get_event),
) -> LoopResult:
    current = repo.get_result(result_id)
    if current is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résultat introuvable.")
    participated = (
        current.participated if payload.participated is None else payload.participated
    )
    loop_type = current.loop_type if payload.loop_type is None else payload.loop_type
    _validate_loop(loop_type, participated, event)

    updated = repo.update_result(
        result_id,
        participated=payload.participated,
        loop_type=payload.loop_type,
        time_seconds=payload.time_seconds,
        extras=payload.extras,
    )
    assert updated is not None  # existence checked above
    return updated


@router.delete(
    "/results/{result_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_superadmin)],
)
def delete_result(
    result_id: int,
    repo: Repository = Depends(get_repository),
) -> None:
    if not repo.delete_result(result_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Résultat introuvable.")


@router.get(
    "/results",
    response_model=list[LoopResult],
    dependencies=[Depends(require_admin)],
)
def list_results(repo: Repository = Depends(get_repository)) -> list[LoopResult]:
    """All raw records — used by the admin/super-admin editing views."""
    return repo.list_results()


@router.put(
    "/participants/{participant_id}",
    response_model=Participant,
    dependencies=[Depends(require_superadmin)],
)
def update_participant(
    participant_id: int,
    payload: ParticipantUpdateIn,
    repo: Repository = Depends(get_repository),
) -> Participant:
    updated = repo.update_participant(
        participant_id, name=payload.name, initials=payload.initials
    )
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Participant introuvable.")
    return updated
