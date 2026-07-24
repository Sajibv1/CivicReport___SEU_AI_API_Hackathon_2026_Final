import secrets
import string
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.ws_manager import manager
from app.database import get_db
from app.models import Department, Report, StatusHistory
from app.schemas import PublicReportOut, ReportCreate
from app.services.ai_analyzer import analyze_report, get_embedding
from app.services.duplicates import find_duplicate
from app.services.image_hash import image_hash_for_upload

router = APIRouter(prefix="/api", tags=["citizen"])

ALPHABET = string.ascii_uppercase + string.digits


def make_tracking_code(db: Session) -> str:
    while True:
        code = "CVR-" + "".join(secrets.choice(ALPHABET) for _ in range(6))
        if not db.query(Report).filter_by(tracking_code=code).first():
            return code


def make_report_uid(db: Session) -> str:
    while True:
        uid = "UID-" + "".join(secrets.choice(ALPHABET) for _ in range(10))
        if not db.query(Report).filter_by(report_uid=uid).first():
            return uid


@router.post("/reports", status_code=201)
async def submit_report(payload: ReportCreate, db: Session = Depends(get_db)):
    analysis = analyze_report(
        payload.description,
        payload.category_citizen.value if payload.category_citizen else None,
        payload.address or (f"{payload.lat},{payload.lng}" if payload.lat else None),
        None,
    )
    embedding = get_embedding(payload.description)
    image_hash = image_hash_for_upload(db, payload.image_path)

    report = Report(
        report_uid=make_report_uid(db),
        tracking_code=make_tracking_code(db),
        description=payload.description,
        category_citizen=payload.category_citizen.value if payload.category_citizen else None,
        lat=payload.lat,
        lng=payload.lng,
        address=payload.address,
        image_url=payload.image_path,
        image_hash=image_hash,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        embedding=embedding,
    )

    if analysis:  # AI succeeded — store validated structured data
        report.category_ai = analysis.category.value
        report.ai_summary = analysis.summary
        report.ai_summary_bn = analysis.summary_bn
        report.ai_confidence = analysis.confidence
        report.severity_level = analysis.severity_level.value
        report.severity_score = analysis.severity_score
        report.severity_rationale = analysis.severity_rationale
        report.suggested_actions = analysis.suggested_actions
        report.ai_suggested_department = analysis.suggested_department
        suggested_department = db.query(Department).filter_by(name=analysis.suggested_department).first()
        if suggested_department:
            report.department_id = suggested_department.id
        if analysis.image_matches_description is not None:
            report.image_ai_note = (
                "Image appears consistent with the description."
                if analysis.image_matches_description
                else "Image may NOT match the description — verify manually."
            )
        report.ai_status = "ok"
    else:  # graceful fallback — never lose a submission
        report.category_ai = report.category_citizen or "Other"
        report.severity_level = "Medium"
        report.severity_rationale = "Pending AI review — default severity assigned."
        report.ai_status = "failed"

    dup_id, dup_score = find_duplicate(
        db, report.category_ai, report.lat, report.lng, embedding, image_hash
    )
    report.is_duplicate_of = dup_id
    report.duplicate_score = dup_score
    original_report = db.get(Report, dup_id) if dup_id else None

    db.add(report)
    db.flush()
    db.add(StatusHistory(report_id=report.id, old_status=None, new_status="Submitted",
                         note="Report received.", changed_by="system"))
    db.commit()
    db.refresh(report)

    await manager.broadcast("report.created", {
        "id": report.id, "tracking_code": report.tracking_code,
        "category": report.category_ai, "severity": report.severity_level,
        "is_duplicate": dup_id is not None,
    })

    reported_at_value = report.created_at
    if reported_at_value.tzinfo is None:
        reported_at_value = reported_at_value.replace(tzinfo=timezone.utc)
    else:
        reported_at_value = reported_at_value.astimezone(timezone.utc)
    reported_at = reported_at_value.isoformat()
    return {"success": True, "data": {"tracking_code": report.tracking_code,
                                      "possible_duplicate": dup_id is not None,
                                      "original_tracking_code": original_report.tracking_code if original_report else None,
                                      "reported_at": reported_at}, "error": None}


@router.get("/track/{code}")
def track_report(code: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter_by(tracking_code=code.upper().strip()).first()
    if not report:
        raise HTTPException(404, "No report found for this tracking code.")
    out = PublicReportOut.model_validate(report)
    out.history = [h for h in out.history if h.is_public]  # privacy: public notes only
    if report.is_duplicate_of:
        original_report = db.get(Report, report.is_duplicate_of)
        out.original_tracking_code = original_report.tracking_code if original_report else None
    return {"success": True, "data": out, "error": None}
