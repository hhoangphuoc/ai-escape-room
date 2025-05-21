// backend/api/routes/gameRoutes.ts
import { Router, Response } from 'express';
import { ROOM_OBJECTS } from '../../constant/objects'; 
import { RoomAgent, RoomData, RoomCommandResponse } from '../../agents/RoomAgent';
import { MultiRoomGame } from '../../agents/MultiRoomGame'; 
import { v4 as uuidv4 } from 'uuid';
import { users } from '../auth/authController';
import { jwtAuth, AuthRequest, UserJwtPayload } from '../auth/jwtMiddleware';
import OpenAI from 'openai'; // Added OpenAI import

// TODO: Move UserGameSession and userActiveGames to a more central state management or service layer
interface UserGameSession {
  gameInstance: RoomAgent | MultiRoomGame;
  gameMode: 'default' | 'single-custom' | 'multi-custom'; 
  gameId: string | number; 
  currentRoomName?: string;
  currentRoomSequence?: number;
  totalRooms?: number;
}
const userActiveGames: Record<string, UserGameSession> = {};

// --- Initialize Room Agents (for default rooms from ROOM_OBJECTS) ---
// This is also state that might need better management
const defaultRoomAgents: Record<number, RoomAgent> = {}; 
Object.keys(ROOM_OBJECTS).forEach(key => {
  const id = parseInt(key, 10);
  defaultRoomAgents[id] = new RoomAgent(id); 
});
//--------------------------------

const router = Router();

// All game routes should be protected
router.use(jwtAuth); 

// GET /rooms - list available predefined rooms (e.g., for a 'default' mode selection)
router.get('/rooms', (req: AuthRequest, res: Response) => {
  const rooms = Object.entries(ROOM_OBJECTS).map(([id, room]) => ({ id: parseInt(id, 10), name: room.name }));
  res.json({ rooms });
});

// POST /command - Process commands from CLI
router.post('/command', async (req: AuthRequest, res: Response): Promise<void> => {
    const { command } = req.body;
    const userId = (req.user as UserJwtPayload).sub;
    console.log(`API: Received command: '${command}' for user: ${userId}`);

    if (!command) {
        res.status(400).json({ response: 'Command is required.' });
        return;
    }
    
    const user = users[userId]; // Assuming users are accessible here
    if (!user) {
        res.status(401).json({ response: 'User not found or not registered.' });
        return;
    }

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ response: 'No active game found. Start a new game using /newgame.' });
        return;
    }
    const { gameInstance, gameMode } = userSession;

    try {
        console.log(`API: Routing command to ${gameMode} game ID: ${userSession.gameId} for user ${userId}`);
        const result: RoomCommandResponse = await gameInstance.process(command);
        
        if (gameInstance instanceof MultiRoomGame) {
            userSession.currentRoomSequence = gameInstance.getCurrentRoomNumber();
            userSession.totalRooms = gameInstance.getTotalRooms();
            const currentRoomData = gameInstance.getCurrentRoom().getRoomData();
            userSession.currentRoomName = currentRoomData?.name || 'Unknown Room';
        } else if (gameInstance instanceof RoomAgent) {
             userSession.currentRoomSequence = 1;
             userSession.totalRooms = 1;
             const roomData = gameInstance.getRoomData();
             userSession.currentRoomName = roomData?.name || 'Unknown Room';
        }
        res.json({ response: result.data?.message || result.response || 'Action processed.', data: result.data });
    } catch (error) {
        console.error(`Error processing command in ${gameMode} game ${userSession.gameId} for user ${userId}:`, error);
        res.status(500).json({ response: `Error processing command in ${gameMode} game.` });
    }
});

// POST /newgame - Create a new escape room (single or multi)
router.post('/newgame', async (req: AuthRequest, res: Response): Promise<void> => {
    const { mode = 'single-room', roomCount, gameTheme } = req.body;
    const userId = (req.user as UserJwtPayload).sub;
    console.log("API: Received /newgame request for user", userId, { body: req.body });

    const user = users[userId];
    if (!user) {
        res.status(401).json({ success: false, error: 'User not found or not registered.' });
        return;
    }
    const apiKey = user.apiKeys?.openai || user.apiKeys?.anthropic;
    if (!apiKey) {
        if (mode === 'single-custom' || mode === 'multi-custom' || mode === 'single-room' || mode === 'multi-room') {
             res.status(403).json({ success: false, error: 'User does not have a configured API key for custom game generation.' });
             return;
        }
    }
    if (userActiveGames[userId]) {
        console.log(`API: Cleaning up previous game for user ${userId}.`);
        delete userActiveGames[userId];
    }

    let newGameSession: UserGameSession | null = null;
    let initialRoomData: RoomData | null = null;
    let responseGameName: string = 'Unknown Game';
    let responseGameBackground: string = 'An unknown challenge awaits...';
    let responseInitialRoomSequence = 1;
    let responseTotalRooms = 1;
    let actualGameMode : 'single-custom' | 'multi-custom' | 'default' = 'single-custom';

    try {
        if (mode === 'single-room' || mode === 'single-custom') {
            actualGameMode = 'single-custom';
            console.log(`API: Creating ${actualGameMode} game for user ${userId}...`);
            if (!apiKey) {
                res.status(403).json({ success: false, error: 'API key required for single-custom game.' });
                return;
            }
            const agentIdNum = Date.now(); 
            const agentIdStr = agentIdNum.toString();
            const newRoomAgent = new RoomAgent(agentIdNum, 1, 1);
            initialRoomData = await newRoomAgent.ensureRoomData(apiKey);
            if (!initialRoomData) {
                console.error(`API Error in /newgame (${actualGameMode}) for user ${userId}: Failed to get room data.`);
                res.status(500).json({ success: false, error: "Failed to create new game. Could not generate valid room data." });
                return;
            }
            
            newGameSession = {
                gameInstance: newRoomAgent,
                gameMode: actualGameMode,
                gameId: agentIdStr,
                currentRoomName: initialRoomData.name,
                currentRoomSequence: 1,
                totalRooms: 1
            };
            responseGameName = initialRoomData.name;
            responseGameBackground = initialRoomData.background || 'A new adventure begins!';
            responseTotalRooms = 1;

        } else if (mode === 'multi-room' || mode === 'multi-custom') {
            actualGameMode = 'multi-custom';
            console.log(`API: Creating ${actualGameMode} game for user ${userId} with ${roomCount || 'default'} rooms and theme '${gameTheme || 'general horror'}'...`);
            if (!apiKey) {
                res.status(403).json({ success: false, error: 'API key required for multi-custom game.' });
                return;
            }
            const newGameId = uuidv4();
            const multiRoomGame = new MultiRoomGame(newGameId, apiKey, roomCount);
            await multiRoomGame.waitUntilReady();
            const firstRoomAgent = multiRoomGame.getCurrentRoom();
            initialRoomData = firstRoomAgent.getRoomData();

            if (!initialRoomData) {
                console.error(`API Error in /newgame (${actualGameMode}) for user ${userId}: Failed to initialize first room data.`);
                res.status(500).json({ success: false, error: "Failed to create multi-room game. Could not initialize first room." });
                return;
            }

            newGameSession = {
                gameInstance: multiRoomGame,
                gameMode: actualGameMode,
                gameId: newGameId,
                currentRoomName: initialRoomData.name,
                currentRoomSequence: multiRoomGame.getCurrentRoomNumber(),
                totalRooms: multiRoomGame.getTotalRooms()
            };
            responseGameName = initialRoomData.name; 
            responseGameBackground = initialRoomData.background || 'A multi-room challenge unfolds!';
            responseInitialRoomSequence = multiRoomGame.getCurrentRoomNumber();
            responseTotalRooms = multiRoomGame.getTotalRooms();
        
        } else if (mode === 'default') {
            actualGameMode = 'default';
            console.log(`API: Creating ${actualGameMode} game (Room 1) for user ${userId}...`);
            const defaultRoomId = 1;
            const templateAgent = defaultRoomAgents[defaultRoomId];
            if (!templateAgent) {
                 console.error(`API Error in /newgame (default) for user ${userId}: Default room agent for ID ${defaultRoomId} not found.`);
                 res.status(500).json({ success: false, error: "Failed to create default game. Room template not found." });
                 return;
            }
            const userDefaultRoomAgent = new RoomAgent(defaultRoomId);
            initialRoomData = userDefaultRoomAgent.getRoomData();
            if (!initialRoomData) {
                console.error(`API Error in /newgame (default) for user ${userId}: Failed to load data for default room ${defaultRoomId}.`);
                res.status(500).json({ success: false, error: "Failed to create default game. Could not load room data." });
                return;
            }

            newGameSession = {
                gameInstance: userDefaultRoomAgent,
                gameMode: actualGameMode,
                gameId: defaultRoomId, 
                currentRoomName: initialRoomData.name,
                currentRoomSequence: 1, 
                totalRooms: Object.keys(ROOM_OBJECTS).length 
            };
            responseGameName = initialRoomData.name;
            responseGameBackground = initialRoomData.background || 'A classic challenge.';
            responseTotalRooms = Object.keys(ROOM_OBJECTS).length;

        } else {
            console.error(`API: Invalid mode specified in /newgame: ${mode} for user ${userId}`);
            res.status(400).json({ success: false, error: "Invalid game mode specified." });
            return;
        }

        if (newGameSession && initialRoomData) {
            userActiveGames[userId] = newGameSession;
            console.log(`API: New game created for user ${userId}. Mode: [${actualGameMode}] - GameID: [${newGameSession.gameId}]`);
            res.json({
                success: true,
                message: `New ${actualGameMode} game started. Room ${responseInitialRoomSequence}: ${responseGameName}.`,
                game: {
                    id: newGameSession.gameId,
                    name: responseGameName,
                    background: responseGameBackground,
                    currentRoom: responseInitialRoomSequence,
                    currentRoomName: newGameSession.currentRoomName,
                    objectCount: initialRoomData.objects ? (Array.isArray(initialRoomData.objects) ? initialRoomData.objects.length : Object.keys(initialRoomData.objects).length) : 0,
                    mode: actualGameMode, 
                    totalRooms: responseTotalRooms
                }
            });
        } else {
             throw new Error("Game session or initial room data was not initialized.");
        }
    } catch (error) {
        console.error(`API: Error in /newgame for user ${userId}, mode ${mode}:`, error);
        delete userActiveGames[userId]; 
        res.status(500).json({
            success: false,
            error: "Failed to create new game. Internal error.",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /game/state - Get current game state for a user
router.get('/game/state', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    console.log(`API: Received /game/state request for user ${userId}`);

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found." });
        return;
    }

    const { gameInstance, gameMode, gameId, currentRoomName, currentRoomSequence, totalRooms } = userSession;
    let roomDataForDisplay: RoomData | null = null;
    let displayRoomName = currentRoomName || 'Loading...';
    let displayRoomSequence = currentRoomSequence || 1;
    let displayTotalRooms = totalRooms || 1;

    try {
        if (gameInstance instanceof MultiRoomGame) {
            roomDataForDisplay = gameInstance.getCurrentRoom().getRoomData();
            displayRoomName = roomDataForDisplay?.name || displayRoomName;
            displayRoomSequence = gameInstance.getCurrentRoomNumber();
            displayTotalRooms = gameInstance.getTotalRooms();
            userSession.currentRoomName = displayRoomName;
            userSession.currentRoomSequence = displayRoomSequence;
            userSession.totalRooms = displayTotalRooms;
        } else if (gameInstance instanceof RoomAgent) {
            roomDataForDisplay = gameInstance.getRoomData();
            displayRoomName = roomDataForDisplay?.name || displayRoomName;
            if (gameMode === 'default' || gameMode === 'single-custom') {
                 displayRoomSequence = 1;
                 displayTotalRooms = (gameMode === 'default') ? Object.keys(ROOM_OBJECTS).length : 1;
            }
        }
        
        res.json({
            gameId: gameId,
            currentRoom: displayRoomSequence,
            currentRoomName: displayRoomName,
            totalRooms: displayTotalRooms,
            gameMode: gameMode,
        });

    } catch (error) {
        console.error(`API Error in /game/state for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to get game state." });
    }
});

// GET /room/objects - List objects in the current room for a user
router.get('/room/objects', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    console.log(`API: Received /room/objects request for user ${userId}`);

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found." });
        return;
    }
    const { gameInstance } = userSession;

    try {
        const result = await gameInstance.process('/look'); 
        const roomName = result.data?.room?.name || (
            gameInstance instanceof RoomAgent ? gameInstance.getRoomData()?.name : (
                gameInstance instanceof MultiRoomGame ? gameInstance.getCurrentRoom().getRoomData()?.name : 'Unknown Room'
            )
        ) || 'Unknown Room';
        const objectNames: string[] = result.data?.objects || [];
        res.json({ roomName: roomName, objects: objectNames });
    } catch (error) {
        console.error(`API Error in /room/objects for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to get room objects." });
    }
});

// GET /object/:object_name - Get details of a specific object for a user
router.get('/object/:object_name', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    const objectNameParam = req.params.object_name;
    console.log(`API: Received /object/${objectNameParam} request for user ${userId}`);

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found." });
        return;
    }
    const { gameInstance } = userSession;
    try {
        const command = `/inspect ${objectNameParam}`;
        const result = await gameInstance.process(command);
        if (result.data?.object) {
            res.status(200).json(result.data.object);
        } else {
            res.status(404).json({ error: result.data?.message || `Object '${objectNameParam}' not found.` });
        }
    } catch (error) {
        console.error(`API Error in /object/${objectNameParam} for user ${userId}:`, error);
        res.status(500).json({ error: `Failed to get object details.` });
    }
});

// POST /room/unlock - Unlock a room for a user
router.post('/room/unlock', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    const { password_guess } = req.body;
    console.log(`API: Received /room/unlock request for user ${userId}`);
    if (typeof password_guess !== 'string') {
        res.status(400).json({ error: 'Password guess must be a string.' });
        return;
    }
    const user = users[userId]; // Ensure user exists
    if (!user) {
        res.status(401).json({ error: 'User not found.' });
        return;
    }
    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found." });
        return;
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
        } else if (responseData.unlocked) {
            if (gameInstance instanceof MultiRoomGame) {
                 userSession.currentRoomSequence = gameInstance.getCurrentRoomNumber();
                 userSession.totalRooms = gameInstance.getTotalRooms();
                 const currentRoomData = gameInstance.getCurrentRoom().getRoomData();
                 userSession.currentRoomName = currentRoomData?.name || 'Unknown Room';
                 responseData.currentRoomName = userSession.currentRoomName;
                 responseData.currentRoom = userSession.currentRoomSequence;
                 responseData.totalRooms = userSession.totalRooms;
            } else if (gameMode === 'default' && result.data?.nextRoom?.id) {
                const nextDefaultRoomId = result.data.nextRoom.id as number;
                const templateAgent = defaultRoomAgents[nextDefaultRoomId];
                if (templateAgent) {
                    const nextDefaultRoomAgent = new RoomAgent(nextDefaultRoomId);
                    const nextRoomData = nextDefaultRoomAgent.getRoomData();
                    userActiveGames[userId] = { 
                        gameInstance: nextDefaultRoomAgent,
                        gameMode: 'default',
                        gameId: nextDefaultRoomId,
                        currentRoomName: nextRoomData?.name || 'Next Room',
                        currentRoomSequence: userSession.currentRoomSequence ? userSession.currentRoomSequence + 1 : nextDefaultRoomId, 
                        totalRooms: Object.keys(ROOM_OBJECTS).length
                    };
                    console.log(`API: User ${userId} progressing to default room ${nextDefaultRoomId}`);
                    responseData.currentRoomName = nextRoomData?.name;
                    responseData.currentRoom = userActiveGames[userId].currentRoomSequence;
                } else {
                    console.log(`API: User ${userId} finished all default rooms.`);
                    responseData.finished = true; 
                    delete userActiveGames[userId];
                }
            }
        }
        res.status(200).json(responseData);
    } catch (error) {
        console.error(`API Error in /room/unlock for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to process unlock attempt." });
    }
});

// POST /chat - Chat with the AI through own API Key
router.post('/chat', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    const { message, model } = req.body;
    const user = users[userId]; // Ensure user exists
    if (!user) {
        res.status(401).json({ error: "User for chat not found." });
        return;
    }
    const userApiKey = user.apiKeys?.openai || user.apiKeys?.anthropic;
    if (!userApiKey) {
        res.status(403).json({ error: "User API key not configured for chat." });
        return;
    }
    const userSession = userActiveGames[userId];
    let roomContext = "AI assistant in an escape room game.";
    let objectsContext = "No game active or objects loaded.";
    if (userSession) {
        const { gameInstance } = userSession;
        let currentRoomData: RoomData | null = null;
        if (gameInstance instanceof MultiRoomGame) {
            currentRoomData = gameInstance.getCurrentRoom().getRoomData();
        } else if (gameInstance instanceof RoomAgent) {
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
        // This requires OpenAI to be imported. It should be at the top of the file.
        let responseText;
        const model_specs: Record<string, any> = {
            'gpt-4o': { max_completion_tokens: 10000, temperature: 0.7, top_p: 1 },
            'gpt-4o-mini': { max_completion_tokens: 10000, temperature: 0.7, top_p: 1 },
             'o3': { reasoning_effort: "medium", store: false },
             'o3-mini': { reasoning_effort: "medium", store: false },
        }

        const currentModelSpec = model_specs[model] || { max_tokens: 150 }; // Default if model not in specs
        const systemContent = `You are an AI assistant in an escape room. Current room: ${roomContext} Objects: ${objectsContext}`;

        if (model.startsWith('gpt') || model.startsWith('o')) {
            console.log(`API: Using model: ${model}`);
            const openai = new OpenAI({ apiKey: userApiKey });
            const completion = await openai.chat.completions.create({
                model, messages: [{ role: "system", content: systemContent }, { role: "user", content: message }],
                ...currentModelSpec 
            });
            responseText = completion.choices[0].message.content;
        } else {
            res.status(400).json({ error: `Unsupported model: ${model}` });
            return;
        }
        res.json({ response: responseText });
    } catch (error) {
        console.error('Chat API Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: 'Chat request failed.', details: errorMessage });
    }
});

export default router; 