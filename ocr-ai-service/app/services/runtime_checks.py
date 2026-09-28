import importlib
import platform
import shutil
import sys
from typing import Any, Dict, List

from app.config import Settings


def _module_check(name: str) -> Dict[str, Any]:
    try:
        module = importlib.import_module(name)
        return {
            "available": True,
            "version": getattr(module, "__version__", "unknown"),
        }
    except Exception as exc:
        return {
            "available": False,
            "error": str(exc),
        }


def collect_runtime_diagnostics(settings: Settings) -> Dict[str, Any]:
    checks: Dict[str, Any] = {
        "python": {
            "version": sys.version,
            "executable": sys.executable,
            "platform": platform.platform(),
        },
        "opencv": _module_check("cv2"),
        "numpy": _module_check("numpy"),
        "httpx": _module_check("httpx"),
        "rapidocr_onnxruntime": _module_check("rapidocr_onnxruntime"),
        "pytesseract": _module_check("pytesseract"),
        "tesseract_binary": {
            "available": shutil.which("tesseract") is not None,
            "path": shutil.which("tesseract"),
        },
        "settings": {
            "ocr_backend": settings.ocr_backend,
            "has_default_callback": settings.nestjs_callback_url is not None,
            "has_hmac_secret": settings.callback_hmac_secret is not None,
            "max_image_bytes": settings.max_image_bytes,
            "allowed_image_hosts": sorted(settings.allowed_hosts_set),
        },
    }

    available_backends: List[str] = []
    if checks["rapidocr_onnxruntime"]["available"]:
        available_backends.append("rapidocr")
    if checks["pytesseract"]["available"] and checks["tesseract_binary"]["available"]:
        available_backends.append("tesseract")

    checks["ocr_backends"] = {
        "available": available_backends,
        "selected_hint": settings.ocr_backend,
    }
    return checks
