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

### 2026-10-17 — Session 2 (local validation)

**Local mock test harness**
- Added `backend/test/localTest.js`, a dependency-free harness that patches
  Node's module loader to inject in-memory fakes for `../lib/auth`,
  `../lib/s3`, `../lib/dynamodb`, and `uuid`. No AWS SDK install required.
- 34 assertions, all passing (`npm test` from `backend/`). Covers:
  upload-key scoping, cross-user key-claim rejection, size/missing-object
  rejection, ownership on list/download/delete, link vs recipient shares,
  revocation, expiry, share listing, and input validation.
- Added `test` script to `backend/package.json` and a README section.

### 2026-10-17 — Session 3 (deployment blocker review)

**Infrastructure fixes (template.yaml)**
- Removed reserved `AWS_REGION` from Lambda env vars (Lambda injects it).
- Added S3 `CorsConfiguration` (GET/PUT/HEAD, `*` origin) so browser pre-signed
  uploads work.
- API Gateway: `AddDefaultAuthorizerToCorsPreflight: false` + `GatewayResponses`
  for `DEFAULT_4XX`/`DEFAULT_5XX` with CORS headers, so OPTIONS preflight is not
  blocked by the Cognito authorizer and error responses stay CORS-readable.
- Upgraded Lambda runtime `nodejs18.x` → `nodejs20.x`.

**Fifth blocker found during review (token type)**
- API Gateway REST Cognito authorizers without OAuth scopes treat the bearer
  token as an **ID token**. The app was sending the **access token** while the
  backend verified `tokenUse: 'access'` — a mismatch that would cause 401s.
- Fixed end to end: frontend now sends the **ID token**
  (`getIdToken()` in `services/auth.js`; used by `api.js` and `SharedFile.jsx`),
  and backend `lib/auth.js` verifies `tokenUse: 'id'` (+ `clientId`/`aud` check).
- Frontend build passes; local harness still 34/34.

### 2026-10-22 — Session 4 (lab-account IAM constraint)

**Problem**
- First CloudFormation deploy failed at `CreateDownloadUrlFunctionRole`:
  `not authorized to perform: iam:CreateRole` (plus `UnauthorizedTaggingOperation`).
- Account is a restricted Vocareum/AWS Academy lab (`assumed-role/voclabs/...`)
  that forbids creating IAM roles, while SAM creates one role per function.

**Fix**
- `infrastructure/template.yaml` now takes a `LambdaRoleArn` parameter; all
  per-function `Policies` blocks were removed. Every function runs under the
  pre-provisioned `arn:aws:iam::958682950316:role/LabRole`.

**Second problem (found during first retry)**
- `sam build` failed with `InvalidGlobalsSectionException`: `Role` is **not** a
  supported property of `Globals.Function`, so the earlier attempt silently
  reused the previously built (stale) template and kept creating roles.
- Fix: `Role: !Ref LambdaRoleArn` is now set on **each** of the 9 functions
  (not in `Globals`). Verified the built template contains no `AWS::IAM::Role`.

**Deployment (success)**
- `sam build` + `sam deploy --stack-name secure-file-sharing --region us-east-1
  --s3-bucket secure-files-artifacts-30087 --capabilities CAPABILITY_IAM`
  with `CognitoUserPoolId`, `CognitoClientId`, `LambdaRoleArn`.
- Stack `CREATE_COMPLETE` in us-east-1. Outputs:
  - `ApiUrl` = https://tjhpqyqupj.execute-api.us-east-1.amazonaws.com/Prod
  - `S3BucketName` = secure-file-sharing-filesbucket-jojs7ddurqm3
  - `FilesTableName` = secure-file-sharing-FilesTable-19CWTOHKQNWGJ
  - `SharesTableName` = secure-file-sharing-SharesTable-1UY9KE77B2AHG
- Reset `frontend/.env` values come from these outputs; Amplify uses console env
  vars (see README).
- Tradeoff documented in README: coarser IAM permissions in the lab; a normal
  account can restore per-function least-privilege `Policies`.

### Next Steps
- Developer: create the Amplify app (repo `Tanishk680/Secure-Cloud-File-Sharing-System`,
  branch `main`), set the five `VITE_*` env vars, add the SPA rewrite, deploy.
- Developer: set the real `VITE_SHARE_BASE_URL` and redeploy.
- Developer: run the README testing checklist against the live stack.
