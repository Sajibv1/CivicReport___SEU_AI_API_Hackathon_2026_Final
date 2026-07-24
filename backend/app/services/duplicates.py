"""Two-stage duplicate detection.
Stage 1: cheap candidate filter (category + ~300m radius + 14 days + not resolved).
Stage 2: cosine similarity of OpenAI embeddings on the survivors.
Never blocks a submission — only links it to a primary report."""

import math
from datetime import datetime, timedelta, timezone

import numpy as np
from sqlalchemy.orm import Session

from app.models import Report

RADIUS_M = 300
WINDOW_DAYS = 14
DUP_THRESHOLD = 0.80
IMAGE_DUP_THRESHOLD = 0.90


def _haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _as_valid_vector(values: list | None) -> np.ndarray | None:
    try:
        vector = np.asarray(values, dtype=float)
    except (TypeError, ValueError):
        return None
    if vector.ndim != 1 or vector.size == 0 or not np.isfinite(vector).all():
        return None
    return vector


def _cosine(left_values: list | None, right_values: list | None) -> float:
    left_vector = _as_valid_vector(left_values)
    right_vector = _as_valid_vector(right_values)
    if left_vector is None or right_vector is None or left_vector.size != right_vector.size:
        return 0.0

    denominator = float(np.linalg.norm(left_vector) * np.linalg.norm(right_vector))
    return float(np.dot(left_vector, right_vector) / denominator) if denominator else 0.0


def _image_similarity(left_hash: str | None, right_hash: str | None) -> float:
    if not left_hash or not right_hash or len(left_hash) != 16 or len(right_hash) != 16:
        return 0.0
    try:
        differing_bits = (int(left_hash, 16) ^ int(right_hash, 16)).bit_count()
    except ValueError:
        return 0.0
    return 1 - differing_bits / 64


def find_duplicate(
    db: Session,
    category_ai: str | None,
    lat: float | None,
    lng: float | None,
    embedding: list[float] | None,
    image_hash: str | None = None,
) -> tuple[int | None, float | None]:
    """Return (primary_report_id, score) of the best duplicate match, or (None, None)."""
    if not (category_ai and (embedding or image_hash)):
        return None, None

    since = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
    q = db.query(Report).filter(
        Report.category_ai == category_ai,
        Report.status != "Resolved",
        Report.created_at >= since,
        Report.is_duplicate_of.is_(None),  # only compare against primaries
    )
    candidates = q.all()

    best_id, best_score = None, 0.0
    for c in candidates:
        if lat is not None and lng is not None and c.lat is not None and c.lng is not None:
            if _haversine_m(lat, lng, c.lat, c.lng) > RADIUS_M:
                continue
        semantic_score = _cosine(embedding, c.embedding)
        image_score = _image_similarity(image_hash, c.image_hash)
        score = max(semantic_score, image_score)
        if (semantic_score >= DUP_THRESHOLD or image_score >= IMAGE_DUP_THRESHOLD) and score > best_score:
            best_id, best_score = c.id, score

    if best_id:
        return best_id, round(best_score, 3)
    return None, None
