const { getUserId } = require('../lib/auth');
const { getUploadUrl } = require('../lib/s3');
const { validateFileMetadata } = require('../lib/validation');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  try {
    const ownerId = await getUserId(event);
    const body = JSON.parse(event.body || '{}');
    const validated = validateFileMetadata(body);
    const fileId = uuidv4();
    const s3Key = `uploads/${ownerId}/${fileId}/${validated.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const url = await getUploadUrl(s3Key, validated.contentType, 300);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadUrl: url, fileId, s3Key }),
    };
  } catch (err) {
    return {
      statusCode: err.message.startsWith('Unauthorized') ? 401 : 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
