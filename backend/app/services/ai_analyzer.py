"""OpenAI analysis + embeddings. Every call is fail-safe: a submission is
never lost because the AI layer errored (Error Handling requirement)."""

from openai import OpenAI

from app.core.config import settings
from app.schemas import ReportAnalysis

MODEL = "gpt-4o-mini"
EMBED_MODEL = "text-embedding-3-small"

SYSTEM_PROMPT = """You are an AI analyst for a civic infrastructure reporting platform in Bangladesh.
The citizen's description may be in Bangla, English, or Banglish.

Tasks:
1. Assign the correct issue category. Override the citizen's selection if it is clearly wrong.
2. Write a concise 1-2 sentence summary for government officials in English (summary)
   and in Bangla (summary_bn).
3. Set confidence in [0,1] for your categorization.
4. Rate severity (level + score 1-100 + rationale). Weigh: public safety risk, service impact,
   scale, immediate danger, and proximity to sensitive areas (schools, hospitals, main roads)
   if mentioned. The rationale must reference these factors explicitly.
5. Recommend the responsible department, exactly one of:
   "Roads & Highways", "Dhaka WASA", "DESCO", "City Corporation Waste Management",
   "General Administration".
6. Suggest 2-4 concrete resolution actions.
7. If an image is provided, set image_matches_description; otherwise null."""


def _client() -> OpenAI:
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def analyze_report(
    description: str,
    citizen_category: str | None,
    location: str | None,
    image_url: str | None = None,
) -> ReportAnalysis | None:
    user_text = (
        f"Citizen-selected category: {citizen_category or 'none'}\n"
        f"Location: {location or 'not provided'}\n"
        f"Description: {description}"
    )
    content: list[dict] = [{"type": "text", "text": user_text}]
    if image_url and image_url.startswith(("http://", "https://")):
        content.append({"type": "image_url", "image_url": {"url": image_url}})
    try:
        completion = _client().chat.completions.parse(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ],
            response_format=ReportAnalysis,
            timeout=20,
        )
        return completion.choices[0].message.parsed
    except Exception:
        return None  # caller applies fallback + ai_status="failed"


def get_embedding(text: str) -> list[float] | None:
    try:
        resp = _client().embeddings.create(model=EMBED_MODEL, input=text[:8000], timeout=15)
        return resp.data[0].embedding
    except Exception:
        return None
