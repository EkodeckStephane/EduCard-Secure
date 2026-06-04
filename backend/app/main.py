from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.cards import router as cards_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.phase5 import router as phase5_router
from app.api.v1.security_ops import router as security_ops_router
from app.api.v1.students import router as students_router
from app.api.v1.users import router as users_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response


app = FastAPI(title="EduCard Secure API", version="0.7.0")
app.add_middleware(SecurityHeadersMiddleware)

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
app.include_router(security_ops_router, prefix="/api/v1")
app.include_router(students_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
