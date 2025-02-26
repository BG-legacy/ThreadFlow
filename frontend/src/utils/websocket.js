const WS_PORT = 8082; // WebSocket port
const HTTP_PORT = 8081; // HTTP port

// Use environment variable in production, fallback to localhost for development
export const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || `ws://localhost:${WS_PORT}`;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${HTTP_PORT}`; 