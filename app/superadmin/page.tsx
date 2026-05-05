// filepath: app/superadmin/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Shield, Users, HardDrive, Ban, Unlock, AlertCircle, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Admin {
  id: number;
  name: string;
  userId: string;
  isBlocked: boolean;
  createdAt: string;
  totalStorage: number;
  userCount: number;
  folderCount: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const ITEMS_PER_PAGE = 10;

export default function SuperadminDashboard() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [togglingId, setTogglingId] = useState<number | null>(null); // Track which admin is being toggled

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/superadmin/admins');
      const data = await res.json();

      if (res.ok) {
        setAdmins(data);
      } else {
        toast.error('Failed to load admins');
      }
    } catch {
      toast.error('Error loading admins');
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async (adminId: number) => {
    setTogglingId(adminId);
    try {
      const res = await fetch(`/api/superadmin/admins/${adminId}/block`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.isBlocked ? 'Admin blocked successfully' : 'Admin unblocked successfully');
        fetchAdmins();
      } else {
        toast.error(data.error || 'Failed to update admin status');
      }
    } catch {
      toast.error('Error updating admin status');
    } finally {
      setTogglingId(null);
    }
  };

  // Search filtering
  const filteredAdmins = admins.filter(admin =>
    admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredAdmins.length / ITEMS_PER_PAGE);
  const paginatedAdmins = filteredAdmins.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Superadmin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage all admins and monitor system storage</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Admins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{admins.length}</p>
            </div>
            <Shield className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Admins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {admins.filter(a => !a.isBlocked).length}
              </p>
            </div>
            <Users className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Blocked Admins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {admins.filter(a => a.isBlocked).length}
              </p>
            </div>
            <Ban className="w-10 h-10 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Storage Used</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatBytes(admins.reduce((acc, a) => acc + a.totalStorage, 0))}
              </p>
            </div>
            <HardDrive className="w-10 h-10 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Admins Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Header with Search */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-900">All Admins</h2>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm w-72"
              />
            </div>
          </div>
        </div>

        {admins.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Admins Yet</h3>
            <p className="text-gray-600">Create your first admin to get started</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-600">Try a different search term</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Admin</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">UserID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Created</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Users</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Folders</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Storage</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedAdmins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-semibold">
                              {admin.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{admin.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono text-sm">{admin.userId}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{admin.userCount}</td>
                      <td className="px-6 py-4 text-gray-600">{admin.folderCount}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{formatBytes(admin.totalStorage)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          admin.isBlocked
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {admin.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleBlock(admin.id)}
                          disabled={togglingId === admin.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            admin.isBlocked
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {togglingId === admin.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : admin.isBlocked ? (
                            <>
                              <Unlock className="w-4 h-4" />
                              Unblock
                            </>
                          ) : (
                            <>
                              <Ban className="w-4 h-4" />
                              Block
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredAdmins.length)} of{' '}
                  {filteredAdmins.length} admins
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}