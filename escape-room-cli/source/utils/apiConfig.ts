import dotenv from "dotenv";
dotenv.config();

export const VERCEL_DOMAIN = "https://ai-escape-room-sable.vercel.app";

// The environment variable the CLI will check for a custom API URL.
const LOCAL_API_URL = process.env['LOCAL_API_URL']; //http://localhost:3001


export const getApiUrl = (): string => {
  
  if (LOCAL_API_URL) {
    console.log(`Using API URL from environment variable ${process.env['LOCAL_API_URL']}: ${LOCAL_API_URL}`);
    return LOCAL_API_URL;
  }

  return VERCEL_DOMAIN;
};