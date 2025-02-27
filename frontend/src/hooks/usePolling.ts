import { useState, useEffect } from 'react';
import { createTaskPoller } from '@/utils/polling';

interface Task {
  id: string;
  data: string;
  priority: number;
  status: string;
  completion_time?: string;
}

interface PollingStatus {
  isPolling: boolean;
  retryCount: number;
  lastKnownTaskId: string | null;
}

// Define an interface for the poller object returned by createTaskPoller
interface TaskPoller {
  start: () => void;
  stop: () => void;
  reset: () => void;
  getStatus: () => PollingStatus;
}

interface UsePollingReturn {
  status: 'idle' | 'polling' | 'error';
  error: string | null;
  retryCount: number;
  completedTasks: Task[];
  startPolling: () => void;
  stopPolling: () => void;
  resetPolling: () => void;
}

export function usePolling(interval?: number): UsePollingReturn {
  const [status, setStatus] = useState<'idle' | 'polling' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [poller, setPoller] = useState<TaskPoller | null>(null);

  useEffect(() => {
    // Create the poller
    const handleTaskCompleted = (task: Task) => {
      console.log('[usePolling] Task completed:', task);
      setCompletedTasks(prev => {
        // Check if we already have this task to avoid duplicates
        if (prev.some(t => t.id === task.id)) {
          return prev;
        }
        return [...prev, task];
      });
    };

    const handleError = (errorMessage: string) => {
      console.error('[usePolling] Error:', errorMessage);
      setError(errorMessage);
      setStatus('error');
    };

    const taskPoller = createTaskPoller(handleTaskCompleted, handleError, interval) as TaskPoller;
    setPoller(taskPoller);

    // Cleanup on unmount
    return () => {
      if (taskPoller) {
        taskPoller.stop();
      }
    };
  }, [interval]);

  useEffect(() => {
    // Update retry count when poller status changes
    if (poller) {
      const updateStatus = () => {
        const pollerStatus: PollingStatus = poller.getStatus();
        setRetryCount(pollerStatus.retryCount);
      };

      // Set up an interval to check the poller status
      const statusInterval = setInterval(updateStatus, 1000);
      
      return () => {
        clearInterval(statusInterval);
      };
    }
  }, [poller]);

  const startPolling = () => {
    if (poller) {
      poller.start();
      setStatus('polling');
      setError(null);
    }
  };

  const stopPolling = () => {
    if (poller) {
      poller.stop();
      setStatus('idle');
    }
  };

  const resetPolling = () => {
    if (poller) {
      poller.reset();
      setStatus('polling');
      setError(null);
      setRetryCount(0);
    }
  };

  return {
    status,
    error,
    retryCount,
    completedTasks,
    startPolling,
    stopPolling,
    resetPolling
  };
} 