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

Create `backend/.env` from `backend/.env.example`, then set `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. To deliver password reset emails, also set `RESEND_API_KEY` and `EMAIL_FROM`. Create a Resend account at https://resend.com, create an API key, and verify a sending domain; use an address on that verified domain for `EMAIL_FROM` (for example, `CareVault <passwords@example.com>`). Use a cryptographically random `SESSION_SECRET` with at least 32 characters. Keep `backend/.env` private; it is ignored by Git. `MONGODB_DATABASE` defaults to `carevault` if omitted.

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
- `GET /api/documents/:id` — fetch one owned document and a temporary signed file URL.
- `DELETE /api/documents/:id` — remove an owned file from Cloudinary and its metadata from MongoDB.
- `GET /api/health` — basic API process check.

Uploads accept PDF, JPG, JPEG, and PNG files up to 10 MB. The backend checks the extension, browser-provided MIME type, and file signature. Cloudinary stores the bytes as authenticated assets; MongoDB stores the metadata and Cloudinary identifiers, not the file bytes. The API creates a time-limited signed URL only when the owner opens a document. Passwords are salted and derived with Node's scrypt. Sessions use signed, HTTP-only, same-site cookies and expire after seven days. Login and registration attempts are rate limited. Deploy the frontend and API behind the same site so the cookie remains same-site. Document routes require a valid account session, and every document query is scoped to its owner.

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

User registration, login, logout, password reset, account sessions, and private document upload/list/open/delete are connected to MongoDB, Resend, and Cloudinary. Passwords are salted and derived with scrypt. Doctor accounts are self-identified and are not credential-verified; the clinician role does not grant access to another user's documents. Dashboard sample records, timeline, intake, connections, sharing controls, and preferences remain prototype UI and are not persisted. OAuth, email verification, clinician credential verification, and real patient-consent sharing are not implemented. Do not use the prototype workflows to coordinate care or store production medical records until the needed operational and regulatory controls are in place.
