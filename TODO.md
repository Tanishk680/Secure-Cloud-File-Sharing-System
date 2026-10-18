# TODO.md - Secure Cloud File Sharing System (AWS)

## Phase 1: Setup & Infrastructure
- [x] Initialize project structure (frontend, backend, infrastructure)
- [x] Setup React frontend (Vite) with dependencies
- [x] Setup Node.js backend for Lambda functions
- [x] Create S3 bucket definition (private, SSE-S3, Block Public Access) via SAM
- [x] Create DynamoDB tables (FilesTable, SharesTable) with GSIs via SAM
- [x] Cognito User Pool is created manually; SAM consumes its IDs as parameters
- [x] Define API Gateway REST API + Cognito authorizer + CORS via SAM
- [x] Configure least-privilege IAM policies per Lambda via SAM policy templates
- [x] Add Amplify build spec (amplify.yml)

## Phase 2: Authentication
- [x] Integrate Cognito with frontend (login/register/confirm/logout)
- [x] Add JWT token validation in Lambda functions (aws-jwt-verify)
- [x] Attach access token to API requests via axios interceptor
- [x] Setup API Gateway Cognito authorizer (default, with public override for resolveShare)

## Phase 3: File Upload & Management
- [x] Implement createUploadUrl Lambda
- [x] Implement confirmUpload Lambda (verifies object exists + name/size)
- [x] Implement listFiles Lambda
- [x] Implement createDownloadUrl Lambda
- [x] Implement deleteFile Lambda
- [x] Add S3 pre-signed URL generation (upload + download)
- [x] Add ownership validation on all file operations

## Phase 4: Secure File Sharing
- [x] Implement createShare Lambda
- [x] Implement resolveShare Lambda (public route, optional auth)
- [x] Implement listShares Lambda
- [x] Implement revokeShare Lambda
- [x] Add share expiry (1h/24h/7d) and revocation logic
- [x] Support link and recipient-based sharing

## Phase 5: Frontend Integration
- [x] Build Login/Register/Confirm pages
- [x] Build Dashboard to list files
- [x] Build Upload page with progress
- [x] Build File Actions (download/delete/share)
- [x] Build Share Dialog
- [x] Build Shared File page (public share resolution)
- [x] Build Share Management page (list + revoke + copy link)
- [x] Integrate with API Gateway

## Phase 6: Testing & Documentation
- [x] Frontend production build passes
- [x] Backend handler syntax validated
- [x] SAM template validated as well-formed YAML
- [x] Write comprehensive README (architecture, setup, deployment, testing)
- [x] Maintain Implementation-Log.md with progress
- [ ] Manual end-to-end testing after AWS deployment (requires real AWS account)
- [ ] Deploy backend via SAM and frontend via Amplify (requires developer's AWS credentials)
