import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WS_URL } from '@/utils/websocket';

export default function WebSocketTest() {
  const { socket, connectionStatus, connectionError } = useWebSocket(WS_URL);
  const [lastPing, setLastPing] = useState<Date | null>(null);

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
        <p className="text-xl text-white/70">URL: {WS_URL}</p>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-sm text-white/50 mt-1">
            Using development URL. Set NEXT_PUBLIC_WEBSOCKET_URL in .env.local to override.
          </p>
        )}
        {lastPing && (
          <p className="text-xl text-white/70">
            Last Ping: {lastPing.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
} 