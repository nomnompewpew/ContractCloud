
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chrome, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (error) {
      console.error('Sign in failed:', error);
      // You can add a toast notification here to inform the user of the error
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src="/logo.png" alt="Company Logo" className="h-24 w-24 invert dark:invert-0" data-ai-hint="logo" />
          </div>
          <CardTitle className="text-3xl font-headline">ContractCloud</CardTitle>
          <CardDescription>Sign in to manage your sales contracts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Button 
              onClick={handleSignIn} 
              disabled={loading}
              className="w-full bg-[#4285F4] text-white hover:bg-[#4285F4]/90" 
              variant="outline"
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Chrome className="mr-2 h-5 w-5" />
              )}
              Sign in with Google
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Please use your @iliadmg.com account.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
