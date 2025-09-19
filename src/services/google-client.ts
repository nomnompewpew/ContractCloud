
import { google } from 'googleapis';
import type { Auth } from 'googleapis';

export function createGoogleAuthClient(scopes: string[]): Auth.JWT {
  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    !process.env.GOOGLE_ADMIN_USER_TO_IMPERSONATE
  ) {
    throw new Error(
      'Google service account credentials are not configured in .env file.'
    );
  }

  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
    undefined,
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes,
    process.env.GOOGLE_ADMIN_USER_TO_IMPERSONATE
  );
}
