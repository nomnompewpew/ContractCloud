
import { google } from 'googleapis';
import type { admin_directory_v1 } from 'googleapis';
import { createGoogleAuthClient } from './google-client';

let directory: admin_directory_v1.Admin | undefined;

function getDirectoryClient(): admin_directory_v1.Admin {
  if (directory) {
    return directory;
  }

  const authClient = createGoogleAuthClient([
    'https://www.googleapis.com/auth/admin.directory.user.readonly',
  ]);

  directory = google.admin({
    version: 'directory_v1',
    auth: authClient,
  });

  return directory;
}

export async function searchUsers(query: string): Promise<admin_directory_v1.Schema$User[]> {
    if (!process.env.GOOGLE_CUSTOMER_ID) {
        throw new Error('GOOGLE_CUSTOMER_ID is not configured in .env file.');
    }

  const dir = getDirectoryClient();
  try {
    // The Google API requires combining filters into the query string.
    const queryParts: string[] = ["orgUnitPath='/Email Footer/Sales'"];

    const trimmedQuery = query ? query.trim() : '';

    if (trimmedQuery) {
        // Add the user's search query if it exists, grouping it with parentheses.
        queryParts.push(`(name:${trimmedQuery}* OR email:${trimmedQuery}*)`);
    }

    // Join the parts with a space, which acts as an AND operator.
    const finalQuery = queryParts.join(' ');

    const listParams: admin_directory_v1.Params$Resource$Users$List = {
        customer: process.env.GOOGLE_CUSTOMER_ID,
        maxResults: 20,
        orderBy: 'familyName',
        projection: 'full',
        query: finalQuery, // Use the combined query string.
    };

    const response = await dir.users.list(listParams);
    return response.data.users || [];
  } catch (error: any)
   {
    console.error('Error searching users in Google Directory:', error);
    // Propagate the specific error message from the Google API client
    throw new Error(error.message || 'An unknown error occurred while searching the directory.');
  }
}
