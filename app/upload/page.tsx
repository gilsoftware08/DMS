"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PDFDocument } from 'pdf-lib';

export default function UploadSplit() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [folderName, setFolderName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [availablePages, setAvailablePages] = useState<number[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  // Check auth on load
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          router.replace('/login?expired=1');
        }
      })
      .catch(() => {
        router.replace('/login?expired=1');
      });
  }, [router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      setFile(uploadedFile);
      setIsLoadingPages(true);

      try {
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        setAvailablePages(Array.from({ length: pdf.getPageCount() }, (_, i) => i + 1));
      } catch (error) {
        console.error('Error reading PDF pages:', error);
        alert('Unable to read PDF pages. Please try another file.');
      } finally {
        setIsLoadingPages(false);
      }
    }
  };

  const togglePage = (pageNum: number) => {
    setSelectedPages(prev => 
      prev.includes(pageNum) ? prev.filter(p => p !== pageNum) : [...prev, pageNum]
    );
  };

  const handleSelectAll = () => {
    const visiblePages = availablePages.filter((p) => p.toString().includes(searchQuery));
    const allSelected = visiblePages.length > 0 && visiblePages.every((page) => selectedPages.includes(page));
    setSelectedPages(allSelected ? [] : visiblePages);
  };

  const handleDiscardSelected = () => {
    if (selectedPages.length === 0) return;
    const selectedSet = new Set(selectedPages);
    setAvailablePages((current) => current.filter((p) => !selectedSet.has(p)));
    setSelectedPages([]);
  };

  const handleSave = async () => {
    if (!file || !folderName || !sectionName || selectedPages.length === 0) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderName', folderName);
    formData.append('sectionName', sectionName);
    formData.append('pages', JSON.stringify(selectedPages));

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    
    if (res.ok) {
      // Remove saved pages from the grid
      const selectedSet = new Set(selectedPages);
      const remainingPages = availablePages.filter((p) => !selectedSet.has(p));
      setAvailablePages(remainingPages);
      setSelectedPages([]);
      setSectionName('');
      setSearchQuery('');

      if (remainingPages.length === 0) {
        alert('All pages processed! Redirecting to dashboard.');
        router.push('/');
      }
    } else {
      alert('Error saving section');
    }
  };

  const filteredPages = availablePages.filter(p => p.toString().includes(searchQuery));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Process PDF</h1>
        
        {!file && (
          <input type="file" accept="application/pdf" onChange={handleFileUpload} className="mb-6 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        )}

        {file && availablePages.length > 0 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <input type="text" placeholder="Folder Name (e.g., ABC)" value={folderName} onChange={e => setFolderName(e.target.value)} className="border p-2 rounded text-black flex-1" />
              <input type="text" placeholder="Search pages..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="border p-2 rounded text-black flex-1" />
              <button onClick={handleSelectAll} className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
                {filteredPages.length > 0 && filteredPages.every((pageNum) => selectedPages.includes(pageNum)) ? 'Unselect All' : 'Select All'}
              </button>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-10 gap-4 relative">
              {isLoadingPages && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm font-medium text-slate-700">Loading pages...</p>
                  </div>
                </div>
              )}
              {filteredPages.map(pageNum => (
                <div 
                  key={pageNum} onClick={() => togglePage(pageNum)}
                  className={`cursor-pointer h-24 flex items-center justify-center text-xl font-bold border-2 rounded-lg transition-all ${selectedPages.includes(pageNum) ? 'bg-blue-600 text-white border-blue-800 scale-105' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:shadow-lg'}`}
                >
                  {pageNum}
                </div>
              ))}
            </div>

            {selectedPages.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg flex flex-col md:flex-row gap-4 items-center border border-blue-200 mt-8">
                <span className="font-semibold text-blue-800">Selected: {selectedPages.sort((a,b)=>a-b).join(', ')}</span>
                <input type="text" placeholder="Section Name (e.g., Section 134)" value={sectionName} onChange={e => setSectionName(e.target.value)} className="border p-2 rounded text-black flex-1" />
                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                  <button onClick={handleDiscardSelected} className="bg-red-600 text-white px-5 py-2 rounded font-bold hover:bg-red-700 transition-colors">
                    Discard Selected
                  </button>
                  <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 transition-colors">
                    {availablePages.length === selectedPages.length ? 'DONE & SAVE' : 'SAVE SECTION'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}