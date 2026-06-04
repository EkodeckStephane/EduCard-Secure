from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.cards import router as cards_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.phase5 import router as phase5_router
from app.api.v1.students import router as students_router
from app.api.v1.users import router as users_router


app = FastAPI(title="EduCard Secure API", version="0.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(cards_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(phase5_router, prefix="/api/v1")
app.include_router(students_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
