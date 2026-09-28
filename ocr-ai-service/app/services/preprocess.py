from typing import Dict, List, Tuple

import cv2
import numpy as np


def _safe_crop_center(image: np.ndarray, ratio: float = 0.8) -> np.ndarray:
    h, w = image.shape[:2]
    ch = int(h * ratio)
    cw = int(w * ratio)
    y0 = max((h - ch) // 2, 0)
    x0 = max((w - cw) // 2, 0)
    return image[y0 : y0 + ch, x0 : x0 + cw]


def preprocess_image(image: np.ndarray, wallet_app_type: str) -> Tuple[List[Tuple[str, np.ndarray]], Dict[str, object]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)
    adaptive = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        2,
    )
    _, otsu = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.int32)
    sharpen = cv2.filter2D(denoised, -1, sharpen_kernel)

    center_crop = _safe_crop_center(denoised, ratio=0.82)

    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    diagnostics: Dict[str, object] = {
        "wallet_app_type": wallet_app_type,
        "input_shape": [int(v) for v in image.shape],
        "blur_score": round(blur_score, 3),
    }

    variants: List[Tuple[str, np.ndarray]] = [
        ("gray", gray),
        ("denoised", denoised),
        ("adaptive", adaptive),
        ("otsu", otsu),
        ("sharpen", sharpen),
        ("center_crop", center_crop),
    ]

    diagnostics["variants"] = [name for name, _ in variants]
    return variants, diagnostics
