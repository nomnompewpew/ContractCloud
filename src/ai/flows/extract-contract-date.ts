
'use server';
/**
 * @fileOverview An AI flow for extracting just the contract date from a PDF.
 *
 * - extractContractDate - A function that scans a PDF and returns the order date.
 * - ExtractContractDateInput - The input type for the extractContractDate function.
 * - ExtractContractDateOutput - The return type for the extractContractDate function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractContractDateInputSchema = z.object({
  contractPdf: z
    .string()
    .describe(
      "A sales contract document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractContractDateInput = z.infer<typeof ExtractContractDateInputSchema>;

const ExtractContractDateOutputSchema = z.object({
  orderDate: z.string().describe('The primary date of the contract, formatted as YYYY-MM-DD.'),
});
export type ExtractContractDateOutput = z.infer<typeof ExtractContractDateOutputSchema>;

export async function extractContractDate(input: ExtractContractDateInput): Promise<ExtractContractDateOutput> {
  return extractContractDateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractContractDatePrompt',
  input: { schema: ExtractContractDateInputSchema },
  output: { schema: ExtractContractDateOutputSchema },
  prompt: `You are an expert assistant for a media sales company. Your task is to analyze the provided contract document and find the main agreement or order date.

Return the date in YYYY-MM-DD format. Look for terms like "Date", "Order Date", or the date at the top of the document.

Document to analyze:
{{media url=contractPdf}}`,
});

const extractContractDateFlow = ai.defineFlow(
  {
    name: 'extractContractDateFlow',
    inputSchema: ExtractContractDateInputSchema,
    outputSchema: ExtractContractDateOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        if (!output) {
            throw new Error('AI model returned no output for date extraction.');
        }
        return output;
    } catch (error: any) {
        console.error('Error in date extraction flow:', error.message);
        throw new Error(`The AI operation for date extraction failed. Last error: ${error.message}`);
    }
  }
);
