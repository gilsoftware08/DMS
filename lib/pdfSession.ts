const SESSION_KEY = 'pdf_upload_session';

interface PdfSessionData {
  folderId: number;
  fileName: string;
  pages: { pageNum: number; dataUrl: string }[];
}

export function savePdfSession(
  folderId: number,
  fileName: string,
  pages: { pageNum: number; dataUrl: string }[]
) {
  if (typeof window === 'undefined') return;
  try {
    const data: PdfSessionData = { folderId, fileName, pages };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save PDF session (might be too large for sessionStorage)', error);
  }
}

export function loadPdfSession(folderId: number): PdfSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored) as PdfSessionData;
    if (data.folderId === folderId) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to load PDF session', error);
    return null;
  }
}

export function clearPdfSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear PDF session', error);
  }
}
