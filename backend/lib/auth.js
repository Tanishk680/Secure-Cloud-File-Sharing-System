const { CognitoJwtVerifier } = require('aws-jwt-verify');

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID,
});

async function getUserId(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }
    const token = authHeader.substring(7);
    const payload = await verifier.verify(token);
    return payload.sub; // Cognito user ID
  } catch (err) {
    throw new Error('Unauthorized: ' + err.message);
  }
}

async function getUserFromToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null; // unauthenticated
  }
  const token = authHeader.substring(7);
  try {
    const payload = await verifier.verify(token);
    return payload.sub;
  } catch (err) {
    throw new Error('Unauthorized: ' + err.message);
  }
}

async function getUserEmailFromToken(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null; // unauthenticated
  }
  const token = authHeader.substring(7);
  try {
    const payload = await verifier.verify(token);
    return payload.email ? String(payload.email).toLowerCase() : null;
  } catch (err) {
    throw new Error('Unauthorized: ' + err.message);
  }
}

module.exports = { getUserId, getUserFromToken, getUserEmailFromToken };
