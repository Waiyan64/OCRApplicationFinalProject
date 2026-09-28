import asyncio

from app.config import Settings
from app.schemas import OcrJobResult
from app.services import callback_client


class FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        self.text = f"status={status_code}"


class FakeClient:
    attempts = 0

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args) -> None:
        return None

    async def post(self, *args, **kwargs) -> FakeResponse:
        FakeClient.attempts += 1
        return FakeResponse(503 if FakeClient.attempts < 3 else 201)


def test_callback_retries_until_success(monkeypatch) -> None:
    FakeClient.attempts = 0
    monkeypatch.setattr(callback_client.httpx, "AsyncClient", FakeClient)
    settings = Settings(
        _env_file=None,
        callback_max_attempts=3,
        callback_backoff_seconds=0,
    )

    delivery = asyncio.run(
        callback_client.persist_result_callback(
            "https://api.example.com/callback",
            OcrJobResult(job_id="job-1", status="processed", wallet_app_type="kbzpay"),
            settings,
        )
    )

    assert FakeClient.attempts == 3
    assert delivery.ok is True
    assert delivery.status_code == 201


class AlwaysFailClient(FakeClient):
    async def post(self, *args, **kwargs) -> FakeResponse:
        return FakeResponse(503)


def test_failed_callback_is_persisted_to_outbox(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(callback_client.httpx, "AsyncClient", AlwaysFailClient)
    settings = Settings(
        _env_file=None,
        callback_max_attempts=1,
        callback_outbox_dir=str(tmp_path),
    )

    delivery = asyncio.run(
        callback_client.persist_result_callback(
            "https://api.example.com/callback",
            OcrJobResult(job_id="job-2", status="processed", wallet_app_type="kbzpay"),
            settings,
        )
    )

    assert delivery.ok is False
    files = list(tmp_path.glob("callback-*.json"))
    assert len(files) == 1
    assert "job-2" in files[0].read_text(encoding="utf-8")