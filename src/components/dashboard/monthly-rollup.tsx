
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Order } from '@/app/dashboard/page';

type DailyStats = {
    total: number;
    revisions: number;
    cancellations: number;
    byMarket: Record<string, number>;
    orders: Order[];
};

interface MonthlyRollupProps {
    data: DailyStats;
}

export function MonthlyRollup({ data }: MonthlyRollupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Rollup</CardTitle>
        <CardDescription>Activity over the last 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-muted p-4 rounded-lg">
                <p className="text-3xl font-bold">{data.total}</p>
                <p className="text-sm text-muted-foreground">Total Contracts</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
                <p className="text-3xl font-bold">{data.revisions}</p>
                <p className="text-sm text-muted-foreground">Revisions</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
                <p className="text-3xl font-bold">{data.cancellations}</p>
                <p className="text-sm text-muted-foreground">Cancellations</p>
            </div>
             <div className="bg-muted p-4 rounded-lg">
                <p className="text-xl font-bold capitalize">
                  {Object.entries(data.byMarket).map(([key, value]) => `${key}: ${value}`).join(' | ')}
                </p>
                <p className="text-sm text-muted-foreground">By Market</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
