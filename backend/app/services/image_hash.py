from io import BytesIO
from pathlib import Path

from PIL import Image
from sqlalchemy.orm import Session

from app.core.uploads import UPLOAD_DIR, image_content_type, image_extension
from app.models import Report, UploadedImage


def image_hash_for_data(content: bytes) -> str | None:
    try:
        with Image.open(BytesIO(content)) as image:
            pixels = list(image.convert("L").resize((9, 8), Image.Resampling.LANCZOS).getdata())
    except (OSError, ValueError):
        return None
    bits = 0
    for row in range(8):
        start = row * 9
        for column in range(8):
            bits = (bits << 1) | int(pixels[start + column] > pixels[start + column + 1])
    return f"{bits:016x}"


def image_hash_for_upload(db: Session, image_path: str | None) -> str | None:
    if not image_path or not image_path.startswith("/uploads/"):
        return None
    upload = db.get(UploadedImage, Path(image_path).name)
    return image_hash_for_data(upload.content) if upload else None


def migrate_local_uploads(db: Session) -> list[Path]:
    if not UPLOAD_DIR.is_dir():
        return []
    migrated = []
    for image_file in UPLOAD_DIR.iterdir():
        if not image_file.is_file():
            continue
        content = image_file.read_bytes()
        extension = image_extension(content)
        if extension and db.get(UploadedImage, image_file.name) is None:
            db.add(UploadedImage(
                file_key=image_file.name,
                content_type=image_content_type(extension),
                content=content,
            ))
        if extension:
            migrated.append(image_file)
    return migrated


def backfill_image_hashes(db: Session) -> None:
    reports = db.query(Report).filter(Report.image_url.isnot(None), Report.image_hash.is_(None)).all()
    for report in reports:
        report.image_hash = image_hash_for_upload(db, report.image_url)
