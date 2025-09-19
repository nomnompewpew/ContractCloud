
'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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

interface ClientComboboxProps {
  value: string;
  onChange: (value: string) => void;
  clients: string[];
}

export function ClientCombobox({ value, onChange, clients }: ClientComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };
  
  // When the popover opens, pre-fill the search input with the current value.
  // This allows the user to easily edit the existing value.
  React.useEffect(() => {
    if (open) {
      setInputValue(value || '');
    }
  }, [open, value]);

  // When the popover closes, if the user has typed a new value
  // without explicitly selecting an item, we treat that as the new value.
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Check if the typed value is different from the last saved value,
      // even if only by case.
      if (inputValue.trim() && inputValue.trim() !== (value || '')) {
         onChange(inputValue.trim());
      }
    }
  };

  const showCreateOption = inputValue.trim().length > 0 && !clients.some(c => c.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || "Select or create client..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command
          // The filter now gives a higher score to items that start with the search term.
          filter={(itemValue, search) => {
            const lowerItem = itemValue.toLowerCase();
            const lowerSearch = search.toLowerCase();
            if (lowerItem.startsWith(lowerSearch)) return 2;
            if (lowerItem.includes(lowerSearch)) return 1;
            return 0;
          }}
        >
          <CommandInput
            placeholder="Search, edit, or create client..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
                {/* This part shows the create option even when no results are found */}
                {showCreateOption ? (
                    <CommandItem
                      onSelect={() => handleSelect(inputValue.trim())}
                      value={inputValue.trim()}
                      className="italic"
                      >
                      Create new: "{inputValue.trim()}"
                    </CommandItem>
                ) : 'No client found.'}
            </CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client}
                  value={client}
                  onSelect={() => handleSelect(client)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      // The checkmark reflects the currently saved value
                      value?.toLowerCase() === client.toLowerCase()
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  {client}
                </CommandItem>
              ))}
               {/* This part shows the create option at the bottom of the list of matches */}
              {showCreateOption ? (
                <CommandItem
                  onSelect={() => handleSelect(inputValue.trim())}
                  value={inputValue.trim()}
                  className="italic"
                  >
                  Create new: "{inputValue.trim()}"
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
