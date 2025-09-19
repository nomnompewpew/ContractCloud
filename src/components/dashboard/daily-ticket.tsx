
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Order } from '@/app/dashboard/page';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { FilePlus, FileText } from 'lucide-react';
import { useState } from 'react';
import { AppendDialog } from '../append-dialog';

type DailyStats = {
    total: number;
    revisions: number;
    cancellations: number;
    byMarket: Record<string, number>;
    orders: Order[];
};

interface DailyTicketProps {
    data: DailyStats;
    onAppendFiles: (
        orderId: string,
        files: { dataUri: string; name: string; type: string }[],
        contractType: 'Original' | 'Revision' | 'Cancellation'
    ) => Promise<{ success: boolean }>;
    isSubmitting: boolean;
}

export function DailyTicket({ data, onAppendFiles, isSubmitting }: DailyTicketProps) {
  const [isAppendDialogOpen, setIsAppendDialogOpen] = useState(false);
  const [orderToAppend, setOrderToAppend] = useState<Order | null>(null);

  const handlePreviewClick = (url: string) => {
    window.open(url, '_blank');
  };

  const handleOpenAppendDialog = (order: Order) => {
    setOrderToAppend(order);
    setIsAppendDialogOpen(true);
  };
  
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Daily Ticket</CardTitle>
        <CardDescription>Contract activity for today.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
            <div className="bg-muted p-4 rounded-lg">
                <p className="text-2xl font-bold">{data.total}</p>
                <p className="text-sm text-muted-foreground">Total Contracts</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
                <p className="text-2xl font-bold">{data.revisions}</p>
                <p className="text-sm text-muted-foreground">Revisions</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
                <p className="text-2xl font-bold">{data.cancellations}</p>
                <p className="text-sm text-muted-foreground">Cancellations</p>
            </div>
             <div className="bg-muted p-4 rounded-lg">
                <p className="text-2xl font-bold capitalize">
                  {Object.entries(data.byMarket).map(([key, value]) => `${key}: ${value}`).join(' | ')}
                </p>
                <p className="text-sm text-muted-foreground">By Market</p>
            </div>
        </div>

        {data.orders.length > 0 && (
          <div className="mt-4">
             <h4 className="text-md font-semibold mb-2">Today's Contracts</h4>
             <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Contract #</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.orders.map(order => (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">{order.client}</TableCell>
                                <TableCell>{order.contractNumber}</TableCell>
                                <TableCell>
                                     <Badge
                                        variant={
                                        order.contractType === 'Revision'
                                            ? 'default'
                                            : order.contractType === 'Cancellation'
                                            ? 'destructive'
                                            : 'secondary'
                                        }
                                    >
                                        {order.contractType || 'Original'}
                                    </Badge>
                                </TableCell>
                                <TableCell>{format(order.orderEntryDate, 'p')}</TableCell>
                                <TableCell className="text-right space-x-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenAppendDialog(order)}>
                                        <FilePlus className="h-4 w-4" />
                                        <span className="sr-only">Revise or Append</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handlePreviewClick(order.pdfUrl)}>
                                        <FileText className="h-4 w-4" />
                                        <span className="sr-only">Preview</span>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
     {orderToAppend && (
        <AppendDialog
          isOpen={isAppendDialogOpen}
          onOpenChange={setIsAppendDialogOpen}
          order={orderToAppend}
          onAppend={onAppendFiles}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}
