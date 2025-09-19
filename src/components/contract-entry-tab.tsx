'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, type UseFormSetValue, type Control } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileUp, Loader2, Paperclip, FileText, Trash2, Users } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { extractContractDetailsAction, mergeAndPreviewAction } from '@/app/actions';
import { ClientSelectDialog } from './client-select-dialog';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';


// Boise Stations
const boiseStations = [
    { id: 'KQBL', name: 'KQBL' },
    { id: 'KWYD', name: 'KWYD' },
    { id: 'KZMG', name: 'KZMG' },
    { id: 'KSRV', name: 'KSRV' },
    { id: 'KQBL HD2', name: 'KQBL HD2' },
    { id: 'KKOO', name: 'KKOO' },
    { id: 'KSRV HD-2', name: 'KSRV HD-2' },
    { id: 'KQBL HD3', name: 'KQBL HD3' },
    { id: 'Digital', name: 'Digital' },
];

// Twin Falls Stations
const twinFallsStations = [
    { id: 'KIRQ', name: 'KIRQ' },
    { id: 'KYUN', name: 'KYUN' },
    { id: 'KTPZ', name: 'KTPZ' },
    { id: 'KIKX', name: 'KIKX' },
    { id: 'KYUN-HD2', name: 'KYUN-HD2' },
    { id: 'KYUN-HD3', name: 'KYUN-HD3' },
    { id: 'Digital', name: 'Digital' },
];


const formSchema = z.object({
  client: z.string().min(2, { message: 'Client name must be at least 2 characters.' }),
  agency: z.string().optional(),
  estimateNumber: z.string().optional(),
  contractNumber: z.string().min(1, { message: 'Contract number is required.' }),
  stations: z.array(z.string()).refine(value => value.some(item => item), {
    message: "You have to select at least one station.",
  }),
  market: z.enum(['boise', 'twin-falls'], { required_error: "You must select a market." }),
  contractType: z.enum(['Original', 'Revision', 'Cancellation']),
  files: z.array(z.any()).min(1, "At least one file is required for merging."),
  finalFileName: z.string().min(1, { message: "File name cannot be empty."}),
});

type FormValues = z.infer<typeof formSchema>;

interface MergedFileInfo {
  id: string;
  webViewLink: string;
  mergedPdfDataUri: string;
}

interface ContractEntryTabProps {
    onContractSubmit: (params: {
      values: Omit<FormValues, 'files'|'salesperson'> & { salesperson: null },
      tempFileId: string;
    }) => Promise<{ success: boolean }>;
    isSubmitting: boolean;
    existingClients: string[];
}

function FinalFilenameGenerator({ control, setValue }: { control: Control<FormValues>, setValue: UseFormSetValue<FormValues> }) {
    const client = useWatch({ control, name: 'client' });
    const contractNumber = useWatch({ control, name: 'contractNumber' });
    const contractType = useWatch({ control, name: 'contractType' });

    const generateFilename = () => {
        const datePart = format(new Date(), 'yyyy-MM-dd');
        const clientPart = (client || 'Client').trim().replace(/[^a-zA-Z0-9]/g, '');
        const contractPart = (contractNumber || 'ContractNum').trim();
        let suffix = '';
        if (contractType === 'Revision') suffix = '_REV';
        if (contractType === 'Cancellation') suffix = '_DEL';
        return `${datePart}_${clientPart}_${contractPart}${suffix}`;
    };

    useEffect(() => {
        setValue('finalFileName', generateFilename(), { shouldValidate: true, shouldDirty: true });
    }, [client, contractNumber, contractType, setValue]);

    return null;
}

export function ContractEntryTab({ onContractSubmit, isSubmitting, existingClients }: ContractEntryTabProps) {
  const { toast } = useToast();
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [mergedFileInfo, setMergedFileInfo] = useState<MergedFileInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client: '',
      agency: '',
      contractNumber: '',
      estimateNumber: '',
      stations: [],
      market: 'boise',
      contractType: 'Original',
      files: [],
      finalFileName: '',
    },
  });

  const selectedMarket = form.watch('market');

   useEffect(() => {
    const savedMarket = localStorage.getItem('lastUsedMarket') as 'boise' | 'twin-falls';
    if (savedMarket && (savedMarket === 'boise' || savedMarket === 'twin-falls')) {
        form.setValue('market', savedMarket);
    }
  }, [form]); 

  useEffect(() => {
      localStorage.setItem('lastUsedMarket', selectedMarket);
  }, [selectedMarket]);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const currentMarket = form.getValues('market');
    const manualClient = form.getValues('client'); // Check if client was entered manually

    form.reset({
      client: manualClient, // Keep manual client name if it exists
      agency: '', contractNumber: '', estimateNumber: '',
      stations: [], market: currentMarket, files: [], finalFileName: '',
      contractType: 'Original',
    });
    setStagedFiles([]);
    setMergedFileInfo(null);

    setIsProcessingFiles(true);
    setStagedFiles(files);
    form.setValue('files', files, { shouldValidate: true });

    try {
        const fileData = await Promise.all(files.map(file => new Promise<{ dataUri: string; name: string; type: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve({ dataUri: e.target?.result as string, name: file.name, type: file.type });
            reader.onerror = e => reject(new Error(`Could not read file: ${file.name}`));
            reader.readAsDataURL(file);
        })));
        
        const mergeResult = await mergeAndPreviewAction(fileData);
        if (!mergeResult.success || !mergeResult.data) throw new Error(mergeResult.error || 'Unknown error during file merge.');
        
        setMergedFileInfo(mergeResult.data);
        toast({ title: "Files Merged", description: "Now scanning for details..." });
        
        try {
            const scanResult = await extractContractDetailsAction(mergeResult.data.mergedPdfDataUri);
            if (scanResult.success && scanResult.data) {
                // Only set the client if it wasn't entered manually beforehand
                if (!manualClient) {
                  form.setValue('client', scanResult.data.client, { shouldDirty: true, shouldValidate: true });
                }
                form.setValue('agency', scanResult.data.agency, { shouldDirty: true });
                form.setValue('estimateNumber', scanResult.data.estimateNumber, { shouldDirty: true });
                form.setValue('stations', scanResult.data.stations, { shouldValidate: true });
                toast({ title: "Scan Complete", description: "The form has been populated with data from the merged PDF." });
            } else {
                throw new Error(scanResult.error || "Failed to extract details from PDF.");
            }
        } catch (scanError: any) {
            toast({ 
                variant: "destructive", 
                title: "AI Scan Failed", 
                description: "Could not automatically fill form. Please enter details manually." 
            });
            console.error("AI Scan Error:", scanError.message);
        }

    } catch (error: any) {
        toast({ variant: "destructive", title: "Processing Failed", description: error.message });
        setStagedFiles([]);
        setMergedFileInfo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
        setIsProcessingFiles(false);
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || []);
    processFiles(newFiles);
  };
  
  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const newFiles = Array.from(event.dataTransfer.files || []);
    processFiles(newFiles);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };


  const handleRemoveFile = (index: number) => {
    const updatedFiles = stagedFiles.filter((_, i) => i !== index);
    setStagedFiles(updatedFiles);
    form.setValue('files', updatedFiles, { shouldValidate: true });
    setMergedFileInfo(null);
    const currentMarket = form.getValues('market');
    form.reset({
        ...form.getValues(),
        client: '', agency: '', contractNumber: '', estimateNumber: '',
        stations: [], files: updatedFiles, finalFileName: '', market: currentMarket,
        contractType: 'Original',
    });
  }

  async function onSubmit(values: FormValues) {
    if (!mergedFileInfo) {
        toast({ variant: "destructive", title: "Submission Error", description: "A merged PDF is required. Please add files to begin." });
        return;
    }

    try {
        const { files, ...formValues } = values;
        const result = await onContractSubmit({ 
            values: { ...formValues, salesperson: null },
            tempFileId: mergedFileInfo.id,
        });

        if (result.success) {
            const currentMarket = form.getValues('market');
            form.reset({
              client: '', agency: '', contractNumber: '', estimateNumber: '',
              stations: [], market: currentMarket, files: [], finalFileName: '',
              contractType: 'Original',
            });
            setStagedFiles([]);
            setMergedFileInfo(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error preparing submission", description: error.message });
    }
  }

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>New Contract Entry</CardTitle>
          <CardDescription>
            Step 1: Add source files. Step 2: Verify details and create contract.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <FinalFilenameGenerator control={form.control} setValue={form.setValue} />
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* --- FILE INPUT AREA --- */}
                <FormField
                    control={form.control}
                    name="files"
                    render={() => (
                      <FormItem>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex-grow">
                                <label
                                  htmlFor="file-upload"
                                  className={cn(
                                    "relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors",
                                    isDragging && "ring-2 ring-primary ring-offset-2"
                                  )}
                                  onDrop={handleDrop}
                                  onDragOver={handleDragOver}
                                  onDragEnter={handleDragEnter}
                                  onDragLeave={handleDragLeave}
                                >
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <FileUp className="w-8 h-8 mb-2 text-muted-foreground" />
                                        <p className="mb-1 text-sm text-muted-foreground">
                                            <span className="font-semibold">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-muted-foreground">PDF, JPG, or PNG files</p>
                                    </div>
                                    <FormControl>
                                      <Input 
                                          id="file-upload"
                                          type="file" 
                                          accept=".pdf,.jpg,.jpeg,.png" 
                                          className="hidden" 
                                          ref={fileInputRef} 
                                          multiple
                                          onChange={handleFileChange}
                                          disabled={isSubmitting || isProcessingFiles}
                                      />
                                    </FormControl>
                                </label>
                                <FormMessage className="mt-2" />
                            </div>

                            {stagedFiles.length > 0 && (
                                <div className="w-full sm:w-1/3">
                                    <ScrollArea className="h-32 w-full rounded-md border p-2">
                                        <div className="space-y-2">
                                        {stagedFiles.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                                                <div className='flex items-center gap-2 overflow-hidden'>
                                                    <Paperclip className="h-4 w-4 flex-shrink-0" />
                                                    <span className='truncate'>{file.name}</span>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveFile(index)} disabled={isSubmitting || isProcessingFiles}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                      </FormItem>
                    )}
                  />

              {/* --- TWO COLUMN LAYOUT --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                 
                 {/* Left Column */}
                 <div className="space-y-6">
                    <FormField control={form.control} name="market" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Market</FormLabel>
                            <Select onValueChange={(value) => { field.onChange(value); form.setValue('stations', []); }} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a market" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="boise">Boise</SelectItem>
                                    <SelectItem value="twin-falls">Twin Falls</SelectItem>
                                </SelectContent>
                            </Select>
                             <FormDescription>This determines which stations to show and which Google Drive folder to use.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="client" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Client</FormLabel>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Input placeholder="AI will fill this, or enter manually" {...field} />
                                </FormControl>
                                <Button type="button" variant="outline" onClick={() => setIsClientDialogOpen(true)}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Choose Existing
                                </Button>
                            </div>
                             <FormDescription>Enter client name manually, or leave blank for AI to fill.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="agency" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Agency</FormLabel>
                            <FormControl><Input placeholder="Agency Name (if any)" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="contractNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Marketron Contract Number</FormLabel>
                            <FormControl><Input placeholder="Enter contract number manually" {...field} /></FormControl>
                            <FormDescription>Required. This autofills into the final file name.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="estimateNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Estimate/PO Number</FormLabel>
                            <FormControl><Input placeholder="Optional Estimate or PO #" {...field} /></FormControl>
                            <FormDescription>Optional identifier from the client.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                 </div>

                 {/* Right Column (Stations & Type) */}
                 <div className="space-y-6">
                      <FormField
                          control={form.control}
                          name="stations"
                          render={() => (
                              <FormItem>
                                  <FormLabel>Stations</FormLabel>
                                  <FormDescription>Select all stations that apply to this contract. The list is based on the selected market.</FormDescription>
                                  <div className="space-y-4 pt-2">
                                      {selectedMarket === 'boise' && (
                                        <div className="grid grid-cols-1 gap-y-3">
                                            {boiseStations.map((station) => (
                                                <FormField key={station.id} control={form.control} name="stations" render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                        <FormControl><Checkbox checked={field.value?.includes(station.id)} onCheckedChange={(checked) => (checked ? field.onChange([...(field.value || []), station.id]) : field.onChange(field.value?.filter((value) => value !== station.id)))} /></FormControl>
                                                        <FormLabel className="font-normal text-sm">{station.name}</FormLabel>
                                                    </FormItem>
                                                )} />
                                            ))}
                                        </div>
                                      )}
                                      {selectedMarket === 'twin-falls' && (
                                        <div className="grid grid-cols-1 gap-y-3">
                                            {twinFallsStations.map((station) => (
                                                <FormField key={station.id} control={form.control} name="stations" render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                        <FormControl><Checkbox checked={field.value?.includes(station.id)} onCheckedChange={(checked) => (checked ? field.onChange([...(field.value || []), station.id]) : field.onChange(field.value?.filter((value) => value !== station.id)))} /></FormControl>
                                                        <FormLabel className="font-normal text-sm">{station.name}</FormLabel>
                                                    </FormItem>
                                                )} />
                                            ))}
                                        </div>
                                      )}
                                  </div>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                        control={form.control}
                        name="contractType"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Contract Type</FormLabel>
                            <FormDescription>
                              Select if this is a revision or cancellation of an existing contract.
                            </FormDescription>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-col space-y-1"
                              >
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Original" />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Original
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Revision" />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Revision (adds "_REV" to filename)
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Cancellation" />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Cancellation (adds "_DEL" to filename)
                                  </FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                 </div>
              </div>
                
              {/* --- FINAL SUBMISSION AREA --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-4 border-t">
                  <FormField control={form.control} name="finalFileName" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Final File Name</FormLabel>
                          <FormControl><Input placeholder="e.g., 2024-07-30_ClientName_ContractNum" {...field} /></FormControl>
                          <FormDescription>You can edit this. The .pdf extension is added automatically.</FormDescription>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <div className="flex flex-col gap-4 pt-[2.125rem]">
                        {mergedFileInfo && (
                            <Button type="button" variant="secondary" onClick={() => window.open(mergedFileInfo.webViewLink, '_blank')} disabled={isSubmitting || isProcessingFiles}>
                                <FileText className="mr-2 h-4 w-4"/>
                                Preview Merged PDF
                            </Button>
                        )}
                      <Button type="submit" disabled={isSubmitting || isProcessingFiles || !mergedFileInfo}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isProcessingFiles ? 'Processing Files...' : 'Create Contract'}
                      </Button>
                  </div>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
      <ClientSelectDialog 
        isOpen={isClientDialogOpen}
        onOpenChange={setIsClientDialogOpen}
        clients={existingClients}
        onSelectClient={(clientName) => {
            form.setValue('client', clientName, { shouldValidate: true, shouldDirty: true });
            setIsClientDialogOpen(false);
        }}
      />
    </>
  );
}
