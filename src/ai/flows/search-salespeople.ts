'use server';
/**
 * @fileOverview A Genkit flow for searching users in the Google Workspace directory.
 *
 * - searchSalespeople - A function that searches for salespeople by name or email.
 * - SearchSalespeopleInput - The input type for the searchSalespeople function.
 * - SearchSalespeopleOutput - The return type for the searchSalespeople function.
 */

import { ai } from '@/ai/genkit';
import { searchUsers } from '@/services/google-directory';
import { z } from 'genkit';

const SearchSalespeopleInputSchema = z.object({
  query: z.string().describe('The name or email to search for.'),
});
export type SearchSalespeopleInput = z.infer<typeof SearchSalespeopleInputSchema>;

const SearchSalespeopleOutputSchema = z.array(
    z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        photoUrl: z.string().nullable(),
    })
);
export type SearchSalespeopleOutput = z.infer<typeof SearchSalespeopleOutputSchema>;

export async function searchSalespeople(input: SearchSalespeopleInput): Promise<SearchSalespeopleOutput> {
  return searchSalespeopleFlow(input);
}

const searchSalespeopleFlow = ai.defineFlow(
  {
    name: 'searchSalespeopleFlow',
    inputSchema: SearchSalespeopleInputSchema,
    outputSchema: SearchSalespeopleOutputSchema,
  },
  async ({ query }) => {
    const users = await searchUsers(query);
    return users.map(user => ({
        id: user.id || '',
        name: user.name?.fullName || 'No name',
        email: user.primaryEmail || 'No email',
        photoUrl: user.thumbnailPhotoUrl || null,
    }));
  }
);
