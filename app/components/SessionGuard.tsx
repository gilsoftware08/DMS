"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

export default function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const isProcessingLogout = useRef<boolean>(false);
  const isModalShown = useRef<boolean>(false); // ← fix stale closure

  // Mount phase: F5 reload protection
  useEffect(() => {
    if (localStorage.getItem('session_expired') === 'true') {
      isProcessingLogout.current = true;
      isModalShown.current = true;

      try {
        localStorage.removeItem('auth');
        sessionStorage.removeItem('auth');
        localStorage.removeItem('session_expired');
        localStorage.removeItem('lastActivityTimestamp');
      } catch { }

      fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' })
        .catch(console.error)
        .finally(() => router.replace('/login'));
    }
  }, [router]);

  // Activity tracking
  useEffect(() => {
    localStorage.setItem('lastActivityTimestamp', Date.now().toString());

    const triggerTimeout = () => {
      if (isProcessingLogout.current || isModalShown.current) return;

      isProcessingLogout.current = true;
      isModalShown.current = true;

      try {
        localStorage.setItem('session_expired', 'true');
        localStorage.removeItem('lastActivityTimestamp');
      } catch { }

      setShowTimeoutModal(true);
    };

    const handleActivity = (e: Event) => {
      if (isProcessingLogout.current || isModalShown.current) return;

      const now = Date.now();
      const stored = parseInt(
        localStorage.getItem('lastActivityTimestamp') || now.toString(), 10
      );

      if (now - stored > INACTIVITY_TIMEOUT_MS) {
        if (e.cancelable) {
          e.preventDefault();
          e.stopPropagation();
        }
        triggerTimeout();
      } else {
        localStorage.setItem('lastActivityTimestamp', now.toString());
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt =>
      window.addEventListener(evt, handleActivity, { capture: true })
    );

    const intervalCheck = setInterval(() => {
      if (isProcessingLogout.current || isModalShown.current) return;

      const now = Date.now();
      const stored = parseInt(
        localStorage.getItem('lastActivityTimestamp') || now.toString(), 10
      );
      if (now - stored > INACTIVITY_TIMEOUT_MS) triggerTimeout();
    }, 5000);

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', handlePageShow);

    const handleManualLogout = () => {
      isProcessingLogout.current = true;
      isModalShown.current = true;
    };
    window.addEventListener('manual-logout', handleManualLogout);

    return () => {
      events.forEach(evt =>
        window.removeEventListener(evt, handleActivity, { capture: true })
      );
      clearInterval(intervalCheck);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('manual-logout', handleManualLogout);
    };
  }, []); // intentionally empty — refs prevent stale closure issues

  const handleRelogin = async () => {
    isProcessingLogout.current = true;

    try {
      localStorage.removeItem('auth');
      sessionStorage.removeItem('auth');
      localStorage.removeItem('session_expired');
      localStorage.removeItem('lastActivityTimestamp');
    } catch { }

    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(console.error);
    router.replace('/login');
  };

  return (
    <>
      {children}

      {showTimeoutModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Session Expired</h2>
            <p className="text-sm text-slate-600 mb-8 leading-relaxed">
              Your session has expired due to inactivity. Please re-login to continue.
            </p>
            <button
              onClick={handleRelogin}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              <LogIn className="w-5 h-5" />
              OK, Re-login
            </button>
          </div>
        </div>
      )}
    </>
  );
}