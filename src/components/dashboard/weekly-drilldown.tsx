
'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { Order } from '@/app/dashboard/page';
import { subDays, format, startOfDay } from 'date-fns';

type DailyStats = {
    total: number;
    revisions: number;
    cancellations: number;
    byMarket: Record<string, number>;
    orders: Order[];
};

interface WeeklyDrilldownProps {
    data: DailyStats;
}

export function WeeklyDrilldown({ data }: WeeklyDrilldownProps) {
  const weeklyChartData = Array.from({ length: 7 }).map((_, i) => {
    const date = startOfDay(subDays(new Date(), i));
    const dayName = format(date, 'EEE');
    const fullDate = format(date, 'yyyy-MM-dd');
    
    const contractsOnDay = data.orders.filter(order => format(startOfDay(order.orderEntryDate), 'yyyy-MM-dd') === fullDate);
    
    return {
      date: dayName,
      contracts: contractsOnDay.length,
    };
  }).reverse();

  const chartConfig = {
    contracts: {
      label: 'Contracts',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Drilldown</CardTitle>
        <CardDescription>Activity over the last 7 days.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                 <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                    <BarChart accessibilityLayer data={weeklyChartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="contracts" fill="var(--color-contracts)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
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
        </div>
      </CardContent>
    </Card>
  );
}
