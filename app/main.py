"""FastAPI application entry point.

Wires the API routers and serves the static frontend from the same service, so
the whole app is a single deployable process. Run locally with::

    uvicorn app.main:app --reload
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

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


def _is_page_navigation(request: Request) -> bool:
    """True when a browser is opening a page (not fetching /api or an asset).

    Page navigations send an ``Accept`` header that includes ``text/html``;
    asset and API requests do not. We use that to tell them apart.
    """
    if request.method not in ("GET", "HEAD"):
        return False
    if request.url.path.startswith("/api"):
        return False
    return "text/html" in request.headers.get("accept", "")


@app.exception_handler(StarletteHTTPException)
async def serve_app_on_missing_page(request: Request, exc: StarletteHTTPException):
    """Serve the app instead of a raw JSON 404 for unknown page URLs.

    Participants reach the app from many devices and in-app browsers; some open
    a stale, cached or slightly altered URL that is neither ``/`` nor a real
    file. Without this, they would land on a blank page showing
    ``{"detail":"Not Found"}``. API and asset 404s keep their JSON response.
    """
    if exc.status_code == 404 and _is_page_navigation(request):
        return FileResponse(FRONTEND_DIR / "index.html")
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


# Serve CSS/JS assets. Mounted last so it never shadows the /api routes.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
