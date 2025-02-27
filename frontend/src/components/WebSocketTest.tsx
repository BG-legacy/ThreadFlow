import { useState, useEffect } from 'react';
import { API_URL } from '@/utils/websocket';
import { usePolling } from '@/hooks/usePolling';

// Rename component to TaskMonitor
export default function TaskMonitor() {
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<{
    http_port?: number;
    version?: string;
    cors_enabled?: boolean;
  } | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  // Use our new polling hook instead of WebSocket
  const {
    status: pollingStatus,
    error: pollingError,
    retryCount,
    completedTasks,
    startPolling,
    stopPolling,
    resetPolling
  } = usePolling();

  // Check server health
  useEffect(() => {
    const checkServerHealth = async () => {
      setIsCheckingServer(true);
      try {
        console.log(`[TaskMonitor] Checking server health at ${API_URL}/health`);
        const response = await fetch(`${API_URL}/health`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[TaskMonitor] Server health data:', data);
          setServerInfo(data);
          setLastPing(new Date().toISOString());
        } else {
          console.error(`[TaskMonitor] Server health check failed: ${response.status}`);
          setServerInfo(null);
        }
      } catch (error) {
        console.error('[TaskMonitor] Error checking server health:', error);
        setServerInfo(null);
      } finally {
        setIsCheckingServer(false);
      }
    };

    // Check health immediately and then every 30 seconds
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Start polling when component mounts
  useEffect(() => {
    startPolling();
    
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  // Format the last ping time
  const formattedLastPing = lastPing 
    ? new Date(lastPing).toLocaleTimeString() 
    : 'Never';

  return (
    <div className="p-6 max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md space-y-4 mt-8">
      <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400">Task Monitor</h2>
      
      <div className="space-y-2">
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">API URL:</span> {API_URL}
        </p>
        
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Polling Status:</span>{' '}
          <span className={`font-medium ${
            pollingStatus === 'polling' ? 'text-green-600 dark:text-green-400' : 
            pollingStatus === 'error' ? 'text-red-600 dark:text-red-400' : 
            'text-yellow-600 dark:text-yellow-400'
          }`}>
            {pollingStatus === 'polling' ? 'Active' : 
             pollingStatus === 'error' ? 'Error' : 'Idle'}
          </span>
        </p>
        
        {pollingError && (
          <p className="text-red-600 dark:text-red-400">
            <span className="font-semibold">Error:</span> {pollingError}
          </p>
        )}
        
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Retry Count:</span> {retryCount}
        </p>
        
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Last Server Check:</span> {formattedLastPing}
          {isCheckingServer && <span className="ml-2 text-blue-500">(Checking...)</span>}
        </p>
        
        {serverInfo && (
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mt-2">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Server Info:</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">HTTP Port: {serverInfo.http_port}</p>
            {serverInfo.version && <p className="text-sm text-gray-700 dark:text-gray-300">Version: {serverInfo.version}</p>}
            <p className="text-sm text-gray-700 dark:text-gray-300">
              CORS: {serverInfo.cors_enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        )}
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={resetPolling}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Reconnect
        </button>
        
        <button
          onClick={pollingStatus === 'polling' ? stopPolling : startPolling}
          className={`px-4 py-2 ${
            pollingStatus === 'polling' 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-green-600 hover:bg-green-700'
          } text-white rounded transition-colors`}
        >
          {pollingStatus === 'polling' ? 'Stop Polling' : 'Start Polling'}
        </button>
      </div>
      
      <div className="mt-6">
        <h3 className="text-xl font-semibold text-purple-600 dark:text-purple-400 mb-3">Completed Tasks</h3>
        {completedTasks.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">No completed tasks yet</p>
        ) : (
          <ul className="space-y-2">
            {completedTasks.map(task => (
              <li key={task.id} className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                <p className="font-medium text-gray-800 dark:text-gray-200">{task.data}</p>
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span>Priority: {task.priority}</span>
                  {task.completion_time && (
                    <span>Completed: {new Date(task.completion_time).toLocaleString()}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 