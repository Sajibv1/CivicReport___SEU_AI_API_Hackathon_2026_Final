"""Seed departments + a few demo reports (no AI calls — safe without a key).
Run: python -m app.seed"""

from app.database import Base, SessionLocal, engine
from app.models import Department, Report, StatusHistory

DEPARTMENTS = [
    ("Roads & Highways", "সড়ক ও জনপথ"),
    ("Dhaka WASA", "ঢাকা ওয়াসা"),
    ("DESCO", "ডেসকো"),
    ("City Corporation Waste Management", "সিটি কর্পোরেশন বর্জ্য ব্যবস্থাপনা"),
    ("General Administration", "সাধারণ প্রশাসন"),
]

DEMO = [
    dict(tracking_code="CVR-DEMO01", description="Large pothole near Dhanmondi 27 main road, rickshaws tipping over.",
         category_ai="Pothole", severity_level="High", severity_score=78,
         severity_rationale="Main road, active traffic hazard.", lat=23.7550, lng=90.3740,
         address="Dhanmondi 27, Dhaka", status="Assigned", department_id=1),
    dict(tracking_code="CVR-DEMO02", description="Streetlight dead for a week beside a school gate in Mirpur 10.",
         category_ai="Broken Streetlight", severity_level="Critical", severity_score=88,
         severity_rationale="Darkness at a school entrance — child safety risk.", lat=23.8069, lng=90.3687,
         address="Mirpur 10, Dhaka", status="In Progress", department_id=3),
    dict(tracking_code="CVR-DEMO03", description="Water leaking from a burst pipe flooding the alley in Uttara sector 4.",
         category_ai="Water Leak", severity_level="Medium", severity_score=55,
         severity_rationale="Water waste and localized flooding.", lat=23.8646, lng=90.4004,
         address="Uttara Sector 4, Dhaka", status="Submitted"),
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(Department).first():
            for name, bn in DEPARTMENTS:
                db.add(Department(name=name, name_bn=bn))
            db.commit()
        if not db.query(Report).first():
            for d in DEMO:
                r = Report(**d)
                db.add(r)
                db.flush()
                db.add(StatusHistory(report_id=r.id, old_status=None,
                                     new_status="Submitted", note="Report received.",
                                     changed_by="system"))
                if r.status != "Submitted":
                    db.add(StatusHistory(report_id=r.id, old_status="Submitted",
                                         new_status=r.status, note="Processed by department.",
                                         changed_by="official"))
            db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
