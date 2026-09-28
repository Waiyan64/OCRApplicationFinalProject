# backend-api (NestJS)

NestJS API for OCR uploads, customer review, and confirmed transaction persistence.

## Implemented

- `POST /api/v1/ocr/process-upload` (JWT required)
  - Accepts multipart upload from frontend/backend clients
  - Validates image, wallet app, and `tx_type`
  - Forwards file to private OCR service `/v1/jobs/process-upload`
  - Returns HTTP 202 with the OCR job ID; no transaction is created yet
- `POST /api/internal/ocr/callback`
  - Validates callback payload DTO
  - Verifies bearer token and/or HMAC signature
  - Persists OCR result in MySQL as `awaiting_confirmation` (or `failed`), not as a transaction
- `GET /api/jobs/:jobId` (JWT required, owner only)
  - Poll for OCR result and review state
- `GET /api/jobs/pending-review` (JWT required)
  - Restore customer drafts after leaving or refreshing the upload page
- `POST /api/jobs/:jobId/confirm` (JWT required, owner only)
  - JSON body `{ "amount": 203333 }`; integer Ks, 1 to 1,000,000,000
  - Atomically creates one transaction with the customer-confirmed amount and marks the job `processed`
- `POST /api/jobs/:jobId/reject` (JWT required, owner only)
  - Marks the draft `rejected` without saving a transaction
- `GET /api/health`

Only confirmed transactions appear in records and dashboard totals. The OCR value remains in the job result; `confirmedAmount` is returned separately on confirmed jobs. A second confirm/reject attempt returns 409. Existing transactions saved by older versions are not retroactively changed. Development TypeORM schema synchronization adds the `awaiting_confirmation` and `rejected` enum values; create and apply an explicit MySQL migration before running with schema synchronization disabled in production.

## Auth modes

Set one or both:

- `OCR_CALLBACK_AUTH_TOKEN` for bearer token auth
- `OCR_CALLBACK_HMAC_SECRET` for HMAC auth using headers:
  - `x-ocr-timestamp`
  - `x-ocr-signature`

If neither is set, callbacks are accepted without auth (development only).

## Run

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run start:dev
```

3. Build:

```bash
npm run build
```

## OCR upload forwarding endpoint

Use this endpoint from your frontend instead of calling OCR directly.

`POST /api/v1/ocr/process-upload`

Multipart fields:

- `image` (required): image file
- `wallet_app_type` (required): example `wavepay`
- `tx_type` (required): `cash_in` or `cash_out`
- `job_id` (optional)
- `metadata_json` (optional JSON string)

Example:

```bash
curl -X POST http://localhost:3000/api/v1/ocr/process-upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "image=@/absolute/path/to/txn.png" \
  -F "wallet_app_type=wavepay" \
  -F "tx_type=cash_out"
```
