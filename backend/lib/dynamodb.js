const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const FILES_TABLE = process.env.DYNAMODB_FILES_TABLE;
const SHARES_TABLE = process.env.DYNAMODB_SHARES_TABLE;

async function putFile(file) {
  const command = new PutCommand({
    TableName: FILES_TABLE,
    Item: file,
  });
  await docClient.send(command);
}

async function getFile(fileId) {
  const command = new GetCommand({
    TableName: FILES_TABLE,
    Key: { fileId },
  });
  const res = await docClient.send(command);
  return res.Item;
}

async function listFilesByOwner(ownerId) {
  const command = new QueryCommand({
    TableName: FILES_TABLE,
    IndexName: process.env.FILES_OWNER_INDEX || 'ownerId-index',
    KeyConditionExpression: 'ownerId = :ownerId',
    ExpressionAttributeValues: { ':ownerId': ownerId },
    ScanIndexForward: false,
  });
  const res = await docClient.send(command);
  return res.Items || [];
}

async function deleteFile(fileId) {
  const command = new DeleteCommand({
    TableName: FILES_TABLE,
    Key: { fileId },
  });
  await docClient.send(command);
}

async function putShare(share) {
  const command = new PutCommand({
    TableName: SHARES_TABLE,
    Item: share,
  });
  await docClient.send(command);
}

async function getShare(shareId) {
  const command = new GetCommand({
    TableName: SHARES_TABLE,
    Key: { shareId },
  });
  const res = await docClient.send(command);
  return res.Item;
}

async function listSharesByFile(fileId) {
  const command = new QueryCommand({
    TableName: SHARES_TABLE,
    IndexName: process.env.SHARES_FILE_INDEX || 'fileId-index',
    KeyConditionExpression: 'fileId = :fileId',
    ExpressionAttributeValues: { ':fileId': fileId },
  });
  const res = await docClient.send(command);
  return res.Items || [];
}

async function updateShareRevoked(shareId, revoked = true) {
  const command = new UpdateCommand({
    TableName: SHARES_TABLE,
    Key: { shareId },
    UpdateExpression: 'SET revoked = :revoked',
    ExpressionAttributeValues: { ':revoked': revoked },
  });
  await docClient.send(command);
}

module.exports = {
  putFile,
  getFile,
  listFilesByOwner,
  deleteFile,
  putShare,
  getShare,
  listSharesByFile,
  updateShareRevoked,
};
