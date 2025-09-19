
'use server';
/**
 * @fileOverview An AI flow for generating insights from dashboard data.
 *
 * - generateDashboardInsights - A function that analyzes sales data and returns a summary.
 * - GenerateDashboardInsightsInput - The input type for the function.
 * - GenerateDashboardInsightsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DailyStatsSchema = z.object({
  total: z.number(),
  revisions: z.number(),
  cancellations: z.number(),
  byMarket: z.record(z.string(), z.number()),
});

const GenerateDashboardInsightsInputSchema = z.object({
  dashboardData: z.object({
    daily: DailyStatsSchema,
    weekly: DailyStatsSchema,
    monthly: DailyStatsSchema,
  }),
});
export type GenerateDashboardInsightsInput = z.infer<typeof GenerateDashboardInsightsInputSchema>;

const GenerateDashboardInsightsOutputSchema = z.object({
  insights: z.string().describe('A concise, analytical summary of the contract data, highlighting key trends, anomalies, or important points. Written in a professional, slightly informal tone suitable for a sales manager.'),
});
export type GenerateDashboardInsightsOutput = z.infer<typeof GenerateDashboardInsightsOutputSchema>;

export async function generateDashboardInsights(input: GenerateDashboardInsightsInput): Promise<GenerateDashboardInsightsOutput> {
  return generateDashboardInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDashboardInsightsPrompt',
  input: { schema: GenerateDashboardInsightsInputSchema },
  output: { schema: GenerateDashboardInsightsOutputSchema },
  prompt: `You are an expert sales data analyst for a media company. Your task is to analyze the following contract data and provide a brief, insightful summary for a sales manager.

Focus on identifying trends, anomalies, or key takeaways. For example, mention if there's a high number of cancellations, if one market is outperforming another, or if there's a significant change compared to other periods. Keep it concise (2-3 sentences).

Here is the data:
- Today's Contracts: {{dashboardData.daily.total}} ({{dashboardData.daily.revisions}} revisions, {{dashboardData.daily.cancellations}} cancellations).
- Last 7 Days: {{dashboardData.weekly.total}} total contracts ({{dashboardData.weekly.revisions}} revisions, {{dashboardData.weekly.cancellations}} cancellations).
- Last 30 Days: {{dashboardData.monthly.total}} total contracts ({{dashboardData.monthly.revisions}} revisions, {{dashboardData.monthly.cancellations}} cancellations).

Market Breakdown (Last 30 Days):
- Boise: {{dashboardData.monthly.byMarket.boise}}
- Twin Falls: {{dashboardData.monthly.byMarket.twin-falls}}

Generate a summary based on this data.
`,
});

const generateDashboardInsightsFlow = ai.defineFlow(
  {
    name: 'generateDashboardInsightsFlow',
    inputSchema: GenerateDashboardInsightsInputSchema,
    outputSchema: GenerateDashboardInsightsOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        if (!output) {
            throw new Error('AI model returned no output for dashboard insights.');
        }
        return output;
    } catch (error: any) {
        console.error('Error in dashboard insights flow:', error.message);
        throw new Error(`The AI operation for insights generation failed. Last error: ${error.message}`);
    }
  }
);
