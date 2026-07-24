from openai import OpenAI

from app.core.config import settings


TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"


def transcribe_audio(filename: str, content: bytes, content_type: str) -> str | None:
    if not settings.OPENAI_API_KEY:
        return None
    try:
        transcription = OpenAI(api_key=settings.OPENAI_API_KEY).audio.transcriptions.create(
            model=TRANSCRIPTION_MODEL,
            file=(filename, content, content_type),
            prompt="The speaker may use Bangla, English, or Banglish. Transcribe faithfully.",
        )
        return transcription.text.strip() or None
    except Exception:
        return None
