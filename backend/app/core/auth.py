import base64
import hashlib
import hmac
import json
import time

from app.core.config import settings


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def credentials_match(username: str, password: str) -> bool:
    return (
        hmac.compare_digest(username, settings.GOVERNMENT_USERNAME)
        and hmac.compare_digest(password, settings.GOVERNMENT_PASSWORD)
    )


def create_session_token(username: str) -> str:
    payload = json.dumps(
        {
            "sub": username,
            "exp": int(time.time()) + settings.AUTH_TOKEN_TTL_MINUTES * 60,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    signature = hmac.new(settings.AUTH_SECRET.encode(), payload, hashlib.sha256).digest()
    return f"{_encode(payload)}.{_encode(signature)}"


def verify_session_token(token: str) -> str | None:
    try:
        payload_part, signature_part = token.split(".", 1)
        payload = _decode(payload_part)
        supplied_signature = _decode(signature_part)
        expected_signature = hmac.new(settings.AUTH_SECRET.encode(), payload, hashlib.sha256).digest()
        data = json.loads(payload)
    except (TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None

    if not hmac.compare_digest(supplied_signature, expected_signature):
        return None
    if data.get("sub") != settings.GOVERNMENT_USERNAME or data.get("exp", 0) < time.time():
        return None
    return data["sub"]
