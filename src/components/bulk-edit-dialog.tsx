
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Order } from '@/app/dashboard/page';
import { Label } from './ui/label';
import { Input } from './ui/input';

interface BulkEditDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ordersCount: number;
  onBulkUpdate: (updatedFields: Partial<Omit<Order, 'id'>>) => void;
}

export function BulkEditDialog({ isOpen, onOpenChange, ordersCount, onBulkUpdate }: BulkEditDialogProps) {
  const { toast } = useToast();
  const [agency, setAgency] = useState<string | undefined>(undefined);
  const [contractNumber, setContractNumber] = useState<string | undefined>(undefined);
  const [estimateNumber, setEstimateNumber] = useState<string | undefined>(undefined);
  const [market, setMarket] = useState<'boise' | 'twin-falls' | undefined>(undefined);

  const reset = () => {
    setAgency(undefined);
    setContractNumber(undefined);
    setEstimateNumber(undefined);
    setMarket(undefined);
  };

  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  const handleSubmit = () => {
    const updatedFields: Partial<Omit<Order, 'id'>> = {};

    if (agency !== undefined) updatedFields.agency = agency;
    if (contractNumber !== undefined) updatedFields.contractNumber = contractNumber;
    if (estimateNumber !== undefined) updatedFields.estimateNumber = estimateNumber;
    if (market) updatedFields.market = market;

    if (Object.keys(updatedFields).length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Changes Selected',
        description: 'Please select at least one field to update.',
      });
      return;
    }

    onBulkUpdate(updatedFields);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Edit {ordersCount} Orders</DialogTitle>
          <DialogDescription>
            Change any of the fields below. The new values will be applied to all selected orders. Leave fields blank to keep their existing values.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bulk-agency" className="text-right">Agency</Label>
            <Input id="bulk-agency" value={agency || ''} onChange={(e) => setAgency(e.target.value)} className="col-span-3" placeholder="New agency name" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bulk-contract" className="text-right">Contract #</Label>
            <Input id="bulk-contract" value={contractNumber || ''} onChange={(e) => setContractNumber(e.target.value)} className="col-span-3" placeholder="New contract number" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Estimate/PO #</Label>
            <Input value={estimateNumber || ''} onChange={(e) => setEstimateNumber(e.target.value)} className="col-span-3" placeholder="New estimate/PO number" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bulk-market" className="text-right">Market</Label>
            <Select onValueChange={(v) => setMarket(v as any)} value={market}>
              <SelectTrigger id="bulk-market" className="col-span-3 capitalize">
                <SelectValue placeholder="Select a new market" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="boise">Boise</SelectItem>
                <SelectItem value="twin-falls">Twin Falls</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit}>Update Orders</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
