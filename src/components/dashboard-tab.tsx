
'use client';

import { useState, useEffect } from 'react';
import { DailyTicket } from "./dashboard/daily-ticket";
import { MonthlyRollup } from "./dashboard/monthly-rollup";
import { WeeklyDrilldown } from "./dashboard/weekly-drilldown";
import { getDashboardDataAction, generateDashboardInsightsAction, appendFilesToContractAction } from '@/app/actions';
import type { DashboardData } from '@/services/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Wand2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Order } from '@/app/dashboard/page';

function AiInsights({ data }: { data: DashboardData }) {
    const [insights, setInsights] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!data) return;

        const fetchInsights = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const result = await generateDashboardInsightsAction(data);
                if (result.success && result.data) {
                    setInsights(result.data);
                } else {
                    setError(result.error || 'Failed to generate insights.');
                }
            } catch (e: any) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInsights();
    }, [data]);

    return (
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Wand2 className="h-6 w-6 text-primary" />
                    <div>
                        <CardTitle className='text-primary'>AI-Powered Insights</CardTitle>
                        <CardDescription>An automated summary of recent activity.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating summary...</span>
                    </div>
                )}
                {error && (
                    <Alert variant="destructive" className="bg-destructive/10">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Insight Generation Failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {!isLoading && !error && (
                    <p className="text-sm">{insights}</p>
                )}
            </CardContent>
        </Card>
    );
}

export function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDashboardDataAction();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'An unknown error occurred.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onAppendFiles = async (
    order: Order,
    files: { dataUri: string; name: string; type: string }[],
    contractType: 'Original' | 'Revision' | 'Cancellation',
  ): Promise<{ success: boolean }> => {
      if (!order) {
          toast({ variant: "destructive", title: "Append Failed", description: "Could not find the original order to update." });
          return { success: false };
      }
      
      const orderIsArchived = order.orderEntryDate.getFullYear() < 2022;

      setIsSubmitting(true);
      try {
          const result = await appendFilesToContractAction({
              pdfFileId: order.pdfFileId,
              orderId: order.id,
              files,
              isArchived: orderIsArchived,
              contractType,
          });

          if (!result.success) {
              throw new Error(result.error || "Failed to append files.");
          }

          await fetchData(); // Refetch dashboard data to show the updated ticket

          toast({
              title: "Files Appended!",
              description: `The contract has been updated to type "${contractType}".`,
          });
          return { success: true };
      } catch (error: any) {
          toast({
              variant: "destructive",
              title: "Append Failed",
              description: error.message,
          });
          return { success: false };
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
        <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Dashboard Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
    );
  }
  
  if (!data) {
    return <p>No data available.</p>;
  }

  return (
    <div className="space-y-6">
      <AiInsights data={data} />
      <DailyTicket data={data.daily} onAppendFiles={onAppendFiles} isSubmitting={isSubmitting} />
      <WeeklyDrilldown data={data.weekly} />
      <MonthlyRollup data={data.monthly} />
    </div>
  );
}
