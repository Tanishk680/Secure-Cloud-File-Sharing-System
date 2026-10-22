const { getUserId } = require('../lib/auth');
const { getFile } = require('../lib/dynamodb');
const { getDownloadUrl } = require('../lib/s3');

exports.handler = async (event) => {
  try {
    const ownerId = await getUserId(event);
    const fileId = event.pathParameters?.fileId;
    if (!fileId) {
      throw new Error('Missing fileId');
    }

    const file = await getFile(fileId);
    if (!file) {
      return { statusCode: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'File not found' }) };
    }
    if (file.ownerId !== ownerId) {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const url = await getDownloadUrl(file.s3Key, 300);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ downloadUrl: url }),
    };
  } catch (err) {
    return {
      statusCode: err.message.startsWith('Unauthorized') ? 401 : 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
