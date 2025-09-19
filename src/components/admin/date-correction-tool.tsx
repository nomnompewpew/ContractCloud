
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { correctOrderDatesAction, countOrdersByDateAction, proposeDateCorrectionForSingleOrderAction, getOrdersByDateBatchAction, archiveFilesAction, type DateCorrectionInfo, type FileToArchiveAction } from '@/app/actions';
import { Loader2, FileScan, CheckCircle, XCircle, ArrowRight, Wand2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Archive } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Order } from '@/app/dashboard/page';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

const BATCH_SIZE = 50;

interface DateCorrectionToolProps {
  isToolBusy: boolean;
  onToolStateChange: (isBusy: boolean) => void;
}

export function DateCorrectionTool({ isToolBusy, onToolStateChange }: DateCorrectionToolProps) {
  const { toast } = useToast();
  const [isCounting, setIsCounting] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [ordersToProcess, setOrdersToProcess] = useState<Order[]>([]);
  const [corrections, setCorrections] = useState<DateCorrectionInfo[]>([]);
  const [filesToArchive, setFilesToArchive] = useState<FileToArchiveAction[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [fixError, setFixError] = useState<string | null>(null);
  const [incorrectDate, setIncorrectDate] = useState<Date | undefined>(new Date());
  const [totalFixableCount, setTotalFixableCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageLastSeenIds, setPageLastSeenIds] = useState<Record<number, string | undefined>>({ 0: undefined });
  
  const isBusy = isCounting || isProcessingBatch || isCorrecting || isArchiving;

  useEffect(() => {
    onToolStateChange(isBusy);
  }, [isBusy, onToolStateChange]);

  const resetCorrectionTool = () => {
    setOrdersToProcess([]);
    setCorrections([]);
    setFilesToArchive([]);
    setProcessingIndex(0);
    setTotalFixableCount(null);
    setFixError(null);
    setCurrentPage(0);
    setPageLastSeenIds({ 0: undefined });
  };
  
  const handleDateSelect = (date?: Date) => {
    setIncorrectDate(date);
    resetCorrectionTool();
  }

  const handleCountFixable = async () => {
    if (!incorrectDate || !isValid(incorrectDate)) {
        setFixError("Please select a valid date to search for.");
        return;
    }
    setIsCounting(true);
    resetCorrectionTool();
    const dateString = format(incorrectDate, 'yyyy-MM-dd');
    const result = await countOrdersByDateAction(dateString);
    if (result.success) {
        setTotalFixableCount(result.data);
         if (result.data === 0) {
            toast({ title: 'No Fixable Orders Found', description: `Could not find any orders with the entry date "${dateString}".` });
        }
    } else {
        setFixError(result.error || 'An unknown error occurred while counting.');
        toast({ variant: 'destructive', title: 'Count Failed', description: result.error });
    }
    setIsCounting(false);
  };

  const startBatchProcessing = async (pageIndex: number) => {
    if (!incorrectDate) return;
    setIsProcessingBatch(true);
    setFixError(null);
    setCorrections([]);
    setFilesToArchive([]);
    setOrdersToProcess([]);
    setProcessingIndex(0);
    
    const dateString = format(incorrectDate, 'yyyy-MM-dd');
    const startAfterId = pageLastSeenIds[pageIndex];
    const batchResult = await getOrdersByDateBatchAction(dateString, BATCH_SIZE, startAfterId);

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

    const newCorrections: DateCorrectionInfo[] = [];
    for (let i = 0; i < ordersInBatch.length; i++) {
        setProcessingIndex(i);
        const order = ordersInBatch[i];
        const result = await proposeDateCorrectionForSingleOrderAction(order);

        if (result.success && result.data) {
            newCorrections.push(result.data);
            setCorrections([...newCorrections]); // Update state inside the loop
            if(result.error) {
                toast({ variant: 'default', title: `Scan Warning for ${order.client}`, description: result.error, duration: 5000 });
            }
        } else if (!result.success) {
            toast({ variant: 'destructive', title: `Critical Error on ${order.client}`, description: result.error });
        }
    }
    
    setProcessingIndex(ordersInBatch.length);
    setIsProcessingBatch(false);
  };
  
  const totalPages = totalFixableCount ? Math.ceil(totalFixableCount / BATCH_SIZE) : 0;
  
  const handleCorrection = async () => {
    setIsCorrecting(true);
    const validFixes = corrections.filter(f => f.proposedDate.getTime() !== f.currentDate.getTime());
    const result = await correctOrderDatesAction(validFixes);

    if (result.success) {
        toast({ title: 'Correction Successful', description: `${result.data?.count || 0} order dates have been corrected.` });
        await handleCountFixable(); // Re-count and reset.
    } else {
        toast({ variant: 'destructive', title: 'Correction Failed', description: result.error });
    }
    setIsCorrecting(false);
  };
  
  const handleToggleArchive = (item: DateCorrectionInfo) => {
      setFilesToArchive(prev => {
          const isArchived = prev.some(f => f.orderId === item.orderId);
          if (isArchived) {
              return prev.filter(f => f.orderId !== item.orderId);
          } else {
              return [...prev, {
                  orderId: item.orderId,
                  pdfFileId: item.order.pdfFileId,
                  finalFileName: item.order.finalFileName,
                  isArchived: item.isArchived,
              }];
          }
      });
  };

  const handleArchive = async () => {
      setIsArchiving(true);
      const result = await archiveFilesAction(filesToArchive);
      if(result.success) {
          toast({ title: 'Archive Successful', description: `${result.data?.count || 0} files have been archived and removed.` });
          await handleCountFixable(); // Re-count and reset
      } else {
          toast({ variant: 'destructive', title: 'Archive Failed', description: result.error });
      }
      setIsArchiving(false);
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

  const formatDate = (date: Date) => format(date, 'PPP');
  
  const hasCorrections = corrections.filter(f => f.proposedDate.getTime() !== f.currentDate.getTime()).length > 0;
  const hasArchives = filesToArchive.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Date Correction</CardTitle>
        <CardDescription>
          This tool finds orders with a specified incorrect entry date, uses AI to find the correct date from the contract, and allows you to fix them or archive them in batches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className='flex-grow space-y-1.5'>
            <Label>Incorrect Entry Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !incorrectDate && "text-muted-foreground"
                  )}
                   disabled={isToolBusy || isBusy}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {incorrectDate ? format(incorrectDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={incorrectDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleCountFixable} disabled={isToolBusy || isBusy || !incorrectDate}>
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
            <h3 className="text-lg font-medium">{totalFixableCount} fixable orders found for date "{formatDate(incorrectDate!)}"</h3>
            <p className="text-sm text-muted-foreground">Process them in batches of {BATCH_SIZE} to avoid timeouts.</p>
            <Button onClick={startFirstBatch} disabled={isToolBusy || isBusy}>
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
                      const isFixable = item.proposedDate.getTime() !== item.currentDate.getTime();
                      const isArchived = filesToArchive.some(f => f.orderId === item.orderId);
                      return (
                        <div key={item.orderId} className={cn("flex items-center p-2 rounded-md bg-muted/50 text-sm gap-2", isArchived && "ring-2 ring-amber-500")}>
                          <div className='flex-grow truncate'>
                            <p className="font-semibold">{item.order.client}</p>
                            <p className="text-xs text-muted-foreground">{item.order.finalFileName}</p>
                          </div>
                          {isFixable ? (
                            <>
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                <p className="font-semibold text-destructive">{formatDate(item.currentDate)}</p>
                                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <p className="font-semibold text-green-600">{formatDate(item.proposedDate)}</p>
                            </>
                          ) : (
                             <div className='flex items-center gap-2'>
                                <p className="text-xs text-muted-foreground italic">Unchanged</p>
                                <Button size="sm" variant={isArchived ? "secondary" : "outline"} className="h-7" onClick={() => handleToggleArchive(item)} disabled={isBusy}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    {isArchived ? "Queued" : "Archive"}
                                </Button>
                             </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="flex justify-between items-center pt-2">
                  <Button onClick={goToPreviousPage} disabled={currentPage === 0 || isToolBusy || isBusy}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous Batch
                  </Button>
                  <span>Page {currentPage + 1} / {totalPages}</span>
                  <Button onClick={goToNextPage} disabled={currentPage + 1 >= totalPages || isToolBusy || isBusy}>
                    Next Batch <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
      {(hasCorrections || hasArchives) && !isProcessingBatch && (
        <CardFooter className="gap-4">
          {hasCorrections && (
            <Button onClick={handleCorrection} disabled={isToolBusy || isBusy}>
              {isCorrecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isCorrecting ? 'Correcting...' : `Correct ${corrections.filter(f => f.proposedDate.getTime() !== f.currentDate.getTime()).length} Order Date(s)`}
            </Button>
          )}
          {hasArchives && (
              <Button variant="outline" onClick={handleArchive} disabled={isToolBusy || isBusy}>
                {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                {isArchiving ? 'Archiving...' : `Archive ${filesToArchive.length} File(s)`}
              </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
