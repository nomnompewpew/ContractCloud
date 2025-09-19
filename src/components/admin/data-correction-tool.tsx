
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { correctOrdersAction, countFixableOrdersAction, proposeCorrectionForSingleOrderAction, getFixableOrdersBatchAction, type CorrectionInfo } from '@/app/actions';
import { Loader2, FileScan, CheckCircle, XCircle, ArrowRight, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Order } from '@/app/dashboard/page';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

const BATCH_SIZE = 50;

interface DataCorrectionToolProps {
  isToolBusy: boolean;
  onToolStateChange: (isBusy: boolean) => void;
}

export function DataCorrectionTool({ isToolBusy, onToolStateChange }: DataCorrectionToolProps) {
  const { toast } = useToast();
  const [isCounting, setIsCounting] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [ordersToProcess, setOrdersToProcess] = useState<Order[]>([]);
  const [corrections, setCorrections] = useState<CorrectionInfo[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [fixError, setFixError] = useState<string | null>(null);
  const [badClientName, setBadClientName] = useState('0-9');
  const [totalFixableCount, setTotalFixableCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageLastSeenIds, setPageLastSeenIds] = useState<Record<number, string | undefined>>({ 0: undefined });

  useEffect(() => {
    onToolStateChange(isCounting || isProcessingBatch || isCorrecting);
  }, [isCounting, isProcessingBatch, isCorrecting, onToolStateChange]);

  const resetCorrectionTool = () => {
    setOrdersToProcess([]);
    setCorrections([]);
    setProcessingIndex(0);
    setTotalFixableCount(null);
    setFixError(null);
    setCurrentPage(0);
    setPageLastSeenIds({ 0: undefined });
  };

  const handleCountFixable = async () => {
    if (!badClientName.trim()) {
        setFixError("Please enter the incorrect client name to search for.");
        return;
    }
    setIsCounting(true);
    resetCorrectionTool();
    const result = await countFixableOrdersAction(badClientName.trim());
    if (result.success) {
        setTotalFixableCount(result.data);
         if (result.data === 0) {
            toast({ title: 'No Fixable Orders Found', description: `Could not find any orders with the client name "${badClientName}".` });
        }
    } else {
        setFixError(result.error || 'An unknown error occurred while counting.');
        toast({ variant: 'destructive', title: 'Count Failed', description: result.error });
    }
    setIsCounting(false);
  };

  const startBatchProcessing = async (pageIndex: number) => {
    setIsProcessingBatch(true);
    setFixError(null);
    setCorrections([]);
    setOrdersToProcess([]);
    setProcessingIndex(0);

    const startAfterId = pageLastSeenIds[pageIndex];
    const batchResult = await getFixableOrdersBatchAction(badClientName.trim(), BATCH_SIZE, startAfterId);

    if (!batchResult.success || !batchResult.data) {
        setFixError(batchResult.error || 'Failed to fetch batch of orders.');
        setIsProcessingBatch(false);
        return;
    }

    const ordersInBatch = batchResult.data;
    setOrdersToProcess(ordersInBatch);
    
    if (ordersInBatch.length > 0) {
        setPageLastSeenIds(prev => ({...prev, [pageIndex + 1]: ordersInBatch[ordersInBatch.length - 1].id }));
    }

    const newCorrections: CorrectionInfo[] = [];
    for (let i = 0; i < ordersInBatch.length; i++) {
        setProcessingIndex(i);
        const order = ordersInBatch[i];
        const result = await proposeCorrectionForSingleOrderAction(order);

        if (result.success && result.data) {
            newCorrections.push(result.data);
            setCorrections([...newCorrections]); // Update state inside the loop
            if(result.error) {
                // Show a non-blocking warning if the AI sub-step failed
                toast({ variant: 'default', title: `AI Scan Warning for ${order.client}`, description: result.error, duration: 5000 });
            }
        } else if (!result.success) {
            // A critical error in the action itself
            toast({ variant: 'destructive', title: `Critical Error on ${order.client}`, description: result.error });
        }
    }
    
    setProcessingIndex(ordersInBatch.length);
    setIsProcessingBatch(false);
  };
  
  const totalPages = totalFixableCount ? Math.ceil(totalFixableCount / BATCH_SIZE) : 0;
  
  const handleCorrection = async () => {
    setIsCorrecting(true);
    const validFixes = corrections.filter(f => f.proposedClient && f.proposedClient !== f.currentClient);
    const result = await correctOrdersAction(validFixes);

    if (result.success) {
        toast({ title: 'Correction Successful', description: `${result.data?.count || 0} orders have been corrected.` });
        await handleCountFixable(); // Re-count and reset to the first page to reflect the changes.
    } else {
        toast({ variant: 'destructive', title: 'Correction Failed', description: result.error });
    }
    setIsCorrecting(false);
  };
  
  const startFirstBatch = () => {
    setCurrentPage(0);
    startBatchProcessing(0);
  };

  const goToNextPage = () => {
    const nextPage = currentPage + 1;
    if (nextPage < totalPages) {
        setCurrentPage(nextPage);
        startBatchProcessing(nextPage);
    }
  };

  const goToPreviousPage = () => {
      const prevPage = currentPage - 1;
      if (prevPage >= 0) {
          setCurrentPage(prevPage);
          startBatchProcessing(prevPage);
      }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Name Correction</CardTitle>
        <CardDescription>
          This tool finds orders with a specified incorrect client name, uses AI to find the correct name from the PDF, and allows you to fix them in batches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className='flex-grow space-y-1.5'>
            <Label htmlFor="bad-client-name">Incorrect Client Name</Label>
            <Input id="bad-client-name" value={badClientName} onChange={(e) => { setBadClientName(e.target.value); resetCorrectionTool(); }} placeholder="e.g., 0-9" disabled={isToolBusy} />
          </div>
          <Button onClick={handleCountFixable} disabled={isToolBusy || !badClientName.trim()}>
            {isCounting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileScan className="mr-2 h-4 w-4" />}
            {isCounting ? 'Counting...' : 'Find Fixable Orders'}
          </Button>
        </div>
        
        {fixError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{fixError}</AlertDescription>
          </Alert>
        )}
        
        {totalFixableCount !== null && totalFixableCount > 0 && corrections.length === 0 && !isProcessingBatch && (
          <div className="text-center p-4 bg-muted/50 rounded-lg space-y-2">
            <h3 className="text-lg font-medium">{totalFixableCount} fixable orders found for client "{badClientName}"</h3>
            <p className="text-sm text-muted-foreground">Process them in batches of {BATCH_SIZE} to avoid timeouts.</p>
            <Button onClick={startFirstBatch} disabled={isToolBusy}>
              <Wand2 className="mr-2 h-4 w-4" />
              Start Processing Batch 1
            </Button>
          </div>
        )}

        {(isProcessingBatch || corrections.length > 0) && ordersToProcess.length > 0 && (
          <div className="space-y-2">
            {isProcessingBatch && (
              <div className="space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Proposing corrections... Processing order {processingIndex} of {ordersToProcess.length}.
                </p>
                <Progress value={(processingIndex / ordersToProcess.length) * 100} className="w-full" />
              </div>
            )}
            {corrections.length > 0 && (
              <>
                <h3 className="text-lg font-medium">Reviewing Batch {currentPage + 1} of {totalPages} ({corrections.length} / {ordersToProcess.length} proposed)</h3>
                <ScrollArea className="h-72 w-full rounded-md border p-2">
                  <div className="space-y-2">
                    {corrections.map((item) => {
                      const isFixable = item.proposedClient && item.proposedClient !== item.currentClient;
                      return (
                        <div key={item.orderId} className="flex items-center p-2 rounded-md bg-muted/50 text-sm gap-4">
                          {isFixable ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                          <p className="font-semibold text-destructive truncate">{item.currentClient}</p>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className={`font-semibold truncate ${isFixable ? 'text-green-600' : 'text-muted-foreground italic'}`}>
                            {isFixable ? item.proposedClient : "Unchanged"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="flex justify-between items-center pt-2">
                  <Button onClick={goToPreviousPage} disabled={currentPage === 0 || isToolBusy}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous Batch
                  </Button>
                  <span>Page {currentPage + 1} / {totalPages}</span>
                  <Button onClick={goToNextPage} disabled={currentPage + 1 >= totalPages || isToolBusy}>
                    Next Batch <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
      {corrections.filter(f => f.proposedClient && f.proposedClient !== f.currentClient).length > 0 && !isProcessingBatch && (
        <CardFooter>
          <Button onClick={handleCorrection} disabled={isToolBusy}>
            {isCorrecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isCorrecting ? 'Correcting...' : `Correct ${corrections.filter(f => f.proposedClient && f.proposedClient !== f.currentClient).length} Order(s) in this Batch`}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

    