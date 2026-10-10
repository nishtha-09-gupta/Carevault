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

Create `backend/.env` from `backend/.env.example`, then set `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. To deliver password-reset emails, configure `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM` for a Gmail account with a Google App Password. These values are backend-only; keep `backend/.env` private. Use a cryptographically random `SESSION_SECRET` with at least 32 characters. `MONGODB_DATABASE` defaults to `carevault` if omitted.

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

Uploads accept PDF, JPG, JPEG, and PNG files up to 10 MB. The backend checks the extension, browser-provided MIME type, and file signature. Cloudinary stores the bytes as authenticated assets; MongoDB stores the metadata and Cloudinary identifiers, not the file bytes. The API streams files only after checking the owner or active patient-doctor grant. Passwords are salted and derived with Node's scrypt. Sessions use signed, HTTP-only, same-site cookies and expire after seven days. Login and registration attempts are rate limited. Deploy the frontend and API behind the same site so the cookie remains same-site. Document routes require a valid account session, and every document query is scoped to its owner.

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

The login page provides credential autofill for two seeded interview accounts. Use `demo@gmail.com` / `demo123` for the patient or `doctor.demo@gmail.com` / `doctor123` for the doctor, then submit through the regular login form. At backend startup, the seed reuses those email identities (and promotes the prior `demo@carevault.invalid` patient in place when present), ensures nine sample PDF documents and four sample medical records exist only under the demo patient account, and establishes an active patient-controlled access grant using the normal access model. Demo documents and records are stored with stable seed keys, so startup does not duplicate them. The grant expires after 30 days; the initializer refreshes expired/revoked fixture access on server startup, and a normal login refreshes expired demo access without changing revoked access. Seeded accounts use regular password hashing, sessions, document APIs, and authorization. Other accounts do not receive demo data.
