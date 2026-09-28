import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile

from app import main
from app.config import Settings


def test_service_auth_rejects_missing_token(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "settings",
        Settings(_env_file=None, service_auth_token="expected-token"),
    )

    with pytest.raises(HTTPException) as exc_info:
        main.require_service_auth(None)

    assert exc_info.value.status_code == 401


def test_service_auth_accepts_matching_token(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "settings",
        Settings(_env_file=None, service_auth_token="expected-token"),
    )

    assert main.require_service_auth("expected-token") is None


def test_upload_reader_rejects_oversized_body() -> None:
    upload = UploadFile(filename="large.png", file=io.BytesIO(b"x" * 11))

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(main.read_upload_limited(upload, 10))

    assert exc_info.value.status_code == 413