"""FastAPI application entry point.

Wires the API routers and serves the static frontend from the same service, so
the whole app is a single deployable process. Run locally with::

    uvicorn app.main:app --reload
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIR
from .dependencies import get_repository
from .routers import admin, public


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Ensure the SQLite file and schema exist before the first request.
    get_repository()
    yield


app = FastAPI(title="Backyard Race", version="1.0.0", lifespan=lifespan)

app.include_router(public.router)
app.include_router(admin.router)


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


# Serve CSS/JS assets. Mounted last so it never shadows the /api routes.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
