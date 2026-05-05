// filepath: app/unauthorized/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldOff, ArrowLeft, LogIn } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Administrator',
  ADMIN:      'Administrator',
  USER:       'User',
};

const ROLE_DASHBOARDS: Record<string, string> = {
  SUPERADMIN: '/superadmin',
  ADMIN:      '/admin',
  USER:       '/user',
};

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const from     = searchParams.get('from') || 'unknown page';
  const required = searchParams.get('required');

  useEffect(() => {
    // Fetch current session to know user's role so we can send them to the right dashboard
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.role) setUserRole(data.role);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleGoToDashboard = () => {
    if (userRole && ROLE_DASHBOARDS[userRole]) {
      router.push(ROLE_DASHBOARDS[userRole]);
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-6">
            <ShieldOff className="w-10 h-10 text-red-400" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 text-sm mb-6">
            You don&apos;t have permission to view this page.
          </p>

          {/* Detail pills */}
          <div className="space-y-3 mb-8">
            {required && (
              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <span className="text-slate-400 text-sm">Required Role</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  {ROLE_LABELS[required] || required}
                </span>
              </div>
            )}

            {!loading && userRole && (
              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <span className="text-slate-400 text-sm">Your Role</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {ROLE_LABELS[userRole] || userRole}
                </span>
              </div>
            )}

            <div className="flex items-start justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <span className="text-slate-400 text-sm flex-shrink-0 mr-3">Attempted Path</span>
              <span className="text-xs font-mono text-slate-300 truncate text-right">
                {from}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!loading && userRole ? (
              <button
                onClick={handleGoToDashboard}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                Go to My Dashboard
              </button>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                Go to Login
              </button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-slate-600 text-xs mt-6">
          If you believe this is a mistake, please contact your administrator.
        </p>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    }>
      <UnauthorizedContent />
    </Suspense>
  );
}
