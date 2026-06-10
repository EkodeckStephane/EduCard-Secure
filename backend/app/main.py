from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.cards import router as cards_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.phase5 import router as phase5_router
from app.api.v1.school_map import router as school_map_router
from app.api.v1.security_ops import router as security_ops_router
from app.api.v1.students import router as students_router
from app.api.v1.users import router as users_router
from app.api.v1.workflows_v2 import router as workflows_v2_router
from app.api.v1.volume3 import router as volume3_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
        if request.url.path in {"/docs", "/redoc"}:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "font-src 'self' https://cdn.jsdelivr.net; "
                "connect-src 'self'"
            )
        else:
            response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:"
        return response


app = FastAPI(
    title="EduCard Secure API",
    version="0.7.0",
    description=(
        "API locale EduCard Secure. Utilisez POST /api/v1/auth/login avant les routes protegees. "
        "Pour les operations d'ecriture, recopiez le csrf_token retourne dans le parametre "
        "X-CSRF-Token affiche par Swagger."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters={
        "displayRequestDuration": True,
        "filter": True,
        "persistAuthorization": True,
        "tryItOutEnabled": True,
    },
)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_code(status_code: int, detail: object) -> str:
    if status_code == 409 and isinstance(detail, dict) and "current_record" in detail:
        return "RECORD_VERSION_CONFLICT"
    return {
        400: "BAD_REQUEST",
        401: "AUTHENTICATION_REQUIRED",
        403: "ACCESS_DENIED",
        404: "NOT_FOUND",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        415: "UNSUPPORTED_MEDIA_TYPE",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
    }.get(status_code, f"HTTP_{status_code}")


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": _error_code(exc.status_code, exc.detail)},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": exc.errors(), "code": "VALIDATION_ERROR"}),
    )


app.include_router(auth_router, prefix="/api/v1")
app.include_router(cards_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(phase5_router, prefix="/api/v1")
app.include_router(school_map_router, prefix="/api/v1")
app.include_router(security_ops_router, prefix="/api/v1")
app.include_router(students_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(workflows_v2_router, prefix="/api/v1")
app.include_router(volume3_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
