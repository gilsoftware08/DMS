/**
 * Scanner Bridge Helper
 * Handles communication with Electron scanner bridge service
 * Bridge runs on http://localhost:4785 by default (configurable via env var)
 */

const SCANNER_BRIDGE_URL = process.env.NEXT_PUBLIC_SCANNER_BRIDGE_URL || 'http://localhost:4785';
const SCAN_TIMEOUT_MS = 60000; // 60 seconds (scanner hardware can take 10-30 seconds)
const STATUS_TIMEOUT_MS = 5000; // 5 seconds for status checks



/**
 * Custom error class for scanner-specific errors
 */
export class ScannerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScannerError';
  }
}

/**
 * Types for scanner responses
 */
export interface ScannerStatusResponse {
  online: boolean;
  scanners: Scanner[];
  message?: string;
}

export interface Scanner {
  id: string;
  name: string;
  status: 'ready' | 'busy' | 'error';
  model?: string;
  source?: string;
}

export interface ScanResponse {
  success: boolean;
  fileData: string; // Base64 encoded PDF
  extension: string;
  fileName?: string;
  scannedAt?: string;
  // Backend may return a plain string OR a structured object like { code, message }
  error?: string | { code?: string; message?: string; [key: string]: unknown } | unknown;
}


/**
 * Safely extract a human-readable string from any backend error shape.
 * Handles:
 *   "plain string"
 *   { message: "...", code: "..." }   <- PaperStream / bridge format
 *   { error: { message: "..." } }      <- nested
 *   { error: "plain string" }          <- flat
 * Never returns [object Object].
 */
function extractApiErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error.trim() || fallback;
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    // Direct message field (e.g. { code, message })
    if (typeof e.message === 'string' && e.message.trim()) return e.message.trim();
    // Nested error field
    if (e.error) {
      if (typeof e.error === 'string' && e.error.trim()) return e.error.trim();
      if (typeof e.error === 'object') {
        const nested = e.error as Record<string, unknown>;
        if (typeof nested.message === 'string' && nested.message.trim()) return nested.message.trim();
      }
    }
    // Last resort: try to JSON-stringify so it's at least readable
    try { return JSON.stringify(error); } catch { return fallback; }
  }
  return fallback;
}

/**
 * Check if scanner bridge is online
 */
export async function getScannerStatus(): Promise<ScannerStatusResponse> {
  const url = `${SCANNER_BRIDGE_URL}/status`;
  
  console.debug('[Scanner] Checking status:', { url });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.debug('[Scanner] Status response:', {
      status: res.status,
      ok: res.ok,
    });

    if (!res.ok) {
      throw new ScannerError(
        'STATUS_ERROR',
        `Scanner bridge returned ${res.status}`,
        { status: res.status }
      );
    }

    const data = await res.json();
    console.debug('[Scanner] Status data:', data);

    return data as ScannerStatusResponse;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[Scanner] Status check timed out');
      throw new ScannerError(
        'TIMEOUT',
        'Scanner bridge status check timed out (5s)',
        { timeout: STATUS_TIMEOUT_MS }
      );
    }

    if (error instanceof ScannerError) {
      throw error;
    }

    if (error instanceof TypeError) {
      console.error('[Scanner] Connection failed:', error.message);
      throw new ScannerError(
        'OFFLINE',
        'Scanner bridge is offline or unreachable',
        { url, originalError: error.message }
      );
    }

    console.error('[Scanner] Unexpected error:', error);
    throw new ScannerError(
      'UNKNOWN',
      'Failed to check scanner bridge status',
      { error: String(error) }
    );
  }
}

/**
 * Get list of available scanners
 */
export async function getScanners(): Promise<Scanner[]> {
  const res = await fetch('http://localhost:4785/scanners');

  if (!res.ok) {
    throw new Error('Failed to fetch scanners');
  }

  const data = await res.json();

  console.log('[Scanner API] Raw response:', data);
  console.log('[Scanner API] Parsed scanners:', data.scanners);

  return Array.isArray(data.scanners)
    ? data.scanners
    : [];
}



/**
 * Cancel an active scan operation
 */
export async function cancelScan(): Promise<{ success: boolean; message?: string }> {
  const url = `${SCANNER_BRIDGE_URL}/cancel`;
  try {
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Cancel failed with status ${res.status}`);
    }
    return { success: true, message: data.message };
  } catch (error) {
    console.error('[Scanner] Failed to cancel scan:', error);
    throw new ScannerError(
      'CANCEL_FAILED',
      'Failed to cancel the scan operation',
      { error: String(error) }
    );
  }
}

/**
 * Convert Base64 scanned PDF to File object
 * Matches the processPdfFile() workflow
 */
export function convertScanResponseToFile(scanResponse: ScanResponse): File {
  try {
    // Decode Base64 to binary string
    const binaryString = atob(scanResponse.fileData);
    
    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create Blob from bytes
    const blob = new Blob([bytes], { type: 'application/pdf' });

    // Create File with timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = scanResponse.fileName || `scanned-${timestamp}.pdf`;

    const file = new File([blob], fileName, { type: 'application/pdf' });

    console.debug('[Scanner] File created from scan:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    return file;
  } catch (error) {
    console.error('[Scanner] Failed to convert scan to file:', error);
    throw new ScannerError(
      'CONVERSION_ERROR',
      'Failed to convert scanned document to file',
      { error: String(error) }
    );
  }
}

/**
 * Get user-friendly error message
 */
export function getScannerErrorMessage(error: unknown): string {
  if (error instanceof ScannerError) {
    switch (error.code) {
      case 'ALREADY_SCANNING': return 'A scan is already in progress — please wait.';
      case 'OFFLINE': return 'Scanner bridge offline — ensure the desktop app is running on port 4785';
      case 'TIMEOUT': return 'Scan timeout — is paper loaded in the scanner tray?';
      case 'NO_SCANNER': return 'No scanner detected — connect a scanner to your computer';
      case 'SCAN_CANCELED': return 'Scan was canceled';
      case 'INVALID_RESPONSE': return 'Scanner bridge returned an invalid response';
      case 'SCAN_FAILED': return error.message || 'Scan failed';
      case 'CONVERSION_ERROR': return 'Failed to process the scanned document';
      default: return error.message || 'Scanner error';
    }
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected scanner error occurred';
}

/**
 * Safe error-to-string helper — never returns [object Object]
 */
export function getReadableErrorMessage(value: unknown, fallback = 'An unexpected error occurred'): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
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
