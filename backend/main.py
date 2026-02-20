from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import export

app = FastAPI(title="Broadcast Tracking System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # デプロイ時に Vercel URL に絞る
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(export.router, prefix="/api/export")


@app.get("/api/health")
def health():
    return {"status": "ok"}
