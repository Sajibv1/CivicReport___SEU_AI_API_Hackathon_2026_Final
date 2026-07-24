from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.uploads import MAX_IMAGE_BYTES, image_content_type, image_extension
from app.database import get_db
from app.models import UploadedImage

router = APIRouter(prefix="/api", tags=["citizen"])
assets_router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_image(image: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await image.read(MAX_IMAGE_BYTES + 1)
    await image.close()

    if not content:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please choose an image to upload.")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image must be 5 MB or smaller.")

    extension = image_extension(content)
    if extension is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG, and WebP images are supported.")

    filename = f"{uuid4().hex}{extension}"
    db.add(UploadedImage(file_key=filename, content_type=image_content_type(extension), content=content))
    db.commit()
    return {"success": True, "data": {"image_path": f"/uploads/{filename}"}, "error": None}


@assets_router.get("/{file_key}", include_in_schema=False)
def get_uploaded_image(file_key: str, db: Session = Depends(get_db)):
    upload = db.get(UploadedImage, file_key)
    if not upload:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found.")
    return Response(content=upload.content, media_type=upload.content_type)
