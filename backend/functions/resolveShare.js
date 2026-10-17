const { getUserFromToken } = require('../lib/auth');
const { getShare, getFile } = require('../lib/dynamodb');
const { getDownloadUrl } = require('../lib/s3');

exports.handler = async (event) => {
  try {
    const shareId = event.pathParameters?.shareId;
    if (!shareId) throw new Error('Missing shareId');

    const share = await getShare(shareId);
    if (!share) return { statusCode: 404, body: JSON.stringify({ error: 'Share not found' }) };
    if (share.revoked) return { statusCode: 403, body: JSON.stringify({ error: 'Share revoked' }) };

    const now = Math.floor(Date.now() / 1000);
    if (share.expiresAt && now > share.expiresAt) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Share expired' }) };
    }

    const file = await getFile(share.fileId);
    if (!file) return { statusCode: 404, body: JSON.stringify({ error: 'File not found' }) };

    // Check access
    if (share.shareType === 'recipient') {
      const userId = await getUserFromToken(event);
      if (!userId) return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }) };
      if (userId !== share.recipientId) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }
    // For link sharing, unauthenticated is allowed as per spec

    const url = await getDownloadUrl(file.s3Key, 300); // short-lived; note: already issued URLs remain valid until expiry if different - but we generate on request
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadUrl: url, file }),
    };
  } catch (err) {
    return {
      statusCode: err.message.startsWith('Unauthorized') ? 401 : 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
