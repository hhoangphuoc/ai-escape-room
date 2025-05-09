"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/api/server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const objects_1 = require("../constant/objects"); // Adjust path as necessary
const RoomAgent_1 = require("../agents/RoomAgent");
const MultiRoomGame_1 = require("../agents/MultiRoomGame"); // Import MultiRoomGame
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const uuid_1 = require("uuid"); // For generating game IDs
// Load environment variables
dotenv_1.default.config();
// In-memory user store (replace with DB in production)
const users = {};
//-------------------------------- GAME DATA & STATE --------------------------------
// Store for active multi-room games
const activeMultiRoomGames = {};
// Store for single custom rooms generated via /api/newgame?mode=single-room
// We still need the agents object for pre-defined rooms from ROOM_OBJECTS
const customSingleRoomAgents = {};
// --- Game State (In-Memory) ---
let gameState = {
    currentRoom: 1, // Start with default room 1
    gameMode: 'default',
};
function getCurrentRoomData() {
    if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
        const game = activeMultiRoomGames[gameState.currentRoom];
        if (game) {
            const currentRoomAgent = game.getCurrentRoom();
            // Use the agent's public getter
            return currentRoomAgent.getRoomData();
        }
        else {
            console.warn(`Multi-room game with ID ${gameState.currentRoom} not found.`);
            return null;
        }
    }
    else if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
        const agent = customSingleRoomAgents[gameState.currentRoom];
        if (agent) {
            // Use the agent's public getter
            return agent.getRoomData();
        }
        else {
            console.warn(`Custom single room agent with ID ${gameState.currentRoom} not found.`);
            return null;
        }
    }
    else if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
        // Original logic for default rooms
        const validRoomId = gameState.currentRoom in objects_1.ROOM_OBJECTS ? gameState.currentRoom : 1;
        if (!(gameState.currentRoom in objects_1.ROOM_OBJECTS)) {
            console.warn(`Invalid default room ID: ${gameState.currentRoom}. Defaulting to room 1.`);
            gameState.currentRoom = 1; // Reset to default if invalid
        }
        return objects_1.ROOM_OBJECTS[validRoomId];
    }
    else {
        console.error('Invalid game state:', gameState);
        return null;
    }
}
//---------------------------------------------------------------------------------------------
// --- Initialize Room Agents (for default rooms) ---
const agents = {}; // Keep this for default rooms
Object.keys(objects_1.ROOM_OBJECTS).forEach(key => {
    const id = parseInt(key, 10);
    // Pass null for sequence/totalRooms for default agents if constructor allows
    agents[id] = new RoomAgent_1.RoomAgent(id);
});
//--------------------------------
// --- Express App Setup ---
const app = (0, express_1.default)();
const port = process.env.API_PORT || 3001; // Use environment variable or default
app.use((0, cors_1.default)()); // Enable CORS for all origins (adjust for production)
app.use(body_parser_1.default.json()); // Parse JSON request bodies
// --- API Endpoints ---
// GET /rooms - list available rooms
app.get('/api/rooms', (req, res) => {
    const rooms = Object.entries(objects_1.ROOM_OBJECTS).map(([id, room]) => ({ id: parseInt(id, 10), name: room.name }));
    res.json({ rooms });
});
// POST /rooms/:id/command - send a command to a room agent
app.post('/api/rooms/:id/command', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const agent = agents[id];
    if (!agent) {
        res.status(404).json({ error: 'Room not found' });
        return;
    }
    const { input } = req.body;
    if (typeof input !== 'string') {
        res.status(400).json({ error: 'Input must be a string' });
        return;
    }
    try {
        const result = await agent.process(input);
        res.json(result);
    }
    catch (err) {
        console.error('RoomAgent error:', err);
        res.status(500).json({ response: 'Internal error processing command.' });
    }
});
// GET /api/health - Health check endpoint for CLI connection
app.get('/api/health', (req, res) => {
    console.log("API: Received health check request");
    res.status(200).json({ status: 'healthy', message: 'Backend server is running' });
});
// POST /api/command - Process commands from CLI
app.post('/api/command', (async (req, res) => {
    console.log("API: Received /api/command request");
    const { command, userId } = req.body;
    console.log(`API: Received command: '${command}' for user: ${userId}`);
    if (!command || !userId) {
        res.status(400).json({ response: 'Command and userId are required.' });
        return;
    }
    // --- Validate User and Get API Key ---
    const user = users[userId];
    if (!user) {
        return res.status(401).json({ response: 'User not found or not registered.' });
    }
    // Determine which API key to use (e.g., prefer OpenAI)
    const apiKey = user.apiKeys?.openai || user.apiKeys?.anthropic;
    if (!apiKey && (gameState.gameMode === 'multi-custom' || gameState.gameMode === 'single-custom')) {
        // Only require API key if it might be needed for generation
        console.warn(`User ${userId} does not have a configured API key for potential generation.`);
        return res.status(403).json({ response: 'No API key configured for this user. Cannot process commands needing AI generation.' });
    }
    // -------------------------------------
    // --- Route command if in multi-room game ---
    if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
        const game = activeMultiRoomGames[gameState.currentRoom];
        if (game) {
            try {
                console.log(`API: Routing command to MultiRoomGame ID: ${gameState.currentRoom}`);
                // Pass the retrieved apiKey to game.process
                // Note: MultiRoomGame.process now internally uses its stored key, so no need to pass here.
                // const result: RoomCommandResponse = await game.process(command, apiKey);
                const result = await game.process(command);
                res.json({ response: result.data?.message || result.response || 'Action processed.' });
            }
            catch (error) {
                // ... error handling ...
                console.error(`Error processing command in MultiRoomGame ${gameState.currentRoom}:`, error);
                res.status(500).json({ response: "Error processing command in multi-room game." });
            }
            return;
        }
        else {
            // ... error handling ...
            console.error(`Multi-room game ${gameState.currentRoom} not found, but gameState indicates multi-custom mode.`);
            gameState = { currentRoom: 1, gameMode: 'default' };
            res.status(500).json({ response: "Error: Active multi-room game not found. Resetting game state." });
            return;
        }
    }
    // ---------------------------------------------
    // --- Process command for default or single-custom game ---
    const normalizedCommand = command.trim().toLowerCase();
    let responseText = ''; // Renamed from 'response' to avoid conflict with Response type
    try {
        const room = getCurrentRoomData();
        if (!room) {
            responseText = "Error: Could not load current room data. Try starting a new game.";
            res.status(500).json({ response: responseText });
            return;
        }
        // --- Handle commands that might require the agent's process method ---
        if (['/look', '/seek', '/hint'].includes(normalizedCommand) ||
            normalizedCommand.startsWith('/inspect ') ||
            normalizedCommand.startsWith('/analyse ') ||
            (normalizedCommand.startsWith('/guess ') && gameState.gameMode === 'single-custom') ||
            (normalizedCommand.startsWith('/password ') && gameState.gameMode === 'single-custom')) {
            let agent;
            if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
                agent = customSingleRoomAgents[gameState.currentRoom];
            }
            else if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
                agent = agents[gameState.currentRoom]; // Use default agent
            }
            if (agent) {
                // Pass apiKey to agent.process
                const result = await agent.process(command, apiKey);
                responseText = result.data?.message || result.response || 'Command processed by agent.';
            }
            else {
                responseText = "Error: Could not find the appropriate game agent.";
                res.status(404).json({ response: responseText });
                return;
            }
            // --- Handle commands processed directly by the server --- 
        }
        else if (normalizedCommand === '/help') {
            // ... help text generation ...
            responseText = 'Available commands:\n' + // Simplified help
                '/help - Shows this help message\n' +
                '/look - Lists objects\n' +
                '/inspect [object] - Examine an object\n' +
                '/guess [password] - Submit a password\n' +
                '/hint - Get a hint\n' +
                '/newgame [single-room|multi-room] - Starts a new game';
        }
        else if (normalizedCommand.startsWith('/guess ') || normalizedCommand.startsWith('/password ')) {
            // This block now *only* handles the default game mode password check
            // Multi-room is handled above, single-custom is handled by agent.process call
            if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
                const passwordGuess = normalizedCommand.startsWith('/password ')
                    ? normalizedCommand.substring('/password '.length).trim()
                    : normalizedCommand.substring('/guess '.length).trim();
                if (passwordGuess === room.password) {
                    // ... default room progression logic ...
                    let message = `Correct! Unlocked '${room.name}'.`;
                    const nextRoomId = gameState.currentRoom + 1;
                    if (objects_1.ROOM_OBJECTS[nextRoomId]) {
                        gameState.currentRoom = nextRoomId;
                        const nextRoom = getCurrentRoomData();
                        message += `\n\nMoving to room ${nextRoomId}: ${nextRoom?.name || 'Unknown Room'}.`;
                    }
                    else {
                        message += `\n\nCongratulations! You've escaped all default rooms!`;
                    }
                    responseText = message;
                }
                else {
                    responseText = `Wrong password. Try again.`;
                }
            }
            else {
                // Should have been handled by agent.process if single-custom
                responseText = "Password command not applicable in current state.";
            }
        }
        else if (normalizedCommand.startsWith('/newgame')) {
            responseText = "Use the dedicated /newgame endpoint via POST request with { mode: '...', userId: '...' }.";
        }
        else {
            responseText = `Unknown command: ${command}. Type /help.`;
        }
    }
    catch (error) {
        console.error("Error processing command in /api/command:", error);
        responseText = "Error: Failed to process command.";
        res.status(500).json({ response: responseText });
        return;
    }
    res.json({ response: responseText });
}));
// POST /api/newgame - Create a new escape room (single or multi)
app.post('/api/newgame', (async (req, res) => {
    console.log("API: Received /api/newgame request");
    const { mode = 'single-room', userId } = req.body;
    if (!userId) {
        return res.status(400).json({ success: false, error: "userId is required." });
    }
    // --- Validate User and Get API Key ---
    const user = users[userId];
    if (!user) {
        return res.status(401).json({ success: false, error: 'User not found or not registered.' });
    }
    const apiKey = user.apiKeys?.openai || user.apiKeys?.anthropic;
    if (!apiKey) {
        return res.status(403).json({ success: false, error: 'User does not have a configured API key (OpenAI or Anthropic required for game generation).' });
    }
    // -------------------------------------
    let gameId = null;
    try {
        let roomData = null;
        let gameName = 'Unknown Game';
        let gameBackground = 'An unknown challenge awaits...';
        let initialRoomSequence = 1;
        // --- Cleanup previous custom games ---
        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            delete activeMultiRoomGames[gameState.currentRoom];
        }
        else if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
            delete customSingleRoomAgents[gameState.currentRoom];
        }
        gameState = { currentRoom: 1, gameMode: 'default' };
        // --------------------------------------------------------------------------------------------
        //                                      SINGLE-ROOM MODE
        // --------------------------------------------------------------------------------------------
        if (mode === 'single-room') {
            console.log("API: Creating single-room game...");
            const agentId = Date.now();
            gameId = agentId;
            const newRoomAgent = new RoomAgent_1.RoomAgent(agentId);
            // Lazy approach to only parse `apiKey` when needed
            roomData = await newRoomAgent.ensureRoomData(apiKey);
            if (!roomData) {
                // ... error handling ...
                console.error("API Error in /api/newgame (single-room): Failed to get room data from new agent.");
                return res.status(500).json({ success: false, error: "Failed to create new game. Could not generate valid room data." });
            }
            customSingleRoomAgents[agentId] = newRoomAgent;
            gameState = { currentRoom: agentId, gameMode: 'single-custom' };
            gameName = roomData.name;
            gameBackground = roomData.background;
            initialRoomSequence = roomData.sequence || 1;
            // --------------------------------------------------------------------------------------------
            //                                      MULTI-ROOM MODE
            // --------------------------------------------------------------------------------------------
        }
        else if (mode === 'multi-room') {
            console.log("API: Creating multi-room game...");
            const newGameId = (0, uuid_1.v4)();
            gameId = newGameId;
            // Pass apiKey to MultiRoomGame constructor
            const multiRoomGame = new MultiRoomGame_1.MultiRoomGame(newGameId, apiKey);
            activeMultiRoomGames[newGameId] = multiRoomGame;
            await multiRoomGame.waitUntilReady();
            const firstRoomAgent = multiRoomGame.getCurrentRoom();
            // getRoomData doesn't need key, data is loaded/generated during init
            roomData = firstRoomAgent.getRoomData();
            if (!roomData) {
                // ... error handling ...
                console.error("API Error in /api/newgame (multi-room): Failed to initialize first room data.");
                delete activeMultiRoomGames[newGameId];
                return res.status(500).json({ success: false, error: "Failed to create multi-room game. Could not initialize first room." });
            }
            gameState = { currentRoom: newGameId, gameMode: 'multi-custom' };
            gameName = roomData.name;
            gameBackground = roomData.background;
            initialRoomSequence = 1;
        }
        else {
            // ... invalid mode error handling ...
            console.error(`API Error in /api/newgame: Invalid mode specified: ${mode} - Use 'single-room' or 'multi-room'.`);
            return res.status(400).json({ success: false, error: "Invalid game mode specified. Use 'single-room' or 'multi-room'." });
        }
        // ... Success response generation (keep existing) ...
        console.log(`API: New game created successfully. 
                        \nMode: [${mode}], 
                        \nName: [${gameName}], 
                        \nID: [${gameId}]
                    `);
        console.log(`Room Details: 
                        \n${JSON.stringify(roomData)}`);
        res.json({
            success: true,
            message: `New ${mode} game started. You're in room ${initialRoomSequence}: ${gameName}.`,
            game: {
                id: gameId,
                name: gameName,
                background: gameBackground,
                currentRoom: initialRoomSequence,
                objectCount: roomData?.objects ? (Array.isArray(roomData.objects) ? roomData.objects.length : Object.keys(roomData.objects).length) : 0,
                mode: mode,
                totalRooms: mode === 'multi-room' ? activeMultiRoomGames[gameId]?.getTotalRooms() : 1
            }
        });
    }
    catch (error) {
        // ... Catch block (keep existing cleanup) ...
        console.error(`API Error in /api/newgame (Mode: ${mode}, ID: ${gameId}):`, error);
        if (mode === 'single-room' && typeof gameId === 'number' && customSingleRoomAgents[gameId]) {
            delete customSingleRoomAgents[gameId];
        }
        else if (mode === 'multi-room' && typeof gameId === 'string' && activeMultiRoomGames[gameId]) {
            delete activeMultiRoomGames[gameId];
        }
        gameState = { currentRoom: 1, gameMode: 'default' };
        res.status(500).json({
            success: false,
            error: "Failed to create new game. An internal error occurred.",
            details: error instanceof Error ? error.message : String(error)
        });
    }
}));
// GET /game/state - Get current game state
app.get('/game/state', (req, res) => {
    console.log("API: Received /game/state request");
    try {
        let roomName = 'Unknown Room';
        let currentRoomDisplay = gameState.currentRoom;
        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            const game = activeMultiRoomGames[gameState.currentRoom];
            if (game) {
                const room = game.getCurrentRoom().getRoomData();
                roomName = room?.name || 'Loading...';
                currentRoomDisplay = `Room ${game.getCurrentRoomNumber()} of ${game.getTotalRooms()}`;
            }
            else {
                roomName = "Error: Game not found";
            }
        }
        else {
            const room = getCurrentRoomData();
            roomName = room?.name || 'Error: Room not found';
        }
        res.json({ currentRoom: currentRoomDisplay, roomName: roomName, gameMode: gameState.gameMode });
    }
    catch (error) {
        console.error("API Error in /game/state:", error);
        res.status(500).json({ error: "Failed to get game state." });
    }
});
// GET /room/objects - List objects in the current room
app.get('/room/objects', async (req, res) => {
    console.log("API: Received /room/objects request");
    try {
        let roomName = 'Unknown Room';
        let objectNames = [];
        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            const game = activeMultiRoomGames[gameState.currentRoom];
            if (game) {
                // Use process method for consistency? Or get data directly?
                // Let's use process('/look') to potentially trigger generation
                const result = await game.process('/look');
                roomName = result.data?.room?.name || game.getCurrentRoom().getRoomData()?.name || 'Loading...';
                objectNames = result.data?.objects || [];
            }
            else {
                roomName = "Error: Game not found";
            }
        }
        else {
            // For default or single-custom
            const agent = (gameState.gameMode === 'single-custom')
                ? customSingleRoomAgents[gameState.currentRoom]
                : agents[gameState.currentRoom]; // Default agents
            if (agent) {
                const result = await agent.process('/look'); // Use agent process
                roomName = result.data?.room?.name || agent.getRoomData()?.name || 'Loading...';
                objectNames = result.data?.objects || [];
            }
            else {
                roomName = "Error: Room or Agent not found";
            }
        }
        res.json({ roomName: roomName, objects: objectNames });
    }
    catch (error) {
        console.error("API Error in /room/objects:", error);
        res.status(500).json({ error: "Failed to get room objects." });
    }
});
// GET /object/:object_name - Get details of a specific object
app.get('/object/:object_name', async (req, res) => {
    const objectNameParam = req.params.object_name;
    console.log(`API: Received /object/${objectNameParam} request`);
    try {
        let responseData = { error: "Object not found or invalid game state." };
        let statusCode = 404;
        const command = `/inspect ${objectNameParam}`;
        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            const game = activeMultiRoomGames[gameState.currentRoom];
            if (game) {
                const result = await game.process(command);
                if (result.data?.object) {
                    responseData = result.data.object; // Return name, description, details
                    statusCode = 200;
                }
                else {
                    responseData = { error: result.data?.message || `Object '${objectNameParam}' not found.` };
                }
            }
            else {
                responseData = { error: "Error: Game not found" };
                statusCode = 500;
            }
        }
        else {
            // For default or single-custom
            const agent = (gameState.gameMode === 'single-custom')
                ? customSingleRoomAgents[gameState.currentRoom]
                : agents[gameState.currentRoom]; // Default agents
            if (agent) {
                const result = await agent.process(command);
                if (result.data?.object) {
                    responseData = result.data.object;
                    statusCode = 200;
                }
                else {
                    responseData = { error: result.data?.message || `Object '${objectNameParam}' not found.` };
                }
            }
            else {
                responseData = { error: "Error: Room or Agent not found" };
                statusCode = 500;
            }
        }
        res.status(statusCode).json(responseData);
    }
    catch (error) {
        console.error(`API Error in /object/${objectNameParam}:`, error);
        res.status(500).json({ error: `Failed to get object details.` });
    }
});
// POST /room/unlock - Attempt to unlock the room
app.post('/room/unlock', async (req, res) => {
    const { password_guess } = req.body;
    console.log(`API: Received /room/unlock request`);
    if (typeof password_guess !== 'string') {
        res.status(400).json({ error: 'Password guess must be a string.' });
        return;
    }
    try {
        let responseData = { unlocked: false, finished: false, message: "Unlock attempt failed or invalid state." };
        let statusCode = 400;
        const command = `/guess ${password_guess}`;
        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            const game = activeMultiRoomGames[gameState.currentRoom];
            if (game) {
                const result = await game.process(command);
                responseData = {
                    unlocked: result.data?.unlocked || false,
                    finished: result.data?.gameCompleted || false,
                    message: result.data?.message || "Guess processed.",
                    nextRoom: result.data?.nextRoom // Include next room info if provided
                };
                statusCode = 200;
            }
            else {
                responseData = { error: "Error: Game not found" };
                statusCode = 500;
            }
        }
        else if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
            const agent = customSingleRoomAgents[gameState.currentRoom];
            if (agent) {
                const result = await agent.process(command);
                responseData = {
                    unlocked: result.data?.unlocked || false,
                    finished: result.data?.gameCompleted || false, // Single room game completes when unlocked
                    message: result.data?.message || "Guess processed."
                };
                statusCode = 200;
            }
            else {
                responseData = { error: "Error: Custom room agent not found" };
                statusCode = 500;
            }
        }
        else if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
            // --- Original logic for default rooms --- 
            const room = getCurrentRoomData();
            if (!room) {
                responseData = { error: "Error: Default room data not found" };
                statusCode = 500;
            }
            else if (password_guess === room.password) {
                let message = `Correct! Unlocked '${room.name}'.`;
                let finished = false;
                let nextRoomInfo = undefined;
                const nextRoomId = gameState.currentRoom + 1;
                if (objects_1.ROOM_OBJECTS[nextRoomId]) {
                    gameState.currentRoom = nextRoomId;
                    const nextRoom = getCurrentRoomData();
                    message += ` Moving to room ${nextRoomId}: ${nextRoom?.name || 'Unknown Room'}.`;
                    nextRoomInfo = nextRoom ? { id: nextRoomId, name: nextRoom.name } : undefined;
                }
                else {
                    message += ` You've escaped all default rooms!`;
                    finished = true;
                }
                responseData = { unlocked: true, finished: finished, message: message, nextRoom: nextRoomInfo };
                statusCode = 200;
            }
            else {
                responseData = { unlocked: false, finished: false, message: `Wrong password. Try again.` };
                statusCode = 200; // 200 OK even if wrong password
            }
            // -----------------------------------------
        }
        else {
            responseData = { error: "Invalid game mode for unlock attempt." };
            statusCode = 400;
        }
        res.status(statusCode).json(responseData);
    }
    catch (error) {
        console.error("API Error in /room/unlock:", error);
        res.status(500).json({ error: "Failed to process unlock attempt." });
    }
});
// --- User Management Endpoints ---
// Register user endpoint
app.post('/api/users/register', ((req, res) => {
    const { name, email, apiKey, provider = 'openai' } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    const userId = Date.now().toString();
    users[userId] = {
        id: userId,
        name,
        email,
        apiKeys: apiKey ? { [provider]: apiKey } : undefined,
        registeredAt: new Date().toISOString()
    };
    console.log(`API: User registered: ${name} (${userId})`);
    res.json({
        userId,
        user: { name, email }
    });
}));
// Authenticate user endpoint
app.post('/api/users/auth', ((req, res) => {
    const { userId } = req.body;
    if (!userId || !users[userId]) {
        return res.status(401).json({ error: 'User not found' });
    }
    // Return user data (excluding API keys)
    const { apiKeys, ...userData } = users[userId];
    console.log(`API: User authenticated: ${userData.name} (${userId})`);
    res.json({
        authenticated: true,
        user: userData
    });
}));
// Get API key - secure endpoint that returns the API key for a given user and provider
app.post('/api/users/get-api-key', ((req, res) => {
    const { userId, provider = 'openai' } = req.body;
    if (!userId || !users[userId]) {
        return res.status(401).json({ error: 'User not found' });
    }
    const user = users[userId];
    const apiKey = user.apiKeys?.[provider];
    if (!apiKey) {
        return res.status(404).json({ error: `No API key found for provider: ${provider}` });
    }
    console.log(`API: API key retrieved for user: ${user.name} (${userId}), provider: ${provider}`);
    res.json({
        apiKey,
        provider
    });
}));
// --- Chat Endpoint ---
app.post('/api/chat', (async (req, res) => {
    const { message, model } = req.body; // Removed currentRoom, rely on global gameState
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'API key is required' });
    }
    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    try {
        // Get current room context - uses getCurrentRoomData which handles game modes
        const room = getCurrentRoomData();
        if (!room) {
            return res.status(404).json({ error: "Current room data not found or invalid state." });
        }
        const roomContext = `You are in ${room.name}. ${room.background || ''}`;
        let objectsContext = 'No objects information available.';
        if (room.objects) {
            const objArray = Array.isArray(room.objects) ? room.objects : Object.values(room.objects);
            objectsContext = objArray.map(o => `${o.name}: ${o.description}`).join('\n');
        }
        console.log(`API: Processing natural input with model: ${model}`);
        let responseText;
        const model_specs = {
            'gpt-4o': { max_completion_tokens: 4098 },
            'gpt-4o-mini': { max_completion_tokens: 1024 },
            'gpt-4.1': { max_completion_tokens: 4098 },
            'o3': { reasoning_effort: "medium" },
            'o3-mini': { reasoning_effort: "medium" },
            'o4-mini': { reasoning_effort: "medium" },
            'claude-3-7-sonnet': { max_completion_tokens: 4098 }
        };
        const currentModelSpec = model_specs[model] || { max_completion_tokens: 1024 };
        if (model.startsWith('gpt') || model.startsWith('o')) {
            const openai = new openai_1.default({ apiKey });
            const completion = await openai.chat.completions.create({
                model,
                messages: [
                    { role: "system", content: `You are an AI assistant in an escape room game. Help the player solve puzzles without giving away solutions directly. Current room information: ${roomContext} Objects in room: ${objectsContext}` },
                    { role: "user", content: message }
                ],
                ...currentModelSpec
            });
            responseText = completion.choices[0].message.content;
        }
        else {
            const Anthropic = require('@anthropic-ai/sdk').default;
            const anthropic = new Anthropic({ apiKey });
            const anthropicResponse = await anthropic.messages.create({
                model,
                max_tokens: currentModelSpec.max_completion_tokens || 500,
                system: `You are an AI assistant in an escape room game. Help the player solve puzzles without giving away solutions directly. Current room information: ${roomContext} Objects in room: ${objectsContext}`,
                messages: [{ role: "user", content: message }]
            });
            responseText = anthropicResponse.content[0].text;
        }
        res.json({ response: responseText });
    }
    catch (error) {
        console.error('Error processing chat:', error);
        res.status(500).json({
            error: 'Error processing chat request',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// --- Error Handling Middleware (Basic) ---
app.use((err, req, res, next) => {
    console.error("Unhandled API Error:", err.stack);
    res.status(500).json({ error: 'An internal server error occurred.' });
});
// --- Start Server ---
app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map