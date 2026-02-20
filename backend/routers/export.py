import base64
import io
import zipfile
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from PIL import Image
import imageio.v3 as iio
import numpy as np

router = APIRouter()


class GifRequest(BaseModel):
    frames: List[str]   # base64 PNG strings
    fps: int = 5
    loop: int = 0       # 0 = infinite


class ZipRequest(BaseModel):
    frames: List[str]   # base64 PNG strings
    filename_prefix: str = "frame"


def decode_frame(b64_str: str) -> Image.Image:
    """base64 PNG 文字列を PIL Image に変換"""
    data = base64.b64decode(b64_str)
    return Image.open(io.BytesIO(data)).convert("RGBA")


@router.post("/gif")
async def export_gif(req: GifRequest):
    if len(req.frames) == 0:
        raise HTTPException(status_code=400, detail="frames is empty")
    if len(req.frames) > 500:
        raise HTTPException(status_code=400, detail="too many frames (max 500)")

    try:
        images = [np.array(decode_frame(f).convert("RGB")) for f in req.frames]
        buf = io.BytesIO()
        duration = int(1000 / max(req.fps, 1))  # ms per frame
        iio.imwrite(
            buf,
            images,
            extension=".gif",
            loop=req.loop,
            duration=duration,
        )
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="image/gif",
            headers={"Content-Disposition": 'attachment; filename="animation.gif"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/zip")
async def export_zip(req: ZipRequest):
    if len(req.frames) == 0:
        raise HTTPException(status_code=400, detail="frames is empty")
    if len(req.frames) > 1000:
        raise HTTPException(status_code=400, detail="too many frames (max 1000)")

    try:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, f in enumerate(req.frames):
                png_data = base64.b64decode(f)
                filename = f"{req.filename_prefix}_{i:04d}.png"
                zf.writestr(filename, png_data)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="frames.zip"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
