from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.core.ws_manager import manager
from app.database import (
    Base, SessionLocal, engine, ensure_report_ai_suggested_department_column,
    ensure_report_image_hash_column, ensure_report_uid_column,
)
from app.routers import admin, analytics, reports, transcriptions, uploads
from app.services.image_hash import backfill_image_hashes, migrate_local_uploads

app = FastAPI(title="CivicReport API", version="1.0.0")

app.add_middleware(  # dev convenience; same-origin behind nginx in prod
    CORSMiddleware, allow_origins=["http://localhost:5173"],
    allow_methods=["*"], allow_headers=["*"],
)

FIELD_LABELS = {
    "description": "Description",
    "category_citizen": "Category",
    "address": "Address",
    "image_path": "Photo",
    "contact_email": "Email address",
    "contact_phone": "Phone number",
    "lat": "Location latitude",
    "lng": "Location longitude",
    "image": "Photo",
    "audio": "Voice recording",
}


def validation_message(errors: list[dict]) -> str:
    if not errors:
        return "Please review the submitted information."

    error = errors[0]
    field = next((str(part) for part in reversed(error.get("loc", [])) if isinstance(part, str)), "request")
    label = FIELD_LABELS.get(field, "Request")
    error_type = error.get("type", "")
    context = error.get("ctx", {})

    if error_type == "missing":
        return f"{label} is required."
    if error_type == "string_too_short":
        return f"{label} must contain at least {context.get('min_length')} characters."
    if error_type == "string_too_long":
        return f"{label} must be {context.get('max_length')} characters or fewer."
    if error_type == "string_pattern_mismatch":
        return "Photo must be a JPEG, PNG, or WebP file uploaded from this form."
    if field == "contact_email":
        return "Enter a valid email address, for example name@example.com."
    if field == "contact_phone":
        return "Enter a valid Bangladesh mobile number with an operator prefix from 013 to 019."
    if field in {"lat", "lng"}:
        return "Choose a valid incident location on the map or use your current GPS location."
    if field == "audio":
        return "Choose a supported voice recording that is 25 MB or smaller."
    return f"{label}: {error.get('msg', 'is invalid.')}"


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_report_uid_column()
    ensure_report_image_hash_column()
    ensure_report_ai_suggested_department_column()
    db = SessionLocal()
    migrated_files = []
    try:
        migrated_files = migrate_local_uploads(db)
        backfill_image_hashes(db)
        db.commit()
    finally:
        db.close()
    for image_file in migrated_files:
        image_file.unlink(missing_ok=True)


# ---- consistent error envelope with correct HTTP status codes (graded) ----

@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code,
                        content={"success": False, "data": None,
                                 "error": {"code": exc.status_code, "message": exc.detail}})


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(request: Request, exc: RequestValidationError):
    details = jsonable_encoder(exc.errors())
    return JSONResponse(status_code=422,
                        content={"success": False, "data": None,
                                 "error": {"code": 422, "message": validation_message(exc.errors()),
                                           "details": details}})


@app.exception_handler(Exception)
async def unhandled_exc_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500,
                        content={"success": False, "data": None,
                                 "error": {"code": 500, "message": "Internal server error."}})


app.include_router(reports.router)
app.include_router(uploads.router)
app.include_router(uploads.assets_router)
app.include_router(transcriptions.router)
app.include_router(admin.router)
app.include_router(analytics.router)


@app.websocket("/ws/dashboard")
async def dashboard_ws(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keepalive; we only broadcast
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.get("/api/health")
def health():
    return {"success": True, "data": {"status": "ok"}, "error": None}
