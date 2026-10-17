const { getUserId } = require('../lib/auth');
const { getObjectMetadata } = require('../lib/s3');
const { putFile } = require('../lib/dynamodb');
const { validateFileMetadata } = require('../lib/validation');

exports.handler = async (event) => {
  try {
    const ownerId = await getUserId(event);
    const body = JSON.parse(event.body || '{}');
    const { fileId, s3Key, fileName, contentType, fileSize } = body;

    if (!fileId || !s3Key) {
      throw new Error('Missing fileId or s3Key');
    }

    const validated = validateFileMetadata({ fileName, contentType, fileSize: parseInt(fileSize) });

    // Ensure the key belongs to this user's namespace to prevent claiming others' objects
    if (!s3Key.startsWith(`uploads/${ownerId}/`)) {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    // Verify the object actually exists and matches the declared size
    const meta = await getObjectMetadata(s3Key);
    if (!meta.exists) {
      throw new Error('Uploaded object not found');
    }
    if (meta.contentLength !== validated.fileSize) {
      throw new Error('Uploaded object size mismatch');
    }

    const now = new Date().toISOString();
    const file = {
      fileId,
      ownerId,
      fileName: validated.fileName,
      s3Key,
      contentType: validated.contentType,
      fileSize: validated.fileSize,
      createdAt: now,
    };
    await putFile(file);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file }),
    };
  } catch (err) {
    return {
      statusCode: err.message.startsWith('Unauthorized') ? 401 : 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
