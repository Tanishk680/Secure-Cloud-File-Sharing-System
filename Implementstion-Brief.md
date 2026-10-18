# Project Implementation Brief: Secure Cloud File Sharing System Using AWS

## 1. Project Overview

**Project title:** Secure Cloud File Sharing System Using AWS

**Objective:** Build a secure, serverless, web-based application that allows authenticated users to upload, store, manage, download, and share files using AWS cloud services. Shared files must support controlled access and expiration.

The project is intended for a college Cloud Computing Lab MiniProject. It should demonstrate practical integration of AWS services, cloud storage, serverless computing, authentication, NoSQL database management, and secure file sharing.

Implement a functional application, not just a frontend mockup.

## 2. Finalized Technology Stack

### Frontend
- React.js
- JavaScript
- HTML and CSS
- AWS Amplify for frontend hosting and deployment

### Backend
- Node.js
- AWS Lambda for serverless backend functions
- Amazon API Gateway for REST API endpoints

### Database and storage
- Amazon S3 for actual file storage
- Amazon DynamoDB for file metadata and sharing records

### Authentication
- Amazon Cognito for registration, login, and user authentication

### Final AWS services: exactly six

| AWS service | Responsibility |
|---|---|
| AWS Amplify | Host the React frontend |
| Amazon Cognito | Authenticate users |
| Amazon API Gateway | Expose REST API endpoints |
| AWS Lambda | Execute backend business logic |
| Amazon S3 | Store files privately |
| Amazon DynamoDB | Store file metadata, ownership, permissions, and sharing expiry |

Do not introduce additional AWS services unless explicitly approved.

AWS KMS and CloudWatch are excluded as separate architectural components to keep the project focused. Use S3-managed encryption by default. Lambda execution logs may be available through AWS's built-in logging integration, but dedicated monitoring is not a project feature.

## 3. Core Features

### 3.1 User authentication
- Register and log in using Amazon Cognito.
- Support logout.
- Use Cognito-issued tokens for authenticated API requests.
- Associate each user's files with their authenticated Cognito identity.
- Never trust a user ID supplied by the frontend without verifying it against the authenticated identity.

### 3.2 File upload
- Allow authenticated users to select and upload files.
- Validate file name, size, and permitted file types.
- Store uploaded objects in a private Amazon S3 bucket.
- Store file metadata and ownership in DynamoDB.
- Generate unique S3 object keys; do not use user-supplied file names directly as object keys.

### 3.3 File management
- Display a dashboard containing the current user's files.
- Show file name, size, upload date, and available actions.
- Allow users to download their own files.
- Allow users to delete their own files.
- Prevent users from reading, downloading, or deleting another user's private files without explicit sharing permission.

### 3.4 Secure file sharing
- Allow a user to create a share link for a file they own.
- Support configurable expiration: 1 hour, 24 hours, or 7 days.
- Store the share record and expiry in DynamoDB.
- Support two sharing modes:
  1. Anyone possessing a valid share link.
  2. A specific authenticated recipient.
- Validate sharing permissions and expiration before granting access.
- Allow the owner to revoke an active share.
- Display active and expired shares in the dashboard if practical.

For authenticated-recipient sharing, verify the recipient's authenticated identity against the recipient identity recorded in the share.

### 3.5 Secure download
- Keep the S3 bucket and its objects private.
- Never make the bucket public.
- After successful authorization, provide temporary access to the requested S3 object using a short-lived pre-signed URL.
- Set the URL lifetime so that it does not exceed the remaining share validity.
- Revalidate the share before issuing a URL. An already-issued pre-signed URL may remain usable until it expires, so revocation is not instantaneous for URLs already issued.
- Do not expose permanent AWS credentials or AWS secret access keys to the frontend.

## 4. Architecture

The application uses the following request flow:

1. The user accesses the React application hosted on AWS Amplify.
2. The frontend sends registration or login requests to Amazon Cognito.
3. Cognito authenticates the user and returns authentication tokens to the frontend.
4. The frontend sends API requests to Amazon API Gateway with the appropriate authentication token.
5. API Gateway validates the token using Cognito integration or a supported JWT authorizer.
6. API Gateway invokes the appropriate AWS Lambda function.
7. Lambda validates authorization and performs business logic.
8. Lambda interacts with Amazon S3 to store, retrieve, or delete file objects.
9. Lambda interacts with DynamoDB to create, retrieve, update, or delete file metadata and sharing records.
10. For a valid download request, Lambda generates a short-lived S3 pre-signed URL.
11. The frontend receives the URL and redirects the user to download the file directly from S3.

Important distinction: Cognito issues tokens to the frontend. The frontend then includes the token in API requests. Cognito does not need to forward its token directly to API Gateway.

The backend must perform ownership and sharing checks even if API Gateway has already authenticated the request.

## 5. Recommended Data Model

Use DynamoDB with a simple, documented schema. The exact key design may be adapted to the selected access patterns.

### File metadata

Example record:

- `fileId`: unique application-level file identifier
- `ownerId`: authenticated Cognito user identifier
- `fileName`: original display name
- `s3Key`: unique object key in S3
- `contentType`: validated MIME type
- `fileSize`: file size in bytes
- `createdAt`: upload timestamp

### Share metadata

Example record:

- `shareId`: unguessable share identifier
- `fileId`: associated file identifier
- `ownerId`: owner of the file
- `shareType`: `link` or `recipient`
- `recipientId`: required for recipient-restricted shares
- `createdAt`: creation timestamp
- `expiresAt`: expiry timestamp
- `revoked`: Boolean revocation state

Store timestamps in a consistent format, such as Unix epoch seconds for expiry comparisons and ISO 8601 strings for display where useful.

Do not treat DynamoDB TTL deletion as the security check. TTL cleanup is asynchronous. Every share request must compare `expiresAt` against the current server time and check revocation status.

Use appropriate DynamoDB keys and indexes so that the application can efficiently list files owned by a user and retrieve sharing records by their share identifier.

## 6. Backend API Requirements

Implement REST endpoints similar to the following. The final routes can be adjusted consistently during implementation.

### File operations

- `POST /files/upload-url` — authorize the user and generate an upload URL.
- `POST /files` — confirm an upload and save file metadata.
- `GET /files` — list files belonging to the authenticated user.
- `GET /files/{fileId}/download-url` — authorize access and generate a download URL.
- `DELETE /files/{fileId}` — delete an owned file and its metadata.

### Sharing operations

- `POST /files/{fileId}/shares` — create a share.
- `GET /shares/{shareId}` — validate a share and obtain authorized file access.
- `GET /files/{fileId}/shares` — list shares for a file owned by the current user.
- `DELETE /shares/{shareId}` — revoke a share owned by the current user.

### Authentication and authorization

- Require a valid Cognito token on all private API endpoints.
- The share-resolution endpoint may accept an unauthenticated request only for the link-sharing mode.
- For authenticated-recipient shares, require authentication and verify the recipient identity.
- Validate all route parameters, request bodies, file names, file sizes, and expiry values.
- Return appropriate HTTP status codes, including `400`, `401`, `403`, `404`, and `500`.
- Do not reveal private file metadata when access is denied.

## 7. Recommended Upload Implementation

Use S3 pre-signed URLs to avoid routing file contents through Lambda.

Upload workflow:

1. The authenticated frontend requests an upload URL.
2. Lambda verifies the user's identity and validates the requested file metadata.
3. Lambda generates a unique S3 key and returns a short-lived pre-signed upload URL.
4. The frontend uploads the file directly to the private S3 bucket.
5. The frontend confirms the upload.
6. Lambda verifies that the expected object exists and records its metadata in DynamoDB.

Do not trust the frontend's confirmation alone. Verify the uploaded object and its expected key before recording it as an available file.

Apply sensible file-size limits and content-type validation. If practical, enforce the upload-size limit at the upload mechanism rather than relying only on frontend validation.

## 8. Security Requirements

Security is a core project requirement.

- Enable S3 Block Public Access.
- Keep all file objects private.
- Use least-privilege IAM execution roles for Lambda.
- Grant Lambda only the S3 and DynamoDB permissions required by its functions.
- Use Cognito-issued tokens and validate them correctly.
- Enforce ownership checks on every private file operation.
- Enforce share expiry and revocation on every share-resolution request.
- Generate short-lived pre-signed URLs only after authorization.
- Never put AWS credentials in frontend source code.
- Keep configuration in environment variables or appropriate AWS configuration mechanisms.
- Do not log passwords, authentication tokens, pre-signed URLs, or sensitive file contents.
- Validate input on the backend even when frontend validation exists.
- Use HTTPS for deployed application and API traffic.

Use unique object keys to prevent collisions between users or uploads. Avoid using an original filename as the sole storage identifier.

## 9. Frontend Pages

Implement a simple, usable interface with the following pages:

1. **Login / Register:** Cognito-based authentication.
2. **Dashboard:** List the current user's uploaded files.
3. **Upload:** Select a file and show upload progress/status.
4. **File Actions:** Download, delete, and share.
5. **Share Dialog:** Choose sharing mode and expiry.
6. **Shared File Page:** Validate the share and allow an authorized download.
7. **Share Management:** Display and revoke active shares.

Provide loading indicators, success/error messages, empty states, and clear access-denied or expired-link messages.

Prioritize working functionality over elaborate styling.

## 10. Suggested Project Structure

A simple repository layout is sufficient:

```text
secure-cloud-file-sharing/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   ├── package.json
│   └── .env.example
├── backend/
│   ├── functions/
│   │   ├── createUploadUrl.js
│   │   ├── confirmUpload.js
│   │   ├── listFiles.js
│   │   ├── createDownloadUrl.js
│   │   ├── deleteFile.js
│   │   ├── createShare.js
│   │   ├── resolveShare.js
│   │   ├── listShares.js
│   │   └── revokeShare.js
│   ├── lib/
│   │   ├── auth.js
│   │   ├── s3.js
│   │   ├── dynamodb.js
│   │   └── validation.js
│   └── package.json
├── infrastructure/
│   └── deployment configuration and AWS resource definitions
├── README.md
└── .gitignore
```

This is a suggested structure, not a requirement to create unnecessary abstractions. Use shared helpers for authentication, validation, and AWS clients where they genuinely reduce duplication. Keep Lambda handlers focused on their individual operations.

Use infrastructure as code if practical, such as AWS SAM or AWS CDK, so that the AWS resources can be deployed and reproduced reliably. Choose one approach rather than mixing multiple deployment frameworks.

## 11. Implementation Order

Build and test the project incrementally:

1. Set up the repository, React frontend, and backend configuration.
2. Provision the private S3 bucket, DynamoDB tables, Cognito user pool, API Gateway, and Lambda functions.
3. Configure Cognito authentication and API authorization.
4. Implement file upload and metadata persistence.
5. Implement file listing, download, and deletion with ownership checks.
6. Implement share creation, expiry, recipient restrictions, and revocation.
7. Implement secure share resolution and temporary download URLs.
8. Integrate the frontend with the backend.
9. Test authorization failures, expired shares, revoked shares, missing files, oversized uploads, and invalid requests.
10. Deploy the frontend through Amplify and document the complete setup.

Do not begin by implementing every feature simultaneously. First prove that authentication, private upload, and authorized download work end to end.

## 12. Acceptance Criteria

The project is considered functional when:

- A user can register and log in.
- An authenticated user can upload a file to private S3 storage.
- File metadata is saved and displayed from DynamoDB.
- Users can list, download, and delete their own files.
- A user can create a share link with a supported expiry.
- A valid share link grants only the permitted access.
- Expired or revoked shares are rejected when resolved.
- Recipient-restricted shares cannot be accessed by other authenticated users.
- Users cannot access or delete another user's files by changing an identifier.
- The application does not require public S3 objects or permanent frontend credentials.
- The React application and backend can be deployed using the documented setup.
- The README explains architecture, AWS configuration, environment variables, deployment, and testing.

## 13. Scope Constraints

Do not add the following unless explicitly requested:

- AWS KMS as a separate service.
- CloudWatch dashboards or a monitoring subsystem.
- EC2-hosted application servers.
- RDS or another database.
- Kafka, RabbitMQ, Kubernetes, or microservices.
- AI-based file classification or malware detection.
- Version history, collaborative editing, or advanced enterprise administration.

The finalized architecture contains exactly these six AWS services: Amplify, Cognito, API Gateway, Lambda, S3, and DynamoDB.

## 14. Final Instruction to the Coding Agent

First inspect the repository and identify the existing code, configuration, and deployment setup. If the repository is empty, initialize the proposed structure.

Then implement the smallest complete, secure solution that satisfies the acceptance criteria. Preserve essential validation, ownership checks, error handling, and least-privilege access controls. Do not claim that AWS resources have been deployed or tested unless that has actually been done.

Document any AWS console configuration or credentials that must be supplied by the developer. Never invent AWS account IDs, access keys, deployed URLs, or resource identifiers.

Prioritize correctness, security, clear architecture, and a working end-to-end demonstration suitable for a Cloud Computing Lab MiniProject.

Important implementation note
The one design detail the coding agent must get right is secure file access: S3 remains private, DynamoDB holds the sharing rules, Lambda validates authorization, and pre-signed URLs provide temporary access. An expiry stored in DynamoDB does not automatically invalidate an S3 URL that has already been issued, so the implementation should keep URL lifetimes short and explain this limitation in its documentation.