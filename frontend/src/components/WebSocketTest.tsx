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
    uptime?: number;
    environment?: string;
  } | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [pollingActivity, setPollingActivity] = useState<{timestamp: number, type: 'check' | 'success' | 'error'}[]>([]);
  const [nextPollTime, setNextPollTime] = useState<number | null>(null);

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
      setPollingActivity(prev => [...prev.slice(-9), {timestamp: Date.now(), type: 'check'}]);
      
      try {
        console.log(`[TaskMonitor] Checking server health at ${API_URL}/health`);
        const response = await fetch(`${API_URL}/health`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[TaskMonitor] Server health data:', data);
          setServerInfo(data);
          setLastPing(new Date().toISOString());
          setPollingActivity(prev => [...prev.slice(-9), {timestamp: Date.now(), type: 'success'}]);
        } else {
          console.error(`[TaskMonitor] Server health check failed: ${response.status}`);
          setServerInfo(null);
          setPollingActivity(prev => [...prev.slice(-9), {timestamp: Date.now(), type: 'error'}]);
        }
      } catch (error) {
        console.error('[TaskMonitor] Error checking server health:', error);
        setServerInfo(null);
        setPollingActivity(prev => [...prev.slice(-9), {timestamp: Date.now(), type: 'error'}]);
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

  // Simulate next poll time countdown
  useEffect(() => {
    if (pollingStatus === 'polling') {
      setNextPollTime(Date.now() + 3000); // 3 seconds from now
      
      const timer = setInterval(() => {
        if (Date.now() >= (nextPollTime || 0)) {
          setNextPollTime(Date.now() + 3000);
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [pollingStatus, nextPollTime]);

  // Format the last ping time
  const formattedLastPing = lastPing 
    ? new Date(lastPing).toLocaleTimeString() 
    : 'Never';

  // Calculate time until next poll
  const timeUntilNextPoll = nextPollTime ? Math.max(0, Math.floor((nextPollTime - Date.now()) / 1000)) : null;
  
  // Calculate retry progress percentage
  const retryProgressPercentage = Math.min(retryCount * 20, 100); // 5 retries = 100%

  return (
    <div className="p-6 max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md space-y-4 mt-8">
      <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400">Task Monitor</h2>
      
      {/* Polling Visualization */}
      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Polling Visualization</h3>
        
        {/* Polling Status Indicator */}
        <div className="flex items-center mb-4">
          <div className={`w-4 h-4 rounded-full mr-3 ${
            pollingStatus === 'polling' 
              ? 'bg-green-500 animate-pulse' 
              : pollingStatus === 'error' 
                ? 'bg-red-500' 
                : 'bg-gray-400'
          }`}></div>
          <span className={`font-medium ${
            pollingStatus === 'polling' ? 'text-green-600 dark:text-green-400' : 
            pollingStatus === 'error' ? 'text-red-600 dark:text-red-400' : 
            'text-yellow-600 dark:text-yellow-400'
          }`}>
            {pollingStatus === 'polling' ? 'Active' : 
             pollingStatus === 'error' ? 'Error' : 'Idle'}
          </span>
          
          {pollingStatus === 'polling' && timeUntilNextPoll !== null && (
            <span className="ml-auto text-sm text-gray-500">
              Next poll in: {timeUntilNextPoll}s
            </span>
          )}
        </div>
        
        {/* Retry Progress Bar */}
        {retryCount > 0 && (
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Retry Count: {retryCount}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
              <div 
                className="bg-yellow-400 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${retryProgressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Activity Timeline */}
        <div className="flex space-x-1 h-6 mt-4">
          {pollingActivity.map((activity, index) => (
            <div 
              key={index} 
              className={`flex-1 rounded-sm ${
                activity.type === 'check' ? 'bg-blue-300 dark:bg-blue-700' :
                activity.type === 'success' ? 'bg-green-300 dark:bg-green-700' :
                'bg-red-300 dark:bg-red-700'
              } transition-all duration-300`}
              title={`${new Date(activity.timestamp).toLocaleTimeString()} - ${activity.type}`}
            ></div>
          ))}
          {Array(10 - pollingActivity.length).fill(0).map((_, index) => (
            <div key={`empty-${index}`} className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-sm"></div>
          ))}
        </div>
      </div>
      
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
            {pollingStatus}
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
            {serverInfo.environment && <p className="text-sm text-gray-700 dark:text-gray-300">Environment: {serverInfo.environment}</p>}
            {serverInfo.uptime !== undefined && <p className="text-sm text-gray-700 dark:text-gray-300">Uptime: {Math.floor(serverInfo.uptime / 60)} minutes</p>}
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
          <div className="space-y-4">
            {/* Task Timeline */}
            <div className="relative pb-12">
              <div className="absolute h-full w-0.5 bg-gray-200 dark:bg-gray-700 left-2.5 top-0"></div>
              {completedTasks.map((task, index) => (
                <div key={task.id} className="relative pl-8 pb-6">
                  <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-purple-500 dark:bg-purple-400 z-10"></div>
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{task.data}</p>
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span>Priority: {task.priority}</span>
                      {task.completion_time && (
                        <span>Completed: {new Date(parseInt(task.completion_time) * 1000).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Task ID: {task.id}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 