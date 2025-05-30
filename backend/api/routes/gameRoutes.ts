// backend/api/routes/gameRoutes.ts
import { Router, Response } from 'express';
import { ROOM_OBJECTS } from '../../constant/objects'; 
import { RoomAgent, RoomData, RoomCommandResponse } from '../../agents/RoomAgent';
import { MultiRoomGame } from '../../agents/MultiRoomGame'; 
import { v4 as uuidv4 } from 'uuid';
import { users } from '../auth/authController';
import { jwtAuth, AuthRequest, UserJwtPayload } from '../auth/jwtMiddleware';
import OpenAI from 'openai'; // Added OpenAI import
import { saveScoreToLeaderboard, getLeaderboard as getFirebaseLeaderboard, getUserBestScores } from '../services/firebaseService';

// TODO: Move UserGameSession and userActiveGames to a more central state management or service layer
interface UserGameSession {
  gameInstance: RoomAgent | MultiRoomGame;
  gameMode: 'default' | 'single-custom' | 'multi-custom'; 
  gameId: string | number; 
  currentRoomName?: string;
  currentRoomSequence?: number;
  totalRooms?: number;
  startTime?: Date; // Added for timer functionality
  endTime?: Date;
  hintsUsed?: number; // Track hints for leaderboard
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

// GET api/game/look - Look around the room (for command /look)
router.get('/look', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    console.log(`API: Received /look request for user ${userId}`);

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found. Start a new game using /newgame." });
        return;
    }

    const { gameInstance } = userSession;
    try {
        const result = await gameInstance.process('/look');
        console.log(`=== /look COMMAND RESULT FOR USER ${userId} ===`);
        console.log(`Raw result:`, JSON.stringify(result, null, 2));
        
        const roomName = result.data?.room?.name || userSession.currentRoomName || 'Unknown Room';
        const objectNames: string[] = result.data?.objects || [];
        
        const response = { 
            roomName,
            objects: objectNames,
            message: result.data?.message || result.response 
        };
        
        console.log(`=== /look API RESPONSE TO CLI ===`);
        console.log(JSON.stringify(response, null, 2));
        
        res.json(response);
    } catch (error) {
        console.error(`[API Error] in /look for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to look around the room." });
    }
});

// GET api/game/inspect - Inspect an object (for command /inpect <object>)
router.get('/inspect', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    const objectName = req.query.object as string;
    console.log(`API: Received /inspect request for object '${objectName}' from user ${userId}`);

    if (!objectName) {
        res.status(400).json({ error: 'Object name is required. Usage: /inspect?object=object_name' });
        return;
    }

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found. Start a new game using /newgame." });
        return;
    }

    const { gameInstance } = userSession;
    try {
        const command = `/inspect ${objectName}`;
        const result = await gameInstance.process(command);
        
        console.log(`=== /inspect COMMAND RESULT FOR USER ${userId} ===`);
        console.log(`Object: ${objectName}`);
        console.log(`Raw result:`, JSON.stringify(result, null, 2));
        
        if (result.data?.object) {
            const response = {
                object: result.data.object,
                message: result.data?.message || `Inspecting ${objectName}`
            };
            
            console.log(`=== /inspect API RESPONSE TO CLI ===`);
            console.log(JSON.stringify(response, null, 2));
            
            res.json(response);
        } else {
            const errorResponse = { error: result.data?.message || `Object '${objectName}' not found.` };
            console.log(`=== /inspect ERROR RESPONSE ===`);
            console.log(JSON.stringify(errorResponse, null, 2));
            
            res.status(404).json(errorResponse);
        }
    } catch (error) {
        console.error(`[API Error] in /inspect for user ${userId}:`, error);
        res.status(500).json({ error: `Failed to inspect object.` });
    }
});

// POST api/game/guess - Guess the puzzle answer for an object 
// (for command /guess <object> <answer>)
router.post('/guess', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    const objectName = req.query.object as string;
    const answer = req.query.answer as string || req.body.answer;
    
    console.log(`API: Received /guess request for object '${objectName}' with answer '${answer}' from user ${userId}`);

    if (!objectName || !answer) {
        res.status(400).json({ 
            error: 'Both object name and answer are required. Usage: /guess <object> <answer>' 
        });
        return;
    }

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found. Start a new game using /newgame." });
        return;
    }

    const { gameInstance } = userSession;
    try {
        const command = `/guess ${objectName} ${answer}`;
        const result = await gameInstance.process(command); // result = { data: { message: string, object: { ...RoomObject, lock: boolean } } }
        res.json({
            message: result.data?.message || result.response || "This command is not supported yet.",
            object: result.data?.object || { 
                name: objectName, 
                description: "No description available.", 
                puzzle: "No puzzle available.", 
                answer: "No answer available.", 
                unlocked: result.data?.object?.unlocked || false
            }
        });
    } catch (error) {
        console.error(`[API Error] in /guess for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to process guess." });
    }
});

// POST api/game/password - Submit the final password to escape 
// (for command /password <password>)
router.post('/password', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    const password = req.query.password as string || req.body.password;
    
    console.log(`API: Received /password request with '${password}' from user ${userId}`);

    if (!password) {
        res.status(400).json({ 
            error: 'Password is required. Usage: /password?password=your_password' 
        });
        return;
    }

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found." });
        return;
    }

    const { gameInstance } = userSession;
    try {
        const command = `/password ${password}`;
        const result = await gameInstance.process(command);
        
        let responseData = {
            escaped: result.data?.escaped || false,
            // correct: result.data?.object?.unlocked || false,
            message: result.data?.message || result.response,
            gameCompleted: result.data?.gameCompleted || false,
            timeElapsed: undefined as number | undefined,
            hintsUsed: userSession.hintsUsed || 0
        };

        // Calculate time elapsed if game is completed
        if (responseData.escaped && userSession.startTime) {
            userSession.endTime = new Date();
            responseData.timeElapsed = Math.floor((userSession.endTime.getTime() - userSession.startTime.getTime()) / 1000);
        }

        if (responseData.gameCompleted) {
            console.log(`API: Game completed for user ${userId}. Time: ${responseData.timeElapsed}s`);
            delete userActiveGames[userId];
        }

        res.json(responseData);
    } catch (error) {
        console.error(`[API Error] in /password for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to process password." });
    }
});

// GET api/game/hint - Get a hint for the current room (
// for command /hint)
router.get('/hint', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    console.log(`API: Received /hint request from user ${userId}`);

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found." });
        return;
    }

    // Track hint usage
    userSession.hintsUsed = (userSession.hintsUsed || 0) + 1;

    const { gameInstance } = userSession;
    try {
        const result = await gameInstance.process('/hint');
        res.json({
            hint: result.data?.hint || result.response,
            hintsUsed: userSession.hintsUsed
        });
    } catch (error) {
        console.error(`[API Error] in /hint for user ${userId}:`, error);
        res.status(500).json({ error: "Failed to get hint." });
    }
});

// POST api/game/restart - Restart the current game (for command /restart)
router.post('/restart', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    console.log(`API: Received /restart request from user ${userId}`);

    const userSession = userActiveGames[userId];
    if (!userSession) {
        res.status(404).json({ error: "No active game found to restart." });
        return;
    }

    // Clean up current game
    delete userActiveGames[userId];
    
    res.json({ 
        message: "Game restarted. Use /newgame to start a new game.",
        success: true 
    });
});

//---------------------------------------------------------------------------------------------------------------------------
// POST /command - Process commands from CLI (fallback for complex commands)
// router.post('/command', async (req: AuthRequest, res: Response): Promise<void> => {
//     const { command } = req.body;
//     const userId = (req.user as UserJwtPayload).sub;
//     console.log(`API: Received command: '${command}' for user: ${userId}`);

//     if (!command) {
//         res.status(400).json({ response: 'Command is required.' });
//         return;
//     }
    
//     const user = users[userId]; // Assuming users are accessible here
//     if (!user) {
//         res.status(401).json({ response: 'User not found or not registered.' });
//         return;
//     }

//     const userSession = userActiveGames[userId];
//     if (!userSession) {
//         res.status(404).json({ response: 'No active game found. Start a new game using /newgame.' });
//         return;
//     }
//     const { gameInstance, gameMode } = userSession;

//     try {
//         console.log(`API: Routing command to ${gameMode} game ID: ${userSession.gameId} for user ${userId}`);
//         const result: RoomCommandResponse = await gameInstance.process(command);
        
//         if (gameInstance instanceof MultiRoomGame) {
//             userSession.currentRoomSequence = gameInstance.getCurrentRoomNumber();
//             userSession.totalRooms = gameInstance.getTotalRooms();
//             const currentRoomData = gameInstance.getCurrentRoom().getRoomData();
//             userSession.currentRoomName = currentRoomData?.name || 'Unknown Room';
//         } else if (gameInstance instanceof RoomAgent) {
//              userSession.currentRoomSequence = 1;
//              userSession.totalRooms = 1;
//              const roomData = gameInstance.getRoomData();
//              userSession.currentRoomName = roomData?.name || 'Unknown Room';
//         }
//         res.json({ response: result.data?.message || result.response || 'Action processed.', data: result.data });
//     } catch (error) {
//         console.error(`Error processing command in ${gameMode} game ${userSession.gameId} for user ${userId}:`, error);
//         res.status(500).json({ response: `Error processing command in ${gameMode} game.` });
//     }
// });
//---------------------------------------------------------------------------------------------------------------------------

// POST /newgame - Create a new escape room (single or multi)
router.post('/newgame', async (req: AuthRequest, res: Response): Promise<void> => {
    const { mode = 'single-room', roomCount, gameTheme } = req.body;
    const userId = (req.user as UserJwtPayload).sub;
    console.log("API: Received /newgame request for user", userId, { body: req.body });

    const user = users[userId];
    if (!user) {
        console.log(`API: User ${userId} not found in in-memory store. Available users:`, Object.keys(users));
        res.status(401).json({ success: false, error: 'User not found or not registered.' });
        return;
    }
    console.log(`API: User ${userId} found in store. API keys:`, user.apiKeys);
    const apiKey = user.apiKeys?.openai || user.apiKeys?.anthropic;
    if (!apiKey) {
        console.log(`API: No API key found for user ${userId}. Mode: ${mode}`);
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
                totalRooms: 1,
                startTime: new Date(), // Start timer
                hintsUsed: 0
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
                totalRooms: multiRoomGame.getTotalRooms(),
                startTime: new Date(), // Start timer
                hintsUsed: 0
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
                totalRooms: Object.keys(ROOM_OBJECTS).length,
                startTime: new Date(), // Start timer
                hintsUsed: 0
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
            
            // Enhanced logging for JSON response debugging
            console.log(`=========================== ROOM DATA GENERATED FOR ${actualGameMode.toUpperCase()} GAME ===========================`);
            console.log(`Room ID: ${initialRoomData.id}`);
            console.log(`Room Name: ${initialRoomData.name}`);
            console.log(`Room Background: ${initialRoomData.background}`);
            console.log(`Room Password: ${initialRoomData.password}`);
            console.log(`Room Hint: ${initialRoomData.hint || 'NO HINT AVAILABLE'}`);
            console.log(`Room Escape Status: ${initialRoomData.escaped}`);
            console.log(`Objects Count: ${Array.isArray(initialRoomData.objects) ? initialRoomData.objects.length : Object.keys(initialRoomData.objects).length}`);
            
            if (Array.isArray(initialRoomData.objects)) {
                console.log(`================================= OBJECTS ARRAY FORMAT ======================================`);
                initialRoomData.objects.forEach((obj, index) => {
                    console.log(`Object ${index + 1}:`);
                    console.log(`  Name: ${obj.name}`);
                    console.log(`  Description: ${obj.description.substring(0, 100)}...`);
                    console.log(`  Puzzle: ${obj.puzzle || 'NO PUZZLE'}`);
                    console.log(`  Answer: ${obj.answer || 'NO ANSWER'}`);
                    console.log(`  Unlocked: ${obj.unlocked}`);
                    console.log(`  Details: ${obj.details ? obj.details.length + ' items' : 'NO DETAILS'}`);
                });
            } else {
                console.log(`================================= OBJECTS RECORD FORMAT ======================================`);
                Object.entries(initialRoomData.objects).forEach(([key, obj]) => {
                    console.log(`Object Key: ${key}`);
                    console.log(`  Name: ${obj.name}`);
                    console.log(`  Description: ${obj.description.substring(0, 100)}...`);
                    console.log(`  Puzzle: ${obj.puzzle || 'NO PUZZLE'}`);
                    console.log(`  Answer: ${obj.answer || 'NO ANSWER'}`);
                    console.log(`  Unlocked: ${obj.unlocked}`);
                    console.log(`  Details: ${obj.details ? obj.details.length + ' items' : 'NO DETAILS'}`);
                });
            }
            
            console.log(`================================= FULL ROOM DATA JSON ======================================`);
            console.log(JSON.stringify(initialRoomData, null, 2));
            
            const gameResponse = {
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
                    totalRooms: responseTotalRooms,
                    startTime: newGameSession.startTime.toISOString(),
                    // Add room data for CLI debugging
                    roomData: initialRoomData
                }
            };
            
            console.log(`================================= API RESPONSE TO CLI ======================================`);
            console.log(JSON.stringify(gameResponse, null, 2));
            
            res.json(gameResponse);
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

// // GET /game/state - Get current game state for a user
router.get('/state', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    console.log(`API: Received /state request for user ${userId}`);

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
//=========================================================================================================================

// // GET /room/objects - List objects in the current room for a user
// router.get('/room/objects', async (req: AuthRequest, res: Response): Promise<void> => {
//     const userId = (req.user as UserJwtPayload).sub;
//     console.log(`API: Received /room/objects request for user ${userId}`);

//     const userSession = userActiveGames[userId];
//     if (!userSession) {
//         res.status(404).json({ error: "No active game found." });
//         return;
//     }
//     const { gameInstance } = userSession;

//     try {
//         const result = await gameInstance.process('/look'); 
//         const roomName = result.data?.room?.name || (
//             gameInstance instanceof RoomAgent ? gameInstance.getRoomData()?.name : (
//                 gameInstance instanceof MultiRoomGame ? gameInstance.getCurrentRoom().getRoomData()?.name : 'Unknown Room'
//             )
//         ) || 'Unknown Room';
//         const objectNames: string[] = result.data?.objects || [];
//         res.json({ roomName: roomName, objects: objectNames });
//     } catch (error) {
//         console.error(`[API Error] in /room/objects for user ${userId}:`, error);
//         res.status(500).json({ error: "Failed to get room objects." });
//     }
// });

// // GET /object/:object_name - Get details of a specific object for a user
// router.get('/object/:object_name', async (req: AuthRequest, res: Response): Promise<void> => {
//     const userId = (req.user as UserJwtPayload).sub;
//     const objectNameParam = req.params.object_name;
//     console.log(`API: Received /object/${objectNameParam} request for user ${userId}`);

//     const userSession = userActiveGames[userId];
//     if (!userSession) {
//         res.status(404).json({ error: "No active game found." });
//         return;
//     }
//     const { gameInstance } = userSession;
//     try {
//         const command = `/inspect ${objectNameParam}`;
//         const result = await gameInstance.process(command);
//         if (result.data?.object) {
//             res.status(200).json(result.data.object);
//         } else {
//             res.status(404).json({ error: result.data?.message || `Object '${objectNameParam}' not found.` });
//         }
//     } catch (error) {
//         console.error(`[API Error] in /object/${objectNameParam} for user ${userId}:`, error);
//         res.status(500).json({ error: `Failed to get object details.` });
//     }
// });

// // POST /room/unlock - Unlock a room for a user
// router.post('/room/unlock', async (req: AuthRequest, res: Response): Promise<void> => {
//     const userId = (req.user as UserJwtPayload).sub;
//     const { password_guess } = req.body;
//     console.log(`API: Received /room/unlock request for user ${userId}`);
//     if (typeof password_guess !== 'string') {
//         res.status(400).json({ error: 'Password guess must be a string.' });
//         return;
//     }
//     const user = users[userId]; // Ensure user exists
//     if (!user) {
//         res.status(401).json({ error: 'User not found.' });
//         return;
//     }
//     const userSession = userActiveGames[userId];
//     if (!userSession) {
//         res.status(404).json({ error: "No active game found." });
//         return;
//     }
//     const { gameInstance, gameMode } = userSession;
//     try {
//         const command = `/guess ${password_guess}`;
//         const result = await gameInstance.process(command);
//         let responseData = {
//             unlocked: result.data?.unlocked || false,
//             finished: result.data?.gameCompleted || false, 
//             message: result.data?.message || "Guess processed.",
//             nextRoom: result.data?.nextRoom, 
//             currentRoomName: userSession.currentRoomName, 
//             currentRoom: userSession.currentRoomSequence,
//             totalRooms: userSession.totalRooms
//         };
//         if (responseData.finished) {
//             console.log(`API: Game finished for user ${userId}. Cleaning up session.`);
//             delete userActiveGames[userId];
//         } else if (responseData.unlocked) {
//             if (gameInstance instanceof MultiRoomGame) {
//                  userSession.currentRoomSequence = gameInstance.getCurrentRoomNumber();
//                  userSession.totalRooms = gameInstance.getTotalRooms();
//                  const currentRoomData = gameInstance.getCurrentRoom().getRoomData();
//                  userSession.currentRoomName = currentRoomData?.name || 'Unknown Room';
//                  responseData.currentRoomName = userSession.currentRoomName;
//                  responseData.currentRoom = userSession.currentRoomSequence;
//                  responseData.totalRooms = userSession.totalRooms;
//             } else if (gameMode === 'default' && result.data?.nextRoom?.id) {
//                 const nextDefaultRoomId = result.data.nextRoom.id as number;
//                 const templateAgent = defaultRoomAgents[nextDefaultRoomId];
//                 if (templateAgent) {
//                     const nextDefaultRoomAgent = new RoomAgent(nextDefaultRoomId);
//                     const nextRoomData = nextDefaultRoomAgent.getRoomData();
//                     userActiveGames[userId] = { 
//                         gameInstance: nextDefaultRoomAgent,
//                         gameMode: 'default',
//                         gameId: nextDefaultRoomId,
//                         currentRoomName: nextRoomData?.name || 'Next Room',
//                         currentRoomSequence: userSession.currentRoomSequence ? userSession.currentRoomSequence + 1 : nextDefaultRoomId, 
//                         totalRooms: Object.keys(ROOM_OBJECTS).length
//                     };
//                     console.log(`API: User ${userId} progressing to default room ${nextDefaultRoomId}`);
//                     responseData.currentRoomName = nextRoomData?.name;
//                     responseData.currentRoom = userActiveGames[userId].currentRoomSequence;
//                 } else {
//                     console.log(`API: User ${userId} finished all default rooms.`);
//                     responseData.finished = true; 
//                     delete userActiveGames[userId];
//                 }
//             }
//         }
//         res.status(200).json(responseData);
//     } catch (error) {
//         console.error(`[API Error] in /room/unlock for user ${userId}:`, error);
//         res.status(500).json({ error: "Failed to process unlock attempt." });
//     }
// });

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
            'gpt-4.1': { max_completion_tokens: 10000, temperature: 0.7, top_p: 1 },
            'gpt-4.1-mini': { max_completion_tokens: 10000, temperature: 0.7, top_p: 1 },
             'o3': { reasoning_effort: "medium", store: false },
             'o3-mini': { reasoning_effort: "medium", store: false },
             'o4-mini': { reasoning_effort: "medium", store: false },
        }

        const currentModelSpec = model_specs[model] || { max_completion_tokens: 150 }; // Default if model not in specs
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

//-----------------------------------------------------------------------------------------------------------------------------
//                                            LEADERBOARD FUNCTIONS
//-----------------------------------------------------------------------------------------------------------------------------

// GET /leaderboard - Get the game leaderboard
router.get('/leaderboard', async (req: AuthRequest, res: Response): Promise<void> => {
    const gameMode = req.query.mode as string || 'all';
    const limit = parseInt(req.query.limit as string) || 10;
    
    console.log(`API: Received /leaderboard request for mode: ${gameMode}`);
    
    try {
        const leaderboard = await getFirebaseLeaderboard(gameMode, limit);
        res.json({
            leaderboard,
            count: leaderboard.length,
            mode: gameMode
        });
    } catch (error) {
        console.error(`[API Error] in /leaderboard:`, error);
        res.status(500).json({ error: "Failed to fetch leaderboard." });
    }
});

// GET /leaderboard/me - Get current user's best scores
router.get('/leaderboard/me', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    const limit = parseInt(req.query.limit as string) || 5;
    
    console.log(`API: Received /leaderboard/me request from user ${userId}`);
    
    try {
        const scores = await getUserBestScores(userId, limit);
        res.json({
            scores,
            count: scores.length,
            userId
        });
    } catch (error) {
        console.error(`[API Error] in /leaderboard/me:`, error);
        res.status(500).json({ error: "Failed to fetch user scores." });
    }
});

// POST /leaderboard/submit - Submit a score to the leaderboard
router.post('/leaderboard/submit', async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = (req.user as UserJwtPayload).sub;
    const { gameId, timeElapsed, hintsUsed, gameMode } = req.body;
    
    console.log(`API: Received leaderboard submission from user ${userId}`);
    
    if (!gameId || !timeElapsed) {
        res.status(400).json({ error: 'GameId and timeElapsed are required.' });
        return;
    }
    
    const user = users[userId];
    if (!user) {
        res.status(401).json({ error: 'User not found.' });
        return;
    }
    
    try {
        const success = await saveScoreToLeaderboard({
            userId,
            userName: user.name,
            gameId,
            timeElapsed,
            hintsUsed: hintsUsed || 0,
            gameMode: gameMode || 'single-custom',
            submittedAt: new Date().toISOString()
        });
        
        if (success) {
            res.json({
                success: true,
                message: "Score submitted successfully to leaderboard"
            });
        } else {
            res.json({
                success: false,
                message: "Score saved locally but Firebase sync failed"
            });
        }
    } catch (error) {
        console.error(`[API Error] in /leaderboard/submit:`, error);
        res.status(500).json({ error: "Failed to submit score." });
    }
});

export default router; 