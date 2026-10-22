const { getUserId } = require('../lib/auth');
const { getFile, putShare } = require('../lib/dynamodb');
const { validateExpiry, validateShareType } = require('../lib/validation');
const { v4: uuidv4 } = require('uuid');

function getExpiryTimestamp(expiry) {
  const now = Date.now();
  switch (expiry) {
    case '1h': return Math.floor((now + 3600 * 1000) / 1000);
    case '24h': return Math.floor((now + 86400 * 1000) / 1000);
    case '7d': return Math.floor((now + 7 * 86400 * 1000) / 1000);
    default: return Math.floor(now / 1000);
  }
}

exports.handler = async (event) => {
  try {
    const ownerId = await getUserId(event);
    const fileId = event.pathParameters?.fileId;
    if (!fileId) throw new Error('Missing fileId');

    const file = await getFile(fileId);
    if (!file) return { statusCode: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'File not found' }) };
    if (file.ownerId !== ownerId) return { statusCode: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Forbidden' }) };

    const body = JSON.parse(event.body || '{}');
    const { shareType, recipientId, expiry } = body;
    validateExpiry(expiry);
    validateShareType(shareType, recipientId);

    const shareId = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = getExpiryTimestamp(expiry);
    const share = {
      shareId,
      fileId,
      ownerId,
      shareType,
      recipientId: shareType === 'recipient' ? recipientId : null,
      createdAt: now,
      expiresAt,
      revoked: false,
    };
    await putShare(share);
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ share }),
    };
  } catch (err) {
    return {
      statusCode: err.message.startsWith('Unauthorized') ? 401 : 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
