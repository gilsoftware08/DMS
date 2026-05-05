// filepath: app/user/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { FolderOpen, FileText, ChevronRight, AlertCircle, X, Eye, Download } from 'lucide-react';

interface Document {
  id: number;
  name: string;
  path: string;
  sizeInBytes: number;
  createdAt: string;
}

interface Folder {
  id: number;
  name: string;
  documentsCount: number;
  totalSize: number;
  documents: Document[];
  admin: { name: string };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function UserDashboard() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'folders' | 'files'>('folders');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const itemsPerPage = 9;

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/user/folders');
      const data = await res.json();

      if (res.ok) {
        setFolders(data);
      } else {
        toast.error('Failed to load folders');
      }
    } catch {
      toast.error('Error loading folders');
    } finally {
      setLoading(false);
    }
  };

  // Filter folders by search
  const filteredFolders = folders.filter(folder =>
    searchType === 'folders' && folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // All documents across folders for global file search
  const allDocuments = folders.flatMap(f => f.documents.map(d => ({ ...d, folderName: f.name })));
  const filteredFiles = allDocuments.filter(doc => 
    searchType === 'files' && doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination for folders
  const totalFolderPages = Math.ceil(filteredFolders.length / itemsPerPage);
  const paginatedFolders = filteredFolders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Filter documents by search within a folder
  const filteredDocuments = selectedFolder?.documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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
        <span className="text-gray-600">DOCS</span>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        {selectedFolder ? (
          <>
            <span className="text-gray-600">{selectedFolder.name}</span>
            <button
              onClick={() => {
                setSelectedFolder(null);
                setSearchQuery('');
              }}
              className="ml-2 text-blue-600 hover:underline"
            >
              (Change)
            </button>
          </>
        ) : (
          <span className="text-gray-900 font-medium">Available Folders</span>
        )}
      </div>

      {!selectedFolder ? (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
            <p className="text-gray-600 mt-2">Access folders assigned to your category</p>
          </div>

          {/* Advanced Search Bar */}
          <div className="mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <input
                type="text"
                placeholder={searchType === 'folders' ? 'Search folders...' : 'Search documents...'}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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
                    onChange={() => {
                      setSearchType('folders');
                      setCurrentPage(1);
                    }}
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
                    onChange={() => {
                      setSearchType('files');
                      setCurrentPage(1);
                    }}
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
                      className="block p-4 border rounded-lg hover:shadow-lg hover:border-blue-400 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-3xl">📄</div>
                        <div className="font-semibold text-gray-800 truncate flex-1">{doc.name}</div>
                      </div>
                      <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-2">
                        DMS / {doc.folderName} / {doc.name}
                      </div>
                      <p className="text-sm text-gray-500">{formatBytes(doc.sizeInBytes)}</p>
                      
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setViewingDoc(doc as any)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
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
          ) : folders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Folders Available</h3>
              <p className="text-gray-600">Your admin hasn&apos;t assigned any folders to your category yet.</p>
            </div>
          ) : paginatedFolders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
              <p className="text-gray-600">Try a different search term</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolder(folder);
                      setSearchQuery('');
                    }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <FolderOpen className="w-6 h-6 text-blue-600" />
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatBytes(folder.totalSize)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{folder.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {folder.documentsCount} document{folder.documentsCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      Managed by: {folder.admin.name}
                    </p>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalFolderPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-600">
                    Page {currentPage} of {totalFolderPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalFolderPages, p + 1))}
                    disabled={currentPage === totalFolderPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        // Folder Detail View
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedFolder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 rotate-180" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{selectedFolder.name}</h1>
                <p className="text-gray-600 mt-1">
                  {selectedFolder.documentsCount} document{selectedFolder.documentsCount !== 1 ? 's' : ''} • {formatBytes(selectedFolder.totalSize)}
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar for Documents */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          {/* Documents Grid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {selectedFolder.documents.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Yet</h3>
                <p className="text-gray-600">This folder is empty</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                <p className="text-gray-600">Try a different search term</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="block p-4 border rounded-lg hover:shadow-lg hover:border-blue-400 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-3xl">📄</div>
                      <div className="font-semibold text-gray-800 truncate flex-1">{doc.name}</div>
                    </div>
                    <p className="text-sm text-gray-500">{formatBytes(doc.sizeInBytes)}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
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
            )}
          </div>
        </div>
      )}

      {/* PDF Viewer Modal — in-browser, no forced download */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] mx-4 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900 truncate">{viewingDoc.name}</h2>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={viewingDoc.path}
                  download={viewingDoc.name}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* In-Browser PDF Viewer via iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={viewingDoc.path}
                className="w-full h-full border-0"
                title={viewingDoc.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}