
'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { extractOrderDetailsAction, suggestOrderNumberAction, submitOrderAction } from '@/app/actions';
import type { Order, SalespersonInfo } from '@/app/dashboard/page';
import { UploadCloud, File as FileIcon, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Progress } from './ui/progress';
import { SalespersonCombobox } from './salesperson-combobox';

type BatchType = 'single-client' | 'multi-client';

interface BatchFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress: number;
  data: Partial<Omit<Order, 'id' | 'pdfUrl' | 'pdfFileId' | 'status' | 'submittedAt'>> & { pdfFile?: File } | null;
  pdfDataUri?: string;
  error?: string;
}

const updateBatchCollisions = (files: BatchFile[], allOrders: Order[]): BatchFile[] => {
  const filesToRevalidate = files.map(f => {
    if (f.error?.startsWith('Duplicate in batch:') || f.error?.startsWith('Duplicate of existing')) {
      return { ...f, status: 'success' as const, error: undefined };
    }
    return f;
  });

  const successfulFiles = filesToRevalidate.filter(f => f.status === 'success' && f.data?.orderNumber);
  const orderNumbersInBatch = new Map<string, string[]>();

  successfulFiles.forEach(f => {
      const orderNum = f.data!.orderNumber!;
      if (!orderNumbersInBatch.has(orderNum)) {
          orderNumbersInBatch.set(orderNum, []);
      }
      orderNumbersInBatch.get(orderNum)!.push(f.id);
  });

  const collidingFileIds = new Set<string>();
  orderNumbersInBatch.forEach((ids) => {
      if (ids.length > 1) {
          ids.forEach(id => collidingFileIds.add(id));
      }
  });

  return filesToRevalidate.map(f => {
      if (collidingFileIds.has(f.id)) {
          return { ...f, status: 'error' as const, error: `Duplicate in batch: ${f.data?.orderNumber}` };
      }
      if (f.data?.orderNumber && allOrders.some(o => o.orderNumber === f.data!.orderNumber)) {
        return { ...f, status: 'error' as const, error: `Duplicate of existing order: ${f.data.orderNumber}` };
      }
      return f;
  });
};

interface BatchUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  batchType: BatchType;
  onOrdersSubmit: (orders: Order[]) => void;
  allOrders: Order[];
}

export function BatchUploadDialog({ isOpen, onOpenChange, batchType, onOrdersSubmit, allOrders }: BatchUploadDialogProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState<SalespersonInfo | null>(null);

  const processFile = async (batchFile: BatchFile) => {
    setFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'processing', progress: 10 } : f));
    
    try {
      const reader = new FileReader();
      const pdfDataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(new Error('File could not be read.'));
        reader.readAsDataURL(batchFile.file);
      });
      setFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, progress: 30 } : f));

      const [detailsResult, suggestionResult] = await Promise.all([
        extractOrderDetailsAction(pdfDataUri),
        suggestOrderNumberAction(batchFile.file.name)
      ]);
      setFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, progress: 80 } : f));

      if (!detailsResult.success) {
        throw new Error(detailsResult.error || 'Failed to extract details.');
      }
      
      const extractedData = detailsResult.data;
      const suggestedOrderNumber = suggestionResult.success ? suggestionResult.data?.orderNumber : null;
      
      const orderDate = extractedData.orderDate ? new Date(extractedData.orderDate) : new Date();
      const userTimezoneOffset = orderDate.getTimezoneOffset() * 60000;

      const orderData: BatchFile['data'] = {
          client: extractedData.client,
          agency: extractedData.agency,
          orderNumber: extractedData.orderNumber || suggestedOrderNumber || '',
          orderDate: new Date(orderDate.getTime() + userTimezoneOffset),
          station: extractedData.station,
          estimate: extractedData.isEstimate,
          pdfFileName: batchFile.file.name,
          market: 'boise', // Default, can be changed
          orderType: 'Entry', // Default, can be changed
          salesperson: null,
      };

      if (!orderData.orderNumber) {
        throw new Error("Could not find order number.");
      }
      
      setFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'success', progress: 100, data: orderData, pdfDataUri: pdfDataUri } : f));

    } catch (error: any) {
      setFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'error', progress: 100, error: error.message } : f));
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newBatchFiles: BatchFile[] = Array.from(selectedFiles).map(file => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      status: 'pending',
      progress: 0,
      data: null,
    }));

    setFiles(prev => [...prev, ...newBatchFiles]);
    setIsProcessing(true);
    await Promise.all(newBatchFiles.map(processFile));
    
    setFiles(currentFiles => updateBatchCollisions(currentFiles, allOrders));

    setIsProcessing(false);
  };
  
  const handleRemoveFile = (id: string) => {
    setFiles(prev => updateBatchCollisions(prev.filter(f => f.id !== id), allOrders));
  }

  const reset = () => {
    setFiles([]);
    setIsProcessing(false);
    setIsSubmitting(false);
    setSelectedSalesperson(null);
  }

  const handleSubmit = async () => {
    if (!selectedSalesperson) {
      toast({
          variant: "destructive",
          title: "Salesperson Required",
          description: "Please select a salesperson for this batch.",
      });
      return;
    }

    setIsSubmitting(true);
    const filesToUpload = files.filter(f => f.status === 'success' && f.data && f.pdfDataUri);
    let submittedCount = 0;
    
    const uploadPromises = filesToUpload.map(async (bf) => {
        try {
            const { pdfFile, ...orderValues } = bf.data!;
            const values = {
                ...orderValues,
                salesperson: selectedSalesperson,
            };

            const result = await submitOrderAction({ 
                values: values as any,
                pdfDataUri: bf.pdfDataUri!,
                pdfMimeType: bf.file.type,
            });
            
            if (!result.success) {
                toast({ variant: 'destructive', title: `Submission Failed for ${bf.file.name}`, description: result.error });
                return null;
            }
            submittedCount++;
            return result.data;
        } catch (error: any) {
            toast({ variant: 'destructive', title: `Submission Error for ${bf.file.name}`, description: error.message });
            return null;
        }
    });

    await Promise.all(uploadPromises);

    if (submittedCount > 0) {
        toast({
            title: `${submittedCount} order(s) submitted!`,
            description: "They are now pending verification.",
        });
    }
    
    if (submittedCount < filesToUpload.length) {
        toast({
            variant: 'destructive',
            title: 'Some submissions failed',
            description: 'Not all valid orders could be submitted. Please check notifications and try again.',
        });
    }
    
    if (submittedCount > 0) {
      onOpenChange(false);
    }

    setIsSubmitting(false);
  };
  
  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  }

  const hasErrors = files.some(f => f.status === 'error');

  return (
    <Dialog open={isOpen} onOpenChange={onDialogOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Batch Upload: {batchType === 'single-client' ? 'Single Client' : 'Multiple Clients'}</DialogTitle>
          <DialogDescription>
            Salesperson is not detected automatically. All orders will be assigned to the selected person. If you see a duplicate error, remove one of the conflicting files to resolve it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow flex flex-col gap-4 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Salesperson (Required)</label>
                <SalespersonCombobox value={selectedSalesperson} onChange={setSelectedSalesperson} />
              </div>
              <div className="relative">
                  <label className="text-sm font-medium">Order PDFs</label>
                  <label
                      htmlFor="batch-file-upload"
                      className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80 transition-colors mt-1.5"
                  >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                          <UploadCloud className="w-8 h-8 mb-3 text-muted-foreground" />
                          <p className="mb-1 text-sm text-muted-foreground">
                              <span className="font-semibold">Click to upload</span>
                          </p>
                          <p className="text-xs text-muted-foreground">or drag and drop</p>
                      </div>
                      <input id="batch-file-upload" type="file" className="hidden" multiple accept=".pdf" onChange={handleFileChange} disabled={isProcessing || isSubmitting} />
                  </label>
              </div>
            </div>
            
            <ScrollArea className="flex-grow border rounded-lg p-2">
                <div className="space-y-2">
                    {files.length === 0 && (
                        <div className="flex items-center justify-center text-center text-muted-foreground h-full py-10">
                           <p> Awaiting files...</p>
                        </div>
                    )}
                    {files.map(bf => (
                        <div key={bf.id} className="flex items-center gap-4 p-2 rounded-md bg-card border">
                            <div className="flex-shrink-0">
                                {bf.status === 'processing' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                                {bf.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {bf.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                                {(bf.status === 'pending' || !bf.status) && <FileIcon className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            
                            <div className="flex-grow overflow-hidden">
                                <p className="text-sm font-medium truncate">{bf.file.name}</p>
                                {bf.status === 'processing' && <Progress value={bf.progress} className="h-1 mt-1" />}
                                {bf.status === 'success' && <p className="text-xs text-green-600 truncate">Client: {bf.data?.client || '...'}, Agency: {bf.data?.agency || '...'}, Order: {bf.data?.orderNumber || '...'}</p>}
                                {bf.status === 'error' && <p className="text-xs text-destructive truncate">{bf.error}</p>}
                            </div>

                            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => handleRemoveFile(bf.id)} disabled={isProcessing || isSubmitting}>
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isProcessing || isSubmitting || files.every(f => f.status !== 'success') || !selectedSalesperson || hasErrors}>
            {(isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing ? 'Processing...' : `Submit ${files.filter(f => f.status === 'success').length} Valid Order(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
