import asyncio
import io
import ipaddress
import socket
from typing import Dict, Tuple
from urllib.parse import urljoin, urlparse

import cv2
import httpx
import numpy as np
from PIL import Image

from app.config import Settings


class ImageDownloadError(Exception):
    pass


class ImageDecodeError(Exception):
    pass


async def _validate_remote_url(image_url: str, settings: Settings) -> str:
    parsed = urlparse(image_url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https":
        raise ImageDownloadError("Image URL must use HTTPS.")
    if not host or parsed.username or parsed.password:
        raise ImageDownloadError("Image URL host is invalid.")

    allowed_hosts = settings.allowed_hosts_set
    if not allowed_hosts:
        raise ImageDownloadError("ALLOWED_IMAGE_HOSTS is required for URL ingestion.")
    if host not in allowed_hosts:
        raise ImageDownloadError("Image host is not allowed by policy.")

    try:
        address_info = await asyncio.to_thread(
            socket.getaddrinfo,
            host,
            parsed.port or 443,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise ImageDownloadError("Image host could not be resolved.") from exc

    for entry in address_info:
        address = ipaddress.ip_address(entry[4][0])
        if not address.is_global:
            raise ImageDownloadError("Image host resolves to a non-public address.")
    return host


async def download_image_bytes(image_url: str, settings: Settings) -> Tuple[bytes, Dict[str, object]]:
    current_url = image_url
    response: httpx.Response
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        for _ in range(4):
            host = await _validate_remote_url(current_url, settings)
            response = await client.get(current_url, follow_redirects=False)
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise ImageDownloadError("Image redirect has no destination.")
                current_url = urljoin(current_url, location)
                continue
            break
        else:
            raise ImageDownloadError("Image URL exceeded redirect limit.")

    if response.status_code >= 400:
        raise ImageDownloadError(
            f"Failed to download image. status_code={response.status_code}"
        )

    content_type = response.headers.get("content-type", "")
    if content_type and not (
        content_type.startswith("image/") or content_type.startswith("application/octet-stream")
    ):
        raise ImageDownloadError(f"Unsupported content-type for image: {content_type}")

    image_bytes = response.content
    if len(image_bytes) > settings.max_image_bytes:
        raise ImageDownloadError(
            f"Image exceeds max size ({settings.max_image_bytes} bytes). "
        )

    metadata = {
        "host": host,
        "bytes": len(image_bytes),
        "content_type": content_type,
    }
    return image_bytes, metadata


def decode_image(image_bytes: bytes, max_pixels: int = 20_000_000) -> np.ndarray:
    if not image_bytes:
        raise ImageDecodeError("Image payload is empty.")
    try:
        with Image.open(io.BytesIO(image_bytes)) as image_header:
            width, height = image_header.size
    except Exception as exc:
        raise ImageDecodeError("Image header could not be decoded.") from exc
    if width <= 0 or height <= 0 or width * height > max_pixels:
        raise ImageDecodeError(f"Image exceeds max pixel count ({max_pixels}).")

    img_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ImageDecodeError("OpenCV could not decode the input image bytes.")
    return image
