from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import json
import statistics
import subprocess
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.config import Settings
from app.schemas import FieldPrediction, OcrSpan, ParsedTransactionFields
from app.services.image_io import decode_image
from app.services.ocr_engine import build_ocr_backend
from app.services.parser import parse_transaction_fields
from app.services.preprocess import preprocess_image

EXPERIMENT_ID = "EXP-001"
CONDITIONS = ("generic", "wallet_aware")
VALUE_FIELDS = ("amount", "tx_id", "tx_type", "timestamp", "fee", "balance")
ERROR_CODES = {
    "amount": ("OCR-01", "OCR-02"),
    "tx_id": ("OCR-03", "OCR-04"),
    "tx_type": ("OCR-05", "OCR-05"),
    "timestamp": ("OCR-06", "OCR-06"),
    "fee": ("OCR-07", "OCR-07"),
    "balance": ("OCR-07", "OCR-07"),
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_csv(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _normalize_decimal(value: Optional[str]) -> Optional[Decimal]:
    if value is None or not value.strip():
        return None
    cleaned = value.replace(",", "").replace(" ", "").strip()
    try:
        return abs(Decimal(cleaned))
    except InvalidOperation:
        return None


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _normalize_type(value: Optional[str]) -> str:
    cleaned = (value or "").strip().lower()
    return cleaned if cleaned in {"cash_in", "cash_out"} else "unknown"


def _normalize_timestamp(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip())
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed.isoformat(timespec="seconds")


def _prediction_value(fields: ParsedTransactionFields, field: str) -> Optional[str]:
    prediction = getattr(fields, field)
    return prediction.value


def _prediction_confidence(fields: ParsedTransactionFields, field: str) -> float:
    prediction: FieldPrediction = getattr(fields, field)
    return float(prediction.confidence)


def _ground_truth(row: Dict[str, str], field: str) -> Tuple[Optional[str], str, bool]:
    if field == "amount":
        return row.get("amount_value"), row.get("amount_state", ""), row.get("amount_state") == "present"
    if field == "tx_id":
        return row.get("transaction_id"), row.get("transaction_id_state", ""), row.get("transaction_id_state") == "present"
    if field == "tx_type":
        value = row.get("transaction_type") or "unknown"
        return value, row.get("transaction_type_state", ""), True
    if field == "timestamp":
        eligible = row.get("timestamp_state") == "present" and bool(row.get("timestamp_value"))
        return row.get("timestamp_value"), row.get("timestamp_state", ""), eligible
    if field == "fee":
        return row.get("fee_value"), row.get("fee_state", ""), row.get("fee_state") == "present"
    if field == "balance":
        return row.get("balance_value"), row.get("balance_state", ""), row.get("balance_state") == "present"
    raise ValueError(f"Unsupported field: {field}")


def _values_match(field: str, expected: Optional[str], predicted: Optional[str]) -> bool:
    if field in {"amount", "fee", "balance"}:
        left = _normalize_decimal(expected)
        right = _normalize_decimal(predicted)
        return left is not None and right is not None and left == right
    if field == "timestamp":
        left = _normalize_timestamp(expected)
        right = _normalize_timestamp(predicted)
        return left is not None and right is not None and left == right
    if field == "tx_type":
        return _normalize_type(expected) == _normalize_type(predicted)
    return _normalize_text(expected) is not None and _normalize_text(expected) == _normalize_text(predicted)


def _score_fields(
    sample_id: str,
    condition: str,
    row: Dict[str, str],
    fields: ParsedTransactionFields,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    scores: List[Dict[str, Any]] = []
    failures: List[Dict[str, Any]] = []

    for field in VALUE_FIELDS:
        expected, expected_state, eligible = _ground_truth(row, field)
        predicted = _prediction_value(fields, field)
        confidence = _prediction_confidence(fields, field)
        predicted_present = predicted is not None and bool(predicted.strip())
        exact_match = eligible and _values_match(field, expected, predicted)
        expected_present = expected_state in {"present", "present_uncertain"} or field == "tx_type"
        presence_match = expected_present == predicted_present

        score = {
            "sample_id": sample_id,
            "condition": condition,
            "field": field,
            "eligible": eligible,
            "expected_state": expected_state,
            "predicted_present": predicted_present,
            "presence_match": presence_match,
            "exact_match": exact_match,
            "confidence": round(confidence, 4),
        }
        scores.append(score)

        error_code: Optional[str] = None
        diagnosis: Optional[str] = None
        if eligible and not predicted_present:
            error_code = ERROR_CODES[field][0]
            diagnosis = "required field not extracted"
        elif eligible and not exact_match:
            error_code = ERROR_CODES[field][1]
            diagnosis = "extracted value did not exactly match ground truth"
        elif not expected_present and predicted_present:
            error_code = ERROR_CODES[field][1]
            diagnosis = "value extracted where annotation marks field absent"

        if error_code:
            failures.append(
                {
                    "sample_id": sample_id,
                    "condition": condition,
                    "field": field,
                    "ground_truth_state": expected_state,
                    "prediction_present": str(predicted_present).lower(),
                    "prediction_confidence": f"{confidence:.4f}",
                    "error_code": error_code,
                    "diagnosis": diagnosis,
                }
            )

    return scores, failures


def _aggregate_scores(scores: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    by_field: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for score in scores:
        by_field[score["field"]].append(score)

    output: Dict[str, Any] = {}
    for field in VALUE_FIELDS:
        field_scores = by_field[field]
        eligible = [score for score in field_scores if score["eligible"]]
        exact_matches = sum(bool(score["exact_match"]) for score in eligible)
        covered = sum(bool(score["predicted_present"]) for score in eligible)
        presence_matches = sum(bool(score["presence_match"]) for score in field_scores)
        output[field] = {
            "eligible_count": len(eligible),
            "exact_matches": exact_matches,
            "exact_match_accuracy": round(exact_matches / len(eligible), 4) if eligible else None,
            "extracted_count": covered,
            "extraction_coverage": round(covered / len(eligible), 4) if eligible else None,
            "presence_evaluable_count": len(field_scores),
            "presence_matches": presence_matches,
            "presence_accuracy": round(presence_matches / len(field_scores), 4) if field_scores else None,
        }
    return output


def _package_version(distribution: str) -> str:
    try:
        return importlib.metadata.version(distribution)
    except importlib.metadata.PackageNotFoundError:
        return "not-installed"


def _git_revision(repo_root: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repo_root,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_image_path(
    repo_root: Path,
    annotated_path: str,
    expected_hash: str,
) -> Tuple[Path, str]:
    direct_path = repo_root / annotated_path
    if direct_path.is_file() and _sha256(direct_path) == expected_hash:
        return direct_path, "annotated_path"

    candidates: List[Path] = []
    for directory in (repo_root / "TanxPhotos", repo_root / "backend-api"):
        if not directory.is_dir():
            continue
        for pattern in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
            for candidate in directory.glob(pattern):
                if candidate.is_file() and _sha256(candidate) == expected_hash:
                    candidates.append(candidate)
    if candidates:
        return sorted(candidates)[0], "hash_alias"
    raise FileNotFoundError(f"No image matching recorded hash for {annotated_path}")


def _extract_spans(image_path: Path, wallet: str, backend: Any, settings: Settings) -> Tuple[List[OcrSpan], Dict[str, Any], int]:
    started = time.perf_counter()
    image_bytes = image_path.read_bytes()
    image = decode_image(image_bytes, max_pixels=settings.max_image_pixels)
    variants, preprocess_meta = preprocess_image(image, wallet)

    spans: List[OcrSpan] = []
    variant_counts: Dict[str, int] = {}
    for variant_name, variant_image in variants:
        variant_spans = backend.extract(variant_image, variant_name)
        spans.extend(variant_spans)
        variant_counts[variant_name] = len(variant_spans)

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    diagnostics = {
        "input_shape": preprocess_meta.get("input_shape"),
        "blur_score": preprocess_meta.get("blur_score"),
        "variant_span_counts": variant_counts,
        "total_spans": len(spans),
    }
    return spans, diagnostics, elapsed_ms


def _write_csv(path: Path, rows: List[Dict[str, Any]], columns: List[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def run_experiment(repo_root: Path, output_dir: Path) -> Dict[str, Any]:
    annotations_path = repo_root / "notes/datasets/dataset-v0.1/pilot_annotations.csv"
    intake_path = repo_root / "notes/datasets/dataset-v0.1/pilot_intake.csv"
    annotations = [
        row for row in _load_csv(annotations_path)
        if row.get("annotation_status") == "completed"
    ]
    intake = {row["sample_id"]: row for row in _load_csv(intake_path)}

    if not annotations:
        raise RuntimeError("No completed annotations found.")
    if len({row["transaction_id"] for row in annotations}) != len(annotations):
        raise RuntimeError("Completed annotations contain duplicate transaction IDs.")

    settings = Settings()
    backend = build_ocr_backend(settings.ocr_backend)
    all_scores: Dict[str, List[Dict[str, Any]]] = {condition: [] for condition in CONDITIONS}
    all_failures: List[Dict[str, Any]] = []
    per_sample: List[Dict[str, Any]] = []
    pipeline_diagnostics: List[Dict[str, Any]] = []
    source_exclusions: List[Dict[str, str]] = []

    for index, row in enumerate(annotations, start=1):
        sample_id = row["sample_id"]
        intake_row = intake.get(sample_id)
        if intake_row is None:
            source_exclusions.append({
                "sample_id": sample_id,
                "reason": "missing_intake_record",
            })
            continue
        try:
            image_path, source_resolution = _resolve_image_path(
                repo_root,
                row["image_path"],
                intake_row.get("sha256", ""),
            )
        except FileNotFoundError:
            source_exclusions.append({
                "sample_id": sample_id,
                "reason": "recorded_hash_not_found",
            })
            continue

        print(f"[{index}/{len(annotations)}] OCR {sample_id}", flush=True)
        spans, extraction_meta, processing_ms = _extract_spans(
            image_path,
            row["wallet_app"],
            backend,
            settings,
        )
        pipeline_diagnostics.append(
            {
                "sample_id": sample_id,
                "wallet_app": row["wallet_app"],
                "source_resolution": source_resolution,
                "processing_ms": processing_ms,
                **extraction_meta,
            }
        )

        condition_fields: Dict[str, ParsedTransactionFields] = {}
        condition_quality: Dict[str, Dict[str, Any]] = {}
        for condition in CONDITIONS:
            wallet_key = None if condition == "generic" else row["wallet_app"]
            fields, _, parse_meta = parse_transaction_fields(
                spans,
                wallet_app_type=wallet_key,
                expected_tx_type=None,
                min_required_confidence=settings.min_required_field_confidence,
                max_transaction_amount=settings.max_transaction_amount,
            )
            condition_fields[condition] = fields
            condition_quality[condition] = dict(parse_meta.get("quality", {}))
            scores, failures = _score_fields(sample_id, condition, row, fields)
            all_scores[condition].extend(scores)
            all_failures.extend(failures)

        sample_row: Dict[str, Any] = {
            "sample_id": sample_id,
            "wallet_app": row["wallet_app"],
            "processing_ms": processing_ms,
            "total_spans": extraction_meta["total_spans"],
        }
        for condition in CONDITIONS:
            sample_row[f"{condition}_quality_accepted"] = str(
                bool(condition_quality[condition].get("accepted", False))
            ).lower()
            for field in VALUE_FIELDS:
                expected, _, eligible = _ground_truth(row, field)
                predicted = _prediction_value(condition_fields[condition], field)
                sample_row[f"{condition}_{field}_eligible"] = str(eligible).lower()
                sample_row[f"{condition}_{field}_match"] = str(
                    eligible and _values_match(field, expected, predicted)
                ).lower()
                sample_row[f"{condition}_{field}_confidence"] = f"{_prediction_confidence(condition_fields[condition], field):.4f}"
        per_sample.append(sample_row)

    if not per_sample:
        raise RuntimeError("No provenance-verified images were available for evaluation.")

    output_dir.mkdir(parents=True, exist_ok=True)
    condition_metrics = {
        condition: _aggregate_scores(scores)
        for condition, scores in all_scores.items()
    }
    processing_times = [row["processing_ms"] for row in pipeline_diagnostics]
    summary = {
        "experiment_id": EXPERIMENT_ID,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository_revision": _git_revision(repo_root),
        "dataset_version": "dataset-v0.1",
        "annotation_protocol": "annotation-v1.2",
        "annotated_sample_count": len(annotations),
        "evaluated_sample_count": len(per_sample),
        "source_exclusion_count": len(source_exclusions),
        "source_exclusions": source_exclusions,
        "alternate_captures_excluded": 2,
        "ambiguous_timestamps_excluded": sum(
            row.get("timestamp_state") == "present_uncertain" for row in annotations
        ),
        "environment": {
            "python_executable": sys.executable,
            "python_version": sys.version.split()[0],
            "ocr_backend": backend.name,
            "rapidocr_onnxruntime": _package_version("rapidocr-onnxruntime"),
            "opencv_python_headless": _package_version("opencv-python-headless"),
            "numpy": _package_version("numpy"),
        },
        "conditions": {
            "generic": {"wallet_app_type": None, "expected_tx_type": None},
            "wallet_aware": {"wallet_app_type": "annotated", "expected_tx_type": None},
        },
        "metrics": condition_metrics,
        "pipeline": {
            "processing_ms_mean": round(statistics.mean(processing_times), 2),
            "processing_ms_median": round(statistics.median(processing_times), 2),
            "processing_ms_min": min(processing_times),
            "processing_ms_max": max(processing_times),
            "total_spans": sum(row["total_spans"] for row in pipeline_diagnostics),
            "failure_codes": dict(sorted(Counter(row["error_code"] for row in all_failures).items())),
        },
        "limitations": [
            "Local pilot only; source-image consent and redaction are not verified.",
            "Single annotator; no inter-annotator agreement.",
            "Small and wallet-imbalanced sample.",
            "All suspicion labels are normal; anomaly metrics are not evaluable.",
            "All evaluated images are labelled clear.",
        ],
    }

    metrics_path = output_dir / "metrics.json"
    metrics_path.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")

    failure_columns = [
        "sample_id",
        "condition",
        "field",
        "ground_truth_state",
        "prediction_present",
        "prediction_confidence",
        "error_code",
        "diagnosis",
    ]
    _write_csv(output_dir / "failures.csv", all_failures, failure_columns)

    per_sample_columns = ["sample_id", "wallet_app", "processing_ms", "total_spans"]
    for condition in CONDITIONS:
        per_sample_columns.append(f"{condition}_quality_accepted")
        for field in VALUE_FIELDS:
            per_sample_columns.extend(
                [
                    f"{condition}_{field}_eligible",
                    f"{condition}_{field}_match",
                    f"{condition}_{field}_confidence",
                ]
            )
    _write_csv(output_dir / "per_sample.csv", per_sample, per_sample_columns)

    diagnostics_path = output_dir / "diagnostics.json"
    diagnostics_path.write_text(
        json.dumps({"samples": pipeline_diagnostics}, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the EXP-001 OCR pilot benchmark.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=_repo_root() / "notes/experiments/results/EXP-001",
    )
    args = parser.parse_args()
    summary = run_experiment(_repo_root(), args.output_dir.resolve())
    print(json.dumps({
        "experiment_id": summary["experiment_id"],
        "annotated_sample_count": summary["annotated_sample_count"],
        "evaluated_sample_count": summary["evaluated_sample_count"],
        "output_dir": str(args.output_dir.resolve()),
    }, indent=2))


if __name__ == "__main__":
    main()
