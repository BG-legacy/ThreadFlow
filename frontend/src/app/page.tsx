'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WS_URL, API_URL } from '@/utils/websocket';

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
  
  const { socket } = useWebSocket(WS_URL);

  useEffect(() => {
    if (socket) {
      socket.onmessage = (event) => {
        console.log('Received WebSocket message:', event.data);
        try {
          const data = JSON.parse(event.data);
          console.log('Parsed message:', data);
          
          if (data.type === 'task_complete') {
            console.log('Updating task status:', data.task_id);
            setTasks(prev => {
              const updated = prev.map(task => 
                task.id === data.task_id 
                  ? { ...task, status: 'completed' as const } 
                  : task
              );
              console.log('Updated tasks:', updated);
              return updated;
            });
            
            // Move notification inside the setTasks callback
            const completedTask = tasks.find(t => t.id === data.task_id);
            if (completedTask && "Notification" in window) {
              Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                  new Notification('Task Completed', {
                    body: `Task "${completedTask.data}" has been completed!`
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
    }
  }, [socket, tasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

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
              className="w-full px-6 py-4 text-xl font-medium bg-white/20 hover:bg-white/30 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200"
            >
              Add Thread
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
            Task added successfully!
          </div>
        )}

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
