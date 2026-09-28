from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


class OcrJobRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=128)
    image_url: HttpUrl
    wallet_app_type: str = Field(min_length=1, max_length=64)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FieldPrediction(BaseModel):
    value: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source_text: Optional[str] = None


class ParsedTransactionFields(BaseModel):
    amount: FieldPrediction = Field(default_factory=FieldPrediction)
    tx_id: FieldPrediction = Field(default_factory=FieldPrediction)
    tx_type: FieldPrediction = Field(default_factory=FieldPrediction)
    timestamp: FieldPrediction = Field(default_factory=FieldPrediction)
    fee: FieldPrediction = Field(default_factory=FieldPrediction)
    balance: FieldPrediction = Field(default_factory=FieldPrediction)


class CallbackDelivery(BaseModel):
    attempted: bool = False
    callback_url: Optional[str] = None
    status_code: Optional[int] = None
    ok: bool = False
    error: Optional[str] = None
    response_excerpt: Optional[str] = None


class OcrJobResult(BaseModel):
    job_id: str
    status: Literal["processed", "failed"]
    wallet_app_type: str
    fields: ParsedTransactionFields = Field(default_factory=ParsedTransactionFields)
    raw_text: str = ""
    diagnostics: Dict[str, Any] = Field(default_factory=dict)
    callback: CallbackDelivery = Field(default_factory=CallbackDelivery)
    processing_ms: int = 0
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error: Optional[str] = None


class OcrJobAccepted(BaseModel):
    job_id: str
    status: Literal["processing"] = "processing"


class OcrSpan(BaseModel):
    text: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    variant: str = "default"


class RuntimeDiagnostics(BaseModel):
    app_name: str
    env: str
    checks: Dict[str, Any]
    selected_ocr_backend: Optional[str] = None
    available_ocr_backends: List[str] = Field(default_factory=list)
