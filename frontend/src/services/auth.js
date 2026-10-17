import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';

export async function getAccessToken() {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString();
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
