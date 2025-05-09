"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiBaseUrl = exports.LOCAL_API_URL = exports.LOCAL_API_PORT = exports.VERCEL_DOMAIN = void 0;
exports.VERCEL_DOMAIN = "https://ai-escape-room-nedap.vercel.app";
exports.LOCAL_API_PORT = process.env.API_PORT || "3001";
exports.LOCAL_API_URL = `http://localhost:${exports.LOCAL_API_PORT}`;
/**
 * Returns the appropriate API base URL.
 * Defaults to Vercel domain if NODE_ENV is 'production',
 * otherwise defaults to local API URL.
 * Can be overridden by a specific API_URL environment variable.
 */
const getApiBaseUrl = () => {
    if (process.env.API_URL) {
        return process.env.API_URL;
    }
    if (process.env.NODE_ENV === "production") {
        return exports.VERCEL_DOMAIN;
    }
    return exports.LOCAL_API_URL;
};
exports.getApiBaseUrl = getApiBaseUrl;
//# sourceMappingURL=apiConfig.js.map