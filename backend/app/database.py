from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def ensure_report_uid_column() -> None:
    inspector = inspect(engine)
    if "reports" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("reports")}
    with engine.begin() as connection:
        if "report_uid" not in columns:
            connection.execute(text("ALTER TABLE reports ADD COLUMN report_uid VARCHAR(20)"))

        missing_ids = connection.execute(
            text("SELECT id FROM reports WHERE report_uid IS NULL OR report_uid = ''")
        ).scalars()
        for report_id in missing_ids:
            connection.execute(
                text("UPDATE reports SET report_uid = :report_uid WHERE id = :report_id"),
                {"report_uid": f"UID-{report_id:08d}", "report_id": report_id},
            )
        connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_report_uid ON reports (report_uid)")
        )


def ensure_report_image_hash_column() -> None:
    inspector = inspect(engine)
    if "reports" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("reports")}
    with engine.begin() as connection:
        if "image_hash" not in columns:
            connection.execute(text("ALTER TABLE reports ADD COLUMN image_hash VARCHAR(16)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_reports_image_hash ON reports (image_hash)"))


def ensure_report_ai_suggested_department_column() -> None:
    inspector = inspect(engine)
    if "reports" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("reports")}
    if "ai_suggested_department" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE reports ADD COLUMN ai_suggested_department VARCHAR(120)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
