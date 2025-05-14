"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiBaseUrl = exports.LOCAL_API_URL = exports.LOCAL_API_PORT = exports.VERCEL_DOMAIN = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.VERCEL_DOMAIN = "https://ai-escape-room-nedap.vercel.app";
exports.LOCAL_API_PORT = process.env.API_PORT || "3001";
exports.LOCAL_API_URL = `http://localhost:${exports.LOCAL_API_PORT}`;
/**
 * Returns the appropriate API base URL for the backend itself.
 * Defaults to Vercel domain if NODE_ENV is 'production',
 * otherwise defaults to local API URL.
 * Can be overridden by a specific API_URL environment variable.
 */
const getApiBaseUrl = () => {
    if (process.env.API_URL) {
        console.log(`[API Config] Backend using API_URL from environment: ${process.env.API_URL}`);
        return process.env.API_URL;
    }
    if (process.env.NODE_ENV === "production") {
        console.log(`[API Config] Backend running in production, using VERCEL_DOMAIN: ${exports.VERCEL_DOMAIN}`);
        return exports.VERCEL_DOMAIN;
    }
    console.log(`[API Config] Backend not in production (NODE_ENV: ${process.env.NODE_ENV}), using LOCAL_API_URL: ${exports.LOCAL_API_URL}`);
    return exports.LOCAL_API_URL;
};
exports.getApiBaseUrl = getApiBaseUrl;
//# sourceMappingURL=apiConfig.js.map