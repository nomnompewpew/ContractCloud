
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { scanForImportableFilesAction, processSingleImportAction, type ImportableFile, type ProcessedItem } from '@/app/actions';
import { Loader2, CheckCircle, XCircle, Play, Square, AlertCircle, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';

interface SmartImportToolProps {
  isToolBusy: boolean;
  onToolStateChange: (isBusy: boolean) => void;
}

export function SmartImportTool({ isToolBusy, onToolStateChange }: SmartImportToolProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [currentStatus, setCurrentStatus] = useState('Idle');
  
  // State for the new inputs
  const [market, setMarket] = useState<'boise' | 'twin-falls'>('boise');
  const [sourceFolderId, setSourceFolderId] = useState('');
  const [yearToScan, setYearToScan] = useState('2025');
  
  const [totalProcessedCount, setTotalProcessedCount] = useState(0);

  const stopProcessing = useRef(false);

  useEffect(() => {
    onToolStateChange(isProcessing);
  }, [isProcessing, onToolStateChange]);
  
  useEffect(() => {
    return () => {
      stopProcessing.current = true;
    };
  }, []);

  const resetState = () => {
    setError(null);
    setProcessedItems([]);
    setTotalProcessedCount(0);
    setCurrentStatus('Idle');
  }
  
  const handleStop = () => {
    if (isProcessing) {
      stopProcessing.current = true;
      setCurrentStatus('Stopping after current file...');
    }
  };
  
  const startContinuousImport = async () => {
    if (!sourceFolderId.trim()) {
        toast({
            variant: 'destructive',
            title: 'Configuration Incomplete',
            description: 'Please provide a Source Folder ID to begin.',
        });
        return;
    }
     if (!yearToScan.trim() || !/^\d{4}$/.test(yearToScan.trim())) {
      toast({
        variant: 'destructive',
        title: 'Invalid Year',
        description: 'Please enter a valid 4-digit year to scan.',
      });
      return;
    }

    setIsProcessing(true);
    stopProcessing.current = false;
    resetState();
    
    let keepGoing = true;
    
    while(keepGoing && !stopProcessing.current) {
      setCurrentStatus('Scanning for next file...');

      const scanResult = await scanForImportableFilesAction(sourceFolderId, yearToScan);
      
      if (!scanResult.success || !scanResult.data) {
          setError(scanResult.error || 'Failed to scan for the next file.');
          keepGoing = false;
          break;
      }

      const fileToProcess = scanResult.data.preview;

      if (!fileToProcess) {
        setCurrentStatus('Complete! No more files to import from the source folder.');
        keepGoing = false;
        break;
      }

      setCurrentStatus(`Processing: ${fileToProcess.fileName}`);
      const result = await processSingleImportAction(fileToProcess, market);
      
      const processedItem: ProcessedItem = {
          file: fileToProcess,
          status: result.success ? 'success' : 'error',
          message: result.message,
      };

      setProcessedItems(prev => [processedItem, ...prev]);
      if (result.success) {
          setTotalProcessedCount(prev => prev + 1);
      }
    }

    if (stopProcessing.current) {
      toast({ title: 'Import Stopped', description: 'The import process was halted by the user.' });
    }
    setCurrentStatus('Idle');
    setIsProcessing(false);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart Contract Importer</CardTitle>
        <CardDescription>
          This tool scans a Google Drive folder for un-imported contracts, parses them, and moves them to the appropriate market folder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className='space-y-1.5'>
                <Label htmlFor="source-folder-id">Source Folder ID</Label>
                <Input id="source-folder-id" value={sourceFolderId} onChange={e => setSourceFolderId(e.target.value)} placeholder="Google Drive Folder ID" disabled={isProcessing} />
            </div>
             <div className='space-y-1.5'>
                <Label htmlFor="year-to-scan">Year to Scan</Label>
                <Input id="year-to-scan" value={yearToScan} onChange={e => setYearToScan(e.target.value)} placeholder="e.g., 2025" disabled={isProcessing} />
            </div>
            <div className='space-y-1.5'>
                <Label htmlFor="market-select">Destination Market</Label>
                 <Select onValueChange={(v) => setMarket(v as any)} value={market} disabled={isProcessing}>
                    <SelectTrigger id="market-select">
                        <SelectValue placeholder="Select a market" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="boise">Boise</SelectItem>
                        <SelectItem value="twin-falls">Twin Falls</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-end gap-2 md:col-span-3">
              <Button onClick={startContinuousImport} disabled={isToolBusy} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Start Auto-Import
              </Button>
              <Button onClick={handleStop} variant="destructive" disabled={!isProcessing} className="w-full">
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </div>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {(isProcessing || processedItems.length > 0) && (
            <div className="space-y-4 pt-4 border-t">
                 <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-medium">Import Progress</h3>
                        <p className="text-sm font-semibold">Total Imported: {totalProcessedCount}</p>
                    </div>
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>Status: {currentStatus}</span>
                    </div>
                </div>

                <Collapsible defaultOpen={true}>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between">
                            <span>Processing Log</span>
                            <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                        </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                        <ScrollArea className="h-72 w-full rounded-md border p-2 mt-2">
                            <div className="space-y-2">
                                {processedItems.length === 0 && (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        <p>Waiting for first file to be processed...</p>
                                    </div>
                                )}
                                {processedItems.map((item, index) => (
                                    <div key={index} className="flex items-center p-2 rounded-md bg-muted/50 text-sm gap-2">
                                        {item.status === 'success' ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                                        <div className="flex-grow overflow-hidden">
                                            <p className="font-semibold truncate">{item.file.clientName} / {item.file.year}</p>
                                            <p className="text-xs text-muted-foreground truncate">{item.file.fileName}</p>
                                        </div>
                                        <p className={cn("text-xs text-right truncate", item.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
                                            {item.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
