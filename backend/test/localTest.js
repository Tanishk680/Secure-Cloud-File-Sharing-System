/*
 * Local logic test harness for the Lambda handlers.
 *
 * Runs WITHOUT AWS credentials and WITHOUT installing the AWS SDK.
 * It patches Node's module loader so the handlers receive in-memory fakes for
 * ../lib/auth, ../lib/s3, ../lib/dynamodb and the `uuid` package.
 *
 * Run:  cd backend && node test/localTest.js
 */

const Module = require('module');
const path = require('path');

// ---------------------------------------------------------------------------
// In-memory fake state
// ---------------------------------------------------------------------------
const state = {
  currentUser: 'user-a',
  files: new Map(),
  shares: new Map(),
  objects: new Map(), // s3Key -> { size, contentType }
  uuidCounter: 0,
};

const mockAuth = {
  async getUserId(event) {
    const h = event?.headers?.Authorization || event?.headers?.authorization;
    if (!h || !h.startsWith('Bearer ')) {
      throw new Error('Unauthorized: missing token');
    }
    return state.currentUser;
  },
  async getUserFromToken(event) {
    const h = event?.headers?.Authorization || event?.headers?.authorization;
    if (!h || !h.startsWith('Bearer ')) return null;
    return state.currentUser;
  },
};

const mockS3 = {
  async getUploadUrl(key) {
    return `https://mock-s3.local/${key}?upload=1`;
  },
  async getDownloadUrl(key) {
    return `https://mock-s3.local/${key}?download=1`;
  },
  async deleteObject(key) {
    state.objects.delete(key);
  },
  async getObjectMetadata(key) {
    const o = state.objects.get(key);
    if (!o) return { exists: false };
    return { exists: true, contentLength: o.size, contentType: o.contentType };
  },
};

const mockDynamo = {
  async putFile(file) {
    state.files.set(file.fileId, { ...file });
  },
  async getFile(fileId) {
    return state.files.get(fileId);
  },
  async listFilesByOwner(ownerId) {
    return [...state.files.values()].filter((f) => f.ownerId === ownerId);
  },
  async deleteFile(fileId) {
    state.files.delete(fileId);
  },
  async putShare(share) {
    state.shares.set(share.shareId, { ...share });
  },
  async getShare(shareId) {
    return state.shares.get(shareId);
  },
  async listSharesByFile(fileId) {
    return [...state.shares.values()].filter((s) => s.fileId === fileId);
  },
  async updateShareRevoked(shareId, revoked = true) {
    const s = state.shares.get(shareId);
    if (s) s.revoked = revoked;
  },
};

// ---------------------------------------------------------------------------
// Patch module loading (must happen before requiring handlers)
// ---------------------------------------------------------------------------
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  switch (request) {
    case '../lib/auth':
      return mockAuth;
    case '../lib/s3':
      return mockS3;
    case '../lib/dynamodb':
      return mockDynamo;
    case 'uuid':
      return { v4: () => `uuid-${++state.uuidCounter}` };
    default:
      return originalLoad.call(this, request, parent, isMain);
  }
};

const FN = path.join(__dirname, '..', 'functions');
const handlers = {
  createUploadUrl: require(path.join(FN, 'createUploadUrl')).handler,
  confirmUpload: require(path.join(FN, 'confirmUpload')).handler,
  listFiles: require(path.join(FN, 'listFiles')).handler,
  createDownloadUrl: require(path.join(FN, 'createDownloadUrl')).handler,
  deleteFile: require(path.join(FN, 'deleteFile')).handler,
  createShare: require(path.join(FN, 'createShare')).handler,
  resolveShare: require(path.join(FN, 'resolveShare')).handler,
  listShares: require(path.join(FN, 'listShares')).handler,
  revokeShare: require(path.join(FN, 'revokeShare')).handler,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function as(user, { body, pathParameters } = {}) {
  state.currentUser = user;
  return {
    headers: { Authorization: 'Bearer test-token' },
    body: body === undefined ? undefined : JSON.stringify(body),
    pathParameters,
  };
}

function anon({ body, pathParameters } = {}) {
  return {
    headers: {},
    body: body === undefined ? undefined : JSON.stringify(body),
    pathParameters,
  };
}

function parse(res) {
  return res.body ? JSON.parse(res.body) : {};
}

let passed = 0;
let failed = 0;
function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n=== Local logic tests (mocked AWS) ===\n');

  const PDF = { fileName: 'report.pdf', contentType: 'application/pdf', fileSize: 1234 };

  // --- Upload flow ---------------------------------------------------------
  console.log('Upload flow');
  let res = await handlers.createUploadUrl(as('user-a', { body: PDF }));
  let data = parse(res);
  check('createUploadUrl returns 200', res.statusCode === 200, res.statusCode);
  check('s3Key is scoped to owner', data.s3Key?.startsWith('uploads/user-a/'), data.s3Key);
  check('fileId returned', !!data.fileId);
  const fileA = data.fileId;
  const keyA = data.s3Key;

  state.objects.set(keyA, { size: PDF.fileSize, contentType: PDF.contentType });

  res = await handlers.confirmUpload(
    as('user-a', { body: { fileId: fileA, s3Key: keyA, ...PDF } })
  );
  check('confirmUpload returns 201', res.statusCode === 201, res.statusCode);
  check('metadata stored', state.files.has(fileA));

  // Cross-user key claim is rejected
  let bRes = await handlers.createUploadUrl(as('user-b', { body: PDF }));
  const keyB = parse(bRes).s3Key;
  state.objects.set(keyB, { size: PDF.fileSize, contentType: PDF.contentType });
  res = await handlers.confirmUpload(
    as('user-a', { body: { fileId: parse(bRes).fileId, s3Key: keyB, ...PDF } })
  );
  check('cannot confirm another user\'s S3 key (403)', res.statusCode === 403, res.statusCode);

  // Size mismatch rejected
  res = await handlers.confirmUpload(
    as('user-a', { body: { fileId: 'fake', s3Key: keyA, ...PDF, fileSize: 999999 } })
  );
  check('rejects size mismatch (400)', res.statusCode === 400, res.statusCode);

  // Missing object rejected
  res = await handlers.confirmUpload(
    as('user-a', { body: { fileId: 'fake2', s3Key: 'uploads/user-a/x', ...PDF } })
  );
  check('rejects missing S3 object (400)', res.statusCode === 400, res.statusCode);

  // --- Listing -------------------------------------------------------------
  console.log('\nListing');
  res = await handlers.listFiles(as('user-a'));
  check('user-a sees own file', parse(res).files?.length === 1);
  res = await handlers.listFiles(as('user-b'));
  check('user-b sees no files', parse(res).files?.length === 0);

  // --- Download authorization ---------------------------------------------
  console.log('\nDownload authorization');
  res = await handlers.createDownloadUrl(as('user-a', { pathParameters: { fileId: fileA } }));
  check('owner gets download URL', res.statusCode === 200);
  res = await handlers.createDownloadUrl(as('user-b', { pathParameters: { fileId: fileA } }));
  check('non-owner denied (403)', res.statusCode === 403, res.statusCode);
  res = await handlers.createDownloadUrl(as('user-a', { pathParameters: { fileId: 'nope' } }));
  check('missing file returns 404', res.statusCode === 404, res.statusCode);

  // --- Link share ----------------------------------------------------------
  console.log('\nLink share');
  res = await handlers.createShare(
    as('user-a', { pathParameters: { fileId: fileA }, body: { shareType: 'link', expiry: '24h' } })
  );
  check('create link share 201', res.statusCode === 201, res.statusCode);
  const linkShareId = parse(res).share?.shareId;

  res = await handlers.resolveShare(anon({ pathParameters: { shareId: linkShareId } }));
  check('anonymous link access works', res.statusCode === 200, res.statusCode);

  // Revoke authorization
  res = await handlers.revokeShare(as('user-b', { pathParameters: { shareId: linkShareId } }));
  check('non-owner cannot revoke (403)', res.statusCode === 403, res.statusCode);
  res = await handlers.revokeShare(as('user-a', { pathParameters: { shareId: linkShareId } }));
  check('owner revokes (200)', res.statusCode === 200, res.statusCode);
  res = await handlers.resolveShare(anon({ pathParameters: { shareId: linkShareId } }));
  check('revoked link rejected (403)', res.statusCode === 403, res.statusCode);

  // --- Recipient share -----------------------------------------------------
  console.log('\nRecipient share');
  res = await handlers.createShare(
    as('user-a', {
      pathParameters: { fileId: fileA },
      body: { shareType: 'recipient', recipientId: 'user-c', expiry: '1h' },
    })
  );
  const recipShareId = parse(res).share?.shareId;
  check('create recipient share 201', res.statusCode === 201, res.statusCode);

  res = await handlers.resolveShare(as('user-c', { pathParameters: { shareId: recipShareId } }));
  check('correct recipient allowed (200)', res.statusCode === 200, res.statusCode);
  res = await handlers.resolveShare(as('user-d', { pathParameters: { shareId: recipShareId } }));
  check('wrong user denied (403)', res.statusCode === 403, res.statusCode);
  res = await handlers.resolveShare(anon({ pathParameters: { shareId: recipShareId } }));
  check('anonymous recipient share denied (401)', res.statusCode === 401, res.statusCode);

  // --- Expiry --------------------------------------------------------------
  console.log('\nExpiry');
  state.shares.get(recipShareId).expiresAt = Math.floor(Date.now() / 1000) - 10;
  res = await handlers.resolveShare(as('user-c', { pathParameters: { shareId: recipShareId } }));
  check('expired share rejected (403)', res.statusCode === 403, res.statusCode);

  // --- List shares ---------------------------------------------------------
  console.log('\nList shares');
  res = await handlers.listShares(as('user-a', { pathParameters: { fileId: fileA } }));
  check('owner lists shares (>=2)', parse(res).shares?.length >= 2, parse(res).shares?.length);
  res = await handlers.listShares(as('user-b', { pathParameters: { fileId: fileA } }));
  check('non-owner cannot list shares (403)', res.statusCode === 403, res.statusCode);

  // --- Validation ----------------------------------------------------------
  console.log('\nValidation');
  res = await handlers.createUploadUrl(
    as('user-a', { body: { ...PDF, contentType: 'application/x-msdownload' } })
  );
  check('rejects disallowed type (400)', res.statusCode === 400, res.statusCode);
  res = await handlers.createUploadUrl(as('user-a', { body: { ...PDF, fileSize: 0 } }));
  check('rejects zero size (400)', res.statusCode === 400, res.statusCode);
  res = await handlers.createUploadUrl(
    as('user-a', { body: { ...PDF, fileSize: 60 * 1024 * 1024 } })
  );
  check('rejects oversize (400)', res.statusCode === 400, res.statusCode);
  res = await handlers.createShare(
    as('user-a', { pathParameters: { fileId: fileA }, body: { shareType: 'link', expiry: '30d' } })
  );
  check('rejects invalid expiry (400)', res.statusCode === 400, res.statusCode);
  res = await handlers.createUploadUrl(anon({ body: PDF }));
  check('unauthenticated upload rejected (401)', res.statusCode === 401, res.statusCode);

  // --- Delete --------------------------------------------------------------
  console.log('\nDelete');
  res = await handlers.deleteFile(as('user-b', { pathParameters: { fileId: fileA } }));
  check('non-owner cannot delete (403)', res.statusCode === 403, res.statusCode);
  res = await handlers.deleteFile(as('user-a', { pathParameters: { fileId: fileA } }));
  check('owner deletes (200)', res.statusCode === 200, res.statusCode);
  check('metadata removed', !state.files.has(fileA));
  check('S3 object removed', !state.objects.has(keyA));

  // -------------------------------------------------------------------------
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test harness crashed:', err);
  process.exit(1);
});
