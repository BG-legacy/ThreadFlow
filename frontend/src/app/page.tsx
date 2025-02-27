'use client';

import { useState, useEffect } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { API_URL } from '@/utils/websocket';

interface Task {
  id: string;
  status: 'pending' | 'completed';
  priority: number;
  data: string;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [priority, setPriority] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    status: pollingStatus, 
    error: pollingError, 
    retryCount, 
    completedTasks,
    startPolling,
    stopPolling,
    resetPolling
  } = usePolling();

  // Handle completed tasks from polling
  useEffect(() => {
    if (completedTasks && completedTasks.length > 0) {
      console.log('Received completed tasks:', completedTasks);
      
      setTasks(prev => {
        const updatedTasks = [...prev];
        
        completedTasks.forEach(completedTask => {
          const taskIndex = updatedTasks.findIndex(t => t.id === completedTask.id);
          
          if (taskIndex !== -1) {
            updatedTasks[taskIndex] = { 
              ...updatedTasks[taskIndex], 
              status: 'completed' as const 
            };
            
            // Show notification for completed task
            if ("Notification" in window) {
              Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                  new Notification('Task Completed', {
                    body: `Task "${updatedTasks[taskIndex].data}" has been completed!`
                  });
                }
              });
            }
          }
        });
        
        console.log('Updated tasks:', updatedTasks);
        return updatedTasks;
      });
    }
  }, [completedTasks]);

  // Start polling when component mounts
  useEffect(() => {
    startPolling();
    
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: newTask, priority }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit task');
      }

      const task: Task = {
        id: data.task_id,
        data: newTask,
        priority: priority,
        status: 'pending' as const
      };

      setTasks(prev => [...prev, task]);
      setNewTask('');
      setPriority(1);
      setSuccess(true);

      // Trigger animation for new task
      const taskElement = document.getElementById(`task-${task.id}`);
      if (taskElement) {
        taskElement.classList.add('task-enter');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container">
        <h1 className="text-7xl font-bold mb-12 font-geist-sans text-center text-white">
          ThreadFlow
        </h1>
        
        <div className="mb-8 p-8 rounded-xl bg-gradient-to-br from-purple-600/30 via-pink-500/30 to-orange-500/30 backdrop-blur-lg border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-2xl font-medium text-white mb-3">
                Task Description:
              </label>
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                className="w-full text-xl p-4 bg-white/10 border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-white/50 text-white placeholder-white/50"
                required
              />
            </div>
            
            <div>
              <label className="block text-2xl font-medium text-white mb-3">
                Priority (1-10):
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full text-xl p-4 bg-white/10 border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-white/50 text-white"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-4 text-xl font-medium bg-white/20 hover:bg-white/30 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding Thread...' : 'Add Thread'}
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-4 p-4 text-red-500 bg-red-100 rounded-lg">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 text-green-500 bg-green-100 rounded-lg">
            Task added successfully! Check the Task Monitor for updates.
          </div>
        )}

        {pollingError && (
          <div className="mb-4 p-4 text-amber-500 bg-amber-100 rounded-lg">
            Polling error: {pollingError}
            <button 
              onClick={resetPolling}
              className="ml-4 px-3 py-1 bg-amber-200 rounded-md hover:bg-amber-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mb-4 p-4 bg-white/10 rounded-lg text-white">
          <p>Polling Status: <span className={pollingStatus === 'polling' ? 'text-green-400' : 'text-amber-400'}>{pollingStatus}</span></p>
          {retryCount > 0 && <p>Retry Count: {retryCount}</p>}
          <div className="mt-2">
            {pollingStatus === 'polling' ? (
              <button 
                onClick={stopPolling}
                className="px-3 py-1 bg-white/20 rounded-md hover:bg-white/30 transition-colors"
              >
                Pause Polling
              </button>
            ) : (
              <button 
                onClick={startPolling}
                className="px-3 py-1 bg-white/20 rounded-md hover:bg-white/30 transition-colors"
              >
                Resume Polling
              </button>
            )}
          </div>
        </div>

        <div className="p-8 rounded-xl bg-gradient-to-br from-purple-600/30 via-pink-500/30 to-orange-500/30 backdrop-blur-lg border border-white/20">
          <h2 className="text-4xl font-bold mb-8 text-white">
            Active Threads
          </h2>
          {tasks.length === 0 ? (
            <p className="text-2xl text-white/70 text-center py-12">
              No threads yet. Start one above!
            </p>
          ) : (
            <div className="space-y-6">
              {tasks.map(task => (
                <div
                  key={task.id}
                  id={`task-${task.id}`}
                  className={`p-6 rounded-xl border border-white/20 transition-all duration-300 ${
                    task.status === 'completed' 
                      ? 'bg-white/10' 
                      : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-medium text-white">
                      {task.data}
                    </p>
                    <span className={`px-4 py-2 rounded-full text-xl font-medium ${
                      task.status === 'completed'
                        ? 'bg-green-500/20 text-white'
                        : 'bg-orange-500/20 text-white'
                    }`}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xl mt-3 text-white/70">
                    Priority: {task.priority}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
