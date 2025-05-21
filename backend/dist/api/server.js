"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/api/server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const apiConfig_1 = require("../constant/apiConfig");
// Import Routers
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const gameRoutes_1 = __importDefault(require("./routes/gameRoutes"));
// Import central user store if needed, or ensure it's correctly scoped within authController
// import { users } from '../auth/authController'; 
// Load environment variables
dotenv_1.default.config();
// JWT_SECRET should be managed in auth/jwtMiddleware.ts and auth/authController.ts
// const JWT_SECRET = process.env.JWT_SECRET || 'very-secure-and-long-secret'; 
// The User and UserGameSession interfaces and their stores (users, userActiveGames)
// have been moved or are expected to be within the new route/controller files.
// Ensure they are correctly scoped and managed there (e.g., user store in authController,
// game session store in gameRoutes or a dedicated game service).
// --- Express App Setup ---
const app = (0, express_1.default)();
const port = apiConfig_1.LOCAL_API_PORT;
// --- Global Request Logger Middleware (NEW) ---
app.use((req, res, next) => {
    console.log(`[Server] Incoming request: ${req.method} ${req.path}`);
    next();
});
// ----------------------------------------------
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// --- API Endpoints ---
// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log("API: Received health check request");
    res.status(200).json({ status: 'healthy', message: 'Backend server is running' });
});
// User Routes (handles /register, /login, /me, etc.)
// @ api/routes/userRoutes.ts
app.use('/api/users', userRoutes_1.default);
// Game Routes (all routes under /api/game/* will use jwtAuth middleware defined in gameRoutes)
// @ api/routes/gameRoutes.ts
app.use('/api/game', gameRoutes_1.default);
// General root 
app.get('/api', (req, res) => {
    res.json({ message: 'API is running on server' });
});
// --- Centralized Error Handling ---
app.use((err, req, res, next) => {
    console.error("API: Unhandled API Error", err.stack);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ error: 'An internal server error occurred.' });
});
// Start the server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`[API Server] Listening on http://localhost:${port}`);
        console.log(`[API Server] Configured base URL: ${(0, apiConfig_1.getApiBaseUrl)()}`);
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map