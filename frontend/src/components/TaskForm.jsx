import { useState } from 'react';

function TaskForm(props) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 1
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('http://localhost:8081/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: formData.title,
          priority: formData.priority
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit task');
      }

      console.log('Task submitted successfully:', data);
      setSuccess(true);
      setFormData({ title: '', description: '', priority: 1 });

      // Add the task to the parent component's state
      if (props.onTaskSubmit) {
        props.onTaskSubmit({
          id: data.task_id,
          data: formData.title,
          priority: formData.priority,
          status: 'pending'
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'priority' ? parseInt(value) : value
    }));
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-8 bg-gradient-to-br from-purple-600/10 via-pink-500/10 to-orange-500/10 rounded-xl backdrop-blur-sm border border-white/10">
      {error && (
        <div className="mb-6 p-4 bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-100 rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-100/80 dark:bg-green-900/30 text-green-700 dark:text-green-100 rounded-lg backdrop-blur-sm">
          Task submitted successfully!
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-xl font-medium text-purple-900 dark:text-purple-100 mb-3">
            Thread Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full text-lg bg-white/50 dark:bg-gray-800/50 border-purple-200 dark:border-purple-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-xl font-medium text-purple-900 dark:text-purple-100 mb-3">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className="w-full text-lg bg-white/50 dark:bg-gray-800/50 border-purple-200 dark:border-purple-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        <div>
          <label htmlFor="priority" className="block text-xl font-medium text-purple-900 dark:text-purple-100 mb-3">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className="w-full text-lg bg-white/50 dark:bg-gray-800/50 border-purple-200 dark:border-purple-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="1">Low Priority</option>
            <option value="2">Medium Priority</option>
            <option value="3">High Priority</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full px-6 py-4 text-xl font-medium bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white rounded-xl hover:from-purple-700 hover:via-pink-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Create New Thread
        </button>
      </form>
    </div>
  );
}

export default TaskForm; 