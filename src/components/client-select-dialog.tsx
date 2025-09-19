'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface ClientSelectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clients: string[];
  onSelectClient: (clientName: string) => void;
}

export function ClientSelectDialog({ isOpen, onOpenChange, clients, onSelectClient }: ClientSelectDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = useMemo(() => {
    if (!searchTerm) {
      return clients;
    }
    return clients.filter(client =>
      client.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose an Existing Client</DialogTitle>
          <DialogDescription>
            Select a client from the list below to populate the form.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10"
          />
        </div>
        <ScrollArea className="flex-grow rounded-md border">
            <div className="p-2 space-y-1">
                {filteredClients.length > 0 ? (
                    filteredClients.map((client) => (
                    <Button
                        key={client}
                        variant="ghost"
                        className="w-full justify-start font-normal"
                        onClick={() => onSelectClient(client)}
                    >
                        {client}
                    </Button>
                    ))
                ) : (
                    <div className="text-center text-sm text-muted-foreground p-4">
                        No clients found matching your search.
                    </div>
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
