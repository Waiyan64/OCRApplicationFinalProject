import asyncio
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, Optional

import httpx

from app.config import Settings
from app.schemas import CallbackDelivery, OcrJobResult

logger = logging.getLogger("ocr_ai_service.callback")


def _serialize_payload(result: OcrJobResult) -> Dict[str, Any]:
    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")  # pydantic v2
    return result.dict()  # pydantic v1 fallback


def _build_hmac_signature(secret: str, payload_bytes: bytes, timestamp: str) -> str:
    to_sign = f"{timestamp}.".encode("utf-8") + payload_bytes
    return hmac.new(secret.encode("utf-8"), to_sign, hashlib.sha256).hexdigest()


async def persist_result_callback(
    callback_url: str,
    result: OcrJobResult,
    settings: Settings,
    auth_token: Optional[str] = None,
    persist_failure: bool = True,
) -> CallbackDelivery:
    payload = _serialize_payload(result)
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")

    headers = {
        "content-type": "application/json",
    }

    token = auth_token or settings.callback_auth_token
    if token:
        headers["authorization"] = f"Bearer {token}"

    if settings.callback_hmac_secret:
        ts = str(int(time.time()))
        signature = _build_hmac_signature(settings.callback_hmac_secret, payload_bytes, ts)
        headers["x-ocr-timestamp"] = ts
        headers["x-ocr-signature"] = signature

    delivery = CallbackDelivery(
        attempted=True,
        callback_url=callback_url,
    )

    for attempt in range(1, settings.callback_max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.callback_timeout_seconds) as client:
                response = await client.post(
                    callback_url,
                    content=payload_bytes,
                    headers=headers,
                )

            delivery.status_code = response.status_code
            delivery.ok = 200 <= response.status_code < 300
            delivery.response_excerpt = response.text[:300] if response.text else None
            if delivery.ok:
                delivery.error = None
                logger.info(
                    "Callback delivered. job_id=%s attempt=%s status_code=%s",
                    result.job_id,
                    attempt,
                    response.status_code,
                )
                return delivery
            delivery.error = f"Callback rejected: status_code={response.status_code}"
        except Exception as exc:
            delivery.ok = False
            delivery.error = str(exc)

        logger.warning(
            "Callback attempt failed. job_id=%s attempt=%s/%s error=%s",
            result.job_id,
            attempt,
            settings.callback_max_attempts,
            delivery.error,
        )
        if attempt < settings.callback_max_attempts:
            await asyncio.sleep(settings.callback_backoff_seconds * (2 ** (attempt - 1)))

    if persist_failure:
        _persist_to_outbox(callback_url, payload, settings)
    return delivery


def _persist_to_outbox(
    callback_url: str,
    payload: Dict[str, Any],
    settings: Settings,
) -> None:
    outbox = Path(settings.callback_outbox_dir)
    outbox.mkdir(parents=True, exist_ok=True, mode=0o700)
    digest = hashlib.sha256(
        f"{payload.get('job_id', 'unknown')}:{time.time_ns()}".encode("utf-8")
    ).hexdigest()[:16]
    destination = outbox / f"callback-{digest}.json"
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"callback_url": callback_url, "payload": payload}),
        encoding="utf-8",
    )
    os.chmod(temporary, 0o600)
    temporary.replace(destination)
    logger.error(
        "Callback queued in outbox. job_id=%s path=%s",
        payload.get("job_id"),
        destination,
    )


async def retry_callback_outbox(settings: Settings) -> int:
    outbox = Path(settings.callback_outbox_dir)
    if not outbox.exists():
        return 0

    delivered = 0
    for path in sorted(outbox.glob("callback-*.json")):
        try:
            entry = json.loads(path.read_text(encoding="utf-8"))
            callback_url = settings.resolve_callback_url(str(entry["callback_url"]))
            if not callback_url:
                raise ValueError("Trusted callback URL is not configured.")
            result = OcrJobResult.model_validate(entry["payload"])
            delivery = await persist_result_callback(
                callback_url,
                result,
                settings,
                persist_failure=False,
            )
            if delivery.ok:
                path.unlink()
                delivered += 1
        except Exception as exc:
            logger.error("Outbox retry failed. path=%s error=%s", path, exc)
    return delivered


async def callback_outbox_worker(settings: Settings) -> None:
    while True:
        await retry_callback_outbox(settings)
        await asyncio.sleep(settings.callback_outbox_retry_seconds)
