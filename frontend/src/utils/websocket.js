const WS_PORT = 8082; // WebSocket port
const HTTP_PORT = 8081; // HTTP port

// For production, derive WebSocket URL from API URL
// This ensures we use the same domain and protocol (ws/wss based on http/https)
const getWebSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Replace http:// with ws:// or https:// with wss://
    return process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws');
  }
  return `ws://localhost:${WS_PORT}`;
};

// Use environment variable in production, fallback to localhost for development
export const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || getWebSocketUrl();
export const API_URL = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${HTTP_PORT}`; 