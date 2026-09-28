# OCR AI Service (FastAPI)

Private OCR worker API that receives transaction image jobs, preprocesses with OpenCV, runs OCR, parses fields, and posts results back to a NestJS callback endpoint.

## Features

- Receives job payload with `image_url` and `wallet_app_type`
- Downloads and validates image payload size and host policy
- Preprocesses image variants with OpenCV
- Runs OCR using `rapidocr` (preferred) or `tesseract` (fallback)
- Parses transaction fields:
  - `amount`
  - `tx_id`
  - `tx_type`
  - `timestamp`
  - `fee`
  - `balance`
- Produces field-level confidence scores
- Returns multipart jobs as HTTP 202 and processes them in bounded background tasks
- Persists results to a trusted NestJS callback endpoint with retry and a disk outbox
- Authenticates private endpoints with `x-ocr-service-token`
- Applies byte, pixel, host, redirect, confidence, and amount limits
- Exposes runtime diagnostics and health checks

## Runtime checks and diagnostics

- Startup captures dependency status with `/v1/diagnostics/runtime`
- Reports available OCR backends and selected backend
- Job response includes detailed diagnostics when enabled

## Quick start

1. Create venv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Copy env file:

```bash
cp .env.example .env
```

3. Run service:

```bash
uvicorn app.main:app --reload --port 8100
```

## API

### Health

`GET /health`

### Runtime diagnostics

`GET /v1/diagnostics/runtime` requires the `x-ocr-service-token` header.

### Process OCR job

`POST /v1/jobs/process`

Example request:

```json
{
  "job_id": "job-001",
  "image_url": "https://example.com/signed-url/image.png",
  "wallet_app_type": "wavepay",
  "metadata": {
    "agent_id": "A123"
  }
}
```

### Process OCR job with direct image upload

`POST /v1/jobs/process-upload`

Use multipart/form-data when your backend receives an uploaded file and wants to pass bytes directly to OCR service.

Example:

```bash
curl -X POST http://localhost:8100/v1/jobs/process-upload \
  -H "x-ocr-service-token: local-dev-ocr-service-token" \
  -F "job_id=job-upload-001" \
  -F "wallet_app_type=wavepay" \
  -F "tx_type=cash_out" \
  -F "image=@/absolute/path/to/transaction.png" \
  -F "metadata_json={\"agent_id\":\"A123\",\"source\":\"backend-upload\"}"
```

The upload endpoint returns HTTP 202 with a job ID. Results are delivered asynchronously to the configured `NESTJS_CALLBACK_URL`.

## Callback payload

The callback receives the full `OcrJobResult` JSON:

- `status`: `processed` or `failed`
- `fields`: parsed values and confidence scores
- `raw_text`: aggregated OCR text
- `diagnostics`: preprocessing, OCR, and parser details
- `processing_ms`
- `error` (if failed)

## Notes

- Keep this service private behind internal networking.
- Use signed image URLs from object storage.
- Use separate service-auth and callback-HMAC secrets in production.
- See [../notes/ocr-service-hardening.md](../notes/ocr-service-hardening.md) for setup, recovery, and validation steps.
