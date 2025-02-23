import { useState, useEffect } from 'react';

export function useWebSocket(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      if (typeof window === 'undefined') return;

      try {
        console.log('Attempting WebSocket connection to:', url);
        setConnectionStatus('connecting');
        
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
          console.log('WebSocket connection established');
          setSocket(ws);
          setConnectionStatus('connected');
          setConnectionError(null);
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          setSocket(null);
          setConnectionStatus('disconnected');
          setConnectionError('Connection closed. Retrying in 5 seconds...');
          
          // Attempt to reconnect
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (event) => {
          console.error('WebSocket error:', event);
          setConnectionStatus('disconnected');
          setConnectionError('Connection error occurred. Is the server running?');
        };

        return ws;
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        setConnectionStatus('disconnected');
        setConnectionError('Failed to create WebSocket connection. Is the server running?');
        return null;
      }
    };

    const ws = connectWebSocket();

    return () => {
      if (ws) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [url]);

  return { socket, connectionStatus, connectionError };
}