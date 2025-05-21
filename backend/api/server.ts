// backend/api/server.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { LOCAL_API_PORT, getApiBaseUrl } from '../constant/apiConfig';

// Import Routers
import userRoutes from './routes/userRoutes';
import gameRoutes from './routes/gameRoutes';
// Import central user store if needed, or ensure it's correctly scoped within authController
// import { users } from '../auth/authController'; 

// Load environment variables
dotenv.config();

// JWT_SECRET should be managed in auth/jwtMiddleware.ts and auth/authController.ts
// const JWT_SECRET = process.env.JWT_SECRET || 'very-secure-and-long-secret'; 

// The User and UserGameSession interfaces and their stores (users, userActiveGames)
// have been moved or are expected to be within the new route/controller files.
// Ensure they are correctly scoped and managed there (e.g., user store in authController,
// game session store in gameRoutes or a dedicated game service).

// --- Express App Setup ---
const app: Application = express();
const port = LOCAL_API_PORT;

// --- Global Request Logger Middleware (NEW) ---
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[Server] Incoming request: ${req.method} ${req.path}`);
  next();
});
// ----------------------------------------------

app.use(cors()); 
app.use(bodyParser.json());

// --- API Endpoints ---

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    console.log("API: Received health check request");
    res.status(200).json({ status: 'healthy', message: 'Backend server is running' });
});

// User Routes (handles /register, /login, /me, etc.)
// @ api/routes/userRoutes.ts
app.use('/api/users', userRoutes);

// Game Routes (all routes under /api/game/* will use jwtAuth middleware defined in gameRoutes)
// @ api/routes/gameRoutes.ts
app.use('/api/game', gameRoutes);

// General root 
app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'API is running on server' });
});

// --- Centralized Error Handling ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
    console.log(`[API Server] Configured base URL: ${getApiBaseUrl()}`);
  });
}

export default app;
