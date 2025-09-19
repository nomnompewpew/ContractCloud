
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { findMarketMismatchesAction, correctMarketMismatchesAction, type MarketCorrectionInfo } from '@/app/actions';
import { Loader2, FileScan, CheckCircle, XCircle, ArrowRight, Wand2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MarketCorrectionToolProps {
  isToolBusy: boolean;
  onToolStateChange: (isBusy: boolean) => void;
}

export function MarketCorrectionTool({ isToolBusy, onToolStateChange }: MarketCorrectionToolProps) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [mismatches, setMismatches] = useState<MarketCorrectionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const isBusy = isScanning || isCorrecting;

  useEffect(() => {
    onToolStateChange(isBusy);
  }, [isBusy, onToolStateChange]);

  const resetTool = () => {
    setMismatches([]);
    setError(null);
  };

  const handleScan = async () => {
    setIsScanning(true);
    resetTool();
    const result = await findMarketMismatchesAction();
    if (result.success && result.data) {
      setMismatches(result.data);
      if (result.data.length === 0) {
        toast({ title: 'No Mismatches Found', description: 'All orders appear to have the correct market assigned in the database.' });
      }
    } else {
      setError(result.error || 'An unknown error occurred while scanning.');
      toast({ variant: 'destructive', title: 'Scan Failed', description: result.error });
    }
    setIsScanning(false);
  };

  const handleCorrection = async () => {
    setIsCorrecting(true);
    const result = await correctMarketMismatchesAction(mismatches);
    if (result.success) {
      toast({ title: 'Correction Successful', description: `${result.data?.count || 0} orders have been corrected.` });
      resetTool(); // Clear the list after successful correction
    } else {
      toast({ variant: 'destructive', title: 'Correction Failed', description: result.error });
    }
    setIsCorrecting(false);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Mismatch Fixer</CardTitle>
        <CardDescription>
          This tool finds orders marked as "Twin Falls" in the database that are incorrectly filed in the Boise Google Drive folder, and moves them to the correct market folder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleScan} disabled={isToolBusy || isBusy} className="w-full">
          {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileScan className="mr-2 h-4 w-4" />}
          {isScanning ? 'Scanning...' : 'Find Market Mismatches'}
        </Button>
        
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {mismatches.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-medium">{mismatches.length} Mismatches Found</h3>
            <ScrollArea className="h-72 w-full rounded-md border p-2">
              <div className="space-y-2">
                {mismatches.map((item) => (
                  <div key={item.order.id} className="flex items-center p-2 rounded-md bg-muted/50 text-sm gap-4">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <p className="flex-1 font-semibold truncate">{item.order.client}</p>
                    <p className="font-semibold text-destructive capitalize">{item.currentMarket}</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="font-semibold text-green-600 capitalize">{item.proposedMarket}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
      {mismatches.length > 0 && !isCorrecting && (
        <CardFooter>
          <Button onClick={handleCorrection} disabled={isToolBusy || isBusy}>
            {isCorrecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {isCorrecting ? 'Correcting...' : `Correct ${mismatches.length} Mismatch(es)`}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
