// filepath: app/login/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { Shield, LogIn, X } from 'lucide-react';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'authenticating' | 'verified'>('idle');
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setShowExpiredModal(searchParams.get('expired') === '1');
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginStatus('authenticating');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setLoginStatus('verified');
        localStorage.setItem('lastActivityTimestamp', Date.now().toString());
        
        // Wait exactly 300ms for visual verification before router transition
        setTimeout(() => {
          switch (data.user.role) {
            case 'SUPERADMIN':
              router.replace('/superadmin');
              break;
            case 'ADMIN':
              router.replace('/admin');
              break;
            case 'USER':
              router.replace('/user');
              break;
            default:
              setLoginStatus('idle');
              router.replace('/login');
          }
        }, 300);
      } else {
        setLoginStatus('idle');
        toast.error(data.error || 'Invalid credentials');
      }
    } catch (error) {
      setLoginStatus('idle');
      toast.error('Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Toaster position="top-right" />
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Document Management System</h1>
          <p className="text-slate-400 mt-2">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your user ID"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginStatus !== 'idle'}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-80 disabled:cursor-wait"
            >
              {loginStatus === 'authenticating' && (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Authenticating credentials...
                </>
              )}
              {loginStatus === 'verified' && (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Access Verified. Loading Dashboard...
                </>
              )}
              {loginStatus === 'idle' && (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              Demo Credentials:<br />
              Superadmin: superadmin / superadmin123
            </p>
          </div>
        </div>
      </div>

      {showExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Session Expired</h2>
                <p className="mt-3 text-sm text-slate-600">
                  Your session has expired due to inactivity. Please log in again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowExpiredModal(false);
                  router.replace('/login');
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mt-8 text-right">
              <button
                type="button"
                onClick={() => {
                  setShowExpiredModal(false);
                  router.replace('/login');
                }}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Return to login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}