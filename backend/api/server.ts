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
import { VERCEL_DOMAIN, LOCAL_API_PORT, LOCAL_API_URL } from '../constant/apiConfig'; // Added import
import { Logger } from '../utils/logger'; // Import Logger

// Initialize Logger with context
const logger = new Logger('API-Server');

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
            logger.warn(`Multi-room game with ID ${gameState.currentRoom} not found.`);
            return null;
        }
    } else if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
        const agent = customSingleRoomAgents[gameState.currentRoom];
        if (agent) {
            // Use the agent's public getter
            return agent.getRoomData();
        } else {
            logger.warn(`Custom single room agent with ID ${gameState.currentRoom} not found.`);
            return null;
        }
    } else if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
        // Original logic for default rooms
        const validRoomId = gameState.currentRoom in ROOM_OBJECTS ? gameState.currentRoom : 1;
        if (!(gameState.currentRoom in ROOM_OBJECTS)) {
            logger.warn(`Invalid default room ID: ${gameState.currentRoom}. Defaulting to room 1.`);
            gameState.currentRoom = 1; // Reset to default if invalid
        }
        return ROOM_OBJECTS[validRoomId];
    } else {
        logger.error('Invalid game state', { state: gameState });
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
// const port = process.env.API_PORT || 3001; // Use environment variable or default
const port = LOCAL_API_PORT; // Use constant

app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(bodyParser.json()); // Parse JSON request bodies

// Create a new Express Router for API endpoints
const apiRouter = express.Router();

// --- API Endpoints (now on apiRouter) ---

apiRouter.get('/', (req: Request, res: Response) => {
  res.json({ message: 'API is running on server' });
});

// GET /rooms - list available rooms
apiRouter.get('/rooms', (req: Request, res: Response) => {
  const rooms = Object.entries(ROOM_OBJECTS).map(([id, room]) => ({ id: parseInt(id, 10), name: room.name }));
  res.json({ rooms });
});

// POST /rooms/:id/command - send a command to a room agent
apiRouter.post('/rooms/:id/command', async (req: Request, res: Response) => {
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
    logger.error('RoomAgent error processing command', err);
    res.status(500).json({ response: 'Internal error processing command.' });
  }
});

// GET /health - Health check endpoint for CLI connection
apiRouter.get('/health', (req: Request, res: Response) => {
    logger.info("Received health check request");
    res.status(200).json({ status: 'healthy', message: 'Backend server is running' });
});

// POST /command - Process commands from CLI
apiRouter.post('/command', (async (req, res) => {
    logger.info("Received /command request", { body: req.body });
    const { command, userId } = req.body;
    logger.info(`Received command: '${command}' for user: ${userId}`);

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
        logger.warn(`User ${userId} does not have a configured API key for potential generation.`);
        return res.status(403).json(
            { response: 'No API key configured for this user. Cannot process commands needing AI generation.' });
    }
    // -------------------------------------

    // --- Route command if in multi-room game ---
    if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
        const game = activeMultiRoomGames[gameState.currentRoom];
        if (game) {
            try {
                logger.info(`Routing command to MultiRoomGame ID: ${gameState.currentRoom}`);
                // Pass the retrieved apiKey to game.process
                // Note: MultiRoomGame.process now internally uses its stored key, so no need to pass here.
                // const result: RoomCommandResponse = await game.process(command, apiKey);
                const result: RoomCommandResponse = await game.process(command);
                res.json({ response: result.data?.message || result.response || 'Action processed.' });
            } catch (error) {
                // ... error handling ...
                logger.error(`Error processing command in MultiRoomGame ${gameState.currentRoom}`, error);
                res.status(500).json({ response: "Error processing command in multi-room game." });
            }
            return;
        } else {
            // ... error handling ...
            logger.error(`Multi-room game ${gameState.currentRoom} not found, but gameState indicates multi-custom mode.`);
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
            (normalizedCommand.startsWith('/password ') && gameState.gameMode === 'single-custom')
           )
        {
            let agent: RoomAgent | undefined;
            if (gameState.gameMode === 'single-custom' && typeof gameState.currentRoom === 'number') {
                agent = customSingleRoomAgents[gameState.currentRoom];
            } else if (gameState.gameMode === 'default' && typeof gameState.currentRoom === 'number') {
                agent = agents[gameState.currentRoom]; // Use default agent
            }

            if (agent) {
                // Pass apiKey to agent.process
                const result = await agent.process(command, apiKey);
                responseText = result.data?.message || result.response || 'Command processed by agent.';
            } else {
                responseText = "Error: Could not find the appropriate game agent.";
                res.status(404).json({ response: responseText });
                return;
            }
        // --- Handle commands processed directly by the server --- 
        } else if (normalizedCommand === '/help') {
            // ... help text generation ...
            responseText = 'Available commands:\n' + // Simplified help
                          '/help - Shows this help message\n' +
                          '/look - Lists objects\n' +
                          '/inspect [object] - Examine an object\n' +
                          '/guess [password] - Submit a password\n' +
                          '/hint - Get a hint\n' +
                          '/newgame [single-room|multi-room] - Starts a new game';

        } else if (normalizedCommand.startsWith('/guess ') || normalizedCommand.startsWith('/password ')) {
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
                    if (ROOM_OBJECTS[nextRoomId]) {
                        gameState.currentRoom = nextRoomId;
                        const nextRoom = getCurrentRoomData();
                        message += `\n\nMoving to room ${nextRoomId}: ${nextRoom?.name || 'Unknown Room'}.`;
                    } else {
                        message += `\n\nCongratulations! You've escaped all default rooms!`;
                    }
                    responseText = message;
                } else {
                    responseText = `Wrong password. Try again.`;
                }
            } else {
                 // Should have been handled by agent.process if single-custom
                 responseText = "Password command not applicable in current state.";
            }
        } else if (normalizedCommand.startsWith('/newgame')) {
            responseText = "Use the dedicated /newgame endpoint via POST request with { mode: '...', userId: '...' }.";
        } else {
            responseText = `Unknown command: ${command}. Type /help.`;
        }

    } catch (error) {
        logger.error("Error processing command in /command", error, { command, userId });
        responseText = "Error: Failed to process command.";
        res.status(500).json({ response: responseText });
        return;
    }

    res.json({ response: responseText });
}) as any);

// POST /newgame - Create a new escape room (single or multi)
apiRouter.post('/newgame', (async (req: Request, res: Response) => {
    logger.info("Received /newgame request", { body: req.body });
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


        // --------------------------------------------------------------------------------------------
        //                                      SINGLE-ROOM MODE
        // --------------------------------------------------------------------------------------------

        if (mode === 'single-room') {
            logger.info("Creating single-room game...", { userId, mode });
            const agentId = Date.now();
            gameId = agentId;
            
            const newRoomAgent = new RoomAgent(agentId);

            // Lazy approach to only parse `apiKey` when needed
            roomData = await newRoomAgent.ensureRoomData(apiKey);

            if (!roomData) {
                // ... error handling ...
                logger.error("Failed to get room data from new agent for single-room game.", undefined, { agentId });
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

        } else if (mode === 'multi-room') {
            logger.info("Creating multi-room game...", { userId, mode });
            const newGameId = uuidv4();
            gameId = newGameId;
            // Pass apiKey to MultiRoomGame constructor
            const multiRoomGame = new MultiRoomGame(newGameId, apiKey);
            activeMultiRoomGames[newGameId] = multiRoomGame;

            await multiRoomGame.waitUntilReady();

            const firstRoomAgent = multiRoomGame.getCurrentRoom();
            // getRoomData doesn't need key, data is loaded/generated during init
            roomData = firstRoomAgent.getRoomData();

            if (!roomData) {
                // ... error handling ...
                logger.error("Failed to initialize first room data for multi-room game.", undefined, { gameId: newGameId });
                delete activeMultiRoomGames[newGameId];
                return res.status(500).json({ success: false, error: "Failed to create multi-room game. Could not initialize first room." });
            }

            gameState = { currentRoom: newGameId, gameMode: 'multi-custom' };
            gameName = roomData.name;
            gameBackground = roomData.background;
            initialRoomSequence = 1;

        } else {
            // ... invalid mode error handling ...
            logger.error(`Invalid mode specified in /newgame: ${mode}`, undefined, { userId });
            return res.status(400).json({ success: false, error: "Invalid game mode specified. Use 'single-room' or 'multi-room'." });
        }

        // ... Success response generation (keep existing) ...
        logger.info(`New game created successfully. Mode: [${mode}] - Name: [${gameName}] - ID: [${gameId}]`);

        logger.info("Initial room details for new game", { details: roomData });
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
                totalRooms: mode === 'multi-room' ? activeMultiRoomGames[gameId as string]?.getTotalRooms() : 1
            }
        });

    } catch (error) {
        // ... Catch block (keep existing cleanup) ...
        logger.error(`Error in /newgame`, error, { mode, gameId, userId });
        if (mode === 'single-room' && typeof gameId === 'number' && customSingleRoomAgents[gameId]) {
             delete customSingleRoomAgents[gameId];
        } else if (mode === 'multi-room' && typeof gameId === 'string' && activeMultiRoomGames[gameId]) {
             delete activeMultiRoomGames[gameId];
        }
        gameState = { currentRoom: 1, gameMode: 'default' };
        res.status(500).json({
            success: false,
            error: "Failed to create new game. An internal error occurred.",
            details: error instanceof Error ? error.message : String(error)
        });
    }
}) as any);

// GET /game/state - Get current game state
app.get('/game/state', (req: Request, res: Response) => {
    logger.info("Received /game/state request");
    try {
        let roomName = 'Unknown Room';
        let currentRoomDisplay: string | number = gameState.currentRoom;

        if (gameState.gameMode === 'multi-custom' && typeof gameState.currentRoom === 'string') {
            const game = activeMultiRoomGames[gameState.currentRoom];
            if (game) {
                const room = game.getCurrentRoom().getRoomData();
                roomName = room?.name || 'Loading...';
                currentRoomDisplay = `Room ${game.getCurrentRoomNumber()} of ${game.getTotalRooms()}`;
            } else {
                 roomName = "Error: Game not found";
            }
        } else {
            const room = getCurrentRoomData();
            roomName = room?.name || 'Error: Room not found';
        }
        res.json({ currentRoom: currentRoomDisplay, roomName: roomName, gameMode: gameState.gameMode });
    } catch (error) {
        logger.error("Error in /game/state", error);
        res.status(500).json({ error: "Failed to get game state." });
    }
});

// GET /room/objects - List objects in the current room
app.get('/room/objects', async (req: Request, res: Response) => { // Make async
    logger.info("Received /room/objects request");
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
        logger.error("Error in /room/objects", error);
        res.status(500).json({ error: "Failed to get room objects." });
    }
});

// GET /object/:object_name - Get details of a specific object
app.get('/object/:object_name', async (req, res) => { // Make async
    const objectNameParam = req.params.object_name;
    logger.info(`Received /object/${objectNameParam} request`);
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
        logger.error(`Error in /object/${objectNameParam}`, error);
        res.status(500).json({ error: `Failed to get object details.` });
    }
});

// POST /room/unlock - Attempt to unlock the room
app.post('/room/unlock', async (req, res) => { // Make async
    const { password_guess } = req.body;
    logger.info("Received /room/unlock request", { body: req.body });

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
        logger.error("Error in /room/unlock", error);
        res.status(500).json({ error: "Failed to process unlock attempt." });
    }
});

// --- User Management Endpoints (on apiRouter) ---

// Register user endpoint
apiRouter.post('/users/register', ((req: Request, res: Response) => {
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
  
  logger.info(`User registered: ${name} (${userId})`, { email });
  
  res.json({ 
    userId,
    user: { name, email }
  });
}) as any);

// Authenticate user endpoint
apiRouter.post('/users/auth', ((req: Request, res: Response) => {
  const { userId } = req.body;
  
  if (!userId || !users[userId]) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // Return user data (excluding API keys)
  const { apiKeys, ...userData } = users[userId];
  
  logger.info(`User authenticated: ${userData.name} (${userId})`);
  
  res.json({ 
    authenticated: true,
    user: userData
  });
}) as any);

// Get API key - secure endpoint that returns the API key for a given user and provider
apiRouter.post('/users/get-api-key', ((req: Request, res: Response) => {
  const { userId, provider = 'openai' } = req.body;
  
  if (!userId || !users[userId]) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  const user = users[userId];
  const apiKey = user.apiKeys?.[provider];
  
  if (!apiKey) {
    return res.status(404).json({ error: `No API key found for provider: ${provider}` });
  }
  
  logger.info(`API key retrieved for user: ${user.name} (${userId})`, { provider });
  
  res.json({ 
    apiKey,
    provider
  });
}) as any);

// --- Chat Endpoint (on apiRouter) ---
apiRouter.post('/chat', (async (req: Request, res: Response) => {
  const { message, model, userId: chatUserId } = req.body; // Destructure userId as chatUserId to avoid conflict if any
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
    
    logger.info(`Processing natural input with model: ${model}`, { userId: chatUserId, roomName: room.name });
    
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
    logger.error('Error processing chat', error, { model });
    res.status(500).json({ 
      error: 'Error processing chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

// Test route - this should also be on apiRouter if it's an /api route
apiRouter.post('/users/test-post', (req: Request, res: Response) => { 
  logger.info('Accessed /users/test-post successfully!', { body: req.body });
  res.status(200).json({ message: 'POST test to /users/test-post successful', receivedBody: req.body });
});

// Mount the API router under the /api path
app.use('/api', apiRouter);

// --- Error Handling Middleware (should be last, after all routes and routers) ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error("Unhandled API Error", err); 
    res.status(500).json({ error: 'An internal server error occurred.' });
});

// --- Start Server ---
/*
app.listen(port, () => {
    const serverUrl = process.env.NODE_ENV === 'production' ? VERCEL_DOMAIN : LOCAL_API_URL;
    logger.info(`API server listening. Reachable at ${serverUrl}`);
    if (process.env.NODE_ENV !== 'production') {
        logger.info(`Local: http://localhost:${port}`);
    }
});
*/

export default app;
