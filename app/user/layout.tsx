// filepath: app/user/layout.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, LogOut, FolderOpen } from 'lucide-react';
import SessionGuard from '@/app/components/SessionGuard';
import AuthGuard from '@/app/components/AuthGuard';
import { clearPdfSession } from '@/lib/pdfSession';


export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      
      // ====================================================================
      // IMPORTANT: Do NOT redirect here. AuthGuard and SessionGuard handle
      // all auth failures. This layout should ONLY display user info.
      // ====================================================================
      if (res.ok && data.user) {
        setUser(data.user);
      }
    } catch (error) {
      // Silent fail - let AuthGuard handle redirects
    }
  };

  const handleLogout = async () => {
    clearPdfSession();
    window.dispatchEvent(new Event('manual-logout'));
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
    router.replace('/login');
  };


  return (
    <AuthGuard>
      <SessionGuard>
        <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white min-h-screen fixed left-0 top-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <FolderOpen className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold">DMS</h1>
              <p className="text-xs text-slate-400">User Panel</p>
            </div>
          </div>

          <nav className="space-y-2">
            <Link
              href="/user"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-800">
          <div className="mb-4">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-slate-400">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 w-full rounded-lg hover:bg-slate-800 transition-colors text-red-400"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
    </SessionGuard>
    </AuthGuard>
  );
}