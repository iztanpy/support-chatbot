from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import uvicorn
import os

from database import init_db
from routers import chat, config, mistakes, logs, workflows, mock, versions, documents

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Support Bot API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routes ────────────────────────────────────────────────────────────────
app.include_router(chat.router,      prefix="/api/chat",      tags=["chat"])
app.include_router(config.router,    prefix="/api/config",    tags=["config"])
app.include_router(mistakes.router,  prefix="/api/mistakes",  tags=["mistakes"])
app.include_router(logs.router,      prefix="/api/logs",      tags=["logs"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(versions.router,  prefix="/api/versions",  tags=["versions"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(mock.router,      prefix="/mock",          tags=["mock"])

@app.get("/api/health")
def health():
    return {"status": "ok"}

# ── Serve React frontend (must come after all API routes) ─────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    # Serve JS/CSS/media assets
    app.mount(
        "/static",
        StaticFiles(directory=os.path.join(STATIC_DIR, "static")),
        name="assets"
    )

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Catch-all: return index.html for every non-API path (supports React Router)."""
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
