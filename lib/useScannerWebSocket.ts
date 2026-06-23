import { useState, useEffect, useRef, useCallback } from 'react';

export type ScanState = 
  | 'IDLE' 
  | 'WARMING_UP'
  | 'SCANNING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'ERROR';

export interface ScanSessionState {
  status: ScanState;
  progressMessage: string;
  scannedPages: string[];
  errorDetails: string | null;
  fileData: string | null;
}

export function useScannerWebSocket(wsUrl: string) {
  const [session, setSession] = useState<ScanSessionState>({
    status: 'IDLE',
    progressMessage: '',
    scannedPages: [],
    errorDetails: null,
    fileData: null,
  });

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Attempt to connect to the scanner bridge via WebSocket
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log('[WS] Socket open');
      console.log('[useScannerWebSocket] Connected');
    };

    socket.onerror = (error) => {
      console.log('[WS] Socket error', error);
    };

    socket.onmessage = (event) => {
      console.log('[WS RAW]', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('[WS PARSED]', data);

        switch (data.type) {
          case 'connected':
            console.log('[useScannerWebSocket] Connected message received');
            break;
          case 'scan:start':
            setSession(s => ({ ...s, status: 'WARMING_UP', errorDetails: null, scannedPages: [], fileData: null, progressMessage: 'Scanner warming up...' }));
            break;
          case 'scan:progress':
            setSession(s => ({ 
              ...s, 
              status: data.payload?.type === 'processing' ? 'PROCESSING' : 'SCANNING', 
              progressMessage: data.payload?.message || 'Scanning in progress...' 
            }));
            break;
          case 'scan:page':
          case 'page-scanned': {
            console.log('[useScannerWebSocket] Page scanned event:', data);
            let imgSrc = '';
            
            const rawImage = data.image || data.imageData || data.payload?.image || data.payload?.imageData;
            if (rawImage) {
              imgSrc = rawImage.startsWith('data:') ? rawImage : `data:image/jpeg;base64,${rawImage}`;
            } else {
              const rawPath = data.imagePath || data.url || data.payload?.imagePath || data.payload?.url || data.imageUrl || data.payload?.imageUrl;
              if (rawPath) {
                imgSrc = rawPath.startsWith('http') ? rawPath : `http://localhost:4785${rawPath}`;
              }
            }

            if (imgSrc) {
              setSession(prev => ({
                ...prev,
                status: 'SCANNING',
                progressMessage: 'Scanning in progress...',
                scannedPages: [...prev.scannedPages, imgSrc]
              }));
            }
            break;
          }
          case 'scan:complete':
            console.log('[useScannerWebSocket] Scan complete event:', data);
            setSession(s => ({
              ...s,
              status: 'COMPLETED',
              progressMessage: 'Scan complete!',
              fileData: data.fileData || data.payload?.fileData
            }));
            break;
          case 'scan:error':
            setSession(s => ({
              ...s,
              status: 'ERROR',
              errorDetails: data.message || data.payload?.message || 'Unknown error occurred'
            }));
            break;
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    socket.onclose = () => {
      console.log('[WS] Socket close');
      console.log('[useScannerWebSocket] Disconnected');
      if (session.status !== 'IDLE' && session.status !== 'COMPLETED') {
        setSession(s => ({ ...s, status: 'ERROR', errorDetails: 'Scanner disconnected unexpectedly.' }));
      }
    };

    return () => {
      socket.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  const startScan = useCallback((options: any = {}) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      setSession(s => ({ ...s, status: 'WARMING_UP', errorDetails: null, scannedPages: [], fileData: null, progressMessage: 'Sending scan command...' }));
      ws.current.send(JSON.stringify({ type: 'scan:start', payload: options }));
    } else {
      setSession(s => ({ ...s, status: 'ERROR', errorDetails: 'Scanner bridge is offline or unreachable.' }));
    }
  }, []);

  const cancelScan = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      setSession(s => ({ ...s, status: 'PROCESSING', progressMessage: 'Cancelling scan...' }));
      ws.current.send(JSON.stringify({ type: 'scan:cancel' }));
    }
  }, []);

  const resetSession = useCallback(() => {
    setSession({
      status: 'IDLE',
      progressMessage: '',
      scannedPages: [],
      errorDetails: null,
      fileData: null,
    });
  }, []);

  return {
    session,
    startScan,
    cancelScan,
    resetSession,
  };
}
