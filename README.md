# Secure Cloud File Sharing System Using AWS

A serverless, web-based application that lets authenticated users upload, manage,
download, and securely share files using Amazon Web Services. Files are stored
privately in Amazon S3; metadata and sharing rules live in Amazon DynamoDB; and
access is granted only through short-lived pre-signed URLs after Lambda has
verified ownership and share validity.

This project was built for a college **Cloud Computing Lab MiniProject** and
demonstrates practical integration of serverless computing, cloud storage,
authentication, NoSQL databases, and secure file sharing.

---

## Architecture

```
Browser (React SPA)
   │  Cognito tokens (login/register)
   ▼
Amazon Cognito ──► issues JWT access token
   │
   ▼
React app ──(Bearer token)──► Amazon API Gateway ──► AWS Lambda ──► Amazon S3 (private)
                                            │                    Amazon DynamoDB (metadata/shares)
                                            ▼
                                    short-lived pre-signed URLs
```

### AWS services used (exactly six)

| Service | Responsibility |
|---|---|
| **AWS Amplify** | Hosts the React frontend |
| **Amazon Cognito** | Registers, logs in, and authenticates users |
| **Amazon API Gateway** | Exposes the REST API and validates Cognito tokens |
| **AWS Lambda** | Runs backend business logic |
| **Amazon S3** | Stores file objects privately (encrypted, no public access) |
| **Amazon DynamoDB** | Stores file metadata, ownership, share records, and expiry |

> AWS KMS and CloudWatch are intentionally **not** separate architectural
> components. S3 uses S3-managed (SSE-S3) encryption. Lambda emits standard
> execution logs through AWS's built-in logging integration, but there is no
> dedicated monitoring subsystem.

---

## Repository layout

```text
secure-cloud-file-sharing/
├── frontend/                      # React (Vite) single-page app
│   ├── src/
│   │   ├── components/            # Navbar, ShareDialog
│   │   ├── pages/                 # Login, Dashboard, Upload, SharedFile, Shares
│   │   ├── services/              # config (Amplify), auth, api (axios)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
├── backend/                       # Lambda code
│   ├── functions/                 # One handler per API operation
│   │   ├── createUploadUrl.js
│   │   ├── confirmUpload.js
│   │   ├── listFiles.js
│   │   ├── createDownloadUrl.js
│   │   ├── deleteFile.js
│   │   ├── createShare.js
│   │   ├── resolveShare.js
│   │   ├── listShares.js
│   │   └── revokeShare.js
│   ├── lib/                       # shared helpers
│   │   ├── auth.js                # Cognito JWT verification
│   │   ├── s3.js                  # pre-signed URLs + object metadata
│   │   ├── dynamodb.js            # files + shares data access
│   │   └── validation.js          # input validation
│   ├── package.json
│   └── .env.example
├── infrastructure/
│   ├── template.yaml              # AWS SAM definition of all resources
│   └── amplify.yml                # Amplify build spec (copy at repo root too)
├── amplify.yml                    # Amplify build spec
├── README.md
└── .gitignore
```

---

## How it works

### Authentication
1. The user registers/logs in via the React app, which calls **Cognito** directly.
2. Cognito returns JWTs to the browser. The app sends the **ID token** as the
   bearer credential (a REST API Cognito authorizer without OAuth scopes expects
   an ID token).
3. The axios client attaches `Authorization: Bearer <token>` to every API call.
4. **API Gateway** validates the token with a Cognito authorizer before invoking
   Lambda. Lambda independently re-verifies the same token as defense in depth.

### Upload (no file bytes flow through Lambda)
1. The frontend calls `POST /files/upload-url` with name, type, and size.
2. Lambda validates the metadata, generates a unique S3 key
   (`uploads/{ownerId}/{fileId}/{sanitized-name}`) and returns a short-lived
   pre-signed **PUT** URL.
3. The browser uploads the file **directly to S3**.
4. The frontend calls `POST /files` to confirm.
5. Lambda verifies the object exists, that it lives under the caller's key
   namespace, and that its size matches; only then does it persist metadata to
   DynamoDB.

### Download
- Owner downloads: `GET /files/{fileId}/download-url` checks ownership and
  returns a 5-minute pre-signed **GET** URL.

### Sharing
- `POST /files/{fileId}/shares` creates a share record with a `shareId`,
  `shareType` (`link` or `recipient`), optional `recipientId`, `expiresAt`
  (epoch seconds), and `revoked = false`. Expiry options: **1h / 24h / 7d**.
- `GET /shares/{shareId}` resolves a share. It rejects revoked shares, expired
  shares (`expiresAt` compared against server time), and — for recipient shares
  — any caller whose Cognito `sub` is not the recorded `recipientId`. On success
  it returns a short-lived pre-signed GET URL.
- `GET /files/{fileId}/shares` lists shares for a file owned by the caller.
- `DELETE /shares/{shareId}` revokes a share owned by the caller.

### Important security limitation
Revoking or expiring a share **prevents new pre-signed URLs from being issued**.
A pre-signed URL that was *already issued* remains valid until its own lifetime
elapses (kept deliberately short, ~5 minutes). DynamoDB TTL is **not** treated as
the security check — every resolution compares `expiresAt` to the current server
time and checks `revoked`.

---

## Data model (DynamoDB)

### FilesTable
Primary key: `fileId` (string). GSI: `ownerId-index` on `ownerId`.

| Attribute | Description |
|---|---|
| `fileId` | Application-level UUID |
| `ownerId` | Cognito `sub` of the owner |
| `fileName` | Original display name |
| `s3Key` | Unique object key in S3 |
| `contentType` | Validated MIME type |
| `fileSize` | Size in bytes |
| `createdAt` | ISO 8601 timestamp |

### SharesTable
Primary key: `shareId` (string). GSI: `fileId-index` on `fileId`.

| Attribute | Description |
|---|---|
| `shareId` | Unguessable UUID |
| `fileId` | Associated file |
| `ownerId` | Owner of the file |
| `shareType` | `link` or `recipient` |
| `recipientId` | Required for recipient shares |
| `createdAt` | ISO 8601 timestamp |
| `expiresAt` | Epoch seconds |
| `revoked` | Boolean |

---

## REST API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/files/upload-url` | Cognito | Get a pre-signed upload URL |
| POST | `/files` | Cognito | Confirm upload, save metadata |
| GET | `/files` | Cognito | List the caller's files |
| GET | `/files/{fileId}/download-url` | Cognito | Pre-signed download URL (owner) |
| DELETE | `/files/{fileId}` | Cognito | Delete an owned file |
| POST | `/files/{fileId}/shares` | Cognito | Create a share |
| GET | `/files/{fileId}/shares` | Cognito | List shares for an owned file |
| GET | `/shares/{shareId}` | Public* | Resolve a share, get access |
| DELETE | `/shares/{shareId}` | Cognito | Revoke an owned share |

\* Public only for `link` shares. `recipient` shares require a valid token whose
`sub` matches the recorded recipient, and return `401`/`403` otherwise.

Status codes used: `200`, `201`, `400`, `401`, `403`, `404`, `500`.

---

## AWS configuration required from the developer

> No AWS account IDs, keys, or URLs are invented in this repo. You must supply
> real values. This project has **not** been deployed by the author of this
> repo — the steps below are how to deploy it yourself.

1. **Amazon Cognito User Pool**
   - Create a user pool (email sign-in).
   - Create an **app client** with no client secret (SPA).
   - Note the **User Pool ID** and **App Client ID**.
   - (Recommended for faster demo) allow auto-confirmation or use the email
     verification flow the UI already implements.
   - Optionally add a custom attribute or rely on the built-in `sub` as the user
     ID used for recipient-restricted shares.

2. **Amazon S3 bucket** — created by the SAM template with:
   - Block Public Access **enabled**
   - Default encryption **SSE-S3 (AES256)**

3. **Amazon DynamoDB tables** — created by the template (`FilesTable`,
   `SharesTable`) with the GSIs described above.

4. **AWS Lambda + IAM** — created by the template with least-privilege policies
   (S3 read/write on the one bucket, DynamoDB read/write on the two tables).

5. **Amazon API Gateway** — created by the template (stage `Prod`) with a
   Cognito authorizer as the default and CORS enabled.

6. **AWS Amplify** — connects to your Git repo and runs `amplify.yml`.

---

## Environment variables

### Frontend (`frontend/.env`)

| Variable | Example | Notes |
|---|---|---|
| `VITE_COGNITO_USER_POOL_ID` | `us-east-1_abc123` | From Cognito |
| `VITE_COGNITO_CLIENT_ID` | `1a2b3c...` | App client ID |
| `VITE_AWS_REGION` | `us-east-1` | Cognito/S3 region |
| `VITE_API_BASE_URL` | `https://xxx.execute-api.us-east-1.amazonaws.com/Prod` | API Gateway stage URL |
| `VITE_SHARE_BASE_URL` | `https://main.xxxx.amplifyapp.com` | Used to build share links |

### Backend (set by the SAM template automatically)

`S3_BUCKET_NAME`, `DYNAMODB_FILES_TABLE`, `DYNAMODB_SHARES_TABLE`,
`FILES_OWNER_INDEX`, `SHARES_FILE_INDEX`, `COGNITO_USER_POOL_ID`,
`COGNITO_CLIENT_ID`, `AWS_REGION`.

---

## Deployment

### 1. Deploy the backend (AWS SAM)

```bash
# Prerequisites: AWS CLI configured, SAM CLI installed, Node.js 20+
cd infrastructure
sam build
sam deploy --guided \
  --parameter-overrides \
      CognitoUserPoolId=<your-user-pool-id> \
      CognitoClientId=<your-app-client-id>
```

`sam deploy` outputs the **API base URL** and resource names. Copy the API URL
into `frontend/.env` as `VITE_API_BASE_URL`.

### 2. Run the frontend locally

```bash
cd frontend
copy .env.example .env      # then edit values (Windows)
npm install
npm run dev                 # http://localhost:3000
```

### 3. Deploy the frontend (AWS Amplify)

- Connect the GitHub repo in the Amplify console.
- Amplify reads `amplify.yml` at the repo root, builds `frontend/`, and
  publishes `frontend/dist`.
- Add the `VITE_*` environment variables in the Amplify console.
- After the first deploy, set `VITE_SHARE_BASE_URL` to the Amplify domain.

---

## Testing checklist

Authentication
- [ ] Register, confirm the email code, and log in.
- [ ] Logout clears the session.

Files
- [ ] Upload a permitted file type within 50 MB; it appears on the dashboard.
- [ ] Upload an oversized or disallowed file; it is rejected.
- [ ] Download an owned file.
- [ ] Delete an owned file; it disappears from the list.

Sharing
- [ ] Create a `link` share (1h/24h/7d) and open it in a new browser/incognito
      window (no login) — download works.
- [ ] Create a `recipient` share; a different authenticated user gets `403`,
      the correct recipient succeeds, and an unauthenticated caller gets `401`.
- [ ] Wait for expiry (or use a 1h share) and confirm it is rejected.
- [ ] Revoke an active share and confirm new resolutions are rejected.
- [ ] Reuse an already-issued pre-signed URL until it expires (documented
      limitation).

Authorization
- [ ] User B cannot download, delete, or list shares for User A's `fileId`
      (expect `403`/`404`).
- [ ] User B cannot resolve a recipient share addressed to User A.

---

## Local logic tests (no AWS required)

The backend ships with a self-contained harness that mocks Cognito, S3, and
DynamoDB in memory, so the authorization and sharing logic can be validated
without an AWS account, credentials, or even installing the AWS SDK:

```bash
cd backend
node test/localTest.js      # or: npm test
```

It exercises 34 cases covering upload scoping, size/type validation, ownership
checks, link vs recipient shares, revocation, expiry, listing, and deletion.
Expected output ends with `=== Results: 34 passed, 0 failed ===`.

---

## Security notes

- S3 Block Public Access is enabled; objects are never public.
- No AWS credentials are placed in frontend code.
- Pre-signed URLs are generated only after authorization and are short-lived.
- Ownership is re-checked in Lambda for every file operation.
- Share expiry and revocation are checked on every resolution (never relying on
  DynamoDB TTL for security).
- Input validation runs on the backend regardless of frontend validation.
- Passwords, tokens, pre-signed URLs, and file contents are never logged.

---

## Tech stack

- **Frontend:** React 18, Vite, React Router, AWS Amplify (`aws-amplify` v6), axios
- **Backend:** Node.js 20 (Lambda runtime `nodejs20.x`), AWS SDK v3, `aws-jwt-verify`, `uuid`
- **Infrastructure:** AWS SAM (`infrastructure/template.yaml`)

## License

Created for academic coursework.
