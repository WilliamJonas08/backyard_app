"""Deliberately minimal password gate.

The brief asks for the simplest possible access control: a hard-coded password
per role, checked against a request header. No accounts, no sessions, no JWT.
:func:`hmac.compare_digest` is used so the comparison is not trivially timeable.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from .config import get_settings


def _check(provided: str | None, expected: str) -> bool:
    return bool(provided) and hmac.compare_digest(provided, expected)


def require_admin(x_admin_password: str | None = Header(default=None)) -> None:
    """FastAPI dependency guarding admin-only endpoints."""
    if not _check(x_admin_password, get_settings().admin_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe admin invalide.",
        )


def require_superadmin(
    x_superadmin_password: str | None = Header(default=None),
) -> None:
    """FastAPI dependency guarding super-admin-only endpoints."""
    if not _check(x_superadmin_password, get_settings().superadmin_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe super-admin invalide.",
        )
