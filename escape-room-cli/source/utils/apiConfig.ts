export const VERCEL_DOMAIN = "https://ai-escape-room-nedap.vercel.app";
export const LOCAL_API_PORT = "3001"; // Assuming this is the consistent local port
export const LOCAL_API_URL = `http://localhost:${LOCAL_API_PORT}`;

/**
 * Returns the appropriate API base URL.
 * Prefers REACT_APP_API_URL, then API_URL environment variables.
 * If NODE_ENV is 'production' and no specific API_URL is set, defaults to VERCEL_DOMAIN.
 * Otherwise, defaults to LOCAL_API_URL.
 */
export const getApiUrl = (): string => {
  if (process.env['REACT_APP_API_URL']) {
    return process.env['REACT_APP_API_URL'];
  }
  if (process.env['API_URL']) {
    return process.env['API_URL'];
  }
  // Vercel automatically sets NODE_ENV to 'production' for production builds.
  // For local development, NODE_ENV might be 'development' or undefined.
  if (process.env['NODE_ENV'] === "production") {
    return VERCEL_DOMAIN;
  }
  return LOCAL_API_URL;
};
