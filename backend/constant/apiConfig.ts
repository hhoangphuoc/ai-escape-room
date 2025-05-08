export const VERCEL_DOMAIN = "https://ai-escape-room-nedap.vercel.app";
export const LOCAL_API_PORT = process.env.API_PORT || "3001";
export const LOCAL_API_URL = `http://localhost:${LOCAL_API_PORT}`;

/**
 * Returns the appropriate API base URL.
 * Defaults to Vercel domain if NODE_ENV is 'production',
 * otherwise defaults to local API URL.
 * Can be overridden by a specific API_URL environment variable.
 */
export const getApiBaseUrl = (): string => {
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  if (process.env.NODE_ENV === "production") {
    return VERCEL_DOMAIN;
  }
  return LOCAL_API_URL;
};
