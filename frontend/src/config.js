// TrustBox API & WebSocket Configuration

// In production on Vercel, default to the deployed backend:
// https://trustbox-nine.vercel.app
// In local development, default to relative path (proxied by Vite dev server to localhost:4000)

export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://trustbox-nine.vercel.app' : '');

export const SOCKET_URL = 
  import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.PROD ? 'https://trustbox-nine.vercel.app' : undefined);

