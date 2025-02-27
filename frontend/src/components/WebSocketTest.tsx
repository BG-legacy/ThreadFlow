import { useState, useEffect } from 'react';
import { API_URL } from '@/utils/websocket';
import { usePolling } from '@/hooks/usePolling';

// Rename component to TaskMonitor and make it more compact
export default function TaskMonitor() {
  // Only keep the state variables we actually use
  const [pollingActivity, setPollingActivity] = useState<{timestamp: number, type: 'check' | 'success' | 'error'}[]>([]);
  const [nextPollTime, setNextPollTime] = useState<number | null>(null);

  // Use our polling hook
  const {
    status: pollingStatus,
    completedTasks,
    startPolling,
    stopPolling,
    resetPolling
  } = usePolling();

  // Check server health
  useEffect(() => {
    const checkServerHealth = async () => {
      setPollingActivity(prev => [...prev.slice(-9), {timestamp: Date.now(), type: 'check'}]);
      
      try {
        const response = await fetch(`${API_URL}/health`);
        
        if (response.ok) {
          setPollingActivity(prev => [...prev.slice(-9), {timestamp: Date.now(), type: 'success'}]);
        } else {
          setPollingActivity(prev => [...prev.slice(-9), {timestamp: Date.now(), type: 'error'}]);
        }
      } catch {
        setPollingActivity(prev => [...prev.slice(-9), {timestamp: Date.now(), type: 'error'}]);
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
    return () => { stopPolling(); };
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

  // Calculate time until next poll
  const timeUntilNextPoll = nextPollTime ? Math.max(0, Math.floor((nextPollTime - Date.now()) / 1000)) : null;
  
  return (
    <div className="p-4 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md mt-4">
      <h2 className="text-xl font-bold text-purple-600 dark:text-purple-400 mb-3">Task Monitor</h2>
      
      {/* Compact Polling Visualization */}
      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              pollingStatus === 'polling' ? 'bg-green-500 animate-pulse' : 
              pollingStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
            }`}></div>
            <span className="text-sm font-medium">
              {pollingStatus === 'polling' ? 'Active' : 
               pollingStatus === 'error' ? 'Error' : 'Idle'}
            </span>
          </div>
          
          {pollingStatus === 'polling' && timeUntilNextPoll !== null && (
            <span className="text-xs text-gray-500">
              Next: {timeUntilNextPoll}s
            </span>
          )}
        </div>
        
        {/* Activity Timeline - Compact */}
        <div className="flex space-x-1 h-4">
          {pollingActivity.map((activity, i) => (
            <div 
              key={i} 
              className={`flex-1 rounded-sm ${
                activity.type === 'check' ? 'bg-blue-300 dark:bg-blue-700' :
                activity.type === 'success' ? 'bg-green-300 dark:bg-green-700' :
                'bg-red-300 dark:bg-red-700'
              }`}
              title={`${new Date(activity.timestamp).toLocaleTimeString()} - ${activity.type}`}
            ></div>
          ))}
          {Array(10 - pollingActivity.length).fill(0).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-sm"></div>
          ))}
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex space-x-2 mb-3">
        <button
          onClick={resetPolling}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Reconnect
        </button>
        
        <button
          onClick={pollingStatus === 'polling' ? stopPolling : startPolling}
          className={`px-3 py-1 text-xs ${
            pollingStatus === 'polling' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          } text-white rounded transition-colors`}
        >
          {pollingStatus === 'polling' ? 'Stop' : 'Start'}
        </button>
      </div>
      
      {/* Completed Tasks - Compact List */}
      <div>
        <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-2">Recent Tasks</h3>
        {completedTasks.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">No completed tasks</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {completedTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs">
                <div className="font-medium text-gray-800 dark:text-gray-200 truncate">{task.data}</div>
                <div className="flex justify-between text-gray-500 mt-1">
                  <span>Priority: {task.priority}</span>
                  <span>ID: {task.id.substring(0, 6)}...</span>
                </div>
              </div>
            ))}
            {completedTasks.length > 3 && (
              <p className="text-xs text-center text-gray-500">
                +{completedTasks.length - 3} more tasks
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 