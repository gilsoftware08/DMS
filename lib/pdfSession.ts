import localforage from 'localforage';

const DB_NAME = 'one_project_pdf_sessions';
const STORE_NAME = 'pdf_upload_sessions';
const SESSION_KEY_PREFIX = 'pdf_upload_session_';

export interface PdfSessionPage {
  pageNum: number;
  dataUrl: string;
}

export interface PdfSessionData {
  folderId: number;
  fileName: string;
  sectionName: string;
  selectedPages: number[];
  pages: PdfSessionPage[];
  file: File;
}

interface PdfSessionEntry extends Omit<PdfSessionData, 'file'> {
  file: File | Blob;
}

const sessionDb = localforage.createInstance({
  name: DB_NAME,
  storeName: STORE_NAME,
  driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
});

function getSessionKey(folderId: number) {
  return `${SESSION_KEY_PREFIX}${folderId}`;
}

function isValidSessionEntry(entry: any): entry is PdfSessionEntry {
  return (
    entry &&
    typeof entry.folderId === 'number' &&
    typeof entry.fileName === 'string' &&
    typeof entry.sectionName === 'string' &&
    Array.isArray(entry.selectedPages) &&
    Array.isArray(entry.pages) &&
    entry.pages.every(
      (page: any) => typeof page.pageNum === 'number' && typeof page.dataUrl === 'string'
    ) &&
    entry.file instanceof Blob
  );
}

export async function savePdfSession(
  folderId: number,
  file: File,
  pages: PdfSessionPage[],
  selectedPages: number[],
  sectionName: string
) {
  if (typeof window === 'undefined') return;
  try {
    const key = getSessionKey(folderId);
    const entry: PdfSessionEntry = {
      folderId,
      fileName: file.name,
      sectionName,
      selectedPages,
      pages,
      file,
    };

    await sessionDb.setItem(key, entry);
  } catch (error) {
    console.warn('Failed to save PDF session to IndexedDB', error);
  }
}

export async function loadPdfSession(folderId: number): Promise<PdfSessionData | null> {
  if (typeof window === 'undefined') return null;

  const key = getSessionKey(folderId);
  try {
    const entry = await sessionDb.getItem<PdfSessionEntry>(key);
    if (!entry || !isValidSessionEntry(entry) || entry.folderId !== folderId) {
      await clearPdfSession(folderId);
      return null;
    }

    const file = entry.file instanceof File
      ? entry.file
      : new File([entry.file], entry.fileName, { type: 'application/pdf' });

    return {
      folderId: entry.folderId,
      fileName: entry.fileName,
      sectionName: entry.sectionName,
      selectedPages: entry.selectedPages,
      pages: entry.pages,
      file,
    };
  } catch (error) {
    console.error('Failed to load PDF session from IndexedDB', error);
    await clearPdfSession(folderId);
    return null;
  }
}

export async function clearPdfSession(folderId: number) {
  if (typeof window === 'undefined') return;

  try {
    const key = getSessionKey(folderId);
    await sessionDb.removeItem(key);
  } catch (error) {
    console.error('Failed to clear PDF session from IndexedDB', error);
  }
}
