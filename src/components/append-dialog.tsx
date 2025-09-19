
'use client';

import React, { useState, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Order } from '@/app/dashboard/page';
import { FileUp, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

interface AppendDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  order: Order;
  onAppend: (
    orderId: string,
    files: { dataUri: string; name: string; type: string }[],
    contractType: 'Original' | 'Revision' | 'Cancellation'
  ) => Promise<{ success: boolean }>;
  isSubmitting: boolean;
}

export function AppendDialog({ isOpen, onOpenChange, order, onAppend, isSubmitting }: AppendDialogProps) {
  const { toast } = useToast();
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [contractType, setContractType] = useState<'Original' | 'Revision' | 'Cancellation'>(order.contractType);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || []);
    if (newFiles.length > 0) {
      setStagedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setStagedFiles([]);
    setContractType(order.contractType);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  const handleSubmit = async () => {
    if (stagedFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Files Selected',
        description: 'Please add at least one file to append.',
      });
      return;
    }
    
    try {
        const filePromises = stagedFiles.map(file => {
            return new Promise<{ dataUri: string; name: string; type: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve({
                    dataUri: e.target?.result as string,
                    name: file.name,
                    type: file.type
                });
                reader.onerror = e => reject(new Error(`Could not read file: ${file.name}`));
                reader.readAsDataURL(file);
            });
        });

        const fileData = await Promise.all(filePromises);
        
        const result = await onAppend(order.id, fileData, contractType);

        if (result.success) {
            handleDialogOpenChange(false);
        }
    } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error preparing files",
          description: error.message
        });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revise or Append to Contract</DialogTitle>
          <DialogDescription>
            Add new files for <span className="font-semibold text-foreground">{order.client}</span> (Contract #: {order.contractNumber}). This will update the contract type and merge the files.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className='space-y-1.5'>
            <Label>Contract Type</Label>
            <RadioGroup value={contractType} onValueChange={setContractType as (value: string) => void} className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Original" id="r-original" />
                <Label htmlFor="r-original" className="font-normal">Original</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Revision" id="r-revision" />
                <Label htmlFor="r-revision" className="font-normal">Revision</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Cancellation" id="r-cancellation" />
                <Label htmlFor="r-cancellation" className="font-normal">Cancellation</Label>
              </div>
            </RadioGroup>
          </div>
            <div>
                <Label className="text-sm font-medium">New Files (PDFs, JPGs, PNGs)</Label>
                <div className="flex items-center gap-2 mt-1.5">
                    <Input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png" 
                        className="hidden" 
                        ref={fileInputRef} 
                        multiple
                        onChange={handleFileChange}
                        disabled={isSubmitting}
                    />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting} className="w-full">
                        <FileUp className="mr-2 h-4 w-4"/>
                        Add Files
                    </Button>
                </div>
            </div>
            {stagedFiles.length > 0 && (
                <ScrollArea className="h-48 w-full rounded-md border p-2">
                    <div className="space-y-2">
                    {stagedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                            <div className='flex items-center gap-2 overflow-hidden'>
                                <Paperclip className="h-4 w-4 flex-shrink-0" />
                                <span className='truncate'>{file.name}</span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveFile(index)}
                                disabled={isSubmitting}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
            )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting || stagedFiles.length === 0}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update and Append Files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
