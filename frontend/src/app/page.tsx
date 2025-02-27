'use client';

import { useState, useEffect } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { API_URL } from '@/utils/websocket';
import TaskMonitor from '@/components/WebSocketTest';

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
    completedTasks,
    startPolling,
    stopPolling
  } = usePolling();

  // Handle completed tasks from polling
  useEffect(() => {
    if (completedTasks && completedTasks.length > 0) {
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
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit task');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen py-6 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:gap-6">
          {/* Left column - Task Monitor and Form */}
          <div className="w-full md:w-1/2">
            <h1 className="text-4xl font-bold mb-4 font-geist-sans text-center text-white">
              ThreadFlow
            </h1>
            
            {/* Task Monitor */}
            <div className="mb-4">
              <TaskMonitor />
            </div>
            
            {/* Task Form */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-600/30 via-pink-500/30 to-orange-500/30 backdrop-blur-lg border border-white/20">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-lg font-medium text-white mb-1">
                    Task Description:
                  </label>
                  <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    className="w-full p-2 bg-white/10 border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-white/50 text-white placeholder-white/50"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-lg font-medium text-white mb-1">
                    Priority (1-10):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full p-2 bg-white/10 border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-white/50 text-white"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 font-medium bg-white/20 hover:bg-white/30 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding...' : 'Add Thread'}
                </button>
              </form>
              
              {error && (
                <div className="mt-3 p-2 text-sm text-red-500 bg-red-100 rounded-lg">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mt-3 p-2 text-sm text-green-500 bg-green-100 rounded-lg">
                  Task added successfully!
                </div>
              )}
            </div>
          </div>
          
          {/* Right column - Active Threads */}
          <div className="w-full md:w-1/2 mt-6 md:mt-0">
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-600/30 via-pink-500/30 to-orange-500/30 backdrop-blur-lg border border-white/20 h-full">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Active Threads
              </h2>
              
              {tasks.length === 0 ? (
                <p className="text-white/70 text-center py-4">
                  No threads yet. Start one on the left!
                </p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border border-white/20 transition-all duration-300 ${
                        task.status === 'completed' 
                          ? 'bg-white/10' 
                          : 'bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-medium text-white truncate max-w-[70%]">
                          {task.data}
                        </p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.status === 'completed'
                            ? 'bg-green-500/20 text-white'
                            : 'bg-orange-500/20 text-white'
                        }`}>
                          {task.status === 'completed' ? 'Done' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 text-xs text-white/70">
                        <span className="mr-3">Priority: {task.priority}</span>
                        <span>ID: {task.id.substring(0, 6)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
