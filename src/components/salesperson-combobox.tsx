
'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { searchSalespeopleAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import type { SalespersonInfo } from '@/app/dashboard/page';

interface SalespersonComboboxProps {
  value: SalespersonInfo | null | undefined; // Allow undefined for bulk edit reset
  onChange: (value: SalespersonInfo | null) => void;
}

export function SalespersonCombobox({ value, onChange }: SalespersonComboboxProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [salespeople, setSalespeople] = React.useState<SalespersonInfo[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    // When the popover is opened, fetch the full list of salespeople.
    if (open) {
      setIsLoading(true);
      searchSalespeopleAction('') // Empty query fetches all users in the OU
        .then((result) => {
          if (result.success) {
            setSalespeople(result.data || []);
          } else {
            toast({
              variant: 'destructive',
              title: 'Directory Search Failed',
              description: result.error || 'Could not fetch salesperson list.',
            });
            setSalespeople([]);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, toast]);

  const handleSelect = (personId: string) => {
    const selected = salespeople.find((s) => s.id === personId);
    onChange(selected || null);
    setOpen(false);
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value ? (
            <div className="flex items-center gap-2 overflow-hidden">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={value.photoUrl || ''} alt={value.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{value.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{value.name}</span>
            </div>
            ) : 'Select salesperson...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command>
          <CommandInput
            placeholder="Search salesperson..."
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && salespeople.length === 0 && <CommandEmpty>No salesperson found.</CommandEmpty>}
            <CommandGroup>
              {salespeople.map((person) => (
                <CommandItem
                  key={person.id}
                  value={person.name + " " + person.email}
                  onSelect={() => handleSelect(person.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value?.id === person.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Avatar className="h-6 w-6 mr-2">
                     <AvatarImage src={person.photoUrl || ''} alt={person.name} data-ai-hint="person portrait" />
                     <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.email}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
