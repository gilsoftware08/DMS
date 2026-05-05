"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function getInitialVerifyingState(): boolean {
  // Runs synchronously — no flash possible
  // If session_expired is set, SessionGuard owns the redirect → don't show spinner
  if (typeof window === 'undefined') return true; // SSR: always block
  if (localStorage.getItem('session_expired') === 'true') return false;
  // No activity timestamp = definitely logged out, redirect immediately
  if (!localStorage.getItem('lastActivityTimestamp')) return false;
  return true; // has timestamp → need API verify
}

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Lazy initializer: runs once synchronously, before first render
  const [isVerifying, setIsVerifying] = useState<boolean>(getInitialVerifyingState);

  useEffect(() => {
    // Handle the "no timestamp" case: redirect immediately, no API call needed
    if (localStorage.getItem('session_expired') === 'true') {
      // SessionGuard is handling this — just ensure spinner is off
      setIsVerifying(false);
      return;
    }

    if (!localStorage.getItem('lastActivityTimestamp')) {
      router.replace('/login');
      return;
    }

    let isMounted = true;

    const verifyRoute = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!isMounted) return;

        if (res.ok) {
          setIsVerifying(false);
        } else {
          router.replace('/login');
        }
      } catch {
        if (isMounted) router.replace('/login');
      }
    };

    verifyRoute();
    return () => { isMounted = false; };
  }, [pathname, router]);

  if (isVerifying) {
    return (
      <div className="fixed inset-0 z-[9998] bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}