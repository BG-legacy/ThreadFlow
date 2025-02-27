'use client';

import TaskMonitor from '@/components/WebSocketTest';
import Link from 'next/link';

export default function MonitorPage() {
  return (
    <main className="min-h-screen py-8 px-4 bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="container mx-auto max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-white">
          ThreadFlow Monitor
        </h1>
        
        <TaskMonitor />
        
        <div className="mt-6 text-center">
          <Link 
            href="/" 
            className="text-purple-300 hover:text-white transition-colors"
          >
            ← Back to main page
          </Link>
        </div>
      </div>
    </main>
  );
} 