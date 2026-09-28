import asyncio
import time
from typing import Dict, List, Optional

from app.config import Settings
from app.schemas import OcrJobRequest, OcrJobResult, OcrSpan
from app.services.callback_client import persist_result_callback
from app.services.image_io import decode_image, download_image_bytes
from app.services.ocr_engine import BaseOcrBackend, build_ocr_backend
from app.services.parser import parse_transaction_fields
from app.services.preprocess import preprocess_image


class OcrPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.backend: BaseOcrBackend = build_ocr_backend(settings.ocr_backend)

    async def process_job(self, job: OcrJobRequest) -> OcrJobResult:
        start = time.perf_counter()
        callback_url = self.settings.resolve_callback_url(None)

        diagnostics: Dict[str, object] = {
            "wallet_app_type": job.wallet_app_type,
            "ocr_backend": self.backend.name,
            "ingest_mode": "url",
        }

        try:
            image_bytes, download_meta = await download_image_bytes(str(job.image_url), self.settings)
            diagnostics["download"] = download_meta

            fields, raw_text, process_meta = await asyncio.to_thread(
                self._extract_fields,
                image_bytes,
                job.wallet_app_type,
                None,
            )
            diagnostics.update(process_meta)

            result = OcrJobResult(
                job_id=job.job_id,
                status="processed",
                wallet_app_type=job.wallet_app_type,
                fields=fields,
                raw_text=raw_text,
                diagnostics=diagnostics if self.settings.enable_diagnostics else {},
                processing_ms=int((time.perf_counter() - start) * 1000),
            )

        except Exception as exc:
            result = OcrJobResult(
                job_id=job.job_id,
                status="failed",
                wallet_app_type=job.wallet_app_type,
                diagnostics=diagnostics if self.settings.enable_diagnostics else {},
                processing_ms=int((time.perf_counter() - start) * 1000),
                error=str(exc),
            )

        if callback_url:
            result.callback = await persist_result_callback(
                callback_url=callback_url,
                result=result,
                settings=self.settings,
                auth_token=job.callback_auth_token,
            )

        return result

    async def process_job_from_image_bytes(
        self,
        *,
        job_id: str,
        wallet_app_type: str,
        tx_type: str,
        image_bytes: bytes,
        metadata: Optional[Dict[str, object]] = None,
    ) -> OcrJobResult:
        start = time.perf_counter()

        diagnostics: Dict[str, object] = {
            "wallet_app_type": wallet_app_type,
            "ocr_backend": self.backend.name,
            "ingest_mode": "multipart-upload",
            "upload": {
                "bytes": len(image_bytes),
            },
        }
        if metadata:
            diagnostics["metadata"] = metadata

        try:
            if len(image_bytes) > self.settings.max_image_bytes:
                raise ValueError(
                    f"Image exceeds max size ({self.settings.max_image_bytes} bytes)."
                )

            fields, raw_text, process_meta = await asyncio.to_thread(
                self._extract_fields,
                image_bytes,
                wallet_app_type,
                tx_type,
            )
            diagnostics.update(process_meta)

            result = OcrJobResult(
                job_id=job_id,
                status="processed",
                wallet_app_type=wallet_app_type,
                fields=fields,
                raw_text=raw_text,
                diagnostics=diagnostics if self.settings.enable_diagnostics else {},
                processing_ms=int((time.perf_counter() - start) * 1000),
            )

        except Exception as exc:
            result = OcrJobResult(
                job_id=job_id,
                status="failed",
                wallet_app_type=wallet_app_type,
                diagnostics=diagnostics if self.settings.enable_diagnostics else {},
                processing_ms=int((time.perf_counter() - start) * 1000),
                error=str(exc),
            )

        effective_callback = self.settings.resolve_callback_url(None)
        if effective_callback:
            result.callback = await persist_result_callback(
                callback_url=effective_callback,
                result=result,
                settings=self.settings,
            )

        return result

    def _extract_fields(
        self,
        image_bytes: bytes,
        wallet_app_type: str,
        tx_type: Optional[str],
    ):
        image = decode_image(
            image_bytes,
            max_pixels=self.settings.max_image_pixels,
        )
        variants, preprocess_meta = preprocess_image(image, wallet_app_type)

        spans: List[OcrSpan] = []
        per_variant_counts = {}
        for variant_name, variant_image in variants:
            variant_spans = self.backend.extract(variant_image, variant_name)
            spans.extend(variant_spans)
            per_variant_counts[variant_name] = len(variant_spans)

        fields, raw_text, parse_meta = parse_transaction_fields(
            spans,
            wallet_app_type=wallet_app_type,
            expected_tx_type=tx_type,
            min_required_confidence=self.settings.min_required_field_confidence,
            max_transaction_amount=self.settings.max_transaction_amount,
        )
        quality = parse_meta.get("quality", {})
        if not quality.get("accepted", False):
            reasons = quality.get("reasons", ["OCR result did not meet quality requirements."])
            raise ValueError("; ".join(str(reason) for reason in reasons))
        return fields, raw_text, {
            "preprocess": preprocess_meta,
            "ocr_spans_per_variant": per_variant_counts,
            "ocr_total_spans": len(spans),
            "parse": parse_meta,
        }
