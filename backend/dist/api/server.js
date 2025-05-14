"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/api/server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken")); // Added for JWT
const objects_1 = require("../constant/objects"); // Adjust path as necessary
const RoomAgent_1 = require("../agents/RoomAgent");
const MultiRoomGame_1 = require("../agents/MultiRoomGame"); // Import MultiRoomGame
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const uuid_1 = require("uuid"); // For generating game IDs
const apiConfig_1 = require("../constant/apiConfig"); // Added import
// Load environment variables
dotenv_1.default.config();
// IMPORTANT: Store this in .env for production!
const JWT_SECRET = process.env.JWT_SECRET || 'very-secure-and-long-secret';
// In-memory user store (replace with DB in production)
const users = {};
const userActiveGames = {};
// REMOVED: Global game stores
// const activeMultiRoomGames: Record<string, MultiRoomGame> = {};
// const customSingleRoomAgents: Record<number, RoomAgent> = {};
// REMOVED: Global GameState interface and variable
// interface GameState {
// currentRoom: number | string;
// gameMode: 'default' | 'single-custom' | 'multi-custom';
// }
// let gameState: GameState = {
// currentRoom: 1,
// gameMode: 'default',
// };
// REMOVED: getCurrentRoomData function as game data will be accessed via userActiveGames
// function getCurrentRoomData(): RoomData | null { ... }
//--------------------------------------------------------------------------------------------->
// --- Initialize Room Agents (for default rooms from ROOM_OBJECTS) ---
// This can still exist if we want to support a global 'default' game mode outside user sessions,
// or it can be removed if 'default' games are also instantiated per user.
// For now, let's assume 'default' rooms are no longer a global shared state and must be initiated by a user.
// If a user wants to play a 'default' sequence, they'd get RoomAgents for ROOM_OBJECTS[id] under their session.
const defaultRoomAgents = {}; // Store template agents for default rooms
Object.keys(objects_1.ROOM_OBJECTS).forEach(key => {
    const id = parseInt(key, 10);
    defaultRoomAgents[id] = new RoomAgent_1.RoomAgent(id); // These are templates, not active games
});
//--------------------------------
// --- Express App Setup ---
const app = (0, express_1.default)();
// const port = process.env.API_PORT || 3001; // Use environment variable or default
const port = apiConfig_1.LOCAL_API_PORT; // Use constant
app.use((0, cors_1.default)()); // Enable CORS for all origins (adjust for production)
app.use(body_parser_1.default.json()); // Parse JSON request bodies
// Create a new Express Router for API endpoints
const apiRouter = express_1.default.Router();
// ---------- AUTHENTICATION MIDDLEWARE ------------------------------------------------------
const jwtAuthentication = (req, res, next) => {
    console.log("API: Authenticating token for userId", req.user?.id);
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || null; // Bearer TOKEN
    if (token == null)
        return res.sendStatus(401); // if no token, unauthorized
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.sendStatus(403); // if token is no longer valid
        }
        req.user = user; // Add user payload to request object
        next(); // proceed to the next middleware or route handler
    });
};
//----------------------------------------------------------------------------------------
// --- API Endpoints (now on apiRouter) ---
apiRouter.get('/', (req, res) => {
    res.json({ message: 'API is running on server' });
});
// GET /rooms - list available predefined rooms (e.g., for a 'default' mode selection)
apiRouter.get('/rooms', (req, res) => {
    const rooms = Object.entries(objects_1.ROOM_OBJECTS).map(([id, room]) => ({ id: parseInt(id, 10), name: room.name }));
    res.json({ rooms });
});
// GET /api/health - Health check endpoint for CLI connection
apiRouter.get('/health', (req, res) => {
    // logger.info("Received health check request");
    console.log("API: Received health check request");
    res.status(200).json({ status: 'healthy', message: 'Backend server is running' });
});
// POST /api/command - Process commands from CLI
apiRouter.post('/command', (async (req, res) => {
    // ---------------- jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    //----------------------------------------------------------------------------------------
    // ----------------------------------- process command -----------------------------------
    // logger.info("Received /api/command request", { body: req.body });
    console.log("API: Received /api/command request", { body: req.body });
    const { command } = req.body;
    console.log(`API: Received command: '${command}' for user: ${req.user?.id}`);
    if (!command) {
        return res.status(400).json({ response: 'Command is required.' });
    }
    const user = users[req.user?.id];
    if (!user) {
        return res.status(401).json({ response: 'User not found or not registered.' });
    }
    const userSession = userActiveGames[req.user?.id];
    if (!userSession) {
        return res.status(404).json({ response: 'No active game found for this user. Start a new game using /newgame.' });
    }
    const { gameInstance, gameMode } = userSession;
    // API key is now part of the gameInstance (passed during its creation)
    // const apiKey = user.apiKeys?.openai || user.apiKeys?.anthropic;
    // if (!apiKey && (gameMode === 'multi-custom' || gameMode === 'single-custom')) {
    // console.warn(`User ${req.user?.id} does not have a configured API key for potential generation.`);
    // return res.status(403).json(
    // { response: 'No API key configured for this user. Cannot process commands needing AI generation.' });
    // }
    try {
        console.log(`API: Routing command to ${gameMode} game ID: ${userSession.gameId} for user ${req.user?.id}`);
        // The gameInstance (RoomAgent or MultiRoomGame) handles its own API key usage internally
        const result = await gameInstance.process(command);
        // Update current room name/sequence in session for multi-room games
        if (gameInstance instanceof MultiRoomGame_1.MultiRoomGame) {
            userSession.currentRoomSequence = gameInstance.getCurrentRoomNumber();
            userSession.totalRooms = gameInstance.getTotalRooms();
            const currentRoomData = gameInstance.getCurrentRoom().getRoomData();
            userSession.currentRoomName = currentRoomData?.name || 'Unknown Room';
        }
        else if (gameInstance instanceof RoomAgent_1.RoomAgent) {
            // For single rooms, totalRooms is 1, sequence is 1
            userSession.currentRoomSequence = 1;
            userSession.totalRooms = 1;
            const roomData = gameInstance.getRoomData();
            userSession.currentRoomName = roomData?.name || 'Unknown Room';
        }
        res.json({ response: result.data?.message || result.response || 'Action processed.', data: result.data });
    }
    catch (error) {
        console.error(`Error processing command in ${gameMode} game ${userSession.gameId} for user ${req.user?.id}:`, error);
        res.status(500).json({ response: `Error processing command in ${gameMode} game.` });
    }
}));
//--------------------------------
// POST /api/newgame - Create a new escape room (single or multi)
apiRouter.post('/newgame', (async (req, res) => {
    // ---------------- jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    //----------------------------------------------------------------------------------------
    // ----------------------------------- process command -----------------------------------
    console.log("API: Received /api/newgame request for user", req.user?.id, { body: req.body });
    const { mode = 'single-room', roomCount, gameTheme } = req.body; // roomCount and gameTheme are new optional params
    if (!req.user) {
        return res.status(401).json({ success: false, error: "userId is required." });
    }
    const user = users[req.user.id];
    if (!user) {
        return res.status(401).json({ success: false, error: 'User not found or not registered.' });
    }
    const apiKey = user.apiKeys?.openai || user.apiKeys?.anthropic;
    if (!apiKey) {
        // For 'default' mode, an API key might not be strictly necessary if using pre-defined rooms.
        // However, custom games will always need it.
        if (mode === 'single-custom' || mode === 'multi-custom' || mode === 'single-room' || mode === 'multi-room') { // single-room and multi-room are aliases for custom
            return res.status(403).json({ success: false, error: 'User does not have a configured API key (OpenAI or Anthropic required for custom game generation).' });
        }
    }
    // --- Clean up previous game for this user if any ---
    if (userActiveGames[req.user.id]) {
        console.log(`API: Cleaning up previous game for user ${req.user.id}.`);
        // Potentially call a cleanup method on the gameInstance if it exists
        // e.g., userActiveGames[req.user.id].gameInstance.cleanup();
        delete userActiveGames[req.user.id];
    }
    //----------------------------------------------------------------------------------------
    let newGameSession = null;
    let initialRoomData = null;
    let responseGameName = 'Unknown Game';
    let responseGameBackground = 'An unknown challenge awaits...';
    let responseInitialRoomSequence = 1;
    let responseTotalRooms = 1;
    let actualGameMode = 'single-custom'; // Determine actual mode
    try {
        if (mode === 'single-room' || mode === 'single-custom') {
            actualGameMode = 'single-custom';
            console.log(`API: Creating ${actualGameMode} game for user ${req.user.id}...`);
            if (!apiKey)
                return res.status(403).json({ success: false, error: 'API key required for single-custom game.' });
            const agentIdNum = Date.now(); // Use timestamp for numeric ID for RoomAgent
            const agentIdStr = agentIdNum.toString(); // Keep a string version for session gameId
            const newRoomAgent = new RoomAgent_1.RoomAgent(agentIdNum, 1, 1);
            initialRoomData = await newRoomAgent.ensureRoomData(apiKey);
            if (!initialRoomData) {
                console.error(`API Error in /api/newgame (${actualGameMode}) for user ${req.user.id}: Failed to get room data.`);
                return res.status(500).json({ success: false, error: "Failed to create new game. Could not generate valid room data." });
            }
            newGameSession = {
                gameInstance: newRoomAgent,
                gameMode: actualGameMode,
                gameId: agentIdStr, // Store the string version (timestamp) in the session as gameId
                currentRoomName: initialRoomData.name,
                currentRoomSequence: 1,
                totalRooms: 1
            };
            responseGameName = initialRoomData.name;
            responseGameBackground = initialRoomData.background || 'A new adventure begins!';
            responseTotalRooms = 1;
        }
        else if (mode === 'multi-room' || mode === 'multi-custom') {
            actualGameMode = 'multi-custom';
            console.log(`API: Creating ${actualGameMode} game for user ${req.user.id} with ${roomCount || 'default'} rooms and theme '${gameTheme || 'general horror'}'...`);
            if (!apiKey)
                return res.status(403).json({ success: false, error: 'API key required for multi-custom game.' });
            const newGameId = (0, uuid_1.v4)();
            // Pass apiKey, roomCount to MultiRoomGame constructor
            const multiRoomGame = new MultiRoomGame_1.MultiRoomGame(newGameId, apiKey, roomCount); // REMOVED gameTheme
            await multiRoomGame.waitUntilReady(); // Ensure generation is complete
            const firstRoomAgent = multiRoomGame.getCurrentRoom();
            initialRoomData = firstRoomAgent.getRoomData();
            if (!initialRoomData) {
                console.error(`API Error in /api/newgame (${actualGameMode}) for user ${req.user.id}: Failed to initialize first room data.`);
                return res.status(500).json({ success: false, error: "Failed to create multi-room game. Could not initialize first room." });
            }
            newGameSession = {
                gameInstance: multiRoomGame,
                gameMode: actualGameMode,
                gameId: newGameId,
                currentRoomName: initialRoomData.name,
                currentRoomSequence: multiRoomGame.getCurrentRoomNumber(),
                totalRooms: multiRoomGame.getTotalRooms()
            };
            responseGameName = initialRoomData.name; // Or a general game name
            responseGameBackground = initialRoomData.background || 'A multi-room challenge unfolds!';
            responseInitialRoomSequence = multiRoomGame.getCurrentRoomNumber();
            responseTotalRooms = multiRoomGame.getTotalRooms();
        }
        else if (mode === 'default') {
            // This mode would allow playing through the predefined ROOM_OBJECTS
            // We need to decide how to manage state for this (e.g., current room in sequence)
            // For simplicity, let's make a 'default' game a single RoomAgent based on ROOM_OBJECTS[1]
            // Progression would need to be handled by creating new RoomAgent sessions for next rooms.
            // Or, a dedicated 'DefaultGameManager' could be introduced.
            // For now, let's instantiate the first default room.
            actualGameMode = 'default';
            console.log(`API: Creating ${actualGameMode} game (Room 1) for user ${req.user.id}...`);
            const defaultRoomId = 1; // Start with the first predefined room
            const templateAgent = defaultRoomAgents[defaultRoomId];
            if (!templateAgent) {
                console.error(`API Error in /api/newgame (default) for user ${req.user.id}: Default room agent for ID ${defaultRoomId} not found.`);
                return res.status(500).json({ success: false, error: "Failed to create default game. Room template not found." });
            }
            // Create a new instance for the user session, even for default rooms
            // The RoomAgent for default rooms doesn't need an API key for its predefined content.
            const userDefaultRoomAgent = new RoomAgent_1.RoomAgent(defaultRoomId); // It will load from ROOM_OBJECTS
            initialRoomData = userDefaultRoomAgent.getRoomData(); // Should be immediately available
            if (!initialRoomData) {
                console.error(`API Error in /api/newgame (default) for user ${req.user.id}: Failed to load data for default room ${defaultRoomId}.`);
                return res.status(500).json({ success: false, error: "Failed to create default game. Could not load room data." });
            }
            newGameSession = {
                gameInstance: userDefaultRoomAgent,
                gameMode: actualGameMode,
                gameId: defaultRoomId, // Use the room number as gameId for default mode
                currentRoomName: initialRoomData.name,
                currentRoomSequence: 1, // Assuming it's the first in a potential sequence
                totalRooms: Object.keys(objects_1.ROOM_OBJECTS).length // Total predefined rooms
            };
            responseGameName = initialRoomData.name;
            responseGameBackground = initialRoomData.background || 'A classic challenge.';
            responseTotalRooms = Object.keys(objects_1.ROOM_OBJECTS).length;
        }
        else {
            console.error(`API: Invalid mode specified in /api/newgame: ${mode} for user ${req.user.id}`);
            return res.status(400).json({ success: false, error: "Invalid game mode specified. Use 'single-room', 'multi-room', or 'default'." });
        }
        if (newGameSession && initialRoomData) {
            userActiveGames[req.user.id] = newGameSession;
            console.log(`API: New game created successfully for user ${req.user.id}. Mode: [${actualGameMode}] - GameID: [${newGameSession.gameId}]`);
            res.json({
                success: true,
                message: `New ${actualGameMode} game started. You're in room ${responseInitialRoomSequence}: ${responseGameName}.`,
                game: {
                    id: newGameSession.gameId,
                    name: responseGameName,
                    background: responseGameBackground,
                    currentRoom: responseInitialRoomSequence,
                    currentRoomName: newGameSession.currentRoomName,
                    objectCount: initialRoomData.objects ? (Array.isArray(initialRoomData.objects) ? initialRoomData.objects.length : Object.keys(initialRoomData.objects).length) : 0,
                    mode: actualGameMode, // Return the determined actualGameMode
                    totalRooms: responseTotalRooms
                }
            });
        }
        else {
            // Should not happen if logic is correct, but as a fallback
            throw new Error("Game session or initial room data was not properly initialized.");
        }
    }
    catch (error) {
        console.error(`API: Error in /api/newgame for user ${req.user.id}, mode ${mode}:`, error);
        // Ensure no partial game state for the user if an error occurred
        delete userActiveGames[req.user.id];
        res.status(500).json({
            success: false,
            error: "Failed to create new game. An internal error occurred.",
            details: error instanceof Error ? error.message : String(error)
        });
    }
}));
//---------------------------------------------------------------------------------------------------------
// GET /game/state - Get current game state for a user
apiRouter.get('/game/state', (async (req, res) => {
    // jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    // process command -----------------------------------
    if (!req.user)
        return res.sendStatus(401);
    const userId = req.user.id;
    console.log(`API: Received /game/state request for user ${userId}`);
    const userSession = userActiveGames[userId];
    if (!userSession) {
        return res.status(404).json({ error: "No active game found for this user." });
    }
    const { gameInstance, gameMode, gameId, currentRoomName, currentRoomSequence, totalRooms } = userSession;
    let roomDataForDisplay = null;
    let displayRoomName = currentRoomName || 'Loading...';
    let displayRoomSequence = currentRoomSequence || 1;
    let displayTotalRooms = totalRooms || 1;
    try {
        if (gameInstance instanceof MultiRoomGame_1.MultiRoomGame) {
            roomDataForDisplay = gameInstance.getCurrentRoom().getRoomData();
            displayRoomName = roomDataForDisplay?.name || displayRoomName;
            displayRoomSequence = gameInstance.getCurrentRoomNumber();
            displayTotalRooms = gameInstance.getTotalRooms();
            // Update session details (could also be done more proactively after commands)
            userSession.currentRoomName = displayRoomName;
            userSession.currentRoomSequence = displayRoomSequence;
            userSession.totalRooms = displayTotalRooms;
        }
        else if (gameInstance instanceof RoomAgent_1.RoomAgent) {
            roomDataForDisplay = gameInstance.getRoomData();
            displayRoomName = roomDataForDisplay?.name || displayRoomName;
            // For single/default rooms, sequence and total might be simpler
            if (gameMode === 'default' || gameMode === 'single-custom') {
                displayRoomSequence = 1; // Or a specific sequence if default mode handles progression
                displayTotalRooms = (gameMode === 'default') ? Object.keys(objects_1.ROOM_OBJECTS).length : 1;
            }
        }
        res.json({
            gameId: gameId,
            currentRoom: displayRoomSequence,
            currentRoomName: displayRoomName,
            totalRooms: displayTotalRooms,
            gameMode: gameMode,
            // Optionally, include more details from roomDataForDisplay if needed by CLI
            // background: roomDataForDisplay?.background,
            // objects: roomDataForDisplay?.objects?.map(o => o.name) 
        });
    }
    catch (error) {
        console.error(`API Error in /game/state for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to get game state." });
    }
}));
//---------------------------------------------------------------------------------------------------------
// GET /room/objects - List objects in the current room for a user
apiRouter.get('/room/objects', (async (req, res) => {
    // jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    // process command -----------------------------------
    if (!req.user)
        return res.sendStatus(401);
    const userId = req.user.id;
    console.log(`API: Received /room/objects request for user ${userId}`);
    const userSession = userActiveGames[userId];
    if (!userSession) {
        return res.status(404).json({ error: "No active game found for this user." });
    }
    const { gameInstance } = userSession;
    try {
        // Using '/look' command ensures any dynamic object generation happens
        const result = await gameInstance.process('/look');
        const roomName = result.data?.room?.name || (gameInstance instanceof RoomAgent_1.RoomAgent ? gameInstance.getRoomData()?.name : gameInstance.getCurrentRoom().getRoomData()?.name) || 'Unknown Room';
        const objectNames = result.data?.objects || [];
        res.json({ roomName: roomName, objects: objectNames });
    }
    catch (error) {
        console.error(`API Error in /room/objects for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to get room objects." });
    }
}));
//---------------------------------------------------------------------------------------------------------
// GET /object/:object_name
// Get details of a specific object for a user
apiRouter.get('/object/:object_name', (async (req, res) => {
    // jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    // ----------------------------------- process command -----------------------------------
    if (!req.user)
        return res.sendStatus(401);
    const userId = req.user.id;
    const objectNameParam = req.params.object_name;
    console.log(`API: Received /object/${objectNameParam} request for user ${userId}`);
    const userSession = userActiveGames[userId];
    if (!userSession) {
        return res.status(404).json({ error: "No active game found for this user." });
    }
    const { gameInstance } = userSession;
    try {
        const command = `/inspect ${objectNameParam}`;
        const result = await gameInstance.process(command);
        if (result.data?.object) {
            res.status(200).json(result.data.object); // Return name, description, details
        }
        else {
            res.status(404).json({ error: result.data?.message || `Object '${objectNameParam}' not found.` });
        }
    }
    catch (error) {
        console.error(`API Error in /object/${objectNameParam} for user ${userId}:`, error);
        res.status(500).json({ error: `Failed to get object details.` });
    }
}));
//---------------------------------------------------------------------------------------------------------
// POST /room/unlock
// Unlock a room for a user
apiRouter.post('/room/unlock', (async (req, res) => {
    // jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    // process command -----------------------------------
    if (!req.user)
        return res.sendStatus(401);
    const userId = req.user.id;
    const { password_guess } = req.body;
    console.log(`API: Received /room/unlock request for user ${userId}`);
    if (typeof password_guess !== 'string') {
        return res.status(400).json({ error: 'Password guess must be a string.' });
    }
    const user = users[userId];
    if (!user) {
        return res.status(401).json({ error: 'User not found or not registered.' });
    }
    const userSession = userActiveGames[userId];
    if (!userSession) {
        return res.status(404).json({ error: "No active game found for this user." });
    }
    const { gameInstance, gameMode } = userSession;
    try {
        const command = `/guess ${password_guess}`;
        const result = await gameInstance.process(command);
        let responseData = {
            unlocked: result.data?.unlocked || false,
            finished: result.data?.gameCompleted || false,
            message: result.data?.message || "Guess processed.",
            nextRoom: result.data?.nextRoom,
            currentRoomName: userSession.currentRoomName,
            currentRoom: userSession.currentRoomSequence,
            totalRooms: userSession.totalRooms
        };
        if (responseData.finished) {
            console.log(`API: Game finished for user ${userId}. Cleaning up session.`);
            delete userActiveGames[userId];
        }
        else if (responseData.unlocked) {
            if (gameInstance instanceof MultiRoomGame_1.MultiRoomGame) {
                userSession.currentRoomSequence = gameInstance.getCurrentRoomNumber();
                userSession.totalRooms = gameInstance.getTotalRooms();
                const currentRoomData = gameInstance.getCurrentRoom().getRoomData();
                userSession.currentRoomName = currentRoomData?.name || 'Unknown Room';
                responseData.currentRoomName = userSession.currentRoomName;
                responseData.currentRoom = userSession.currentRoomSequence;
                responseData.totalRooms = userSession.totalRooms;
            }
            else if (gameMode === 'default' && result.data?.nextRoom?.id) {
                const nextDefaultRoomId = result.data.nextRoom.id;
                const templateAgent = defaultRoomAgents[nextDefaultRoomId];
                if (templateAgent) {
                    const nextDefaultRoomAgent = new RoomAgent_1.RoomAgent(nextDefaultRoomId);
                    const nextRoomData = nextDefaultRoomAgent.getRoomData();
                    userActiveGames[userId] = {
                        gameInstance: nextDefaultRoomAgent,
                        gameMode: 'default',
                        gameId: nextDefaultRoomId,
                        currentRoomName: nextRoomData?.name || 'Next Room',
                        currentRoomSequence: userSession.currentRoomSequence ? userSession.currentRoomSequence + 1 : nextDefaultRoomId,
                        totalRooms: Object.keys(objects_1.ROOM_OBJECTS).length
                    };
                    console.log(`API: User ${userId} progressing to default room ${nextDefaultRoomId}`);
                    responseData.currentRoomName = nextRoomData?.name;
                    responseData.currentRoom = userActiveGames[userId].currentRoomSequence;
                }
                else {
                    console.log(`API: User ${userId} finished all default rooms.`);
                    responseData.finished = true;
                    delete userActiveGames[userId];
                }
            }
        }
        res.status(200).json(responseData);
    }
    catch (error) {
        console.error(`API Error in /room/unlock for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to process unlock attempt." });
    }
}));
//---------------------------------------------------------------------------------------------------------
// POST /users/register
// Register a new user
apiRouter.post('/users/register', ((req, res) => {
    const { name, email, apiKey, provider = 'openai' } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    const userId = (0, uuid_1.v4)();
    const newUser = {
        id: userId,
        name,
        email,
        apiKeys: apiKey ? { [provider]: apiKey } : undefined,
        registeredAt: new Date().toISOString()
    };
    users[userId] = newUser;
    const accessToken = jsonwebtoken_1.default.sign({ id: userId, name: name }, JWT_SECRET, { expiresIn: '24h' });
    console.log(`API: User registered: ${name} (${userId})`);
    res.json({
        userId,
        name: newUser.name,
        email: newUser.email,
        token: accessToken
    });
}));
//---------------------------------------------------------------------------------------------------------
// POST /users/login
// Login a user
apiRouter.post('/users/login', ((req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'userId is required for login.' });
    }
    const user = users[userId];
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }
    const accessToken = jsonwebtoken_1.default.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    console.log(`API: User logged in: ${user.name} (${user.id})`);
    res.json({
        userId: user.id,
        name: user.name,
        email: user.email,
        token: accessToken
    });
}));
// GET /users/me
// Get user's own details (excluding API keys)
apiRouter.get('/users/me', (async (req, res) => {
    // jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    // process command -----------------------------------
    if (!req.user)
        return res.sendStatus(401);
    const user = users[req.user.id];
    if (!user)
        return res.sendStatus(404);
    const { apiKeys, ...userData } = user; // Exclude API keys
    res.json(userData);
}));
//---------------------------------------------------------------------------------------------------------
// POST /users/auth
// Authenticate user by userId
apiRouter.post('/users/auth', (async (req, res) => {
    // jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    // process command -----------------------------------
    const { userId } = req.body;
    if (!userId || !users[userId]) {
        return res.status(401).json({ error: 'User not found' });
    }
    const { apiKeys, ...userData } = users[userId];
    console.log(`API: User authenticated: ${userData.name} (${userId})`);
    res.json({
        authenticated: true,
        user: userData
    });
}));
//---------------------------------------------------------------------------------------------------------
// POST /users/get-api-key
// Get user's API key
apiRouter.post('/users/get-api-key', (async (req, res) => {
    const { userId, provider = 'openai' } = req.body;
    if (!userId || !users[userId]) {
        return res.status(401).json({ error: 'User not found' });
    }
    const user = users[userId];
    const apiKeyVal = user.apiKeys?.[provider]; // Renamed to avoid conflict with imported apiKey
    if (!apiKeyVal) {
        return res.status(404).json({ error: `No API key found for provider: ${provider}` });
    }
    console.log(`API: API key retrieved for user: ${user.name} (${userId}), provider: ${provider}`);
    res.json({
        apiKey: apiKeyVal,
        provider
    });
}));
//---------------------------------------------------------------------------------------------------------
// POST /chat
// Chat with the AI through own API Key
apiRouter.post('/chat', (async (req, res) => {
    // jwt authentication before processing command --------------------------
    jwtAuthentication(req, res, () => {
    });
    // ----------------------------------- process command -----------------------------------
    if (!req.user?.id)
        return res.sendStatus(401);
    const chatUserId = req.user.id;
    const { message, model } = req.body;
    const user = users[chatUserId];
    if (!user) {
        return res.status(401).json({ error: "User for chat not found." });
    }
    const userApiKey = user.apiKeys?.openai || user.apiKeys?.anthropic;
    if (!userApiKey) {
        return res.status(403).json({ error: "User API key not configured for chat." });
    }
    const userSession = userActiveGames[chatUserId];
    let roomContext = "AI assistant in an escape room game.";
    let objectsContext = "No game active or objects loaded.";
    if (userSession) {
        const { gameInstance } = userSession;
        let currentRoomData = null;
        if (gameInstance instanceof MultiRoomGame_1.MultiRoomGame) {
            currentRoomData = gameInstance.getCurrentRoom().getRoomData();
        }
        else if (gameInstance instanceof RoomAgent_1.RoomAgent) {
            currentRoomData = gameInstance.getRoomData();
        }
        if (currentRoomData) {
            roomContext = `In ${currentRoomData.name}. ${currentRoomData.background || ''}`;
            objectsContext = currentRoomData.objects ?
                (Array.isArray(currentRoomData.objects) ? currentRoomData.objects : Object.values(currentRoomData.objects))
                    .map(o => `${o.name}: ${o.description}`).join('\n')
                : 'No objects in this room.';
        }
    }
    try {
        let responseText;
        const model_specs = {
            'gpt-4o': { max_completion_tokens: 4098 }, 'gpt-4o-mini': { max_completion_tokens: 1024 },
            'gpt-4.1': { max_completion_tokens: 4098 }, 'claude-3-opus-20240229': { max_tokens: 4096 },
            'claude-3-sonnet-20240229': { max_tokens: 4096 }, 'claude-3-haiku-20240307': { max_tokens: 4096 },
            'claude-2.1': { max_tokens: 4000 },
        };
        const currentModelSpec = model_specs[model] || { max_completion_tokens: 1024, max_tokens: 1024 };
        const systemContent = `You are an AI assistant in an escape room. Current room: ${roomContext} Objects: ${objectsContext}`;
        if (model.startsWith('gpt') || model.includes('gpt') || model.startsWith('oai')) {
            const openai = new openai_1.default({ apiKey: userApiKey });
            const completion = await openai.chat.completions.create({
                model, messages: [{ role: "system", content: systemContent }, { role: "user", content: message }],
                max_tokens: currentModelSpec.max_completion_tokens
            });
            responseText = completion.choices[0].message.content;
        }
        else if (model.startsWith('claude')) {
            const Anthropic = require('@anthropic-ai/sdk').default;
            const anthropic = new Anthropic({ apiKey: userApiKey });
            const anthropicResponse = await anthropic.messages.create({
                model, max_tokens: currentModelSpec.max_tokens, system: systemContent,
                messages: [{ role: "user", content: message }]
            });
            responseText = Array.isArray(anthropicResponse.content) ?
                anthropicResponse.content.map(b => b.type === 'text' ? b.text : '').join('') :
                anthropicResponse.content.text;
        }
        else {
            return res.status(400).json({ error: `Unsupported model: ${model}` });
        }
        res.json({ response: responseText });
    }
    catch (error) {
        res.status(500).json({ error: 'Chat request failed.', details: error instanceof Error ? error.message : String(error) });
    }
}));
//---------------------------------------------------------------------------------------------------------
//TESTING POST --------------------------------------------------------------------------------------------
apiRouter.post('/users/test-post', (req, res) => {
    console.log("API: Accessed /users/test-post successfully!", { body: req.body });
    res.status(200).json({ message: 'POST test to /users/test-post successful', receivedBody: req.body });
});
//---------------------------------------------------------------------------------------------------------
app.use('/api', apiRouter);
app.use((err, req, res, next) => {
    console.error("API: Unhandled API Error", err);
    res.status(500).json({ error: 'An internal server error occurred.' });
});
// Start the server only if this script is run directly (e.g., for local development)
// For Vercel, the runtime will import 'app' and handle listening.
if (require.main === module) {
    app.listen(port, () => {
        console.log(`[API Server] Listening on http://localhost:${port}`);
        console.log(`[API Server] Configured base URL: ${(0, apiConfig_1.getApiBaseUrl)()}`);
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map