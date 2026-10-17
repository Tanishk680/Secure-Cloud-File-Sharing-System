import { Amplify } from 'aws-amplify';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const SHARE_BASE_URL = import.meta.env.VITE_SHARE_BASE_URL || window.location.origin;

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      },
    },
  });
}
