// filepath: app/admin/documents/page.tsx
"use client";

import { useEffect, useState, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { FolderPlus, FolderOpen, ChevronRight, AlertCircle, X, Check, Loader2, Eye, Download, FileText, Maximize } from 'lucide-react';
import { savePdfSession, loadPdfSession, clearPdfSession } from '@/lib/pdfSession';

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

// Folder Detail Component with PDF Upload
function FolderDetail({ 
  folder, 
  onBack,
  onUpdate 
}: { 
  folder: Folder; 
  onBack: () => void;
  onUpdate: () => void;
}) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isThumbnailLoading, setIsThumbnailLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<{ pageNum: number; dataUrl: string }[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [sectionName, setSectionName] = useState('');
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [pageSearch, setPageSearch] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const hasRestoredSession = useRef(false);

  const allPagesSelected = pdfPages.length > 0 && pdfPages.every((page) => selectedPages.includes(page.pageNum));

  useEffect(() => {
    hasRestoredSession.current = false;
  }, [folder.id]);

  useEffect(() => {
    fetchDocuments();
  }, [folder.id]);

  useEffect(() => {
    if (hasRestoredSession.current) return;
    hasRestoredSession.current = true;

    const savedSession = loadPdfSession(folder.id);
    if (savedSession && savedSession.pages.length > 0) {
      setPdfPages(savedSession.pages);
      const dummyFile = new File([], savedSession.fileName, { type: 'application/pdf' });
      setPdfFile(dummyFile);
      toast.info(`Restored ${savedSession.pages.length} pages from previous session`, {
        id: 'pdf-session-restore'
      });
    }
  }, [folder.id]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/admin/folders/${folder.id}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      setPdfFile(file);
      setPdfPages([]);
      setSelectedPages([]);
      setIsThumbnailLoading(true);
      
      // Generate thumbnails using pdfjs
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // Use explicit https protocol and min.mjs for dynamic module import
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const pages: { pageNum: number; dataUrl: string }[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);

  const scale = 2; // 🔥 increase quality (try 2–3)
  const viewport = page.getViewport({ scale: 2 }); // or even 2.5 for ultra sharp

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;

  canvas.width = viewport.width * dpr;
  canvas.height = viewport.height * dpr;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  if (context) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    await page.render({
      canvasContext: context,
      viewport,
      canvas: canvas as any,
    }).promise;

    pages.push({
      pageNum: i,
      dataUrl: canvas.toDataURL('image/png'), // 🔥 max quality
    });
  }
}
        
        setPdfPages(pages);
        savePdfSession(folder.id, file.name, pages);
        toast.success(`PDF loaded with ${pages.length} pages`);
      } catch (error) {
        console.error('Error parsing PDF:', error);
        toast.error('Error parsing PDF');
      } finally {
        setIsThumbnailLoading(false);
      }
    }
  };

  const togglePage = (pageNum: number) => {
    setSelectedPages(prev => 
      prev.includes(pageNum) 
        ? prev.filter(p => p !== pageNum)
        : [...prev, pageNum]
    );
  };

  const handleSelectAll = () => {
    const visiblePageNums = pdfPages.map((p) => p.pageNum);
    const isAllSelected = visiblePageNums.length > 0 && visiblePageNums.every((pageNum) => selectedPages.includes(pageNum));
    setSelectedPages(isAllSelected ? [] : visiblePageNums);
  };

  const handleDiscardSelected = () => {
  if (selectedPages.length === 0) {
    toast.error('No selected pages to discard');
    return;
  }

  setPdfPages((current) => {
    const remainingPages = current.filter(
      (page) => !selectedPages.includes(page.pageNum)
    );

    // ✅ KEY FIX: if no pages left → go back to upload UI
    if (remainingPages.length === 0) {
      setPdfFile(null);
      clearPdfSession();
    } else {
      if (pdfFile) {
        savePdfSession(folder.id, pdfFile.name, remainingPages);
      }
    }

    return remainingPages;
  });

  setSelectedPages([]);
};

  const handleSaveSection = async () => {
    if (!pdfFile || !sectionName.trim() || selectedPages.length === 0) {
      toast.error('Please select pages and enter section name');
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('folderId', folder.id.toString());
      formData.append('sectionName', sectionName);
      formData.append('pages', JSON.stringify(selectedPages));
      
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Section saved successfully');
        
        setPdfPages((current) => {
          const remainingPages = current.filter((page) => !selectedPages.includes(page.pageNum));
          if (remainingPages.length === 0) {
            setPdfFile(null);
            clearPdfSession();
          } else {
            if (pdfFile) {
              savePdfSession(folder.id, pdfFile.name, remainingPages);
            }
          }
          return remainingPages;
        });

        setSelectedPages([]);
        setSectionName('');

        fetchDocuments();
        onUpdate();
      } else {
        toast.error(data.error || 'Failed to save section');
      }
    } catch (error) {
      toast.error('Error saving section');
    } finally {
      setUploading(false);
    }
  };

  const handleClearUpload = () => {
    setPdfFile(null);
    setPdfPages([]);
    setSelectedPages([]);
    setSectionName('');
    clearPdfSession();
  };

  const filteredPages = pdfPages.filter((page) =>
  page.pageNum.toString().includes(pageSearch)
);

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 rotate-180" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{folder.name}</h1>
            <p className="text-gray-600 mt-1">
              {documents.length} document{documents.length !== 1 ? 's' : ''} • {formatBytes(folder.totalSize)}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Upload PDF</h2>
        
        {!pdfFile ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="pdf-upload"
              disabled={uploading}
            />
            <label
              htmlFor="pdf-upload"
              className="cursor-pointer"
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Processing PDF...</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 mb-2">Drag & drop a PDF here, or click to browse</p>
                  <p className="text-sm text-gray-500">Supports multi-page PDFs</p>
                </>
              )}
            </label>
          </div>
        ) : (
          <div>
            {/* Selected Pages Bar */}
            <div className="bg-blue-50 p-4 rounded-lg mb-4 flex flex-col md:flex-row gap-4 items-center">
  <span
    className={`font-semibold ${
      selectedPages.length === 0 ? 'text-red-600' : 'text-blue-800'
    }`}
  >
    Selected:{' '}
    {selectedPages.length === 0
      ? 'None'
      : selectedPages.sort((a, b) => a - b).join(', ')}
  </span>

  <input
    type="text"
    placeholder="Section Name (e.g., Section 1, Part A)"
    value={sectionName}
    onChange={(e) => setSectionName(e.target.value)}
    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
  />

  <button
    onClick={handleSaveSection}
    disabled={uploading || selectedPages.length === 0}
    className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
  >
    {uploading ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Slicing PDF...
      </>
    ) : (
      <>
        <Check className="w-4 h-4" />
        Save Section
      </>
    )}
  </button>

  <button
    onClick={handleDiscardSelected}
    disabled={uploading || selectedPages.length === 0}
    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
  >
    Discard Selected
  </button>

  <button
    onClick={handleClearUpload}
    className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors"
    title="Clear Upload"
  >
    <X className="w-6 h-6" />
  </button>
</div>

            {/* Page Thumbnails Grid */}
            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
  <input
    type="text"
    placeholder="Search page number (e.g. 5, 12...)"
    value={pageSearch}
    onChange={(e) => setPageSearch(e.target.value)}
    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
  />

  <button
    onClick={handleSelectAll}
    className="text-sm text-blue-600 hover:underline"
  >
    {allPagesSelected ? 'Unselect All' : 'Select All'}
  </button>
</div>
            
            <div className="relative">
              {isThumbnailLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 rounded-2xl">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm font-medium text-slate-700">Loading pages...</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 opacity-90">
              {filteredPages.map((page) => (
                <div
                  key={page.pageNum}
                  onClick={() => togglePage(page.pageNum)}
                  className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    selectedPages.includes(page.pageNum)
                      ? 'border-blue-600 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-400'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={page.dataUrl}
                      alt={`Page ${page.pageNum}`}
                      className="w-full h-auto"
                    />
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                      {page.pageNum}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPreviewPage(page.pageNum);
                        setPreviewImageUrl(page.dataUrl);
                      }}
                      className="absolute top-2 right-2 rounded-full bg-white/90 p-2 text-slate-700 hover:bg-slate-200"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                    {selectedPages.includes(page.pageNum) && (
                      <div className="absolute bottom-2 right-2 bg-green-500 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Saved Sections</h2>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Yet</h3>
            <p className="text-gray-600">Upload a PDF and create sections above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="block p-4 border rounded-lg hover:shadow-lg hover:border-blue-400 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-8 h-8 text-blue-500 flex-shrink-0" />
                  <div className="font-semibold text-gray-800 truncate flex-1">{doc.name}</div>
                </div>
                <p className="text-sm text-gray-500">{formatBytes(doc.sizeInBytes)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
                {/* View/Download actions */}
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
        )}
      </div>

      {previewPage && previewImageUrl && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
    onClick={() => {
      setPreviewPage(null);
      setPreviewImageUrl(null);
      setIsZoomed(false);
    }}
  >
    {/* Close Button */}
    <button
      onClick={() => {
        setPreviewPage(null);
        setPreviewImageUrl(null);
        setIsZoomed(false);
      }}
      className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg z-10"
    >
      <X className="w-5 h-5" />
    </button>

    {/* Page label */}
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm font-semibold px-4 py-2 rounded-full z-10">
      Page {previewPage}
    </div>

    {/* Image with pan + magnifier zoom on hover */}
    <div
      className="relative overflow-hidden rounded-xl shadow-2xl"
      style={{ width: '80vw', height: '88vh' }}
      onClick={(e) => e.stopPropagation()}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setZoomPos({ x, y });
      }}
    >
      <img
        src={previewImageUrl}
        alt={`Page ${previewPage}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
          transform: isZoomed ? 'scale(2.5)' : 'scale(1)',
          transition: isZoomed ? 'none' : 'transform 0.2s ease',
          cursor: isZoomed ? 'zoom-out' : 'zoom-in',
          display: 'block',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsZoomed((prev) => !prev);
        }}
      />
    </div>

    {/* Hint */}
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
      {isZoomed ? 'Move mouse to pan • Click to zoom out' : 'Click to zoom in'}
    </div>
  </div>
)}
    </div>
  );
}