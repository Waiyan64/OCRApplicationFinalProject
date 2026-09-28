import asyncio
import socket

import cv2
import numpy as np
import pytest

from app.config import Settings
from app.services.image_io import ImageDecodeError, ImageDownloadError, _validate_remote_url, decode_image


def test_decode_rejects_excessive_pixel_count() -> None:
    ok, encoded = cv2.imencode(".png", np.zeros((10, 10, 3), dtype=np.uint8))
    assert ok

    with pytest.raises(ImageDecodeError, match="pixel count"):
        decode_image(encoded.tobytes(), max_pixels=50)


def test_url_ingestion_requires_allowlist() -> None:
    settings = Settings(_env_file=None, allowed_image_hosts=None)

    with pytest.raises(ImageDownloadError, match="ALLOWED_IMAGE_HOSTS"):
        asyncio.run(_validate_remote_url("https://images.example.com/a.png", settings))


def test_url_ingestion_rejects_private_dns(monkeypatch) -> None:
    settings = Settings(_env_file=None, allowed_image_hosts="images.example.com")
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))],
    )

    with pytest.raises(ImageDownloadError, match="non-public"):
        asyncio.run(_validate_remote_url("https://images.example.com/a.png", settings))