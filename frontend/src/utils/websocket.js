const WS_PORT = 8082; // WebSocket port
const HTTP_PORT = 8081; // HTTP port

// Determine if we're in production (Vercel deployment)
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname !== 'localhost' && 
   window.location.hostname !== '127.0.0.1');

// For production, use the Render URL
// For development, use localhost
const getApiUrl = () => {
  if (isProduction) {
    return 'https://threadflow.onrender.com';
  }
  return `http://localhost:${HTTP_PORT}`;
};

// For production, derive WebSocket URL from API URL
const getWebSocketUrl = () => {
  if (isProduction) {
    // Add explicit path for WebSocket connection
    return 'wss://threadflow.onrender.com/ws';
  }
  return `ws://localhost:${WS_PORT}`;
};

// Use environment variables if available, otherwise use our production/development logic
export const API_URL = process.env.NEXT_PUBLIC_API_URL || getApiUrl();
export const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || getWebSocketUrl();

// Log the URLs being used
if (typeof window !== 'undefined') {
  console.log('[Config] Environment:', isProduction ? 'Production' : 'Development');
  console.log('[Config] API URL:', API_URL);
  console.log('[Config] WebSocket URL:', WS_URL);
  
  // Add diagnostic information
  console.log('[Config] Browser:', navigator.userAgent);
  console.log('[Config] Secure context:', window.isSecureContext);
  
  // Check if the API is reachable
  fetch(`${API_URL}/health`)
    .then(response => {
      console.log('[Config] API health check status:', response.status);
      return response.json().catch(() => ({ error: 'Invalid JSON response' }));
    })
    .then(data => {
      console.log('[Config] API health check data:', data);
    })
    .catch(error => {
      console.error('[Config] API health check failed:', error.message);
    });
} 