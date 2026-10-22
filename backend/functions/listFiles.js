const { getUserId } = require('../lib/auth');
const { listFilesByOwner } = require('../lib/dynamodb');

exports.handler = async (event) => {
  try {
    const ownerId = await getUserId(event);
    const files = await listFilesByOwner(ownerId);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ files }),
    };
  } catch (err) {
    return {
      statusCode: err.message.startsWith('Unauthorized') ? 401 : 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
