export const VERCEL_DOMAIN = "https://ai-escape-room-nedap.vercel.app";
export const LOCAL_API_PORT = "3001"; // Assuming this is the consistent local port
export const LOCAL_API_URL = `http://localhost:${LOCAL_API_PORT}`;

/**
 * Returns the appropriate API base URL.
 * Prefers REACT_APP_API_URL or API_URL environment variables if set.
 * Otherwise, defaults to VERCEL_DOMAIN.
 * LOCAL_API_URL would only be used if explicitly configured via an env var or different logic.
 */
export const getApiUrl = (): string => {
  if (process.env['REACT_APP_API_URL']) {
    // For debugging, you can uncomment the next line:
    console.log(`Using API URL from REACT_APP_API_URL: ${process.env['REACT_APP_API_URL']}`);
    return process.env['REACT_APP_API_URL'];
  }
  if (process.env['API_URL']) {
    // For debugging, you can uncomment the next line:
    console.log(`Using API URL from API_URL: ${process.env['API_URL']}`);
    return process.env['API_URL'];
  }
  
  // Default to VERCEL_DOMAIN if no environment variable override is found.
  return VERCEL_DOMAIN;
};
