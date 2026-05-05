// filepath: app/admin/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FolderOpen, FileText, HardDrive, TrendingUp } from 'lucide-react';

interface Folder {
  id: number;
  name: string;
  sizeInBytes: number;
  documentsCount: number;
  totalSize: number;
  accesses: { category: { name: string } }[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function bytesToKB(bytes: number) {
  return bytes / 1024;
}

function bytesToMB(bytes: number) {
  return bytes / 1024 / 1024;
}

function bytesToGB(bytes: number) {
  return bytes / 1024 / 1024 / 1024;
}

function formatBytes(bytes: number, unit: 'B' | 'KB' | 'MB' | 'GB' = 'MB'): string {
  if (bytes === 0) return `0 ${unit}`;
  switch (unit) {
    case 'B':
      return `${bytes.toFixed(0)} B`;
    case 'KB':
      return `${bytesToKB(bytes).toFixed(2)} KB`;
    case 'MB':
      return `${bytesToMB(bytes).toFixed(2)} MB`;
    case 'GB':
      return `${bytesToGB(bytes).toFixed(5)} GB`;
    default:
      return `${bytesToMB(bytes).toFixed(2)} MB`;
  }
}

export default function AdminDashboard() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageFilter, setStorageFilter] = useState<'B' | 'KB' | 'MB' | 'GB'>('MB');

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/admin/folders');
      const data = await res.json();
      
      if (res.ok) {
        setFolders(data);
      } else {
        toast.error('Failed to load folders');
      }
    } catch (error) {
      toast.error('Error loading folders');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredValue = (bytes: number): number => {
    switch (storageFilter) {
      case 'B':
        return bytes;
      case 'KB':
        return bytesToKB(bytes);
      case 'MB':
        return bytesToMB(bytes);
      case 'GB':
        return bytesToGB(bytes);
      default:
        return bytesToMB(bytes);
    }
  };

  // Get top 5 folders by storage
  const topFolders = [...folders]
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 5)
    .map(folder => ({
      name: folder.name.length > 15 ? folder.name.substring(0, 15) + '...' : folder.name,
      fullName: folder.name,
      size: getFilteredValue(folder.totalSize),
    }));

  // Storage distribution for pie chart
  const pieData = folders.map((folder, index) => ({
    name: folder.name,
    value: getFilteredValue(folder.totalSize),
    color: COLORS[index % COLORS.length],
  }));

  const totalStorage = folders.reduce((acc, f) => acc + f.totalSize, 0);
  const totalDocuments = folders.reduce((acc, f) => acc + f.documentsCount, 0);
  const averageFolderRawBytes = folders.length > 0 ? Math.round(totalStorage / folders.length) : 0;

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
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor storage usage and folder statistics</p>
      </div>

      {/* Storage Filter */}
      <div className="mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Storage Overview</h2>
          <p className="text-sm text-gray-500">Select your preferred viewing unit for all metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Display Unit:</span>
          <div className="relative">
            <select
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value as 'B' | 'KB' | 'MB' | 'GB')}
              className="appearance-none bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-4 pr-10 py-2.5 cursor-pointer hover:bg-blue-100 transition-colors"
            >
              <option value="B">Bytes (B)</option>
              <option value="KB">Kilobytes (KB)</option>
              <option value="MB">Megabytes (MB)</option>
              <option value="GB">Gigabytes (GB)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Folders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{folders.length}</p>
            </div>
            <FolderOpen className="w-10 h-10 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalDocuments}</p>
            </div>
            <FileText className="w-10 h-10 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Storage</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatBytes(totalStorage, storageFilter)}</p>
            </div>
            <HardDrive className="w-10 h-10 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg per Folder</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {folders.length > 0 ? formatBytes(averageFolderRawBytes, storageFilter) : `0 ${storageFilter}`}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Top 5 Folders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Top 5 Folders by Storage</h2>
          {topFolders.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No folders yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topFolders}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `${value.toFixed(2)} ${storageFilter}`} />
                <Tooltip 
                  formatter={(value: any) => [`${Number(value).toFixed(2)} ${storageFilter}`, 'Storage']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="size" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart - Storage Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Storage Distribution</h2>
          {pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No folders yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${Number(value).toFixed(2)} ${storageFilter}`, 'Storage']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}