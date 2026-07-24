from pathlib import Path


UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def image_extension(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    return None


def image_content_type(extension: str) -> str:
    return {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[extension]
