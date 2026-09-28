import re
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple

from dateutil import parser as dt_parser

from app.schemas import FieldPrediction, OcrSpan, ParsedTransactionFields

NUMBER_PATTERN = r"(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d{1,2})?"

AMOUNT_PATTERNS = [
    re.compile(r"(?i)(?:amount|amt|total)\D{0,20}(" + NUMBER_PATTERN + r")"),
    re.compile(r"(?i)(?:cash\s*(?:in|out)|payment|transfer)\D{0,20}(" + NUMBER_PATTERN + r")"),
]
FEE_PATTERN = re.compile(r"(?i)(?:fee|charge|service\s*fee)\D{0,20}(" + NUMBER_PATTERN + r")")
BALANCE_PATTERN = re.compile(
    r"(?i)(?:balance|remaining|available\s*balance)\D{0,20}(" + NUMBER_PATTERN + r")"
)
TX_ID_PATTERN = re.compile(
    r"(?i)(?:tx|trx|transaction)(?:\s*(?:id|no|number|code))\s*[:#-]?\s*([A-Za-z0-9-]{6,})"
)
GENERIC_ID_PATTERN = re.compile(r"\b[A-Z0-9]{10,}\b")

WALLET_AMOUNT_PATTERNS = {
    "kbzpay": [re.compile(r"(?i)(?:transaction\s*amount|transfer\s*amount)\D{0,20}(" + NUMBER_PATTERN + r")")],
    "wavepay": [re.compile(r"(?i)(?:amount\s*sent|amount\s*received)\D{0,20}(" + NUMBER_PATTERN + r")")],
    "cbpay": [re.compile(r"(?i)(?:transaction\s*amount|total\s*amount)\D{0,20}(" + NUMBER_PATTERN + r")")],
    "ayapay": [re.compile(r"(?i)(?:total\s*amount|top[- ]?up\s*amount)\D{0,20}(" + NUMBER_PATTERN + r")")],
}

TIMESTAMP_PATTERNS = [
    re.compile(r"\b\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\b"),
    re.compile(r"\b\d{2}[-/]\d{2}[-/]\d{4}[ T]\d{2}:\d{2}(?::\d{2})?\b"),
    re.compile(r"\b\d{2}[-/]\d{2}[-/]\d{4}\b"),
]

TX_TYPE_KEYWORDS = {
    "cash_in": ["cash in", "deposit", "received", "top up", "topup"],
    "cash_out": ["cash out", "withdraw", "sent", "payment"],
}


def _normalize_amount(value: str) -> str:
    cleaned = value.replace(",", "").replace(" ", "")
    if cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "")
    return cleaned


def _confidence_for_source(source_text: str, spans: List[OcrSpan]) -> float:
    if not source_text:
        return 0.0

    source_tokens = [t.lower() for t in re.findall(r"[A-Za-z0-9]+", source_text)]
    if not source_tokens:
        return 0.0

    confs: List[float] = []
    for token in source_tokens:
        for span in spans:
            if re.search(rf"\b{re.escape(token)}\b", span.text.lower()):
                confs.append(span.confidence)
                break

    if not confs:
        return 0.0
    return round(sum(confs) / len(confs), 4)


def _make_prediction(value: Optional[str], source: Optional[str], spans: List[OcrSpan]) -> FieldPrediction:
    if not value:
        return FieldPrediction(value=None, confidence=0.0, source_text=source)
    confidence = _confidence_for_source(source or value, spans)
    return FieldPrediction(value=value, confidence=confidence, source_text=source)


def _pick_first_match(patterns: List[re.Pattern], text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            return match.group(1), match.group(0), pattern.pattern
    return None, None, None


def _parse_timestamp(raw_text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    for pattern in TIMESTAMP_PATTERNS:
        match = pattern.search(raw_text)
        if not match:
            continue

        source = match.group(0)
        try:
            parsed = dt_parser.parse(source, fuzzy=False)
            return parsed.isoformat(), source, pattern.pattern
        except Exception:
            return None, source, pattern.pattern
    return None, None, None


def _detect_tx_type(raw_text: str) -> Tuple[Optional[str], Optional[str]]:
    lower_text = raw_text.lower()
    for tx_type, keywords in TX_TYPE_KEYWORDS.items():
        for kw in keywords:
            if kw in lower_text:
                return tx_type, kw
    return None, None


def parse_transaction_fields(
    spans: List[OcrSpan],
    wallet_app_type: Optional[str] = None,
    expected_tx_type: Optional[str] = None,
    min_required_confidence: float = 0.5,
    max_transaction_amount: int = 1_000_000_000,
) -> Tuple[ParsedTransactionFields, str, Dict[str, object]]:
    fields = ParsedTransactionFields()

    clean_spans = [s for s in spans if s.text and s.text.strip()]
    raw_text = "\n".join(span.text for span in clean_spans)

    diagnostics: Dict[str, object] = {
        "span_count": len(clean_spans),
        "matched_patterns": {},
        "warnings": [],
    }

    wallet_patterns = WALLET_AMOUNT_PATTERNS.get((wallet_app_type or "").lower(), [])
    amount_value, amount_source, amount_pattern = _pick_first_match(
        [*wallet_patterns, *AMOUNT_PATTERNS],
        raw_text,
    )
    if amount_value:
        amount_value = _normalize_amount(amount_value)

    fields.amount = _make_prediction(amount_value, amount_source, clean_spans)
    if amount_pattern:
        diagnostics["matched_patterns"]["amount"] = amount_pattern

    fee_match = FEE_PATTERN.search(raw_text)
    fee_value = _normalize_amount(fee_match.group(1)) if fee_match else None
    fee_source = fee_match.group(0) if fee_match else None
    fields.fee = _make_prediction(fee_value, fee_source, clean_spans)
    if fee_match:
        diagnostics["matched_patterns"]["fee"] = FEE_PATTERN.pattern

    balance_match = BALANCE_PATTERN.search(raw_text)
    balance_value = _normalize_amount(balance_match.group(1)) if balance_match else None
    balance_source = balance_match.group(0) if balance_match else None
    fields.balance = _make_prediction(balance_value, balance_source, clean_spans)
    if balance_match:
        diagnostics["matched_patterns"]["balance"] = BALANCE_PATTERN.pattern

    tx_id_match = TX_ID_PATTERN.search(raw_text)
    tx_id_value = tx_id_match.group(1) if tx_id_match else None
    tx_id_source = tx_id_match.group(0) if tx_id_match else None
    tx_id_pattern = TX_ID_PATTERN.pattern if tx_id_match else None

    if not tx_id_value:
        fallback_id = GENERIC_ID_PATTERN.search(raw_text)
        if fallback_id:
            tx_id_value = fallback_id.group(0)
            tx_id_source = fallback_id.group(0)
            tx_id_pattern = GENERIC_ID_PATTERN.pattern

    fields.tx_id = _make_prediction(tx_id_value, tx_id_source, clean_spans)
    if tx_id_pattern:
        diagnostics["matched_patterns"]["tx_id"] = tx_id_pattern

    detected_tx_type, detected_tx_type_source = _detect_tx_type(raw_text)
    tx_type_value = expected_tx_type or detected_tx_type
    tx_type_source = "request:tx_type" if expected_tx_type else detected_tx_type_source
    fields.tx_type = (
        FieldPrediction(value=tx_type_value, confidence=1.0, source_text=tx_type_source)
        if expected_tx_type
        else _make_prediction(tx_type_value, tx_type_source, clean_spans)
    )
    if tx_type_value:
        diagnostics["matched_patterns"]["tx_type"] = tx_type_source
    if expected_tx_type and detected_tx_type and expected_tx_type != detected_tx_type:
        diagnostics["warnings"].append(
            f"OCR transaction type {detected_tx_type} conflicts with requested {expected_tx_type}."
        )

    ts_value, ts_source, ts_pattern = _parse_timestamp(raw_text)
    fields.timestamp = _make_prediction(ts_value, ts_source, clean_spans)
    if ts_pattern:
        diagnostics["matched_patterns"]["timestamp"] = ts_pattern

    if not fields.amount.value:
        diagnostics["warnings"].append("Amount could not be confidently extracted.")
    if not fields.tx_id.value:
        diagnostics["warnings"].append("Transaction ID not found.")
    if not fields.timestamp.value:
        diagnostics["warnings"].append("Timestamp not found.")

    quality_reasons = []
    if not fields.amount.value:
        quality_reasons.append("Amount is required.")
    elif fields.amount.confidence < min_required_confidence:
        quality_reasons.append(
            f"Amount confidence {fields.amount.confidence:.2f} is below {min_required_confidence:.2f}."
        )
    else:
        try:
            amount_decimal = Decimal(fields.amount.value)
            if amount_decimal <= 0 or amount_decimal > max_transaction_amount:
                quality_reasons.append(
                    f"Amount must be between 0 and {max_transaction_amount}."
                )
        except InvalidOperation:
            quality_reasons.append("Amount is not a valid decimal value.")
    if not fields.tx_id.value:
        quality_reasons.append("Transaction ID is required.")
    elif fields.tx_id.confidence < min_required_confidence:
        quality_reasons.append(
            f"Transaction ID confidence {fields.tx_id.confidence:.2f} is below {min_required_confidence:.2f}."
        )
    diagnostics["quality"] = {
        "accepted": not quality_reasons,
        "reasons": quality_reasons,
        "min_required_confidence": min_required_confidence,
    }

    diagnostics["raw_text_preview"] = raw_text[:1000]
    return fields, raw_text, diagnostics
