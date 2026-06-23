// filepath: app/admin/documents/page.tsx
"use client";

import { useEffect, useState, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { FolderPlus, FolderOpen, ChevronRight, AlertCircle, X, Check, Loader2, Eye, Download, FileText, Maximize, ScanLine, Settings2, RefreshCw } from 'lucide-react';
import { savePdfSession, loadPdfSession, clearPdfSession } from '@/lib/pdfSession';
import { convertScanResponseToFile, getScanners, Scanner } from '@/lib/scanner';
import { useScannerWebSocket } from '@/lib/useScannerWebSocket';

interface Category {
  id: number;
  name: string;
}

interface Folder {
  id: number;
  name: string;
  documentsCount: number;
  totalSize: number;
  accesses: { category: { id: number; name: string } }[];

  documents: {
    id: number;
    name: string;
    sizeInBytes: number;
    path: string;
  }[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getReadableErrorMessage(value: unknown, fallback = 'An unexpected error occurred'): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    // Try common message keys, including nested { error: { message } }
    const candidates = [
      v.message,
      typeof v.error === 'string' ? v.error : (v.error as Record<string, unknown>)?.message,
      v.details,
      v.description,
      v.statusText,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return String(value) || fallback;
}

/** @deprecated use getReadableErrorMessage */
function getToastMessage(value: unknown, fallback: string): string {
  return getReadableErrorMessage(value, fallback);
}

export default function DocumentsPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'folders' | 'files'>('folders');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editCategories, setEditCategories] = useState<number[]>([]);

  useEffect(() => {
    fetchData();
  }, []);
  

  const fetchData = async () => {
    try {
      const [foldersRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/folders'),
        fetch('/api/admin/categories'),
      ]);
      
      const foldersData = await foldersRes.json();
      const categoriesData = await categoriesRes.json();
      
      if (foldersRes.ok) setFolders(foldersData);
      if (categoriesRes.ok) setCategories(categoriesData);
    } catch (error) {
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch('/api/admin/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName,
          categoryIds: selectedCategories,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Folder created successfully');
        setShowCreateModal(false);
        setNewFolderName('');
        setSelectedCategories([]);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create folder');
      }
    } catch (error) {
      toast.error('Error creating folder');
    }
  };

  const toggleCategory = (catId: number) => {
    setSelectedCategories(prev => 
      prev.includes(catId) 
        ? prev.filter(id => id !== catId)
        : [...prev, catId]
    );
  };

  const toggleEditCategory = (catId: number) => {
    setEditCategories(prev => 
      prev.includes(catId) 
        ? prev.filter(id => id !== catId)
        : [...prev, catId]
    );
  };

  const openEditModal = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setEditCategories(folder.accesses.map(a => a.category.id));
  };

  const handleUpdateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder) return;

    try {
      const res = await fetch(`/api/admin/folders/${editingFolder.id}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryIds: editCategories }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Folder access updated');
        setEditingFolder(null);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to update access');
      }
    } catch (error) {
      toast.error('Error updating access');
    }
  };

  const filteredFolders = folders.filter((folder) => {
    if (searchType === 'folders') {
      return folder.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return false;
  });

  const allDocuments = folders.flatMap(f => f.documents.map(d => ({ ...d, folderName: f.name })));
  const filteredFiles = allDocuments.filter(doc => 
    searchType === 'files' && doc.name.toLowerCase().includes(searchQuery.toLowerCase())
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
      
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <button
  onClick={() => setSelectedFolder(null)}
  className="text-gray-600 hover:text-blue-600 hover:underline"
>
  DOCS
</button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        {selectedFolder ? (
          <>
            <span className="text-gray-600">{selectedFolder.name}</span>
            
          </>
        ) : (
          <span className="text-gray-900 font-medium">All Folders</span>
        )}
      </div>

      {!selectedFolder ? (
        <>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
              <p className="text-gray-600 mt-2">Manage your folders and access control</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FolderPlus className="w-5 h-5" />
              Add Folder
            </button>
          </div>

          {/* Advanced Search Bar */}
          <div className="mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <input
                type="text"
                placeholder={searchType === 'folders' ? 'Search folders...' : 'Search documents...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              <div className="flex items-center gap-4 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                <span className="text-sm font-medium text-gray-700">Search In:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="searchType"
                    value="folders"
                    checked={searchType === 'folders'}
                    onChange={() => setSearchType('folders')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Folders</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="searchType"
                    value="files"
                    checked={searchType === 'files'}
                    onChange={() => setSearchType('files')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Files</span>
                </label>
              </div>
            </div>
          </div>

          {/* Grid Content */}
          {searchType === 'files' ? (
            filteredFiles.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Files Found</h3>
                <p className="text-gray-600 mb-6">Try a different search term</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {filteredFiles.map((doc) => (
                    <div
                      key={doc.id}
                      className="block p-4 border rounded-lg hover:shadow-lg hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-8 h-8 text-blue-500 flex-shrink-0" />
                        <div className="font-semibold text-gray-800 truncate flex-1">{doc.name}</div>
                      </div>
                      <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-2">
                        DMS / {doc.folderName} / {doc.name}
                      </div>
                      <p className="text-sm text-gray-500">{formatBytes(doc.sizeInBytes)}</p>
                      
                      <div className="flex gap-2 mt-3">
                        <a
                          href={doc.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </a>
                        <a
                          href={doc.path}
                          download={doc.name}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : filteredFolders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Folders Yet</h3>
              <p className="text-gray-600 mb-6">Create your first folder to start organizing documents</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FolderPlus className="w-5 h-5" />
                Add Folder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedFolder(folder)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FolderOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {formatBytes(folder.totalSize)}
                      </span>
                      <button
                        onClick={(e) => openEditModal(folder, e)}
                        className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                      >
                        Edit Access
                      </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{folder.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {folder.documentsCount} document{folder.documentsCount !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {folder.accesses.map((access) => (
                      <span
                        key={access.category.id}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        {access.category.name}
                      </span>
                    ))}
                    {folder.accesses.length === 0 && (
                      <span className="text-xs text-gray-400">No access restrictions</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <FolderDetail 
          folder={selectedFolder} 
          onBack={() => setSelectedFolder(null)}
          onUpdate={fetchData}
        />
      )}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create New Folder</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Access (Multi-select)
                </label>
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-500">No categories available. Create categories first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                          selectedCategories.includes(cat.id)
                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {selectedCategories.includes(cat.id) && (
                          <Check className="w-4 h-4" />
                        )}
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Access Modal */}
      {editingFolder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Folder Access</h2>
                <p className="text-sm text-gray-500">{editingFolder.name}</p>
              </div>
              <button
                onClick={() => setEditingFolder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateAccess} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Access (Multi-select)
                </label>
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-500">No categories available.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleEditCategory(cat.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                          editCategories.includes(cat.id)
                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {editCategories.includes(cat.id) && (
                          <Check className="w-4 h-4" />
                        )}
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingFolder(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Folder Detail Component — Redesigned
function FolderDetail({ folder, onBack, onUpdate }: { folder: Folder; onBack: () => void; onUpdate: () => void; }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isThumbnailLoading, setIsThumbnailLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<{ pageNum: number; dataUrl: string }[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [sectionName, setSectionName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [helperStatus, setHelperStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [pageSearch, setPageSearch] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [uploadSource, setUploadSource] = useState<'upload' | 'scan' | null>(null);
  const hasRestoredSession = useRef(false);
  // Ref-based lock: survives StrictMode double-invocation & prevents double-click races
  const isScanningRef = useRef(false);

  // Scanner State
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [selectedScannerId, setSelectedScannerId] = useState<string>('');
  const [scanSettings, setScanSettings] = useState({
    resolution: 300,
    colorMode: 'color' as 'color' | 'grayscale' | 'blackwhite',
    source: 'feeder' as 'feeder' | 'flatbed',
    duplex: false,
  });

  const WS_URL = (process.env.NEXT_PUBLIC_SCANNER_BRIDGE_URL || 'http://localhost:4785').replace('http', 'ws');
  const { session, startScan, cancelScan: wsCancelScan, resetSession } = useScannerWebSocket(WS_URL);

  const hasPages = pdfPages.length > 0;
  const allPagesSelected = hasPages && pdfPages.every(p => selectedPages.includes(p.pageNum));

  useEffect(() => { hasRestoredSession.current = false; }, [folder.id]);
  useEffect(() => { fetchDocuments(); }, [folder.id]);

  const checkHelperHealth = async () => {
    try {
      const res = await fetch('http://localhost:4785/health');
      if (res.ok) {
        setHelperStatus('online');
        return true;
      }
    } catch (err) {
      // offline
    }
    setHelperStatus('offline');
    return false;
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    const poll = async () => {
      if (!isSubscribed) return;
      console.log('[ScannerUI] Fetching scanners');
      const isOnline = await checkHelperHealth();
      if (!isOnline) {
        if (isSubscribed) setScanners([]);
        return;
      }
      try {
        const list = await getScanners();
        if (!isSubscribed) return;
        console.log('[UI] scanners loaded:', list);
        if (list.length > 0) {
          setScanners(list);
          setSelectedScannerId(list[0].id);
        } else {
          setScanners([]);
        }
      } catch (err) {
        console.log('[ScannerUI] Fetch failed', err);
        if (isSubscribed) {
          toast.error('Scanner detection failed');
          setScanners([]);
        }
      }
    };

    poll();

    if (scanners.length === 0) {
      intervalId = setInterval(poll, 5000);
    }

    return () => {
      isSubscribed = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [scanners.length === 0]);

  const handleRefreshScanners = async () => {
    setIsRefreshing(true);
    console.log('[ScannerUI] Fetching scanners (manual)');
    const isOnline = await checkHelperHealth();
    if (!isOnline) {
      toast.error('Scanner helper is offline');
      setScanners([]);
      setIsRefreshing(false);
      return;
    }
    try {
      const list = await getScanners();
      console.log('[UI] scanners loaded:', list);
      if (list.length > 0) {
        setScanners(list);
        setSelectedScannerId(list[0].id);
        toast.success('Scanner list refreshed');
      } else {
        setScanners([]);
        toast.error('No scanners detected');
      }
    } catch (err) {
      console.log('[ScannerUI] Fetch failed', err);
      toast.error('Scanner detection failed');
      setScanners([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (session.status === 'SCANNING' || session.status === 'PROCESSING' || session.status === 'ERROR' || session.status === 'COMPLETED') {
      setIsStartingScan(false);
      if (session.status === 'ERROR' || session.status === 'COMPLETED') {
        isScanningRef.current = false;
      }
    }
  }, [session.status]);

  useEffect(() => {
    if (hasRestoredSession.current) return;
    hasRestoredSession.current = true;
    const restore = async () => {
      const s = await loadPdfSession(folder.id);
      if (s && s.pages.length > 0) {
        setPdfFile(s.file); setPdfPages(s.pages);
        setSelectedPages(s.selectedPages); setSectionName(s.sectionName);
        setUploadSource('upload');
        toast.info(`Restored ${s.pages.length} pages from previous session`, { id: 'pdf-session-restore' });
      }
    };
    void restore();
  }, [folder.id]);

  useEffect(() => {
    if (!pdfFile || pdfPages.length === 0) return;
    void savePdfSession(folder.id, pdfFile, pdfPages, selectedPages, sectionName);
  }, [folder.id, pdfFile, pdfPages, selectedPages, sectionName]);

  useEffect(() => {
    if (session.status === 'COMPLETED' && session.fileData && uploadSource !== 'scan') {
      console.log('FINAL FILE DATA', session.fileData);
      try {
        const scanResponse = { success: true, fileData: session.fileData, extension: 'pdf' };
        const scannedFile = convertScanResponseToFile(scanResponse as any);
        console.log('Converted scan file', scannedFile);
        console.log('Calling processPdfFile');
        processPdfFile(scannedFile, 'scan');
        toast.success('Scan completed successfully!', { id: 'scanner-operation' });
      } catch (err) {
        console.error(err);
        toast.error('Failed to process completed scan.');
      }
    }
    if (session.status === 'ERROR' && session.errorDetails) {
      toast.error(session.errorDetails, { duration: 6000 });
    }
  }, [session.status, session.fileData, session.errorDetails]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/admin/folders/${folder.id}/documents`);
      if (res.ok) setDocuments(await res.json());
    } catch { console.error('Error fetching documents'); }
    finally { setLoading(false); }
  };

  const processPdfFile = async (file: File, source: 'upload' | 'scan') => {
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return; }
    setPdfFile(file); setPdfPages([]); setSelectedPages([]); setIsThumbnailLoading(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages: { pageNum: number; dataUrl: string }[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr; canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          await page.render({ canvasContext: ctx, viewport, canvas: canvas as any }).promise;
          pages.push({ pageNum: i, dataUrl: canvas.toDataURL('image/png') });
        }
      }
      setPdfPages(pages); setSelectedPages([]); setUploadSource(source);
      await savePdfSession(folder.id, file, pages, [], sectionName);
      toast.success(`${source === 'scan' ? 'Scanned document' : 'PDF'} loaded — ${pages.length} pages`);
    } catch (err) { console.error('Error parsing PDF:', err); toast.error('Error parsing document'); }
    finally { setIsThumbnailLoading(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) await processPdfFile(e.target.files[0], 'upload');
  };

  const togglePage = (n: number) =>
    setSelectedPages(prev => prev.includes(n) ? prev.filter(p => p !== n) : [...prev, n]);

  const handleSelectAll = () => {
    const nums = pdfPages.map(p => p.pageNum);
    setSelectedPages(nums.every(n => selectedPages.includes(n)) ? [] : nums);
  };

  const handleDiscardSelected = () => {
    if (!selectedPages.length) { toast.error('No pages selected'); return; }
    const remaining = pdfPages.filter(p => !selectedPages.includes(p.pageNum));
    if (!remaining.length) {
      setPdfFile(null); setPdfPages([]); setSelectedPages([]); setSectionName(''); setUploadSource(null);
      void clearPdfSession(folder.id); return;
    }
    setPdfPages(remaining); setSelectedPages([]);
    if (pdfFile) void savePdfSession(folder.id, pdfFile, remaining, [], sectionName);
  };

  const handleSaveSection = async () => {
    if (!pdfFile || !sectionName.trim() || !selectedPages.length) {
      toast.error('Select pages and enter a section name'); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', pdfFile); fd.append('folderId', folder.id.toString());
      fd.append('sectionName', sectionName); fd.append('pages', JSON.stringify(selectedPages));
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        toast.success('Section saved successfully');
        const remaining = pdfPages.filter(p => !selectedPages.includes(p.pageNum));
        setPdfPages(remaining); setSelectedPages([]); setSectionName('');
        if (!remaining.length) { setPdfFile(null); setUploadSource(null); await clearPdfSession(folder.id); }
        else await savePdfSession(folder.id, pdfFile, remaining, [], '');
        fetchDocuments(); onUpdate();
      } else toast.error(getToastMessage(data.error, 'Failed to save section'));
    } catch (err) { toast.error(getToastMessage(err, 'Error saving section')); }
    finally { setUploading(false); }
  };

  const handleClearUpload = async () => {
    setPdfFile(null); setPdfPages([]); setSelectedPages([]); setSectionName(''); setUploadSource(null);
    await clearPdfSession(folder.id);
  };

  const handleCancelScan = async () => {
    wsCancelScan();
    toast.info('Cancellation requested...');
  };

  const handleScanNow = async () => {
    if (isStartingScan || isScanningRef.current || !['IDLE', 'ERROR', 'COMPLETED'].includes(session.status)) {
      console.warn('[ScannerUI] Scan already in progress');
      return;
    }
    
    if (!selectedScannerId) {
      toast.error('No scanners detected');
      return;
    }
    if (helperStatus !== 'online') {
      toast.error('Scanner helper is offline');
      return;
    }

    setUploadSource(null);
    isScanningRef.current = true;
    setIsStartingScan(true);

    console.log('[ScannerUI] Scan started', { selectedScannerId, ...scanSettings });
    toast.loading('Starting scan...', { id: 'scanner-operation' });
    
    try {
      startScan({
        scannerId: selectedScannerId,
        resolution: scanSettings.resolution,
        colorMode: scanSettings.colorMode,
        source: scanSettings.source,
        duplex: scanSettings.duplex,
      });
    } catch (err) {
      console.error('[ScannerUI] Scan failed', err);
      toast.error('Failed to start scan');
      setIsStartingScan(false);
      isScanningRef.current = false;
    }
  };

  const filteredPages = pdfPages.filter(p => p.pageNum.toString().includes(pageSearch));

  return (
    <div className="min-h-screen">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600 rotate-180" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {documents.length} document{documents.length !== 1 ? 's' : ''} · {formatBytes(folder.totalSize)}
          </p>
        </div>
      </div>

      {/* ── EMPTY STATE: both panels ── */}
      {!hasPages && (
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Upload Panel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">Upload PDF</h2>
              </div>
              <label
                htmlFor="pdf-upload"
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-blue-200 rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group flex-1"
              >
                <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" id="pdf-upload" disabled={uploading} />
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Click to browse or drag &amp; drop</p>
                  <p className="text-xs text-gray-400 mt-1">Supports multi-page PDFs</p>
                </div>
              </label>
            </div>

            {/* Scan Panel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-base font-semibold text-gray-900">Scan Document</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-100">
                    <div className={`w-2 h-2 rounded-full ${helperStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-xs font-medium text-gray-600">
                      Helper: {helperStatus === 'online' ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <button 
                    onClick={handleRefreshScanners}
                    disabled={isRefreshing}
                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                    title="Refresh Scanners"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              
              {['IDLE', 'ERROR', 'COMPLETED'].includes(session.status) && !isStartingScan ? (
                scanners.length === 0 ? (
                  <div className="flex flex-col gap-4 flex-1 border border-red-100 bg-red-50/50 rounded-xl p-5">
                    <div className="flex flex-col items-center justify-center text-center py-4">
                      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">No scanner detected</h3>
                      <p className="text-xs text-gray-600 mb-4 max-w-[250px]">
                        Please start the scanner helper and reconnect your scanner device.
                      </p>
                      <button
                        onClick={handleRefreshScanners}
                        disabled={isRefreshing}
                        className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh Scanners
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 flex-1 border border-indigo-100 bg-indigo-50/30 rounded-xl p-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Scanner</label>
                        <div className="relative">
                          <select
                            value={selectedScannerId}
                            onChange={(e) => setSelectedScannerId(e.target.value)}
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 pl-8"
                          >
                            {scanners.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.source})
                              </option>
                            ))}
                          </select>
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                            <div className={`w-2 h-2 rounded-full ${scanners.find(s => s.id === selectedScannerId)?.status === 'ready' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
                        <select
                          value={scanSettings.source}
                          onChange={(e) => setScanSettings({ ...scanSettings, source: e.target.value as 'feeder' | 'flatbed' })}
                          className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="feeder">Document Feeder</option>
                          <option value="flatbed">Flatbed Glass</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Color Mode</label>
                        <select
                          value={scanSettings.colorMode}
                          onChange={(e) => setScanSettings({ ...scanSettings, colorMode: e.target.value as any })}
                          className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="color">Color</option>
                          <option value="grayscale">Grayscale</option>
                          <option value="blackwhite">Black & White</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Resolution</label>
                        <select
                          value={scanSettings.resolution}
                          onChange={(e) => setScanSettings({ ...scanSettings, resolution: Number(e.target.value) })}
                          className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="150">150 DPI (Fast)</option>
                          <option value="200">200 DPI (Standard)</option>
                          <option value="300">300 DPI (High Quality)</option>
                        </select>
                      </div>

                      <div className="flex items-center mt-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={scanSettings.duplex}
                            onChange={(e) => setScanSettings({ ...scanSettings, duplex: e.target.checked })}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            disabled={scanSettings.source === 'flatbed'}
                          />
                          <span className="text-sm font-medium text-gray-700">Duplex (Both sides)</span>
                        </label>
                      </div>
                    </div>

                    <div className="mt-auto pt-4">
                      <button
                        type="button"
                        onClick={handleScanNow}
                        disabled={scanners.length === 0 || isStartingScan}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isStartingScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                        {isStartingScan ? 'Starting Scan...' : 'Scan Now'}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 flex-1 border border-indigo-100 bg-indigo-50/50 rounded-xl p-8">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ScanLine className="w-6 h-6 text-indigo-600" />
                    </div>
                    {/* Yellow dot indicating scanning */}
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-900">
                      {isStartingScan ? 'Starting Scan...' : 'Scanning in Progress'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{session.progressMessage || 'Please wait...'}</p>
                  </div>
                  
                  {session.scannedPages.length > 0 && (
                    <div className="mt-4 w-full">
                      <p className="text-sm font-medium text-gray-700 mb-2">Live Preview ({session.scannedPages.length}):</p>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border bg-white rounded-lg">
                        {(() => { console.log('Rendering scanned pages', session.scannedPages); return null; })()}
                        {session.scannedPages.map((imgSrc, idx) => (
                          <div key={idx} className="w-12 h-16 border rounded overflow-hidden shadow-sm">
                            <img src={imgSrc} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => {
                              console.error('Image failed', imgSrc);
                            }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCancelScan}
                    className="mt-4 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Cancel Scan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Empty hint */}
          <div className="flex flex-col items-center py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Upload or scan a document to begin</p>
            <p className="text-gray-400 text-xs mt-1">Pages will appear here as thumbnails</p>
          </div>
        </div>
      )}

      {/* ── LOADED STATE: compact toolbar ── */}
      {hasPages && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
          {/* Source badge row */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {uploadSource === 'scan'
                ? <><ScanLine className="w-4 h-4 text-indigo-600" /><span className="text-sm font-medium text-indigo-700">Scanned Document</span></>
                : <><FileText className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium text-blue-700">Uploaded PDF</span></>}
              <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{pdfPages.length} pages</span>
            </div>
            <div className="flex items-center gap-2">
              {uploadSource === 'upload' && (
                <label htmlFor="pdf-reupload" className="cursor-pointer text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                  <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" id="pdf-reupload" />
                  Replace File
                </label>
              )}
              {uploadSource === 'scan' && (
                <button onClick={handleScanNow} disabled={!['IDLE', 'ERROR', 'COMPLETED'].includes(session.status)}
                  className="text-xs text-indigo-600 hover:underline px-2 py-1 rounded hover:bg-indigo-50 transition-colors disabled:opacity-50">
                  {!['IDLE', 'ERROR', 'COMPLETED'].includes(session.status) ? 'Scanning…' : 'Scan Again'}
                </button>
              )}
              <button onClick={handleClearUpload} title="Clear all pages"
                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className={`text-sm font-semibold whitespace-nowrap shrink-0 ${selectedPages.length === 0 ? 'text-gray-400' : 'text-blue-700'}`}>
              {selectedPages.length === 0 ? 'None selected' : `Selected: ${selectedPages.slice().sort((a, b) => a - b).join(', ')}`}
            </span>
            <input
              type="text"
              placeholder="Section name…"
              value={sectionName}
              onChange={e => setSectionName(e.target.value)}
              className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 outline-none"
            />
            <button
              onClick={handleSaveSection}
              disabled={uploading || !selectedPages.length}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Check className="w-3.5 h-3.5" />Save Section</>}
            </button>
            <button
              onClick={handleDiscardSelected}
              disabled={uploading || !selectedPages.length}
              className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />Discard
            </button>
          </div>

          {/* Filter + select-all row */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2 border-t border-gray-100 bg-gray-50">
            <input
              type="text"
              placeholder="Filter by page number…"
              value={pageSearch}
              onChange={e => setPageSearch(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 w-48"
            />
            <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">
              {allPagesSelected ? 'Unselect All' : 'Select All'}
            </button>
          </div>
        </div>
      )}

      {/* ── THUMBNAIL GRID ── */}
      {hasPages && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-8 p-5 relative">
          {isThumbnailLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 rounded-2xl">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">Loading pages…</p>
              </div>
            </div>
          )}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {filteredPages.map(page => (
              <div
                key={page.pageNum}
                onClick={() => togglePage(page.pageNum)}
                className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-150 hover:shadow-md ${
                  selectedPages.includes(page.pageNum)
                    ? 'border-blue-600 ring-2 ring-blue-200 shadow-sm'
                    : 'border-gray-200 hover:border-blue-400'
                }`}
              >
                <div className="relative">
                  <img src={page.dataUrl} alt={`Page ${page.pageNum}`} className="w-full h-auto block" />
                  <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded shadow">
                    {page.pageNum}
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setPreviewPage(page.pageNum); setPreviewImageUrl(page.dataUrl); }}
                    className="absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1.5 text-slate-600 hover:bg-slate-200 shadow transition-colors"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                  {selectedPages.includes(page.pageNum) && (
                    <div className="absolute bottom-1.5 right-1.5 bg-emerald-500 rounded-full p-1 shadow">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SAVED SECTIONS ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Saved Sections</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-700 mb-1">No sections saved yet</h3>
            <p className="text-xs text-gray-400">Upload or scan a PDF and save sections above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
            {documents.map(doc => (
              <div key={doc.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <FileText className="w-7 h-7 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatBytes(doc.sizeInBytes)}</p>
                    <p className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href={doc.path} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium">
                    <Eye className="w-3.5 h-3.5" />View
                  </a>
                  <a href={doc.path} download={doc.name}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium">
                    <Download className="w-3.5 h-3.5" />Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PREVIEW MODAL ── */}
      {previewPage && previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => { setPreviewPage(null); setPreviewImageUrl(null); setIsZoomed(false); }}
        >
          <button
            onClick={() => { setPreviewPage(null); setPreviewImageUrl(null); setIsZoomed(false); }}
            className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm font-semibold px-4 py-2 rounded-full z-10">
            Page {previewPage}
          </div>
          <div
            className="relative overflow-hidden rounded-xl shadow-2xl"
            style={{ width: '80vw', height: '88vh' }}
            onClick={e => e.stopPropagation()}
            onMouseMove={e => {
              const r = e.currentTarget.getBoundingClientRect();
              setZoomPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}
          >
            <img
              src={previewImageUrl}
              alt={`Page ${previewPage}`}
              style={{
                width: '100%', height: '100%', objectFit: 'contain',
                transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                transform: isZoomed ? 'scale(2.5)' : 'scale(1)',
                transition: isZoomed ? 'none' : 'transform 0.2s ease',
                cursor: isZoomed ? 'zoom-out' : 'zoom-in', display: 'block',
              }}
              onClick={e => { e.stopPropagation(); setIsZoomed(prev => !prev); }}
            />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            {isZoomed ? 'Move mouse to pan · Click to zoom out' : 'Click to zoom in'}
          </div>
        </div>
      )}
    </div>
  );
}
