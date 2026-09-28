import asyncio
from contextlib import asynccontextmanager
from contextlib import suppress
import hmac
import logging
import json
from typing import Any, AsyncIterator, Dict, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.logging_utils import setup_logging
from app.schemas import OcrJobAccepted, OcrJobRequest, OcrJobResult, RuntimeDiagnostics
from app.services.pipeline import OcrPipeline
from app.services.callback_client import callback_outbox_worker
from app.services.runtime_checks import collect_runtime_diagnostics

settings: Settings = get_settings()
logger = logging.getLogger("ocr_ai_service")

_pipeline: Optional[OcrPipeline] = None
_runtime_checks: Dict[str, Any] = {}
_job_slots = asyncio.Semaphore(settings.max_concurrent_jobs)
_outbox_task: Optional[asyncio.Task[None]] = None


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    global _pipeline, _runtime_checks, _outbox_task

    setup_logging(settings.log_level)
    logger.info("Starting OCR AI Worker Service")
    _runtime_checks = collect_runtime_diagnostics(settings)

    try:
        _pipeline = OcrPipeline(settings)
        logger.info("OCR backend selected: %s", _pipeline.backend.name)
    except Exception as exc:
        _pipeline = None
        logger.warning("OCR backend is not ready: %s", exc)

    _outbox_task = asyncio.create_task(callback_outbox_worker(settings))
    yield

    if _outbox_task is not None:
        _outbox_task.cancel()
        with suppress(asyncio.CancelledError):
            await _outbox_task


app = FastAPI(
    title="OCR AI Worker Service",
    version="0.1.0",
    description="Private OCR worker API for transaction screenshot extraction.",
    lifespan=lifespan,
)


def require_service_auth(
    x_ocr_service_token: Optional[str] = Header(None),
) -> None:
    expected = settings.service_auth_token
    if not expected and settings.env.lower() == "development":
        return
    if not expected or not x_ocr_service_token or not hmac.compare_digest(
        x_ocr_service_token,
        expected,
    ):
        raise HTTPException(status_code=401, detail="Invalid OCR service authentication.")


async def read_upload_limited(upload: UploadFile, limit: int) -> bytes:
    chunks = bytearray()
    while True:
        chunk = await upload.read(min(1024 * 1024, limit + 1 - len(chunks)))
        if not chunk:
            return bytes(chunks)
        chunks.extend(chunk)
        if len(chunks) > limit:
            raise HTTPException(
                status_code=413,
                detail=f"Image exceeds max size ({limit} bytes).",
            )


async def process_upload_background(
    *,
    job_id: str,
    wallet_app_type: str,
    tx_type: str,
    image_bytes: bytes,
    metadata: Dict[str, object],
) -> None:
    if _pipeline is None:
        logger.error("OCR pipeline became unavailable. job_id=%s", job_id)
        return

    async with _job_slots:
        result = await _pipeline.process_job_from_image_bytes(
            job_id=job_id,
            wallet_app_type=wallet_app_type,
            tx_type=tx_type,
            image_bytes=image_bytes,
            metadata=metadata,
        )

    if result.status == "failed":
        logger.warning("OCR upload job failed. job_id=%s error=%s", result.job_id, result.error)
    else:
        logger.info(
            "OCR upload job processed. job_id=%s processing_ms=%s",
            result.job_id,
            result.processing_ms,
        )


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok" if _pipeline is not None else "degraded",
        "app": settings.app_name,
        "env": settings.env,
        "ocr_backend_ready": _pipeline is not None,
        "ocr_backend": _pipeline.backend.name if _pipeline else None,
    }


@app.get(
    "/v1/diagnostics/runtime",
    response_model=RuntimeDiagnostics,
    dependencies=[Depends(require_service_auth)],
)
async def runtime_diagnostics() -> RuntimeDiagnostics:
    if not settings.enable_diagnostics:
        raise HTTPException(status_code=404, detail="Diagnostics are disabled.")

    available = _runtime_checks.get("ocr_backends", {}).get("available", [])
    selected = _pipeline.backend.name if _pipeline else None

    return RuntimeDiagnostics(
        app_name=settings.app_name,
        env=settings.env,
        checks=_runtime_checks,
        selected_ocr_backend=selected,
        available_ocr_backends=available,
    )


@app.post(
    "/v1/jobs/process",
    response_model=OcrJobResult,
    dependencies=[Depends(require_service_auth)],
)
async def process_job(job: OcrJobRequest) -> OcrJobResult:
    if _pipeline is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "OCR backend is not available. Check /v1/diagnostics/runtime "
                "for dependency status."
            ),
        )

    async with _job_slots:
        result = await _pipeline.process_job(job)
    if result.status == "failed":
        logger.warning("OCR job failed. job_id=%s error=%s", result.job_id, result.error)
    else:
        logger.info(
            "OCR job processed. job_id=%s processing_ms=%s",
            result.job_id,
            result.processing_ms,
        )
    return result


@app.post(
    "/v1/jobs/process-upload",
    response_model=OcrJobAccepted,
    status_code=202,
    dependencies=[Depends(require_service_auth)],
)
async def process_job_upload(
    background_tasks: BackgroundTasks,
    job_id: str = Form(...),
    wallet_app_type: str = Form(...),
    tx_type: str = Form(...),
    image: UploadFile = File(...),
    metadata_json: Optional[str] = Form(None),
) -> OcrJobAccepted:
    if _pipeline is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "OCR backend is not available. Check /v1/diagnostics/runtime "
                "for dependency status."
            ),
        )

    content_type = image.content_type or ""
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported upload content type: {content_type}",
        )

    metadata: Dict[str, object] = {}
    if metadata_json:
        try:
            decoded = json.loads(metadata_json)
            if isinstance(decoded, dict):
                metadata = decoded
            else:
                raise ValueError("metadata_json must decode to a JSON object")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid metadata_json: {exc}")

    if tx_type not in {"cash_in", "cash_out"}:
        raise HTTPException(status_code=400, detail="Invalid transaction type.")

    image_bytes = await read_upload_limited(image, settings.max_image_bytes)
    metadata = {
        **metadata,
        "filename": image.filename,
        "content_type": content_type,
    }

    background_tasks.add_task(
        process_upload_background,
        job_id=job_id,
        wallet_app_type=wallet_app_type,
        tx_type=tx_type,
        image_bytes=image_bytes,
        metadata=metadata,
    )
    return OcrJobAccepted(job_id=job_id)
