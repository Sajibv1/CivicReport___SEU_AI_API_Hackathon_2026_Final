from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Report
from app.routers.admin import require_admin

router = APIRouter(prefix="/api", tags=["government"])


def _counts(db: Session, column):
    return {k or "Unknown": v for k, v in db.query(column, func.count(Report.id)).group_by(column).all()}


@router.get("/analytics", dependencies=[Depends(require_admin)])
def analytics(db: Session = Depends(get_db)):
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    daily = (db.query(func.date(Report.created_at), func.count(Report.id))
             .filter(Report.created_at >= week_ago)
             .group_by(func.date(Report.created_at)).all())
    return {"success": True, "data": {
        "total": db.query(func.count(Report.id)).scalar(),
        "by_status": _counts(db, Report.status),
        "by_category": _counts(db, Report.category_ai),
        "by_severity": _counts(db, Report.severity_level),
        "duplicates_flagged": db.query(func.count(Report.id))
                                .filter(Report.is_duplicate_of.isnot(None)).scalar(),
        "last_7_days": [{"date": str(d), "count": c} for d, c in daily],
    }, "error": None}


@router.get("/analytics/status-trends", dependencies=[Depends(require_admin)])
def status_trends(
    period: str = Query("day", pattern="^(day|month|year)$"),
    db: Session = Depends(get_db),
):
    """Report creation trends by status, grouped using Bangladesh local time."""
    bangladesh = ZoneInfo("Asia/Dhaka")
    grouped: dict[str, Counter] = defaultdict(Counter)
    statuses = set()

    for created_at, report_status in db.query(Report.created_at, Report.status).all():
        report_time = created_at.replace(tzinfo=timezone.utc) if created_at.tzinfo is None else created_at
        local_time = report_time.astimezone(bangladesh)
        if period == "day":
            key = local_time.date().isoformat()
        elif period == "month":
            key = local_time.strftime("%Y-%m")
        else:
            key = str(local_time.year)
        grouped[key][report_status] += 1
        statuses.add(report_status)

    series = [{"period": key, "statuses": dict(grouped[key])} for key in sorted(grouped)]
    return {"success": True, "data": {
        "period": period,
        "statuses": sorted(statuses),
        "series": series,
    }, "error": None}
