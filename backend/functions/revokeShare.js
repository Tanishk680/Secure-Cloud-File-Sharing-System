const { getUserId } = require('../lib/auth');
const { getShare, updateShareRevoked } = require('../lib/dynamodb');

exports.handler = async (event) => {
  try {
    const ownerId = await getUserId(event);
    const shareId = event.pathParameters?.shareId;
    if (!shareId) throw new Error('Missing shareId');

    const share = await getShare(shareId);
    if (!share) return { statusCode: 404, body: JSON.stringify({ error: 'Share not found' }) };
    if (share.ownerId !== ownerId) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };

    await updateShareRevoked(shareId, true);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Share revoked' }),
    };
  } catch (err) {
    return {
      statusCode: err.message.startsWith('Unauthorized') ? 401 : 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
