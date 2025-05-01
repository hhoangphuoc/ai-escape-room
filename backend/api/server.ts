// backend/api/server.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ROOM_OBJECTS} from '../constant/objects'; // Adjust path as necessary
import { RoomAgent, RoomData, RoomObject, type RoomCommandResponse } from '../agents/RoomAgent';
import { MultiRoomGame } from '../agents/MultiRoomGame'; // Import MultiRoomGame
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid'; // For generating game IDs

// Load environment variables
dotenv.config();

//-------------------------------- USER DATA --------------------------------
interface User {
  id: string;
  name: string;
  email?: string;
  apiKeys?: {
    anthropic?: string;
    openai?: string;
  };
  registeredAt: string;
}

// In-memory user store (replace with DB in production)
const users: Record<string, User> = {};

//-------------------------------- GAME DATA & STATE --------------------------------

// Store for active multi-room games
const activeMultiRoomGames: Record<string, MultiRoomGame> = {};

// Store for single custom rooms generated via /api/newgame?mode=single-room
// We still need the agents object for pre-defined rooms from ROOM_OBJECTS
const customSingleRoomAgents: Record<number, RoomAgent> = {};


interface CustomGameData { // This might need adjustment for multi-room
    // Option 1: Keep simple, use isCustomGame flag + gameId
    // Option 2: Make it a union type
    gameId?: string; // ID for multi-room or single custom room
    room?: number; // Original field, maybe only for single rooms?
    rooms?: Record<number, RoomData>; // Original field
}

interface GameState {
    currentRoom: number | string; // Use number for default/single, string (gameId) for multi
    gameMode: 'default' | 'single-custom' | 'multi-custom';
    // isCustomGame: boolean; // Replaced by gameMode
    // customGameData: CustomGameData | null; // Simplify state management
}

// --- Game State (In-Memory) ---
let gameState: GameState = {
    currentRoom: 1, // Start with default room 1
    gameMode: 'default',
};


function getCurrentRoomData(): RoomData | null { // Return type might be null now
    if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
        const game = activeMultiRoomGames[gameState.currentRoom];
        if (game) {
            const currentRoomAgent = game.getCurrentRoom();
            // Use the agent's public getter
            return currentRoomAgent.getRoomData();
        } else {
            console.warn(`Multi-room game with ID ${gameState.currentRoom} not found.`);
            return null;
        }
    } else if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
        const agent = customSingleRoomAgents[gameState.currentRoom];
        if (agent) {
            // Use the agent's public getter
            return agent.getRoomData();
        } else {
            console.warn(`Custom single room agent with ID ${gameState.currentRoom} not found.`);
            return null;
        }
    } else if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
        // Original logic for default rooms
        const validRoomId = gameState.currentRoom in ROOM_OBJECTS ? gameState.currentRoom : 1;
        if (!(gameState.currentRoom in ROOM_OBJECTS)) {
            console.warn(`Invalid default room ID: ${gameState.currentRoom}. Defaulting to room 1.`);
            gameState.currentRoom = 1; // Reset to default if invalid
        }
        return ROOM_OBJECTS[validRoomId];
    } else {
        console.error('Invalid game state:', gameState);
        return null;
    }
}
//---------------------------------------------------------------------------------------------

// --- Initialize Room Agents (for default rooms) ---
const agents: Record<number, RoomAgent> = {}; // Keep this for default rooms
Object.keys(ROOM_OBJECTS).forEach(key => {
  const id = parseInt(key, 10);
  // Pass null for sequence/totalRooms for default agents if constructor allows
  agents[id] = new RoomAgent(id);
});
//--------------------------------

// --- Express App Setup ---
const app: Application = express();
const port = process.env.API_PORT || 3001; // Use environment variable or default

app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(bodyParser.json()); // Parse JSON request bodies

// --- API Endpoints ---
// GET /rooms - list available rooms
app.get('/api/rooms', (req: Request, res: Response) => {
  const rooms = Object.entries(ROOM_OBJECTS).map(([id, room]) => ({ id: parseInt(id, 10), name: room.name }));
  res.json({ rooms });
});

// POST /rooms/:id/command - send a command to a room agent
app.post('/api/rooms/:id/command', async (req: Request, res: Response) => {
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
    const result: RoomCommandResponse = await agent.process(input);
    res.json(result);
  } catch (err: any) {
    console.error('RoomAgent error:', err);
    res.status(500).json({ response: 'Internal error processing command.' });
  }
});

// GET /api/health - Health check endpoint for CLI connection
app.get('/api/health', (req: Request, res: Response) => {
    console.log("API: Received health check request");
    res.status(200).json({ status: 'healthy', message: 'Backend server is running' });
});

// POST /api/command - Process commands from CLI
app.post('/api/command', async (req, res) => { // Make async to handle MultiRoomGame.process
    console.log("API: Received /api/command request");
    const { command } = req.body;
    console.log(`API: Received command: ${command}`);

    if (!command) {
        res.status(400).json({ response: 'No command provided' });
        return;
    }

    // --- Route command if in multi-room game ---
    if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
        const game = activeMultiRoomGames[gameState.currentRoom];
        if (game) {
            try {
                console.log(`API: Routing command to MultiRoomGame ID: ${gameState.currentRoom}`);
                const result: RoomCommandResponse = await game.process(command);
                // The MultiRoomGame.process method should return the appropriate structure
                res.json({ response: result.data?.message || 'Action processed.' }); // Send back primary message
            } catch (error) {
                console.error(`Error processing command in MultiRoomGame ${gameState.currentRoom}:`, error);
                res.status(500).json({ response: "Error processing command in multi-room game." });
            }
            return; // Stop further processing
        } else {
            console.error(`Multi-room game ${gameState.currentRoom} not found, but gameState indicates multi-custom mode.`);
            // Fallback or error? Resetting state might be safest.
            gameState = { currentRoom: 1, gameMode: 'default' };
            res.status(500).json({ response: "Error: Active multi-room game not found. Resetting game state." });
            return;
        }
    }
    // ---------------------------------------------

    // --- Process command for default or single-custom game ---
    const normalizedCommand = command.trim().toLowerCase();
    let response = '';

    try {
        const room = getCurrentRoomData(); // Get current room data (might be default or single-custom)

        // Handle cases where room data might be null (e.g., single-custom agent failed)
        if (!room) {
            response = "Error: Could not load current room data. Try starting a new game.";
            res.status(500).json({ response });
            return;
        }

        if (normalizedCommand === '/help') {
            response = 'Available commands:\n' +
                      '/help - Shows this help message\n' +
                      '/seek (or /look) - Lists all interactable objects in the current room\n' +
                      '/analyse [object_name] (or /inspect) - Examine an object more closely\n' +
                      '/password [your_guess] (or /guess) - Submit a password guess\n' +
                      '/newgame [single-room|multi-room] - Starts a new game (defaults to single-room)'; // Update help text
        } else if (normalizedCommand === '/seek' || normalizedCommand === '/look') { // Added /look alias
            let objectNames: string[] = [];
            if (Array.isArray(room.objects)) {
                objectNames = room.objects.map(o => o.name);
            } else if (room.objects) {
                objectNames = Object.values(room.objects).map(o => o.name);
            }
            response = `You are in ${room.name}. Looking around, you see:\n` +
                      objectNames.map(name => `- ${name}`).join('\n');

        } else if (normalizedCommand.startsWith('/analyse ') || normalizedCommand.startsWith('/inspect ')) { // Added /inspect alias
            const objectName = normalizedCommand.startsWith('/analyse ')
                               ? normalizedCommand.substring('/analyse '.length).trim()
                               : normalizedCommand.substring('/inspect '.length).trim();
            let foundObject: RoomObject | null = null;
            if (Array.isArray(room.objects)) {
                foundObject = room.objects.find(o => o.name.toLowerCase() === objectName.toLowerCase()) || null;
            } else if (room.objects) {
                 const key = Object.keys(room.objects).find(
                    k => room.objects[k].name.toLowerCase() === objectName.toLowerCase()
                );
                foundObject = key ? room.objects[key] : null;
            }

            if (!foundObject) {
                response = `Object '${objectName}' not found in room.`;
            } else {
                response = `${foundObject.name}: ${foundObject.description}\n\n${foundObject.details.join('\n')}`;
            }

        } else if (normalizedCommand.startsWith('/password ') || normalizedCommand.startsWith('/guess ')) { // Added /guess alias
            // This logic is now primarily for DEFAULT rooms. Single-custom rooms might have their own logic?
            // Multi-room game commands are handled above.
            if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
                const passwordGuess = normalizedCommand.startsWith('/password ')
                                      ? normalizedCommand.substring('/password '.length).trim()
                                      : normalizedCommand.substring('/guess '.length).trim();
                if (passwordGuess === room.password) {
                    let message = `Correct! Unlocked '${room.name}'.`;
                    const nextRoomId = gameState.currentRoom + 1; // Safe: currentRoom is number
                    if (ROOM_OBJECTS[nextRoomId]) {
                        gameState.currentRoom = nextRoomId;
                        const nextRoom = getCurrentRoomData(); // Fetch next room data
                        message += `\n\nMoving to room ${nextRoomId}: ${nextRoom?.name || 'Unknown Room'}.`;
                    } else {
                        message += `\n\nCongratulations! You've escaped all default rooms!`;
                        // Maybe reset state here?
                        // gameState = { currentRoom: 1, gameMode: 'default' };
                    }
                    response = message;
                } else {
                    response = `Wrong password. Try again.`;
                }
            } else if (gameState.gameMode === 'single-custom') {
                 // Handle guess for single custom room - delegate to agent?
                 const agent = customSingleRoomAgents[gameState.currentRoom as number];
                 if (agent) {
                     const result = await agent.process(command);
                     response = result.data?.message || 'Guess processed.';
                 } else {
                     response = "Error processing guess: Custom room agent not found.";
                 }
            } else {
                 response = "Password command not applicable in current game mode.";
            }

        } else if (normalizedCommand.startsWith('/newgame')) {
            // This command is now handled by the dedicated /api/newgame POST endpoint.
            // We can provide info or just say it's processed elsewhere.
            response = "Starting a new game... Use the dedicated /newgame endpoint via POST request.";
            // Or trigger the POST endpoint call from here if desired (more complex)

        } else {
            response = `Unknown command: ${command}. Type /help to see available commands.`;
        }

    } catch (error) {
        console.error("Error processing command in /api/command:", error);
        response = "Error: Failed to process command.";
        res.status(500).json({ response });
        return;
    }

    res.json({ response });
});

// POST /game/start - Start a new game
app.post('/game/start', (req: Request, res: Response) => {
    console.log("API: Received /game/start request");
    gameState = { currentRoom: 1, gameMode: 'default' };
    try {
        const room = getCurrentRoomData();
        res.json({ message: `New game started. You're in room 1: ${room.name}.`, currentRoom: gameState.currentRoom, roomName: room.name });
    } catch (error) {
        console.error("API Error in /game/start:", error);
        res.status(500).json({ error: "Failed to start game. Could not load room data." });
    }
});

// POST /api/newgame - Create a new escape room (single or multi)
app.post('/api/newgame', async (req: Request, res: Response) => {
    console.log("API: Received /api/newgame request");
    const { mode = 'single-room' } = req.body;

    let gameId: string | number | null = null;

    try {
        let roomData: RoomData | null = null;
        let gameName: string = 'Unknown Game';
        let gameBackground: string = 'An unknown challenge awaits...';
        let initialRoomSequence = 1;

        // --- Cleanup previous custom games ---
        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            delete activeMultiRoomGames[gameState.currentRoom];
        } else if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
            delete customSingleRoomAgents[gameState.currentRoom];
        }
        gameState = { currentRoom: 1, gameMode: 'default' };
        // ------------------------------------

        if (mode === 'single-room') {
            console.log("API: Creating single-room game...");
            const agentId = Date.now();
            gameId = agentId;
            const newRoomAgent = new RoomAgent(agentId);

            // Use ensureRoomData to generate if needed
            roomData = await newRoomAgent.ensureRoomData();

            if (!roomData) {
                console.error("API Error in /api/newgame (single-room): Failed to get room data from new agent.");
                res.status(500).json({ success: false, error: "Failed to create new game. Could not generate valid room data." });
                return;
            }

            customSingleRoomAgents[agentId] = newRoomAgent;
            gameState = { currentRoom: agentId, gameMode: 'single-custom' };
            gameName = roomData.name;
            gameBackground = roomData.background;
            initialRoomSequence = roomData.sequence || 1;

        } else if (mode === 'multi-room') {
            console.log("API: Creating multi-room game...");
            const newGameId = uuidv4();
            gameId = newGameId;
            const multiRoomGame = new MultiRoomGame(newGameId);
            activeMultiRoomGames[newGameId] = multiRoomGame;

            await multiRoomGame.waitUntilReady(); // Use the added method

            const firstRoomAgent = multiRoomGame.getCurrentRoom();
            roomData = firstRoomAgent.getRoomData(); // Use the added getter

            if (!roomData) {
                console.error("API Error in /api/newgame (multi-room): Failed to initialize first room data.");
                delete activeMultiRoomGames[newGameId];
                res.status(500).json({ success: false, error: "Failed to create multi-room game. Could not initialize first room." });
                return;
            }

            gameState = { currentRoom: newGameId, gameMode: 'multi-custom' };
            gameName = roomData.name;
            gameBackground = roomData.background;
            initialRoomSequence = 1;

        } else {
            console.error(`API Error in /api/newgame: Invalid mode specified: ${mode}`);
            res.status(400).json({ success: false, error: "Invalid game mode specified. Use 'single-room' or 'multi-room'." });
            return;
        }

        console.log(`API: New game created successfully. Mode: ${mode}, Name: ${gameName}, ID: ${gameId}`);
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
                // Use the added getter
                totalRooms: mode === 'multi-room' ? activeMultiRoomGames[gameId as string]?.getTotalRooms() : 1
            }
        });

    } catch (error) {
        console.error(`API Error in /api/newgame (Mode: ${mode}, ID: ${gameId}):`, error);
        if (mode === 'single-room' && typeof gameId === 'number' && customSingleRoomAgents[gameId]) {
             delete customSingleRoomAgents[gameId];
        } else if (mode === 'multi-room' && typeof gameId === 'string' && activeMultiRoomGames[gameId]) {
             delete activeMultiRoomGames[gameId];
        }
        gameState = { currentRoom: 1, gameMode: 'default' };
        res.status(500).json({
            success: false,
            error: "Failed to create new game. An internal error occurred during room generation.",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /game/state - Get current game state
app.get('/game/state', (req: Request, res: Response) => {
    console.log("API: Received /game/state request");
    try {
        let roomName = 'Unknown Room';
        let currentRoomDisplay: string | number = gameState.currentRoom;

        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            const game = activeMultiRoomGames[gameState.currentRoom];
            if (game) {
                const room = game.getCurrentRoom().getRoomData();
                roomName = room?.name || 'Loading...';
                // Display as Room X of Y using the new getter
                currentRoomDisplay = `Room ${game.getCurrentRoomNumber()} of ${game.getTotalRooms()}`;
            } else {
                 roomName = "Error: Game not found";
            }
        } else {
            const room = getCurrentRoomData(); // For default or single-custom
            roomName = room?.name || 'Error: Room not found';
        }
        res.json({ currentRoom: currentRoomDisplay, roomName: roomName, gameMode: gameState.gameMode });
    } catch (error) {
        console.error("API Error in /game/state:", error);
        res.status(500).json({ error: "Failed to get game state." });
    }
});

// GET /room/objects - List objects in the current room
app.get('/room/objects', async (req: Request, res: Response) => { // Make async
    console.log("API: Received /room/objects request");
    try {
        let roomName = 'Unknown Room';
        let objectNames: string[] = [];

        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            const game = activeMultiRoomGames[gameState.currentRoom];
            if (game) {
                // Use process method for consistency? Or get data directly?
                // Let's use process('/look') to potentially trigger generation
                const result = await game.process('/look');
                roomName = result.data?.room?.name || game.getCurrentRoom().getRoomData()?.name || 'Loading...';
                objectNames = result.data?.objects || [];
            } else {
                 roomName = "Error: Game not found";
            }
        } else {
            // For default or single-custom
            const agent = (gameState.gameMode === 'single-custom')
                          ? customSingleRoomAgents[gameState.currentRoom as number]
                          : agents[gameState.currentRoom as number]; // Default agents
            if (agent) {
                const result = await agent.process('/look'); // Use agent process
                roomName = result.data?.room?.name || agent.getRoomData()?.name || 'Loading...';
                objectNames = result.data?.objects || [];
            } else {
                 roomName = "Error: Room or Agent not found";
            }
        }
        res.json({ roomName: roomName, objects: objectNames });
     } catch (error) {
        console.error("API Error in /room/objects:", error);
        res.status(500).json({ error: "Failed to get room objects." });
    }
});

// GET /object/:object_name - Get details of a specific object
app.get('/object/:object_name', async (req, res) => { // Make async
    const objectNameParam = req.params.object_name;
    console.log(`API: Received /object/${objectNameParam} request`);
    try {
        let responseData: any = { error: "Object not found or invalid game state." };
        let statusCode = 404;

        const command = `/inspect ${objectNameParam}`;

        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            const game = activeMultiRoomGames[gameState.currentRoom];
            if (game) {
                const result = await game.process(command);
                if (result.data?.object) {
                    responseData = result.data.object; // Return name, description, details
                    statusCode = 200;
                } else {
                    responseData = { error: result.data?.message || `Object '${objectNameParam}' not found.` };
                }
            } else {
                 responseData = { error: "Error: Game not found" };
                 statusCode = 500;
            }
        } else {
            // For default or single-custom
             const agent = (gameState.gameMode === 'single-custom')
                          ? customSingleRoomAgents[gameState.currentRoom as number]
                          : agents[gameState.currentRoom as number]; // Default agents
            if (agent) {
                 const result = await agent.process(command);
                 if (result.data?.object) {
                    responseData = result.data.object;
                    statusCode = 200;
                } else {
                    responseData = { error: result.data?.message || `Object '${objectNameParam}' not found.` };
                }
            } else {
                 responseData = { error: "Error: Room or Agent not found" };
                 statusCode = 500;
            }
        }
        res.status(statusCode).json(responseData);
     } catch (error) {
        console.error(`API Error in /object/${objectNameParam}:`, error);
        res.status(500).json({ error: `Failed to get object details.` });
    }
});

// POST /room/unlock - Attempt to unlock the room
app.post('/room/unlock', async (req, res) => { // Make async
    const { password_guess } = req.body;
    console.log(`API: Received /room/unlock request`);

    if (typeof password_guess !== 'string') {
        res.status(400).json({ error: 'Password guess must be a string.' });
        return;
    }

    try {
        let responseData: any = { unlocked: false, finished: false, message: "Unlock attempt failed or invalid state." };
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
            } else {
                 responseData = { error: "Error: Game not found" };
                 statusCode = 500;
            }
        } else if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
             const agent = customSingleRoomAgents[gameState.currentRoom];
             if (agent) {
                 const result = await agent.process(command);
                 responseData = {
                    unlocked: result.data?.unlocked || false,
                    finished: result.data?.gameCompleted || false, // Single room game completes when unlocked
                    message: result.data?.message || "Guess processed."
                 };
                 statusCode = 200;
             } else {
                 responseData = { error: "Error: Custom room agent not found" };
                 statusCode = 500;
             }
        } else if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
            // --- Original logic for default rooms --- 
            const room = getCurrentRoomData();
            if (!room) {
                 responseData = { error: "Error: Default room data not found" };
                 statusCode = 500;
            } else if (password_guess === room.password) {
                let message = `Correct! Unlocked '${room.name}'.`;
                let finished = false;
                let nextRoomInfo: { id: number, name: string } | undefined = undefined;
                const nextRoomId = gameState.currentRoom + 1;
                if (ROOM_OBJECTS[nextRoomId]) {
                    gameState.currentRoom = nextRoomId;
                    const nextRoom = getCurrentRoomData();
                    message += ` Moving to room ${nextRoomId}: ${nextRoom?.name || 'Unknown Room'}.`;
                    nextRoomInfo = nextRoom ? { id: nextRoomId, name: nextRoom.name } : undefined;
                } else {
                    message += ` You've escaped all default rooms!`;
                    finished = true;
                }
                responseData = { unlocked: true, finished: finished, message: message, nextRoom: nextRoomInfo };
                statusCode = 200;
            } else {
                responseData = { unlocked: false, finished: false, message: `Wrong password. Try again.` };
                statusCode = 200; // 200 OK even if wrong password
            }
            // -----------------------------------------
        } else {
             responseData = { error: "Invalid game mode for unlock attempt." };
             statusCode = 400;
        }
        res.status(statusCode).json(responseData);
     } catch (error) {
        console.error("API Error in /room/unlock:", error);
        res.status(500).json({ error: "Failed to process unlock attempt." });
    }
});

// --- User Management Endpoints ---

// Register user endpoint
app.post('/api/users/register', ((req: Request, res: Response) => {
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
}) as any);

// Authenticate user endpoint
app.post('/api/users/auth', ((req: Request, res: Response) => {
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
}) as any);

// Get API key - secure endpoint that returns the API key for a given user and provider
app.post('/api/users/get-api-key', ((req: Request, res: Response) => {
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
}) as any);

// --- Chat Endpoint ---
app.post('/api/chat', (async (req: Request, res: Response) => {
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
    
    console.log(`API: Processing chat message with model: ${model}`);
    
    let responseText;
    const model_specs = {
      'gpt-4o': { max_completion_tokens: 4098 },
      'gpt-4o-mini': { max_completion_tokens: 1024 },
      'gpt-4.1': { max_completion_tokens: 4098 },
      'o3': { reasoning_effort: "medium" },
      'o3-mini': { reasoning_effort: "medium" },
      'o4-mini': { reasoning_effort: "medium" },
      'claude-3-7-sonnet': { max_completion_tokens: 4098 }
    }
    const currentModelSpec = model_specs[model] || { max_completion_tokens: 1024 };

    if (model.startsWith('gpt') || model.startsWith('o')) {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: `You are an AI assistant in an escape room game. Help the player solve puzzles without giving away solutions directly. Current room information: ${roomContext} Objects in room: ${objectsContext}` },
          { role: "user", content: message }
        ],
        ...currentModelSpec
      });
      responseText = completion.choices[0].message.content;

    } else {
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

  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ 
      error: 'Error processing chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

// --- Error Handling Middleware (Basic) ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled API Error:", err.stack);
    res.status(500).json({ error: 'An internal server error occurred.' });
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
});
