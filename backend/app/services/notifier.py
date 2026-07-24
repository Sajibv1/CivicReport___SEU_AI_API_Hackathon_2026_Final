"""Email notification on status change (bonus). Fail-silent by design —
a broken SMTP config must never break a status update."""

import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_status_email(to: str, tracking_code: str, new_status: str, note: str | None) -> None:
    if not (settings.SMTP_HOST and settings.SMTP_USER and to):
        return
    try:
        msg = EmailMessage()
        msg["Subject"] = f"[CivicReport] {tracking_code} is now: {new_status}"
        msg["From"] = settings.SMTP_USER
        msg["To"] = to
        body = f"Your report {tracking_code} status changed to {new_status}."
        if note:
            body += f"\n\nUpdate from the department:\n{note}"
        body += f"\n\nTrack it any time using your tracking code."
        msg.set_content(body)
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as s:
            s.starttls()
            s.login(settings.SMTP_USER, settings.SMTP_PASS)
            s.send_message(msg)
    except Exception:
        pass
