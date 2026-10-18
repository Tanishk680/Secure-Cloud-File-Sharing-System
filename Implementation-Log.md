# Implementation-Log.md - Secure Cloud File Sharing System Using AWS

## Project Info
- Start Date: 2026-10-17
- Repo: https://github.com/Tanishk680/Secure-Cloud-File-Sharing-System.git
- Local: C:\Users\HP\OneDrive\Desktop\CCL_Miniproject

## Requirements Summary
- Six AWS services only: Amplify, Cognito, API Gateway, Lambda, S3, DynamoDB.
- Private S3 (Block Public Access, SSE-S3); never public.
- Short-lived pre-signed URLs for upload/download.
- DynamoDB stores file metadata + shares (expiry in epoch seconds, revoked flag).
- Two share modes: anyone-with-link and specific authenticated recipient.
- Ownership + share validity checked in Lambda on every request.
- Revocation/expiry does NOT invalidate already-issued pre-signed URLs (documented).

---

## Progress Log

### 2026-10-17 — Session 1

**Recon**
- Read `Implementstion-Brief.md` and `CC_Abstract.md`; confirmed requirements.
- Repo was effectively empty (only abstract + brief). Initialized the proposed
  structure: `frontend/`, `backend/`, `infrastructure/`.
- Created `TODO.md` and this `Implementation-Log.md`.

**Backend (Node.js 18, AWS SDK v3)**
- `backend/package.json` with `@aws-sdk/client-{s3,dynamodb}`, `lib-dynamodb`,
  `s3-request-presigner`, `aws-jwt-verify`, `uuid`.
- `backend/lib/auth.js` — Cognito JWT verification (required + optional variants).
- `backend/lib/s3.js` — pre-signed PUT/GET URL generation, delete, object metadata.
- `backend/lib/dynamodb.js` — file + share data access over FilesTable/SharesTable.
- `backend/lib/validation.js` — file name/type/size, expiry, and share-type checks.
- Nine handlers in `backend/functions/`:
  `createUploadUrl`, `confirmUpload`, `listFiles`, `createDownloadUrl`,
  `deleteFile`, `createShare`, `resolveShare`, `listShares`, `revokeShare`.
- Hardening: confirmUpload verifies the S3 key is under the caller's namespace
  (`uploads/{ownerId}/...`) and that the stored object size matches the declared
  size before persisting metadata.
- All handlers pass `node --check`.

**Infrastructure (AWS SAM)**
- `infrastructure/template.yaml` defines: private S3 bucket, two DynamoDB tables
  with GSIs (`ownerId-index`, `fileId-index`), nine Lambda functions with
  least-privilege policies, and a `Prod` REST API with a Cognito authorizer
  (default) + CORS. `resolveShare` overrides to `Authorizer: NONE` so link
  shares work without login.
- Cognito is created manually; User Pool ID + Client ID passed as parameters.
- `amplify.yml` (repo root + infrastructure) builds `frontend/` to `frontend/dist`.
- Validated as well-formed YAML (13 resources).

**Frontend (React 18 + Vite)**
- Chose Vite over CRA for a lighter toolchain (CRA dependency resolution failed
  with current `aws-amplify` v6 peers).
- `src/services/config.js` — Amplify v6 Auth config from `VITE_*` env vars.
- `src/services/auth.js` — token/user helpers built on `aws-amplify/auth`.
- `src/services/api.js` — axios instance with auth interceptor + all API calls.
- `src/components/` — `Navbar`, `ShareDialog`.
- `src/pages/` — `Login` (register/confirm/resend), `Dashboard`, `Upload` (with
  progress), `SharedFile` (public resolution), `Shares` (management/revoke).
- `src/App.jsx` — routing + auth guard; `/shared/:shareId` is public.
- Production build verified: `vite build` succeeds (~364 kB JS).

**Docs**
- `README.md` — architecture, data model, API table, AWS setup steps,
  environment variables, deployment (SAM + Amplify), testing checklist,
  security notes, and the pre-signed URL limitation.

**Deliberately not done (requires real AWS account/credentials)**
- No AWS resources have been deployed or end-to-end tested. No account IDs, keys,
  bucket names, or URLs were invented. Developer must deploy per README.

### Next Steps
- Developer: create Cognito User Pool/App Client, then `sam build && sam deploy`.
- Developer: configure `frontend/.env` and deploy via Amplify.
- Developer: run the README testing checklist against the live stack.
- Optional: add DynamoDB TTL attribute (documented as non-security cleanup only).
