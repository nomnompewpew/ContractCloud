import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Note: We explicitly pass the API keys here to create two distinct clients.
// Genkit would otherwise default to the GOOGLE_API_KEY environment variable for both.

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY })],
  model: 'googleai/gemini-2.0-flash',
});

export const backupAi = genkit({
    plugins: [googleAI({ apiKey: process.env.GOOGLE_BACKUP_API_KEY })],
    model: 'googleai/gemini-2.0-flash',
});
