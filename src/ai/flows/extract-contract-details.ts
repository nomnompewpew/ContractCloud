'use server';
/**
 * @fileOverview An AI flow for extracting key details from a sales contract PDF.
 *
 * - extractContractDetails - A function that scans a PDF and returns structured data.
 * - ExtractContractDetailsInput - The input type for the extractContractDetails function.
 * - ExtractContractDetailsOutput - The return type for the extractContractDetails function.
 */

import { ai, backupAi } from '@/ai/genkit';
import { z } from 'genkit';

const ALL_STATIONS = [
  'KQBL', 'KWYD', 'KZMG', 'KSRV', 'KQBL HD2', 'KKOO', 
  'KSRV HD-2', 'KQBL HD3', 'KIRQ', 'KYUN', 'KTPZ', 'KIKX', 
  'KYUN-HD2', 'KYUN-HD3', 'Digital'
];

const ExtractContractDetailsInputSchema = z.object({
  contractPdf: z
    .string()
    .describe(
      "A sales contract document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractContractDetailsInput = z.infer<typeof ExtractContractDetailsInputSchema>;

const ExtractContractDetailsOutputSchema = z.object({
  client: z.string().describe('The name of the primary client or advertiser.'),
  agency: z.string().describe('The name of the advertising agency, if any. If not present, this should be an empty string.'),
  estimateNumber: z
    .string()
    .describe('The "Estimate Number", "PO Number", or "Booking Number". This is an optional identifier. If not found, return an empty string.'),
  stations: z.array(z.string()).describe(`An array of all station call letters found in the document. The possible values are: ${ALL_STATIONS.join(', ')}. Return only the call letters that are explicitly mentioned.`),
});
export type ExtractContractDetailsOutput = z.infer<typeof ExtractContractDetailsOutputSchema>;

export async function extractContractDetails(input: ExtractContractDetailsInput): Promise<ExtractContractDetailsOutput> {
  return extractContractDetailsFlow(input);
}

const mainPrompt = ai.definePrompt({
  name: 'extractContractDetailsPrompt',
  input: { schema: ExtractContractDetailsInputSchema },
  output: { schema: ExtractContractDetailsOutputSchema },
  prompt: `You are an expert assistant for a media sales company. Your task is to analyze the provided contract document and extract specific information with perfect accuracy.

Analyze the document provided in the input. Extract the following fields:
- client: The name of the end customer or advertiser.
- agency: The advertising agency involved. If there is no agency, return an empty string.
- estimateNumber: Look for a "PO Number", "Estimate Number", or "Booking Number". This is an optional field. If none of these are present, return an empty string.
- stations: An array of all station call letters found in the document. Look for any of these specific identifiers: ${ALL_STATIONS.join(', ')}.

Document to analyze:
{{media url=contractPdf}}`,
});

// Define a second prompt using the backup client.
const backupPrompt = backupAi.definePrompt({
    name: 'extractContractDetailsBackupPrompt',
    input: { schema: ExtractContractDetailsInputSchema },
    output: { schema: ExtractContractDetailsOutputSchema },
    prompt: `You are an expert assistant for a media sales company. Your task is to analyze the provided contract document and extract specific information with perfect accuracy.

Analyze the document provided in the input. Extract the following fields:
- client: The name of the end customer or advertiser.
- agency: The advertising agency involved. If there is no agency, return an empty string.
- estimateNumber: Look for a "PO Number", "Estimate Number", or "Booking Number". This is an optional field. If none of these are present, return an empty string.
- stations: An array of all station call letters found in the document. Look for any of these specific identifiers: ${ALL_STATIONS.join(', ')}.

Document to analyze:
{{media url=contractPdf}}`,
});

const extractContractDetailsFlow = ai.defineFlow(
  {
    name: 'extractContractDetailsFlow',
    inputSchema: ExtractContractDetailsInputSchema,
    outputSchema: ExtractContractDetailsOutputSchema,
  },
  async (input) => {
    try {
        console.log('Attempting AI extraction with primary key...');
        const { output } = await mainPrompt(input);
        if (!output) {
            throw new Error('Primary AI model returned no output.');
        }
        console.log('Primary AI extraction successful.');
        return output;
    } catch (error: any) {
        console.warn('Primary AI key failed:', error.message);
        // Check if the error is a quota/resource exhaustion error
        if (error.message && (error.message.includes('429') || error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('resource has been exhausted'))) {
            console.log('Quota error detected. Attempting fallback to backup key...');
            try {
                const { output: backupOutput } = await backupPrompt(input);
                if (!backupOutput) {
                    throw new Error('Backup AI model also returned no output.');
                }
                console.log('Backup AI extraction successful.');
                return backupOutput;
            } catch (backupError: any) {
                console.error('Backup AI key also failed:', backupError.message);
                throw new Error(`The AI operation failed on both the primary and backup keys. Last error: ${backupError.message}`);
            }
        }
        // If it's not a quota error, just re-throw it.
        throw error;
    }
  }
);
