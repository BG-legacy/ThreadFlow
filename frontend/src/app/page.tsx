'use client';

import { useState, useEffect } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { API_URL } from '@/utils/websocket';
import Link from 'next/link';

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
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-7xl font-bold font-geist-sans text-center text-white">
            ThreadFlow
          </h1>
          <Link 
            href="/monitor" 
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Task Monitor
          </Link>
        </div>
        
        {/* System Visualization */}
        <div className="mb-12 p-6 rounded-xl bg-gradient-to-br from-purple-600/20 via-pink-500/20 to-orange-500/20 backdrop-blur-lg border border-white/20">
          <h2 className="text-3xl font-bold mb-6 text-white text-center">How It Works</h2>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-white">
            {/* Client */}
            <div className="bg-white/10 p-4 rounded-lg border border-white/20 w-full md:w-1/4">
              <h3 className="text-xl font-semibold mb-2">Client</h3>
              <div className="flex items-center justify-center h-24 relative">
                <div className="absolute w-16 h-16 bg-purple-500/30 rounded-full animate-ping"></div>
                <div className="absolute w-12 h-12 bg-purple-500/50 rounded-full"></div>
                <span className="relative z-10">Frontend</span>
              </div>
              <p className="text-sm mt-2">Submits tasks and polls for updates</p>
            </div>
            
            {/* Arrows */}
            <div className="flex flex-col items-center w-full md:w-1/6">
              <div className="hidden md:block w-full h-0.5 bg-white/30 relative">
                <div className={`absolute top-0 left-0 h-full bg-green-400 transition-all duration-500 ${pollingStatus === 'polling' ? 'animate-pulse' : ''}`} style={{ width: '100%' }}></div>
              </div>
              <div className="md:hidden h-8 w-0.5 bg-white/30"></div>
              <span className="text-xs text-white/70 my-1">HTTP Polling</span>
              <div className="md:hidden h-8 w-0.5 bg-white/30"></div>
              <div className="hidden md:block w-full h-0.5 bg-white/30"></div>
            </div>
            
            {/* Server */}
            <div className="bg-white/10 p-4 rounded-lg border border-white/20 w-full md:w-1/4">
              <h3 className="text-xl font-semibold mb-2">Server</h3>
              <div className="flex items-center justify-center h-24 relative">
                <div className={`w-16 h-16 rounded-lg border-2 border-white/30 flex items-center justify-center ${pollingStatus === 'polling' ? 'border-green-400' : ''}`}>
                  <div className={`w-4 h-4 rounded-full ${pollingStatus === 'polling' ? 'bg-green-400 animate-pulse' : 'bg-white/50'}`}></div>
                </div>
              </div>
              <p className="text-sm mt-2">Processes tasks and tracks completion</p>
            </div>
            
            {/* Arrows */}
            <div className="flex flex-col items-center w-full md:w-1/6">
              <div className="hidden md:block w-full h-0.5 bg-white/30 relative">
                <div className={`absolute top-0 left-0 h-full bg-blue-400 transition-all duration-500`} style={{ width: `${tasks.length > 0 ? '100%' : '0%'}` }}></div>
              </div>
              <div className="md:hidden h-8 w-0.5 bg-white/30"></div>
              <span className="text-xs text-white/70 my-1">Task Queue</span>
              <div className="md:hidden h-8 w-0.5 bg-white/30"></div>
              <div className="hidden md:block w-full h-0.5 bg-white/30"></div>
            </div>
            
            {/* Worker */}
            <div className="bg-white/10 p-4 rounded-lg border border-white/20 w-full md:w-1/4">
              <h3 className="text-xl font-semibold mb-2">Worker</h3>
              <div className="flex items-center justify-center h-24">
                <div className="relative">
                  <svg className={`w-16 h-16 ${tasks.length > 0 ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center">{tasks.filter(t => t.status === 'pending').length}</span>
                </div>
              </div>
              <p className="text-sm mt-2">Executes tasks in priority order</p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{tasks.length}</div>
              <div className="text-xs text-white/70">Total Tasks</div>
            </div>
            <div className="bg-white/10 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{tasks.filter(t => t.status === 'pending').length}</div>
              <div className="text-xs text-white/70">Pending</div>
            </div>
            <div className="bg-white/10 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{tasks.filter(t => t.status === 'completed').length}</div>
              <div className="text-xs text-white/70">Completed</div>
            </div>
            <div className="bg-white/10 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{retryCount}</div>
              <div className="text-xs text-white/70">Retry Count</div>
            </div>
          </div>
        </div>
        
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
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${pollingStatus === 'polling' ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`}></div>
            <p>Polling Status: <span className={pollingStatus === 'polling' ? 'text-green-400' : 'text-amber-400'}>{pollingStatus}</span></p>
            {retryCount > 0 && <p className="ml-4">Retry Count: {retryCount}</p>}
          </div>
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
                  className={`p-6 rounded-xl border border-white/20 transition-all duration-500 ${
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
                      {task.status === 'completed' ? (
                        <span className="flex items-center">
                          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          Completed
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <svg className="w-5 h-5 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                          </svg>
                          Pending
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center mt-3 text-white/70">
                    <div className="flex items-center mr-6">
                      <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                      <span>Priority: {task.priority}</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
                      </svg>
                      <span>ID: {task.id.split('_').pop()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
