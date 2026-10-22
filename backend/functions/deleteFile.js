const { getUserId } = require('../lib/auth');
const { getFile, deleteFile } = require('../lib/dynamodb');
const { deleteObject } = require('../lib/s3');

exports.handler = async (event) => {
  try {
    const ownerId = await getUserId(event);
    const fileId = event.pathParameters?.fileId;
    if (!fileId) {
      throw new Error('Missing fileId');
    }

    const file = await getFile(fileId);
    if (!file) {
      return { statusCode: 404, body: JSON.stringify({ error: 'File not found' }) };
    }
    if (file.ownerId !== ownerId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    await deleteObject(file.s3Key);
    await deleteFile(fileId);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'File deleted' }),
    };
  } catch (err) {
    return {
      statusCode: err.message.startsWith('Unauthorized') ? 401 : 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
