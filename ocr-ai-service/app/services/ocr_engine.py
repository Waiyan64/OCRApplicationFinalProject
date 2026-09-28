from typing import List, Sequence

import numpy as np

from app.schemas import OcrSpan


def _clip_conf(value: float) -> float:
    return max(0.0, min(1.0, value))


class OcrBackendUnavailableError(Exception):
    pass


class BaseOcrBackend:
    name = "base"

    def extract(self, image: np.ndarray, variant: str) -> List[OcrSpan]:
        raise NotImplementedError


class RapidOcrBackend(BaseOcrBackend):
    name = "rapidocr"

    def __init__(self) -> None:
        from rapidocr_onnxruntime import RapidOCR  # type: ignore

        self.engine = RapidOCR()

    def extract(self, image: np.ndarray, variant: str) -> List[OcrSpan]:
        output, _ = self.engine(image)
        spans: List[OcrSpan] = []
        if not output:
            return spans

        for item in output:
            # Expected format: [box, text, score]
            text = str(item[1]).strip() if len(item) > 1 else ""
            score = float(item[2]) if len(item) > 2 else 0.0
            if text:
                spans.append(
                    OcrSpan(
                        text=text,
                        confidence=_clip_conf(score),
                        variant=variant,
                    )
                )
        return spans


class TesseractBackend(BaseOcrBackend):
    name = "tesseract"

    def __init__(self) -> None:
        import pytesseract  # type: ignore

        self.pytesseract = pytesseract

    def extract(self, image: np.ndarray, variant: str) -> List[OcrSpan]:
        data = self.pytesseract.image_to_data(
            image,
            output_type=self.pytesseract.Output.DICT,
            config="--psm 6",
        )

        spans: List[OcrSpan] = []
        total = len(data.get("text", []))
        for idx in range(total):
            text = (data["text"][idx] or "").strip()
            if not text:
                continue
            conf_raw = str(data.get("conf", ["0"])[idx])
            try:
                conf = float(conf_raw)
            except Exception:
                conf = 0.0
            # Tesseract returns confidence in range [0, 100], sometimes -1.
            normalized_conf = 0.0 if conf < 0 else _clip_conf(conf / 100.0)
            spans.append(
                OcrSpan(
                    text=text,
                    confidence=normalized_conf,
                    variant=variant,
                )
            )
        return spans


def _backend_candidates(preferred: str) -> Sequence[str]:
    preferred = (preferred or "auto").strip().lower()
    if preferred in {"rapidocr", "tesseract"}:
        return [preferred]
    # auto preference order
    return ["rapidocr", "tesseract"]


def build_ocr_backend(preferred: str) -> BaseOcrBackend:
    errors = []
    for candidate in _backend_candidates(preferred):
        try:
            if candidate == "rapidocr":
                return RapidOcrBackend()
            if candidate == "tesseract":
                return TesseractBackend()
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")

    raise OcrBackendUnavailableError(
        "No OCR backend available. Install rapidocr-onnxruntime or pytesseract with "
        f"the tesseract binary. details={errors}"
    )
