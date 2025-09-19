
'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Calendar as CalendarIcon, X, Trash2, Pencil, Check, FilePlus, Loader2, ChevronDown } from 'lucide-react';
import type { Order } from '@/app/dashboard/page';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BulkEditDialog } from './bulk-edit-dialog';
import { AppendDialog } from './append-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { ClientCombobox } from './client-combobox';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { updateOrderAction, deleteOrderAction, deleteOrdersAction, bulkUpdateOrdersAction, appendFilesToContractAction } from '@/app/actions';

const allStations = [
    'KQBL', 'KWYD', 'KZMG', 'KSRV', 'KQBL HD2', 'KKOO', 'KSRV HD-2', 'KQBL HD3', 
    'KIRQ', 'KYUN', 'KTPZ', 'KIKX', 'KYUN-HD2', 'KYUN-HD3', 'Digital'
].sort();

interface OrdersTabProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: (options: { includeArchived: boolean, includeOlder: boolean }) => void;
  onViewChange: (options: { includeArchived: boolean, includeOlder: boolean }) => void;
  initialFetch: () => void;
}

export function OrdersTab({
  orders,
  setOrders,
  isLoading,
  hasMore,
  onLoadMore,
  onViewChange,
  initialFetch
}: OrdersTabProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState<Date | undefined>(undefined);
  const [searchArchived, setSearchArchived] = useState(false);
  const [showOlder, setShowOlder] = useState(false);

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = useState(false);
  const [editedOrderData, setEditedOrderData] = useState<Partial<Order> | null>(null);
  const [isAppendDialogOpen, setIsAppendDialogOpen] = useState(false);
  const [orderToAppend, setOrderToAppend] = useState<Order | null>(null);

  // Initial fetch and refetch when view options change
  useEffect(() => {
    // Only call initial fetch if orders haven't been loaded yet.
    if(orders.length === 0) {
      initialFetch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onViewChange({ includeArchived: searchArchived, includeOlder: showOlder });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchArchived, showOlder]);
  
  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      onLoadMore({ includeArchived: searchArchived, includeOlder: showOlder });
    }
  };
  
  const existingClients = useMemo(() => {
    const clientNames = orders.map(o => o.client).filter(Boolean);
    const unique = [...new Set(clientNames)].sort((a, b) => a.localeCompare(b));
    return unique;
  }, [orders]);
  
  const handleUpdateOrder = async (orderId: string, updatedFields: Partial<Omit<Order, 'id'>>) => {
    const result = await updateOrderAction(orderId, updatedFields, searchArchived);
    if(result.success) {
       setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? { ...o, ...updatedFields } : o));
    } else {
      toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
    }
  };

  const handleStartEditing = (order: Order) => {
    setEditingOrderId(order.id);
    setEditedOrderData(order);
  };
  
  const handleCancelEditing = () => {
    setEditingOrderId(null);
    setEditedOrderData(null);
  };

  const handleSaveEditing = async () => {
    if (editingOrderId && editedOrderData) {
      await handleUpdateOrder(editingOrderId, editedOrderData);
      toast({title: "Order Updated"});
    }
    handleCancelEditing();
  };
  
  const handleFieldChange = (field: keyof Order, value: any) => {
    setEditedOrderData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleStationCheckedChange = (stationId: string, isChecked: boolean) => {
    setEditedOrderData(prev => {
        if (!prev) return null;
        const currentStations = prev.stations || [];
        const newStations = isChecked 
            ? [...currentStations, stationId] 
            : currentStations.filter(s => s !== stationId);
        return { ...prev, stations: newStations };
    });
  };

  const handleFilterClick = (filterValue: string) => {
    setSearchTerm(filterValue);
  };

  const handlePreviewClick = (order: Order) => {
    if (order.pdfUrl) {
      window.open(order.pdfUrl, '_blank');
    } else {
      toast({
        variant: 'destructive',
        title: 'Preview Failed',
        description: 'No PDF file found for this order.',
      });
    }
  };

  const handleOpenAppendDialog = (order: Order) => {
    setOrderToAppend(order);
    setIsAppendDialogOpen(true);
  };
  
  const onDeleteOrder = async (orderId: string) => {
    const result = await deleteOrderAction(orderId, searchArchived);
    if(result.success) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast({ title: 'Order Deleted' });
    } else {
      toast({ variant: 'destructive', title: 'Deletion Failed', description: result.error });
    }
  };
  
  const onDeleteOrders = async (orderIds: string[]) => {
     const result = await deleteOrdersAction(orderIds, searchArchived);
    if(result.success) {
      setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      toast({ title: 'Bulk Delete Successful', description: `${orderIds.length} orders deleted.` });
    } else {
      toast({ variant: 'destructive', title: 'Bulk Deletion Failed', description: result.error });
    }
  };

  const displayedOrders = useMemo(() => {
    const hasSearchTerm = searchTerm.trim() !== '';
    const hasSearchDate = !!searchDate;
    
    if (!hasSearchTerm && !hasSearchDate) {
      return orders;
    }

    const lowercasedFilter = searchTerm.toLowerCase().trim();

    return orders.filter((order) => {
      const textMatch =
        !hasSearchTerm ||
        order.client.toLowerCase().includes(lowercasedFilter) ||
        (order.agency || '').toLowerCase().includes(lowercasedFilter) ||
        order.contractNumber.toLowerCase().includes(lowercasedFilter) ||
        (order.estimateNumber || '').toLowerCase().includes(lowercasedFilter) ||
        order.stations.join(' ').toLowerCase().includes(lowercasedFilter) ||
        order.market.toLowerCase().includes(lowercasedFilter) ||
        (order.contractType || '').toLowerCase().includes(lowercasedFilter) ||
        order.finalFileName.toLowerCase().includes(lowercasedFilter) ||
        order.status.toLowerCase().includes(lowercasedFilter);

      const dateMatch = !hasSearchDate || (
          order.orderEntryDate.getFullYear() === searchDate.getFullYear() &&
          order.orderEntryDate.getMonth() === searchDate.getMonth() &&
          order.orderEntryDate.getDate() === searchDate.getDate()
      );

      return textMatch && dateMatch;
    });
  }, [searchTerm, searchDate, orders]);

  const handleDeleteFiltered = () => {
    const idsToDelete = displayedOrders.map(o => o.id);
    if (idsToDelete.length > 0) {
        onDeleteOrders(idsToDelete);
    }
  };
  
  const onBulkUpdateOrders = async (orderIds: string[], updatedFields: Partial<Omit<Order, 'id'>>) => {
     const result = await bulkUpdateOrdersAction(orderIds, updatedFields, searchArchived);
    if(result.success) {
       // A full refetch might be easier than patching state here
       onViewChange({ includeArchived, includeOlder: showOlder });
      toast({ title: 'Bulk Update Successful', description: `${orderIds.length} orders updated.` });
    } else {
      toast({ variant: 'destructive', title: 'Bulk Update Failed', description: result.error });
    }
  }

  const handleBulkUpdate = (updatedFields: Partial<Omit<Order, 'id'>>) => {
    const idsToUpdate = displayedOrders.map(o => o.id);
    if (idsToUpdate.length > 0) {
      onBulkUpdateOrders(idsToUpdate, updatedFields);
    }
  };
  
  const handleAppendFiles = async (
    orderId: string,
    files: { dataUri: string; name: string; type: string }[],
    contractType: 'Original' | 'Revision' | 'Cancellation'
  ): Promise<{ success: boolean }> => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) {
        toast({ variant: "destructive", title: "Append Failed", description: "Could not find the original order to update." });
        return { success: false };
    }
    const orderIsArchived = orderToUpdate.orderEntryDate.getFullYear() < 2022;

    setIsSubmitting(true);
    try {
        const result = await appendFilesToContractAction({
            pdfFileId: orderToUpdate.pdfFileId,
            orderId: orderToUpdate.id,
            files,
            isArchived: orderIsArchived,
            contractType,
        });

        if (!result.success) {
            throw new Error(result.error || "Failed to append files.");
        }
        
        // Optimistically update the single order in the list
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, contractType } : o));

        toast({
            title: "Files Appended!",
            description: `The contract has been updated to type "${contractType}".`,
        });
        return { success: true };
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Append Failed",
            description: error.message,
        });
        return { success: false };
    } finally {
        setIsSubmitting(false);
    }
  };


  const hasActiveFilter = searchTerm.trim() !== '' || !!searchDate;
  
  const getCardDescription = () => {
      let baseText = hasActiveFilter ? `Showing ${displayedOrders.length} matching results.` : `Showing ${orders.length} results.`;
      
      if (searchArchived) return `${baseText} Searching the archive.`;
      if (showOlder) return `${baseText} Searching all current orders.`;
      
      return `${baseText} Searching recent orders.`
  }

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <div className='flex justify-between items-start'>
            <div>
              <CardTitle>Filed Contracts</CardTitle>
              <CardDescription>
                {getCardDescription()}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-4">
               <div className="flex items-center space-x-2">
                <Switch id="older-switch" checked={showOlder} onCheckedChange={setShowOlder} disabled={searchArchived} />
                <Label htmlFor="older-switch">Show Older Contracts</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="archive-switch" checked={searchArchived} onCheckedChange={setSearchArchived} />
                <Label htmlFor="archive-switch">Search Archives</Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-grow w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search by Client, Filename, Contract #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full sm:w-[240px] justify-start text-left font-normal',
                    !searchDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {searchDate ? format(searchDate, 'PPP') : <span>Filter by entry date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={searchDate}
                  onSelect={setSearchDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {(hasActiveFilter || isLoading) && (
               <Button variant="ghost" size="icon" onClick={() => { setSearchTerm(''); setSearchDate(undefined); }} className="h-10 w-10 sm:h-9 sm:w-9 flex-shrink-0">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear filters</span>
               </Button>
            )}
            {hasActiveFilter && displayedOrders.length > 0 && (
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={() => setIsBulkEditDialogOpen(true)} className="flex-1 sm:flex-none">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit ({displayedOrders.length})
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="flex-1 sm:flex-none">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({displayedOrders.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the ${"{"}displayedOrders.length} currently filtered order(s). This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={handleDeleteFiltered}
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
          </div>

          <div className="rounded-md border relative min-h-[400px]">
             {isLoading && orders.length === 0 && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client / Agency</TableHead>
                  <TableHead>Contract / PO #</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Stations</TableHead>
                  <TableHead>Entry Date</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedOrders.length > 0 ? (
                  displayedOrders.map((order) => {
                    const lastModification = order.modifications && order.modifications.length > 0 ? order.modifications.slice(-1)[0] : null;
                    return (
                    <TableRow key={order.id} className={cn(editingOrderId === order.id && "bg-muted/50")}>
                      <TableCell>
                        {editingOrderId === order.id ? (
                          <div className="flex flex-col gap-1 w-48">
                            <ClientCombobox 
                              clients={existingClients}
                              value={editedOrderData?.client || ''}
                              onChange={(value) => handleFieldChange('client', value)}
                            />
                            <Input 
                              value={editedOrderData?.agency || ''} 
                              onChange={(e) => handleFieldChange('agency', e.target.value)} 
                              className="h-8"
                              placeholder="Agency"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => handleFilterClick(order.client)} className="text-left font-medium hover:underline p-0 bg-transparent h-auto">{order.client}</button>
                            <button onClick={() => handleFilterClick(order.agency)} className="text-left text-sm text-muted-foreground hover:underline p-0 bg-transparent h-auto">{order.agency || 'N/A'}</button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                         {editingOrderId === order.id ? (
                            <div className="flex flex-col gap-1">
                              <Input 
                                  value={editedOrderData?.contractNumber || ''} 
                                  onChange={(e) => handleFieldChange('contractNumber', e.target.value)} 
                                  className="h-8"
                                  placeholder="Contract #"
                              />
                               <Input 
                                  value={editedOrderData?.estimateNumber || ''} 
                                  onChange={(e) => handleFieldChange('estimateNumber', e.target.value)} 
                                  className="h-8"
                                  placeholder="Estimate/PO #"
                              />
                            </div>
                         ) : (
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => handleFilterClick(order.contractNumber)} className="text-left hover:underline p-0 bg-transparent h-auto">{order.contractNumber}</button>
                              <button onClick={() => handleFilterClick(order.estimateNumber || '')} className="text-left text-sm text-muted-foreground hover:underline p-0 bg-transparent h-auto">{order.estimateNumber || 'N/A'}</button>
                            </div>
                         )}
                      </TableCell>
                      <TableCell>
                        {editingOrderId === order.id ? (
                            <Input 
                              value={editedOrderData?.finalFileName || ''} 
                              onChange={(e) => handleFieldChange('finalFileName', e.target.value)} 
                              className="h-8"
                              placeholder="Filename"
                            />
                        ) : (
                          <div onClick={() => handleFilterClick(order.finalFileName)} className="text-sm text-muted-foreground max-w-xs truncate cursor-pointer hover:underline">
                            {order.finalFileName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                          {editingOrderId === order.id ? (
                              <Select
                                  onValueChange={(v) => handleFieldChange('market', v)}
                                  value={editedOrderData?.market}
                              >
                                  <SelectTrigger className="h-8 capitalize">
                                      <SelectValue placeholder="Market" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="boise">Boise</SelectItem>
                                      <SelectItem value="twin-falls">Twin Falls</SelectItem>
                                  </SelectContent>
                              </Select>
                          ) : (
                               <Badge
                                  onClick={() => handleFilterClick(order.market)}
                                  variant="outline"
                                  className="capitalize cursor-pointer"
                                >
                                  {order.market}
                                </Badge>
                          )}
                      </TableCell>
                       <TableCell>
                        {editingOrderId === order.id ? (
                          <Select
                            onValueChange={(v) => handleFieldChange('contractType', v)}
                            value={editedOrderData?.contractType}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Original">Original</SelectItem>
                              <SelectItem value="Revision">Revision</SelectItem>
                              <SelectItem value="Cancellation">Cancellation</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={
                              order.contractType === 'Revision'
                                ? 'default'
                                : order.contractType === 'Cancellation'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="cursor-pointer"
                            onClick={() => handleFilterClick(order.contractType || 'Original')}
                          >
                            {order.contractType || 'Original'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                          {editingOrderId === order.id ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-8">
                                        <span>{editedOrderData?.stations?.length || 0} selected</span>
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56">
                                    <DropdownMenuLabel>Select Stations</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {allStations.map((station) => (
                                        <DropdownMenuCheckboxItem
                                            key={station}
                                            checked={editedOrderData?.stations?.includes(station)}
                                            onCheckedChange={(checked) => handleStationCheckedChange(station, !!checked)}
                                        >
                                            {station}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                                {order.stations?.map((station) => (
                                    <Badge key={station} variant="secondary" className="font-mono">{station}</Badge>
                                ))}
                            </div>
                          )}
                      </TableCell>
                      <TableCell>
                        {editingOrderId === order.id ? (
                          <Popover>
                              <PopoverTrigger asChild>
                                  <Button
                                      variant={'outline'}
                                      className={cn(
                                          'w-full justify-start text-left font-normal h-8',
                                          !editedOrderData?.orderEntryDate && 'text-muted-foreground'
                                      )}
                                  >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {editedOrderData?.orderEntryDate ? format(editedOrderData.orderEntryDate, 'P') : <span>Pick date</span>}
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                  <Calendar 
                                      mode="single" 
                                      selected={editedOrderData?.orderEntryDate} 
                                      onSelect={(date) => date && handleFieldChange('orderEntryDate', date)} 
                                      initialFocus 
                                  />
                              </PopoverContent>
                          </Popover>
                        ) : (
                          <button onClick={() => setSearchDate(order.orderEntryDate)} className="text-left hover:underline p-0 bg-transparent h-auto">{format(order.orderEntryDate, 'P')}</button>
                        )}
                      </TableCell>
                       <TableCell>
                        {lastModification ? (
                          <>
                            {format(lastModification.date, 'P')}
                            <p className="text-xs text-muted-foreground">{lastModification.description}</p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">No history</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {editingOrderId === order.id ? (
                             <>
                                <Button variant="ghost" size="icon" onClick={handleSaveEditing}>
                                    <Check className="h-4 w-4 text-green-500" />
                                    <span className="sr-only">Save</span>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleCancelEditing}>
                                    <X className="h-4 w-4 text-destructive" />
                                    <span className="sr-only">Cancel</span>
                                </Button>
                             </>
                          ) : (
                              <Button variant="ghost" size="icon" onClick={() => handleStartEditing(order)}>
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                              </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenAppendDialog(order)}>
                            <FilePlus className="h-4 w-4" />
                            <span className="sr-only">Append Files</span>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePreviewClick(order)}>
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">View PDF</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Order</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete the contract for client <strong>{order.client}</strong> with contract number <strong>{order.contractNumber}</strong>. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => onDeleteOrder(order.id)}
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      {!isLoading && (hasActiveFilter 
                        ? "No results found for your search criteria."
                        : `No contracts found for the selected view.`
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
           {hasMore && !hasActiveFilter && (
            <div className="flex justify-center mt-4">
              <Button onClick={handleLoadMore} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <BulkEditDialog
        isOpen={isBulkEditDialogOpen}
        onOpenChange={setIsBulkEditDialogOpen}
        ordersCount={displayedOrders.length}
        onBulkUpdate={handleBulkUpdate}
      />
      {orderToAppend && (
        <AppendDialog
          isOpen={isAppendDialogOpen}
          onOpenChange={setIsAppendDialogOpen}
          order={orderToAppend}
          onAppend={handleAppendFiles}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}

    