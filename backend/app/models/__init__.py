import secrets
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def make_report_uid() -> str:
    return f"UID-{secrets.token_hex(5).upper()}"


class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    name_bn: Mapped[str | None] = mapped_column(String(120))


class UploadedImage(Base):
    __tablename__ = "uploaded_images"
    file_key: Mapped[str] = mapped_column(String(40), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(30))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_uid: Mapped[str] = mapped_column(String(20), unique=True, index=True, default=make_report_uid)
    tracking_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text)
    category_citizen: Mapped[str | None] = mapped_column(String(40))
    category_ai: Mapped[str | None] = mapped_column(String(40))
    ai_summary: Mapped[str | None] = mapped_column(Text)
    ai_summary_bn: Mapped[str | None] = mapped_column(Text)
    ai_confidence: Mapped[float | None] = mapped_column(Float)
    severity_level: Mapped[str | None] = mapped_column(String(16))
    severity_score: Mapped[int | None] = mapped_column(Integer)
    severity_rationale: Mapped[str | None] = mapped_column(Text)
    suggested_actions: Mapped[list | None] = mapped_column(JSON)
    ai_suggested_department: Mapped[str | None] = mapped_column(String(120))
    image_url: Mapped[str | None] = mapped_column(String(500))
    image_hash: Mapped[str | None] = mapped_column(String(16), index=True)
    image_ai_note: Mapped[str | None] = mapped_column(Text)
    embedding: Mapped[list | None] = mapped_column(JSON)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(String(300))
    contact_email: Mapped[str | None] = mapped_column(String(200))  # never exposed publicly
    contact_phone: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), default="Submitted")
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    is_duplicate_of: Mapped[int | None] = mapped_column(ForeignKey("reports.id"))
    duplicate_score: Mapped[float | None] = mapped_column(Float)
    ai_status: Mapped[str] = mapped_column(String(10), default="ok")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    department = relationship("Department", lazy="joined")
    history = relationship(
        "StatusHistory", back_populates="report", order_by="StatusHistory.created_at", lazy="selectin"
    )


class StatusHistory(Base):
    __tablename__ = "status_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), index=True)
    old_status: Mapped[str | None] = mapped_column(String(30))
    new_status: Mapped[str] = mapped_column(String(30))
    note: Mapped[str | None] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    changed_by: Mapped[str] = mapped_column(String(60), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    report = relationship("Report", back_populates="history")
