const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'audio/mpeg',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function validateFileMetadata({ fileName, contentType, fileSize }) {
  if (!fileName || fileName.length > 255) {
    throw new Error('Invalid file name');
  }
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    throw new Error('Invalid file type');
  }
  const size = parseInt(fileSize);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
    throw new Error('Invalid file size');
  }
  return { fileName, contentType, fileSize: size };
}

function validateExpiry(expiry) {
  const valid = ['1h', '24h', '7d'];
  if (!valid.includes(expiry)) {
    throw new Error('Invalid expiry');
  }
  return expiry;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateShareType(shareType, recipientEmail) {
  if (shareType !== 'link' && shareType !== 'recipient') {
    throw new Error('Invalid share type');
  }
  if (shareType === 'recipient') {
    if (!recipientEmail || !EMAIL_RE.test(String(recipientEmail).trim())) {
      throw new Error('Valid recipient email required for recipient share');
    }
  }
  return { shareType, recipientEmail };
}

module.exports = { validateFileMetadata, validateExpiry, validateShareType };
