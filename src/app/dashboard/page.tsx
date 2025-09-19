
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Header } from '@/components/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilePlus, Search, Loader2, LayoutDashboard } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { submitFinalContractAction, getPagedOrdersAction } from '@/app/actions';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const ContractEntryTab = dynamic(() => import('@/components/contract-entry-tab').then(mod => mod.ContractEntryTab), {
  loading: () => <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

const DashboardTab = dynamic(() => import('@/components/dashboard-tab').then(mod => mod.DashboardTab), {
  loading: () => <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

const OrdersTab = dynamic(() => import('@/components/search-tab').then(mod => mod.OrdersTab), {
  loading: () => <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});


export interface SalespersonInfo {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
}

export interface Order {
  id: string;
  client: string;
  agency: string;
  contractNumber: string;
  estimateNumber?: string;
  stations: string[];
  market: 'boise' | 'twin-falls';
  contractType: 'Original' | 'Revision' | 'Cancellation';
  salesperson: SalespersonInfo | null;
  finalFileName: string;
  pdfUrl: string;
  pdfFileId: string;
  status: 'Filed';
  orderEntryDate: Date;
  modifications: Array<{
    date: Date;
    description: string;
  }>;
}

// Firestore data structure mirrors Order, but with Timestamps
export interface OrderDocument extends Omit<Order, 'id' | 'orderEntryDate' | 'modifications'> {
  orderEntryDate: Timestamp;
  modifications: Array<{
    date: Timestamp;
    description: string;
  }>;
}

export type OrderDateFilter = 'recent' | 'all' | 'archived';

export type MarketCorrectionInfo = {
    order: Order;
    currentMarket: 'boise' | 'twin-falls';
    proposedMarket: 'boise' | 'twin-falls';
    isArchived: boolean;
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('contract-entry');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const initialFetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getPagedOrdersAction({ limit: 50, includeArchived: false, includeOlder: false });
      if (result.success && result.data) {
        setOrders(result.data);
      } else {
        toast({ variant: 'destructive', title: 'Error fetching orders', description: result.error });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error fetching orders', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user) {
      initialFetch();
    }
  }, [user, authLoading, router, initialFetch]);

  const existingClients = useMemo(() => {
    const clientNames = orders.map(o => o.client).filter(Boolean);
    return [...new Set(clientNames)].sort((a, b) => a.localeCompare(b));
  }, [orders]);


  const handleContractSubmit = async (params: {
    values: any,
    tempFileId: string;
  }) => {
    setIsSubmitting(true);
    try {
      const result = await submitFinalContractAction(params);

      if (!result.success) {
          throw new Error(result.error || 'An unknown error occurred during submission.');
      }
      
      toast({
          title: 'Contract Created!',
          description: `The contract has been filed and is available in the Orders tab.`,
      });
      // Prepend the new order to the list so it appears immediately
      if (result.data) {
        setOrders(prev => [result.data as Order, ...prev]);
      }
      return { success: true };

    } catch (error: any) {
      toast({
          variant: 'destructive',
          title: 'Submission Failed',
          description: error.message,
      });
      return { success: false };
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6 h-auto">
              <TabsTrigger value="contract-entry">
                <FilePlus className="mr-2 h-4 w-4" />
                Contract Entry
              </TabsTrigger>
               <TabsTrigger value="dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="orders">
                <Search className="mr-2 h-4 w-4" />
                Orders
              </TabsTrigger>
            </TabsList>
            <TabsContent value="contract-entry">
              <ContractEntryTab 
                onContractSubmit={handleContractSubmit}
                isSubmitting={isSubmitting}
                existingClients={existingClients}
              />
            </TabsContent>
            <TabsContent value="dashboard">
              <DashboardTab />
            </TabsContent>
            <TabsContent value="orders">
              <OrdersTab
                initialOrders={orders}
                setInitialOrders={setOrders}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            </TabsContent>
          </Tabs>
      </main>
    </div>
  );
}

