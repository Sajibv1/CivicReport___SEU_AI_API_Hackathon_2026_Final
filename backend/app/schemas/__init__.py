import re
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, field_validator

BANGLADESH_MOBILE_NUMBER = re.compile(r"^(?:\+880|880|0)1[3-9]\d{8}$")


# ---------- AI structured output (enforced by OpenAI + re-validated by Pydantic) ----------

class Category(str, Enum):
    pothole = "Pothole"
    streetlight = "Broken Streetlight"
    water_leak = "Water Leak"
    illegal_dumping = "Illegal Dumping"
    other = "Other"


class SeverityLevel(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    critical = "Critical"


class ReportAnalysis(BaseModel):
    category: Category
    summary: str
    summary_bn: str
    confidence: float
    severity_level: SeverityLevel
    severity_score: int
    severity_rationale: str
    suggested_department: str
    suggested_actions: list[str]
    image_matches_description: bool | None


# ---------- API request/response ----------

class GovernmentLogin(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class GovernmentSession(BaseModel):
    access_token: str
    expires_in: int


class ReportCreate(BaseModel):
    description: str = Field(min_length=10, max_length=4000)
    category_citizen: Category | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = Field(default=None, max_length=300)
    image_path: str | None = Field(default=None, max_length=80, pattern=r"^/uploads/[0-9a-f]{32}\.(jpg|png|webp)$")
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)

    @field_validator("contact_phone")
    @classmethod
    def validate_bangladesh_mobile(cls, value: str | None) -> str | None:
        if not value:
            return None
        normalized = re.sub(r"[\s-]", "", value)
        if not BANGLADESH_MOBILE_NUMBER.fullmatch(normalized):
            raise ValueError("must be a valid Bangladesh mobile number with an operator prefix from 013 to 019")
        if normalized.startswith("0"):
            return f"+880{normalized[1:]}"
        return normalized if normalized.startswith("+") else f"+{normalized}"


class StatusUpdate(BaseModel):
    status: str | None = None
    department_id: int | None = None
    note: str | None = Field(default=None, max_length=2000)
    is_public: bool = True


class DuplicateLinkUpdate(BaseModel):
    original_report_id: int | None = Field(default=None, ge=1)


class HistoryOut(BaseModel):
    old_status: str | None
    new_status: str
    note: str | None
    is_public: bool
    changed_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentOut(BaseModel):
    id: int
    name: str
    name_bn: str | None

    model_config = {"from_attributes": True}


class PublicReportOut(BaseModel):
    """Citizen tracking view — NO contact fields, only public notes."""
    tracking_code: str
    description: str
    status: str
    department: DepartmentOut | None
    created_at: datetime
    history: list[HistoryOut]
    original_tracking_code: str | None = None

    model_config = {"from_attributes": True}


class AdminReportOut(PublicReportOut):
    id: int
    report_uid: str
    category_citizen: str | None
    category_ai: str | None
    ai_summary: str | None
    ai_summary_bn: str | None
    ai_confidence: float | None
    severity_level: str | None
    severity_score: int | None
    severity_rationale: str | None
    suggested_actions: list[str] | None
    ai_suggested_department: str | None
    image_url: str | None
    image_ai_note: str | None
    lat: float | None
    lng: float | None
    address: str | None
    contact_email: str | None
    contact_phone: str | None
    department_id: int | None
    is_duplicate_of: int | None
    duplicate_score: float | None
    ai_status: str
