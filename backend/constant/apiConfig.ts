import dotenv from "dotenv";
dotenv.config();

export const VERCEL_DOMAIN = "https://ai-escape-room-nedap.vercel.app";
export const LOCAL_API_PORT = process.env.API_PORT || "3001";
export const LOCAL_API_URL = `http://localhost:${LOCAL_API_PORT}`;

/**
 * Returns the appropriate API base URL for the backend itself.
 * Defaults to Vercel domain if NODE_ENV is 'production',
 * otherwise defaults to local API URL.
 * Can be overridden by a specific API_URL environment variable.
 */
export const getApiBaseUrl = (): string => {
  if (process.env.API_URL) {
    console.log(`[API Config] Backend using API_URL from environment: ${process.env.API_URL}`);
    return process.env.API_URL;
  }
  if (process.env.NODE_ENV === "production") {
    console.log(`[API Config] Backend running in production, using VERCEL_DOMAIN: ${VERCEL_DOMAIN}`);
    return VERCEL_DOMAIN;
  }
  console.log(`[API Config] Backend not in production (NODE_ENV: ${process.env.NODE_ENV}), using LOCAL_API_URL: ${LOCAL_API_URL}`);
  return LOCAL_API_URL;
};
