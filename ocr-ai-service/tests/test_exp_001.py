import hashlib
from typing import Optional

from benchmarks.exp_001 import (
    _aggregate_scores,
    _normalize_decimal,
    _normalize_timestamp,
    _resolve_image_path,
    _score_fields,
)
from app.schemas import FieldPrediction, ParsedTransactionFields


def _prediction(value: Optional[str], confidence: float = 0.9) -> FieldPrediction:
    return FieldPrediction(value=value, confidence=confidence)


def test_decimal_normalization_uses_canonical_magnitude() -> None:
    assert _normalize_decimal("-40,000.00") == _normalize_decimal("40000")


def test_timestamp_normalization_uses_seconds() -> None:
    assert _normalize_timestamp("2026-09-01T08:53:00") == "2026-09-01T08:53:00"


def test_uncertain_timestamp_is_excluded_from_exact_match_denominator() -> None:
    row = {
        "sample_id": "PILOT-X",
        "amount_value": "5000",
        "amount_state": "present",
        "transaction_id": "TX123456",
        "transaction_id_state": "present",
        "transaction_type": "cash_out",
        "transaction_type_state": "cash_out",
        "timestamp_value": "",
        "timestamp_state": "present_uncertain",
        "fee_value": "",
        "fee_state": "absent",
        "balance_value": "",
        "balance_state": "absent",
    }
    fields = ParsedTransactionFields(
        amount=_prediction("5000"),
        tx_id=_prediction("TX123456"),
        tx_type=_prediction("cash_out"),
        timestamp=_prediction("2026-09-02T08:53:00"),
    )

    scores, failures = _score_fields("PILOT-X", "generic", row, fields)
    metrics = _aggregate_scores(scores)

    assert metrics["timestamp"]["eligible_count"] == 0
    assert not any(item["field"] == "timestamp" for item in failures)


def test_transaction_type_is_scored_from_prediction() -> None:
    row = {
        "sample_id": "PILOT-X",
        "amount_value": "5000",
        "amount_state": "present",
        "transaction_id": "TX123456",
        "transaction_id_state": "present",
        "transaction_type": "cash_in",
        "transaction_type_state": "cash_in",
        "timestamp_value": "2026-09-01T08:53:00",
        "timestamp_state": "present",
        "fee_value": "",
        "fee_state": "absent",
        "balance_value": "",
        "balance_state": "absent",
    }
    fields = ParsedTransactionFields(
        amount=_prediction("5000"),
        tx_id=_prediction("TX123456"),
        tx_type=_prediction("cash_out"),
        timestamp=_prediction("2026-09-01T08:53:00"),
    )

    scores, failures = _score_fields("PILOT-X", "wallet_aware", row, fields)
    tx_type_score = next(item for item in scores if item["field"] == "tx_type")

    assert tx_type_score["exact_match"] is False
    assert any(item["error_code"] == "OCR-05" for item in failures)


def test_failure_output_does_not_include_values() -> None:
    row = {
        "sample_id": "PILOT-X",
        "amount_value": "5000",
        "amount_state": "present",
        "transaction_id": "PRIVATE123456",
        "transaction_id_state": "present",
        "transaction_type": "cash_out",
        "transaction_type_state": "cash_out",
        "timestamp_value": "2026-09-01T08:53:00",
        "timestamp_state": "present",
        "fee_value": "",
        "fee_state": "absent",
        "balance_value": "",
        "balance_state": "absent",
    }
    fields = ParsedTransactionFields(
        amount=_prediction(None),
        tx_id=_prediction("WRONG999999"),
        tx_type=_prediction("cash_out"),
        timestamp=_prediction("2026-09-01T08:53:00"),
    )

    _, failures = _score_fields("PILOT-X", "generic", row, fields)

    serialized = str(failures)
    assert "PRIVATE123456" not in serialized
    assert "WRONG999999" not in serialized


def test_moved_image_is_resolved_by_recorded_hash(tmp_path) -> None:
    image_dir = tmp_path / "TanxPhotos"
    image_dir.mkdir()
    image_path = image_dir / "renamed.jpg"
    image_path.write_bytes(b"image-bytes")
    expected_hash = hashlib.sha256(b"image-bytes").hexdigest()

    resolved, method = _resolve_image_path(
        tmp_path,
        "backend-api/original.jpg",
        expected_hash,
    )

    assert resolved == image_path
    assert method == "hash_alias"


def test_unresolved_hash_raises_without_substitution(tmp_path) -> None:
    image_dir = tmp_path / "TanxPhotos"
    image_dir.mkdir()
    (image_dir / "different.jpg").write_bytes(b"different-image")

    try:
        _resolve_image_path(tmp_path, "missing.jpg", "0" * 64)
    except FileNotFoundError as exc:
        assert "recorded hash" in str(exc)
    else:
        raise AssertionError("Expected unresolved provenance hash to fail")
