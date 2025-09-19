
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { APP_VERSION } from '@/version';
import { Badge } from './ui/badge';
import { useAuth } from '@/hooks/use-auth';

const ADMIN_EMAILS = ['codyw@iliadmg.com', 'developer@iliadmg.com', 'olgae@iliadmg.com', 'amberv@iliadmg.com'];

export function Header() {
  const { user, signOut } = useAuth();
  const isAuthorizedAdmin = user && user.email && ADMIN_EMAILS.includes(user.email);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container flex h-20 items-center px-4 sm:px-6">
        <Link href="/dashboard" className="mr-4 flex items-center gap-3">
            <img src="/logo.png" alt="Company Logo" className="h-10 w-10 invert dark:invert-0" data-ai-hint="logo" />
            <h1 className="text-xl font-bold tracking-tight font-headline">ContractCloud</h1>
        </Link>
        <Badge variant="outline" className="hidden sm:inline-flex">{APP_VERSION}</Badge>
        
        <nav className="ml-6 flex items-center space-x-2">
           {isAuthorizedAdmin && (
             <Button asChild variant="ghost" size="sm">
               <Link href="/admin">
                 <Shield className="mr-2 h-4 w-4" />
                 Admin
               </Link>
             </Button>
           )}
        </nav>

        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} data-ai-hint="person portrait" />
                    <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
