import { useState, useEffect } from 'react';
import { API_URL } from '@/utils/websocket';

export function useWebSocket(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    const connectWebSocket = () => {
      if (typeof window === 'undefined') return;

      try {
        console.log(`[WebSocket] Attempting connection to: ${url} (Attempt: ${reconnectCount + 1})`);
        setConnectionStatus('connecting');
        
        // Check if the URL is valid
        if (!url || !url.startsWith('ws')) {
          throw new Error(`Invalid WebSocket URL: ${url}. URL must start with ws:// or wss://`);
        }
        
        // Check if we're in a secure context when using wss://
        if (url.startsWith('wss:') && window.isSecureContext === false) {
          console.warn('[WebSocket] Warning: Using wss:// in an insecure context may cause issues');
        }
        
        // First check if the server is reachable via HTTP
        console.log(`[WebSocket] Checking server health at ${API_URL}/health before connecting`);
        fetch(`${API_URL}/health`)
          .then(response => {
            if (response.ok) {
              console.log('[WebSocket] Server health check passed, proceeding with WebSocket connection');
            } else {
              console.warn(`[WebSocket] Server health check returned status ${response.status}`);
            }
          })
          .catch(err => {
            console.warn('[WebSocket] Server health check failed:', err.message);
          });
        
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
          console.log(`[WebSocket] Connection established to ${url}`);
          setSocket(ws);
          setConnectionStatus('connected');
          setConnectionError(null);
          setReconnectCount(0); // Reset reconnect counter on successful connection
          
          // Send a ping to test the connection
          try {
            ws.send(JSON.stringify({ type: 'ping' }));
            console.log('[WebSocket] Ping sent');
          } catch (e) {
            console.error('[WebSocket] Failed to send ping:', e);
          }
        };

        ws.onclose = (event) => {
          console.log(`[WebSocket] Connection closed: Code ${event.code}${event.reason ? `, Reason: ${event.reason}` : ''}`);
          setSocket(null);
          setConnectionStatus('disconnected');
          
          // Provide more detailed error messages based on close code
          let errorMessage = 'Connection closed.';
          if (event.code === 1006) {
            errorMessage = 'Connection closed abnormally. This may be due to network issues, server configuration, or the server not accepting WebSocket connections.';
          } else if (event.code === 1001) {
            errorMessage = 'Server is going away. The server might be restarting.';
          } else if (event.code === 1011) {
            errorMessage = 'Server encountered an error.';
          }
          
          setConnectionError(`${errorMessage} Retrying in 5 seconds...`);
          
          // Increment reconnect counter
          setReconnectCount(prev => prev + 1);
          
          // Attempt to reconnect with exponential backoff
          const delay = Math.min(5000 * Math.pow(1.5, Math.min(reconnectCount, 10)), 30000);
          console.log(`[WebSocket] Reconnecting in ${delay/1000} seconds...`);
          setTimeout(connectWebSocket, delay);
        };

        ws.onerror = (event) => {
          console.error('[WebSocket] Error:', event);
          // We don't set disconnected here because onclose will be called after onerror
          setConnectionError('Connection error occurred. Check browser console for details.');
          
          // Try to diagnose the issue
          console.log('[WebSocket] Attempting to diagnose connection issue...');
          
          // Check if the server is reachable
          fetch(`${API_URL}/health`)
            .then(response => {
              if (response.ok) {
                console.log('[WebSocket] Health check passed, server is running');
                return response.json();
              } else {
                console.error('[WebSocket] Health check failed:', response.status);
                throw new Error(`Health check failed with status ${response.status}`);
              }
            })
            .then(data => {
              console.log('[WebSocket] Server info:', data);
              if (data.websocket_port) {
                console.log(`[WebSocket] Server reports WebSocket port: ${data.websocket_port}`);
              }
            })
            .catch(err => {
              console.error('[WebSocket] Health check failed:', err);
              console.log('[WebSocket] This may indicate the server is down or unreachable');
            });
        };

        return ws;
      } catch (error) {
        console.error('[WebSocket] Failed to create connection:', error);
        setConnectionStatus('disconnected');
        setConnectionError(`Failed to create WebSocket connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Attempt to reconnect
        const delay = Math.min(5000 * Math.pow(1.5, Math.min(reconnectCount, 10)), 30000);
        setReconnectCount(prev => prev + 1);
        setTimeout(connectWebSocket, delay);
        
        return null;
      }
    };

    const ws = connectWebSocket();

    return () => {
      if (ws) {
        console.log('[WebSocket] Closing connection due to component unmounting');
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [url, reconnectCount]);

  return { socket, connectionStatus, connectionError, reconnectCount };
}