from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.services.transcriber import transcribe_audio

router = APIRouter(prefix="/api", tags=["citizen"])

MAX_AUDIO_BYTES = 25 * 1024 * 1024
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
}


@router.post("/transcriptions")
async def create_transcription(audio: UploadFile = File(...)):
    content_type = (audio.content_type or "").split(";", 1)[0].lower()
    if content_type not in ALLOWED_AUDIO_TYPES:
        await audio.close()
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported audio format.")

    content = await audio.read(MAX_AUDIO_BYTES + 1)
    await audio.close()
    if not content:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please record some audio first.")
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Audio must be 25 MB or smaller.")

    suffix = Path(audio.filename or "recording.webm").suffix or ".webm"
    text = await run_in_threadpool(transcribe_audio, f"recording{suffix}", content, content_type)
    if not text:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Unable to transcribe audio right now.")
    return {"success": True, "data": {"text": text}, "error": None}
