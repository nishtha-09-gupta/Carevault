# CareVault

CareVault is organized as two applications:

- `frontend/` — React/Vite user interface.
- `backend/` — Express API, MongoDB models, and Cloudinary document storage.

## Setup

Requirements: Node.js 20 or later, MongoDB (local or Atlas), and a Cloudinary account.

Install dependencies in each application:

```sh
npm --prefix frontend install
npm --prefix backend install
```

Create `backend/.env` from `backend/.env.example`, then set `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. To enable document analysis, set the backend-only `GROQ_API_KEY` and `GROQ_MODEL`. The key is never sent to the frontend. To deliver password-reset emails, configure `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM` for a Gmail account with a Google App Password. Keep all backend values private. Use a cryptographically random `SESSION_SECRET` with at least 32 characters. `MONGODB_DATABASE` defaults to `carevault` if omitted.

## Run locally

Start each application in a separate terminal from the project root:

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

Vite serves the UI at http://localhost:5173 and proxies `/api` requests to Express at http://localhost:4000. The backend waits for MongoDB before it starts. Cloudinary is needed when a file is uploaded or opened.

Build the frontend with `npm --prefix frontend run build`. Run backend validation tests with `npm --prefix backend test`.

## Accounts and document API

- `POST /api/auth/register` — create a patient or clinician account with name, email, and password.
- `POST /api/auth/login` — authenticate with email and password.
- `POST /api/auth/forgot-password` — request or resend a time-limited email verification code.
- `POST /api/auth/verify-reset-otp` — verify the email code and receive a short-lived reset authorization.
- `POST /api/auth/reset-password` — set a new password using the reset authorization.
- `POST /api/auth/logout` — revoke active sessions and clear the session cookie.
- `GET /api/auth/me` — return the authenticated account.

- `POST /api/documents` — send one multipart file in a field named `document`.
- `GET /api/documents` — list the authenticated account's document metadata.
- `GET /api/documents/:id` — fetch metadata for one owned document.
- `GET /api/documents/:id/file` — stream an owned document through the authenticated API without exposing its Cloudinary URL.
- `DELETE /api/documents/:id` — remove an owned file from Cloudinary and its metadata from MongoDB.
- `GET /api/documents/:id/analysis` — get the status/results for an owned document.
- `PUT /api/documents/:id/analysis/:analysisId/review` — save patient edits to extracted information.
- `POST /api/documents/:id/analysis/:analysisId/confirm` — explicitly add reviewed information as a medical record linked to the original document.
- `POST /api/documents/:id/analysis/retry` — retry failed analysis.
- `GET /api/medical-records` — patient-only saved entries plus owned document metadata.
- `POST /api/medical-records` and `PUT /api/medical-records/:id` — create or update a patient-owned medical record, optionally linked to an owned document ID.
- `DELETE /api/medical-records/:id` — delete an owned medical record.
- `GET /api/medical-records/timeline` — patient-only chronological events from dated medical records and owned documents. Upload dates are labeled separately from medical event dates.
- `GET /api/access/doctors?q=...` — patient-only doctor search.
- `GET /api/access` — patient's access history or the authenticated doctor's active patient grants.
- `POST /api/access` and `DELETE /api/access/:id` — patient-only grant and revoke operations.
- `GET /api/doctor/patients` — list patients who currently grant access to the authenticated doctor, including document counts.
- `GET /api/doctor/patients/:patientId` — return the authenticated doctor's active or expired, unrevoked grant details; revoked and unknown patients are denied.
- `GET /api/doctor/patients/:patientId/documents` and `/api/doctor/patients/:patientId/documents/:documentId/file` — patient-scoped records and file streaming, checked against the active grant on every request.
- `GET /api/health` — basic API process check.

## Sharing & access history

The **Sharing & access** page uses the existing access-grants API. Its history can be filtered by All, Active, Expired, or Revoked, with counts derived from the returned grants and their expiry times. Search matches the other person's name or email and works together with the status filter. Results show six grants per page with a summary and page controls; changing the search or filter returns to page one. Patients can revoke only active, unexpired grants, after confirming the action. Filtering and pagination do not change grant records or backend authorization behavior.

Uploads accept PDF, JPG, JPEG, and PNG files up to 10 MB. The backend checks the extension, browser-provided MIME type, and file signature. Cloudinary stores the bytes as authenticated assets; MongoDB stores the metadata and Cloudinary identifiers, not the file bytes. The API streams files only after checking the owner or active patient-doctor grant. Passwords are salted and derived with Node's scrypt. Sessions use signed, HTTP-only, same-site cookies and expire after seven days. Login and registration attempts are rate limited. Deploy the frontend and API behind the same site so the cookie remains same-site. Document routes require a valid account session, and every document query is scoped to its owner.

## Asynchronous document analysis

After a successful upload, the API persists the document first and then writes an idempotent analysis job to MongoDB. The API-host process runs a worker that claims jobs using atomic MongoDB updates and expiring leases, so pending and interrupted jobs survive refreshes, logout, and backend restarts. Multiple API instances may run the worker safely. MongoDB is the persistent queue; no Redis service is required. If job creation is interrupted, a recovery scan finds pending document rows. Transient Groq/storage failures retry with bounded backoff; exhausted jobs remain `Failed` and can be retried by the patient. Missing Groq configuration does not block upload.

Digital PDF text is read with PDF.js and skips OCR when sufficient embedded text is available. Image uploads and scanned PDF pages use Tesseract.js English OCR; scanned PDFs default to a limit of 8 pages (`DOCUMENT_OCR_MAX_PAGES`). Embedded page images are extracted and downscaled only when they exceed 2200 pixels on an edge. Digital PDFs default to a 20-page limit (`DOCUMENT_MAX_PDF_PAGES`). OCR may need to download English language data from the Tesseract.js CDN on first use after a fresh host start; allow outbound HTTPS from the backend. Extracted text is held in worker memory and sent to Groq. A bounded, short-lived in-memory cache reuses extracted text for transient retries, clears it after success, and never writes it to MongoDB or logs. Raw report text and private Cloudinary URLs are not logged. MongoDB stores validated extracted fields and evidence snippets. Patients can edit results and must explicitly confirm them before the app creates a record/timeline event. The source document ID is retained on the record. Doctors can read analysis only through the same active patient grant that controls document access; the grant is rechecked for each request. Worker logs include stage durations, OCR mode/page counts, and Groq token counts only.

Set `GROQ_MODEL` to a model currently enabled for your Groq account and strict JSON Schema output. The current implementation locally allowlists `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, and `qwen/qwen3.8-27b`, based on Groq's published [Structured Outputs model list](https://console.groq.com/docs/structured-outputs). It sends one strict-schema completion request per attempt instead of making a separate models-list request first; model/account availability failures are handled as retryable or actionable job failures. For local setup, add both `GROQ_API_KEY` and `GROQ_MODEL` to `backend/.env`, restart the API, then upload a synthetic test document. If the key is omitted, uploads still work but jobs eventually show `Failed` until the environment is configured and the patient retries.

Local steps: run `npm --prefix backend install` and `npm --prefix frontend install`; copy `backend/.env.example` to `backend/.env`; fill in MongoDB, Cloudinary, session, and CORS settings; set `GROQ_API_KEY` and `GROQ_MODEL` to enable analysis; start MongoDB, then run `npm --prefix backend run dev` and `npm --prefix frontend run dev` in separate terminals. `GROQ_API_KEY` is optional for upload testing; queued jobs will retry and eventually show Failed until Groq is configured.

Render deployment steps: use the existing API service with backend root directory `backend`, build command `npm install`, and start command `npm start`. Add `GROQ_API_KEY`, `GROQ_MODEL`, and optionally `DOCUMENT_OCR_MAX_PAGES`/`DOCUMENT_MAX_PDF_PAGES` in that Render service's Environment settings, alongside its existing MongoDB, Cloudinary, session, CORS, and email values; keep the key out of Vercel variables and Git. The first API start creates the analysis collection and required unique indexes. No separate worker service, Redis, or Render disk is needed because job state is in MongoDB. Ensure the service can make outbound HTTPS requests to `api.groq.com` and the Tesseract.js language-data CDN. Deploy the frontend changes to Vercel as part of the same release. After deployment, verify `/api/health`, sign in with a patient account, open **AI Analysis**, select a synthetic PDF/image, start analysis, and review/confirm before checking the medical timeline.

## Project layout

- `frontend/src/pages/` — React screens.
- `frontend/src/components/` — reusable UI components.
- `frontend/src/services/authApi.js` — account registration, login, logout, and session lookup.
- `frontend/src/services/documentApi.js` — authenticated document requests.
- `backend/src/routes/` — Express route definitions.
- `backend/src/controllers/` — request handling and account-scoped MongoDB queries.
- `backend/src/models/` — Mongoose schemas.
- `backend/src/services/` — Cloudinary file storage operations.
- `backend/src/middleware/` — request identity and error handling.

## Current product boundary

User registration, login, logout, password reset, account sessions, private document upload/list/open/delete, patient-owned medical records, and time-limited patient-to-doctor grants are connected to MongoDB and Cloudinary. Patient grants can be revoked, expire by timestamp, and gate doctor access to each patient's documents. Medical record CRUD and timeline APIs are patient-only; the doctor interface continues to use the existing shared-document grant and submitted-intake rules. Medical records may link to an owned document by its MongoDB ID without copying file data. Doctor accounts are self-identified and are not credential-verified. OAuth, email verification, clinician credential verification, and broader operational and regulatory controls are not implemented.

The login page offers passwordless **Demo Patient** and **Demo Doctor** options. The backend stores only randomly generated password hashes for these dedicated accounts; users authenticate through a rate-limited role endpoint, and normal password login and password recovery cannot be used to enter or change demo accounts. Once authenticated, demo accounts use the normal patient and doctor workflows. Patient actions remain owner-scoped, and doctor access to patient records still requires that patient's active grant. The demo doctor receives no access to real patients unless they explicitly grant it; the seeded demo-to-demo grant can be revoked and is not restored after revocation or expiry. The demo patient and doctor use separate reserved `@carevault.invalid` identities; startup fails closed if either identity is occupied by a non-demo account or the doctor is paired with another patient. The old demo email identities are no longer accepted as demo logins.

Production demo setup is disabled by default. After reviewing the deployment change and approving demo account creation and Cloudinary uploads, set `ENABLE_DEMO_ACCOUNTS=true` on the backend host and restart/deploy the backend. Startup verifies all nine checked-in fictional PDF fixtures against their SHA-256 allowlist before any upload, seeds four synthetic medical records under the dedicated demo patient, and creates only the demo-to-demo access grant. Keep the flag unset or `false` to leave production demo setup disabled. Never copy patient records into demo accounts or replace the fixture files without updating and reviewing the allowlist.
