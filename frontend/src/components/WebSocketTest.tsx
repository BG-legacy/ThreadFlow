import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WS_URL, API_URL } from '@/utils/websocket';

export default function WebSocketTest() {
  const { socket, connectionStatus, connectionError, reconnectCount } = useWebSocket(WS_URL);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  // Check server health
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setIsCheckingServer(true);
        const healthUrl = `${API_URL}/health`;
        console.log(`Checking server health at: ${healthUrl}`);
        
        const response = await fetch(healthUrl);
        if (response.ok) {
          const data = await response.json();
          setServerInfo(data);
          console.log('Server health check passed:', data);
        } else {
          console.error('Server health check failed:', response.status);
          setServerInfo({ error: `HTTP ${response.status}` });
        }
      } catch (error) {
        console.error('Server health check error:', error);
        setServerInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setIsCheckingServer(false);
      }
    };

    checkServerHealth();
  }, [API_URL]);

  useEffect(() => {
    if (socket) {
      const pingInterval = setInterval(() => {
        try {
          socket.send(JSON.stringify({ type: 'ping' }));
          setLastPing(new Date());
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }, 30000);

      return () => clearInterval(pingInterval);
    }
  }, [socket]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-500 dark:text-green-400';
      case 'connecting':
        return 'text-orange-500 dark:text-orange-400';
      case 'disconnected':
        return 'text-red-500 dark:text-red-400';
    }
  };

  const handleManualReconnect = () => {
    if (socket) {
      socket.close();
    }
    // The useWebSocket hook will automatically attempt to reconnect
  };

  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-6">
      <h3 className="text-3xl font-bold mb-4 text-white">
        Connection Status
      </h3>
      <div className="space-y-4">
        <p className="text-xl text-white">
          Status: <span className={`${getStatusColor()} font-semibold`}>
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </span>
        </p>
        
        {connectionError && (
          <p className="text-xl text-red-300">
            Error: {connectionError}
          </p>
        )}
        
        <p className="text-xl text-white/70">WebSocket URL: {WS_URL}</p>
        <p className="text-xl text-white/70">API URL: {API_URL}</p>
        
        {reconnectCount > 0 && (
          <p className="text-xl text-white/70">
            Reconnection attempts: {reconnectCount}
          </p>
        )}
        
        {process.env.NODE_ENV === 'development' && (
          <p className="text-sm text-white/50 mt-1">
            Using development URL. Set NEXT_PUBLIC_API_URL in .env.local to override.
          </p>
        )}
        
        {lastPing && (
          <p className="text-xl text-white/70">
            Last Ping: {lastPing.toLocaleTimeString()}
          </p>
        )}
        
        {serverInfo && (
          <div className="mt-4 p-4 bg-black/30 rounded-lg">
            <h4 className="text-lg font-semibold text-white mb-2">Server Info:</h4>
            {serverInfo.error ? (
              <p className="text-red-300">Error: {serverInfo.error}</p>
            ) : (
              <pre className="text-sm text-white/70 overflow-auto">
                {JSON.stringify(serverInfo, null, 2)}
              </pre>
            )}
          </div>
        )}
        
        <button
          onClick={handleManualReconnect}
          className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          Manually Reconnect
        </button>
      </div>
    </div>
  );
} 