from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.auth import create_session_token, credentials_match, verify_session_token
from app.core.ws_manager import manager
from app.database import get_db
from app.models import Department, Report, StatusHistory
from app.schemas import AdminReportOut, DepartmentOut, DuplicateLinkUpdate, GovernmentLogin, GovernmentSession, StatusUpdate
from app.services.ai_analyzer import analyze_report
from app.services.notifier import send_status_email

router = APIRouter(prefix="/api", tags=["government"])

VALID_STATUSES = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Rejected"]
bearer_scheme = HTTPBearer(auto_error=False)


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    token = credentials.credentials if credentials and credentials.scheme.lower() == "bearer" else ""
    if not verify_session_token(token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.")


@router.post("/auth/login")
def login(payload: GovernmentLogin):
    if not credentials_match(payload.username, payload.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password.")
    token = create_session_token(payload.username)
    session = GovernmentSession(
        access_token=token,
        expires_in=settings.AUTH_TOKEN_TTL_MINUTES * 60,
    )
    return {"success": True, "data": session, "error": None}


@router.get("/departments")
def list_departments(db: Session = Depends(get_db)):
    depts = db.query(Department).all()
    return {"success": True, "data": [DepartmentOut.model_validate(d) for d in depts], "error": None}


@router.get("/reports", dependencies=[Depends(require_admin)])
def list_reports(
    db: Session = Depends(get_db),
    category: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    department_id: int | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = db.query(Report)
    if category:
        query = query.filter(Report.category_ai == category)
    if severity:
        query = query.filter(Report.severity_level == severity)
    if status:
        query = query.filter(Report.status == status)
    else:
        query = query.filter(Report.status.notin_(["Resolved", "Rejected"]))
    if department_id:
        query = query.filter(Report.department_id == department_id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Report.description.ilike(like),
                                 Report.address.ilike(like),
                                 Report.report_uid.ilike(like),
                                 Report.tracking_code.ilike(like)))
    total = query.count()
    rows = (query.order_by(Report.severity_score.desc().nullslast(), Report.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size).all())
    return {"success": True,
            "data": {"total": total, "page": page,
                     "items": [AdminReportOut.model_validate(r) for r in rows]},
            "error": None}


@router.get("/reports/{report_id}", dependencies=[Depends(require_admin)])
def report_detail(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    duplicates = db.query(Report).filter(Report.is_duplicate_of == report_id).all()
    return {"success": True,
            "data": {"report": AdminReportOut.model_validate(report),
                     "linked_duplicates": [AdminReportOut.model_validate(d) for d in duplicates]},
            "error": None}


@router.patch("/reports/{report_id}", dependencies=[Depends(require_admin)])
async def update_report(report_id: int, payload: StatusUpdate,
                        background: BackgroundTasks, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    if payload.status and payload.status not in VALID_STATUSES:
        raise HTTPException(422, f"Invalid status. Allowed: {VALID_STATUSES}")

    if payload.department_id is not None:
        if not db.get(Department, payload.department_id):
            raise HTTPException(422, "Unknown department_id.")
        report.department_id = payload.department_id

    if payload.status and payload.status != report.status:
        old = report.status
        report.status = payload.status
        db.add(StatusHistory(report_id=report.id, old_status=old, new_status=payload.status,
                             note=payload.note, is_public=payload.is_public, changed_by="official"))
        if report.contact_email:
            background.add_task(send_status_email, report.contact_email,
                                report.tracking_code, payload.status,
                                payload.note if payload.is_public else None)
    elif payload.note:  # note without status change
        db.add(StatusHistory(report_id=report.id, old_status=report.status,
                             new_status=report.status, note=payload.note,
                             is_public=payload.is_public, changed_by="official"))

    db.commit()
    db.refresh(report)
    await manager.broadcast("report.updated", {"id": report.id, "status": report.status})
    return {"success": True, "data": AdminReportOut.model_validate(report), "error": None}


@router.patch("/reports/{report_id}/duplicate-link", dependencies=[Depends(require_admin)])
async def update_duplicate_link(report_id: int, payload: DuplicateLinkUpdate, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")

    if payload.original_report_id is not None:
        if payload.original_report_id == report.id:
            raise HTTPException(422, "A report cannot be linked to itself.")
        original_report = db.get(Report, payload.original_report_id)
        if not original_report:
            raise HTTPException(422, "Original report not found.")
        if original_report.is_duplicate_of is not None:
            raise HTTPException(422, "Choose a primary report, not another duplicate.")
        report.is_duplicate_of = original_report.id
        report.duplicate_score = None
    else:
        report.is_duplicate_of = None
        report.duplicate_score = None

    db.commit()
    db.refresh(report)
    await manager.broadcast("report.updated", {"id": report.id, "status": report.status})
    return {"success": True, "data": AdminReportOut.model_validate(report), "error": None}


@router.post("/reports/{report_id}/reanalyze", dependencies=[Depends(require_admin)])
async def reanalyze(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    analysis = analyze_report(report.description, report.category_citizen,
                              report.address, report.image_url)
    if not analysis:
        raise HTTPException(503, "AI service unavailable — try again shortly.")
    report.category_ai = analysis.category.value
    report.ai_summary = analysis.summary
    report.ai_summary_bn = analysis.summary_bn
    report.ai_confidence = analysis.confidence
    report.severity_level = analysis.severity_level.value
    report.severity_score = analysis.severity_score
    report.severity_rationale = analysis.severity_rationale
    report.suggested_actions = analysis.suggested_actions
    report.ai_status = "ok"
    db.commit()
    await manager.broadcast("report.updated", {"id": report.id, "status": report.status})
    return {"success": True, "data": AdminReportOut.model_validate(report), "error": None}
