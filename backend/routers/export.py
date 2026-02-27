import base64
import io
import subprocess
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


class VideoRequest(BaseModel):
    frames: List[str]   # base64 PNG strings
    fps: int = 10


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


@router.post("/mp4")
async def export_mp4(req: VideoRequest):
    if len(req.frames) == 0:
        raise HTTPException(status_code=400, detail="frames is empty")
    if len(req.frames) > 600:
        raise HTTPException(status_code=400, detail="too many frames (max 600)")

    fps = max(1, min(req.fps, 60))

    cmd = [
        "ffmpeg", "-y",
        "-f", "image2pipe", "-vcodec", "png", "-r", str(fps), "-i", "pipe:0",
        "-vcodec", "libx264", "-pix_fmt", "yuv420p",
        "-movflags", "frag_keyframe+empty_moov",
        "-f", "mp4", "pipe:1",
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        for b64 in req.frames:
            proc.stdin.write(base64.b64decode(b64))
        proc.stdin.close()

        mp4_data = proc.stdout.read()
        proc.wait()

        if proc.returncode != 0:
            err = proc.stderr.read().decode("utf-8", errors="replace")
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {err}")

        return StreamingResponse(
            io.BytesIO(mp4_data),
            media_type="video/mp4",
            headers={"Content-Disposition": 'attachment; filename="track_animation.mp4"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
