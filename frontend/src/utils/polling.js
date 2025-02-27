import { API_URL } from './websocket';

// Configuration
const POLLING_INTERVAL = 3000; // Poll every 3 seconds by default
const MAX_RETRY_COUNT = 5; // Maximum number of retries on failure
const RETRY_DELAY = 5000; // Initial retry delay in ms

/**
 * Creates a polling mechanism to check for completed tasks
 * @param {Function} onTaskCompleted - Callback function when a task is completed
 * @param {Function} onError - Callback function when an error occurs
 * @param {number} interval - Polling interval in milliseconds
 * @returns {Object} - Control functions for the polling mechanism
 */
export function createTaskPoller(onTaskCompleted, onError, interval = POLLING_INTERVAL) {
  let isPolling = false;
  let pollTimer = null;
  let retryCount = 0;
  let lastKnownTaskId = null;
  
  // Function to fetch completed tasks
  const fetchCompletedTasks = async () => {
    try {
      console.log('[Polling] Checking for completed tasks...');
      
      // First check server health
      const healthResponse = await fetch(`${API_URL}/health`);
      if (!healthResponse.ok) {
        throw new Error(`Server health check failed with status ${healthResponse.status}`);
      }
      
      const healthData = await healthResponse.json();
      console.log('[Polling] Server health:', healthData);
      
      // Then fetch completed tasks
      const response = await fetch(`${API_URL}/completed_tasks${lastKnownTaskId ? `?since=${lastKnownTaskId}` : ''}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch completed tasks: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Polling] Completed tasks response:', data);
      
      if (data.tasks && data.tasks.length > 0) {
        // Update the last known task ID
        const latestTask = data.tasks[data.tasks.length - 1];
        if (latestTask && latestTask.id) {
          lastKnownTaskId = latestTask.id;
        }
        
        // Notify for each completed task
        data.tasks.forEach(task => {
          if (onTaskCompleted) {
            onTaskCompleted(task);
          }
        });
      }
      
      // Reset retry count on success
      retryCount = 0;
      
      // Schedule next poll if still polling
      if (isPolling) {
        pollTimer = setTimeout(fetchCompletedTasks, interval);
      }
    } catch (error) {
      console.error('[Polling] Error:', error);
      
      if (onError) {
        onError(error.message);
      }
      
      // Implement exponential backoff for retries
      retryCount++;
      const delay = Math.min(RETRY_DELAY * Math.pow(1.5, Math.min(retryCount, 10)), 30000);
      
      console.log(`[Polling] Retry ${retryCount}/${MAX_RETRY_COUNT} in ${delay/1000} seconds...`);
      
      if (retryCount <= MAX_RETRY_COUNT && isPolling) {
        pollTimer = setTimeout(fetchCompletedTasks, delay);
      } else if (retryCount > MAX_RETRY_COUNT) {
        console.error('[Polling] Maximum retry count reached. Stopping polling.');
        isPolling = false;
        
        if (onError) {
          onError('Maximum retry count reached. Please check your connection and try again.');
        }
      }
    }
  };
  
  // Start polling
  const start = () => {
    if (!isPolling) {
      console.log('[Polling] Starting task polling...');
      isPolling = true;
      fetchCompletedTasks();
    }
  };
  
  // Stop polling
  const stop = () => {
    console.log('[Polling] Stopping task polling...');
    isPolling = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };
  
  // Reset the polling state
  const reset = () => {
    stop();
    retryCount = 0;
    lastKnownTaskId = null;
    start();
  };
  
  // Get current status
  const getStatus = () => ({
    isPolling,
    retryCount,
    lastKnownTaskId
  });
  
  return {
    start,
    stop,
    reset,
    getStatus
  };
} 