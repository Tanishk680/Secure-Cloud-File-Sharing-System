import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';

// API Gateway's REST Cognito authorizer (without OAuth scopes) expects an
// ID token, so we use the ID token as the bearer credential for API calls.
export async function getIdToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user.userId;
}

export async function getCurrentUserEmail() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.payload?.email;
}

export async function logout() {
  await signOut();
}
