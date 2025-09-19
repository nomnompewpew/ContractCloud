
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const ADMIN_EMAILS = ['codyw@iliadmg.com', 'developer@iliadmg.com', 'olgae@iliadmg.com', 'amberv@iliadmg.com'];

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-40">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

const DataCorrectionTool = dynamic(() => import('@/components/admin/data-correction-tool').then(mod => mod.DataCorrectionTool), { loading: () => <LoadingSpinner /> });
const SmartImportTool = dynamic(() => import('@/components/admin/smart-import-tool').then(mod => mod.SmartImportTool), { loading: () => <LoadingSpinner /> });
const DateCorrectionTool = dynamic(() => import('@/components/admin/date-correction-tool').then(mod => mod.DateCorrectionTool), { loading: () => <LoadingSpinner /> });
const MarketCorrectionTool = dynamic(() => import('@/components/admin/market-correction-tool').then(mod => mod.MarketCorrectionTool), { loading: () => <LoadingSpinner /> });

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const isAuthorized = user && user.email && ADMIN_EMAILS.includes(user.email);
  
  const handleToolStateChange = (toolName: string, isBusy: boolean) => {
    setActiveTool(isBusy ? toolName : null);
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="mx-auto w-full max-w-4xl space-y-8">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            {isAuthorized ? (
              <div className="space-y-8">
                
                <DataCorrectionTool 
                  isToolBusy={activeTool !== null && activeTool !== 'client-corrector'}
                  onToolStateChange={(busy) => handleToolStateChange('client-corrector', busy)}
                />

                <DateCorrectionTool
                  isToolBusy={activeTool !== null && activeTool !== 'date-corrector'}
                  onToolStateChange={(busy) => handleToolStateChange('date-corrector', busy)}
                />
                
                <MarketCorrectionTool
                  isToolBusy={activeTool !== null && activeTool !== 'market-corrector'}
                  onToolStateChange={(busy) => handleToolStateChange('market-corrector', busy)}
                />

                <SmartImportTool
                  isToolBusy={activeTool !== null && activeTool !== 'importer'}
                  onToolStateChange={(busy) => handleToolStateChange('importer', busy)}
                />

              </div>
            ) : (
                <Card className="border-destructive">
                    <CardHeader className="flex flex-row items-center gap-4">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                        <div>
                            <CardTitle className="text-destructive">Access Denied</CardTitle>
                            <CardDescription>
                                You do not have permission to view this page. Please contact an administrator.
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            )}
        </div>
      </main>
    </div>
  );
}
