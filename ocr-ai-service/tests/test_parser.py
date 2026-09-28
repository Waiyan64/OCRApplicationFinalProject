from app.schemas import OcrSpan
from app.services.parser import parse_transaction_fields


def test_parse_transaction_fields_basic_case() -> None:
    spans = [
        OcrSpan(text="Amount: 25,000", confidence=0.98, variant="gray"),
        OcrSpan(text="Tx ID: TXNABC123456", confidence=0.96, variant="gray"),
        OcrSpan(text="Cash Out", confidence=0.93, variant="gray"),
        OcrSpan(text="2026-08-23 10:30:45", confidence=0.95, variant="gray"),
        OcrSpan(text="Fee: 500", confidence=0.90, variant="gray"),
        OcrSpan(text="Balance: 100,000", confidence=0.92, variant="gray"),
    ]

    fields, raw_text, diagnostics = parse_transaction_fields(spans)

    assert fields.amount.value == "25000"
    assert fields.tx_id.value == "TXNABC123456"
    assert fields.tx_type.value == "cash_out"
    assert fields.fee.value == "500"
    assert fields.balance.value == "100000"
    assert fields.timestamp.value is not None
    assert raw_text
    assert "matched_patterns" in diagnostics
    assert diagnostics["quality"]["accepted"] is True


def test_reference_number_is_not_used_as_amount() -> None:
    spans = [
        OcrSpan(text="Balance: 50,000", confidence=0.99),
        OcrSpan(text="Amount unavailable", confidence=0.95),
        OcrSpan(text="Reference: 123456789012", confidence=0.98),
    ]

    fields, _, diagnostics = parse_transaction_fields(spans)

    assert fields.amount.value is None
    assert diagnostics["quality"]["accepted"] is False
    assert "Amount is required." in diagnostics["quality"]["reasons"]


def test_transaction_code_is_preferred_over_generic_text() -> None:
    spans = [
        OcrSpan(text="CREDITCARDREPAYMENT", confidence=0.99),
        OcrSpan(text="Transaction Code", confidence=0.97),
        OcrSpan(text="273574430529", confidence=0.98),
        OcrSpan(text="Total Amount 203,333", confidence=0.95),
    ]

    fields, _, _ = parse_transaction_fields(spans, wallet_app_type="ayapay")

    assert fields.tx_id.value == "273574430529"


def test_requested_transaction_type_is_authoritative() -> None:
    spans = [
        OcrSpan(text="Amount: 1,000", confidence=0.99),
        OcrSpan(text="Transaction ID: ABCDEF123456", confidence=0.99),
        OcrSpan(text="Payment sent", confidence=0.99),
    ]

    fields, _, diagnostics = parse_transaction_fields(
        spans,
        expected_tx_type="cash_in",
    )

    assert fields.tx_type.value == "cash_in"
    assert fields.tx_type.source_text == "request:tx_type"
    assert any("conflicts" in warning for warning in diagnostics["warnings"])


def test_excessive_amount_fails_quality_gate() -> None:
    spans = [
        OcrSpan(text="Amount: 9,999,999,999", confidence=0.99),
        OcrSpan(text="Transaction ID: ABCDEF123456", confidence=0.99),
    ]

    _, _, diagnostics = parse_transaction_fields(spans)

    assert diagnostics["quality"]["accepted"] is False
    assert any("between" in reason for reason in diagnostics["quality"]["reasons"])
