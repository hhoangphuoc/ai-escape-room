import { getApiUrl } from './apiConfig.js';
import { 
    HelpResponse, 
    LookResponse, 
    InspectResponse, 
    GuessResponse, 
    PasswordResponse, 
    HintResponse, 
    NewGameResponse, 
    LeaderboardResponse,
    AuthResponse,
    UserContext,
    GameContext
} from './responseTypes.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const USER_CONFIG_FILE = path.join(os.homedir(), '.escape-room-config.json');

// Help Command Handler
export const handleHelpCommand = (userContext: UserContext, gameContext: GameContext): HelpResponse => {
    const baseCommands = [
        { command: '/help', description: 'Show this help message' },
        { command: '/history', description: 'Show command history' },
    ];

    const authCommands = userContext.sessionToken ? [
        { command: '/newgame [single-room|multi-room]', description: 'Start a new AI-generated game', usage: '/newgame single-room' },
        { command: '/look', description: 'Look around the current room' },
        { command: '/inspect [object]', description: 'Inspect an object in the room', usage: '/inspect table' },
        { command: '/guess [object] [answer]', description: 'Guess the puzzle answer for an object', usage: '/guess safe 1234' },
        { command: '/password [password]', description: 'Submit the password to unlock the door', usage: '/password escape123' },
        { command: '/hint', description: 'Get a hint about the current puzzle' },
        { command: '/leaderboard', description: 'View the top 10 players on the leaderboard' },
        { command: '/logout', description: 'End your current session' },
    ] : [
        { command: '/register', description: 'Start the registration process' },
        { command: '/login', description: 'Login to the game' },
    ];

    const aiCommands = userContext.hasAICapability ? [
        { command: '/model', description: 'Change AI model for chat assistance' },
    ] : [];

    const commands = [...baseCommands, ...authCommands, ...aiCommands];

    return {
        success: true,
        message: 'Available commands:',
        commands,
        currentContext: {
            hasAI: userContext.hasAICapability,
            currentModel: userContext.selectedModel?.label,
            currentRoom: gameContext.currentRoomName !== 'Loading...' ? gameContext.currentRoomName : undefined,
            gameMode: gameContext.currentGameMode !== 'unknown' ? gameContext.currentGameMode : undefined,
            isAuthenticated: !!userContext.sessionToken,
        }
    };
};

// Look Command Handler
export const handleLookCommand = async (userContext: UserContext): Promise<LookResponse> => {
    if (!userContext.sessionToken) {
        return {
            success: false,
            message: 'You are not in a game session. Please login first.',
            error: 'Not authenticated',
            roomData: { name: '', objects: [] }
        };
    }

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/game/look`, {
            headers: { 'Authorization': `Bearer ${userContext.sessionToken}` }
        });

        if (response.ok) {
            const data = await response.json() as any;
            console.log('=== CLI: /look RESPONSE RECEIVED ===');
            console.log(JSON.stringify(data, null, 2));

            return {
                success: true,
                message: data.message || `You are in ${data.roomName}`,
                roomData: {
                    name: data.roomName || 'Unknown Room',
                    background: data.background,
                    objects: data.objects || []
                }
            } as LookResponse;
        } else {
            const errorData = await response.json() as any;
            console.error('=== CLI: /look ERROR ===');
            console.log(JSON.stringify(errorData, null, 2));
            
            return {
                success: false,
                message: 'Failed to look around the room',
                error: errorData.error || 'Unknown error',
                roomData: { name: '', objects: [] }
            } as LookResponse;
        }
    } catch (error) {
        console.error('=== CLI: /look NETWORK ERROR ===');
        console.error(error);
        
        return {
            success: false,
            message: 'Network error occurred while looking around',
            error: 'Network error',
            roomData: { name: '', objects: [] }
        } as LookResponse;
    }
};

// Inspect Command Handler
export const handleInspectCommand = async (objectName: string, userContext: UserContext): Promise<InspectResponse> => {
    if (!userContext.sessionToken) {
        return {
            success: false,
            message: 'You are not in a game session. Please login first.',
            error: 'Not authenticated'
        };
    }

    if (!objectName) {
        return {
            success: false,
            message: 'Object name is required.',
            error: 'Missing object name'
        };
    }

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/game/inspect?object=${encodeURIComponent(objectName)}`, {
            headers: { 'Authorization': `Bearer ${userContext.sessionToken}` }
        });

        const data = await response.json() as any;
        console.log('=== CLI: /inspect RESPONSE RECEIVED ===');
        console.log(`Object: ${objectName}`);
        console.log(JSON.stringify(data, null, 2));

        if (response.ok && data.object) {
            return {
                success: true,
                message: data.message || `Inspecting ${objectName}...`,
                objectData: {
                    name: data.object.name,
                    description: data.object.description,
                    puzzle: data.object.puzzle,
                    answer: data.object.answer,
                    unlocked: data.object.unlocked || false,
                    details: data.object.details
                }
            } as InspectResponse;
        } else {
            return {
                success: false,
                message: data.error || `Could not inspect ${objectName}.`,
                error: data.error || 'Object not found'
            } as InspectResponse;
        }
    } catch (error) {
        console.error('=== CLI: /inspect NETWORK ERROR ===');
        console.error(error);
        
        return {
            success: false,
            message: 'Network error occurred while inspecting object',
            error: 'Network error'
        } as InspectResponse;
    }
};

// Guess Command Handler
export const handleGuessCommand = async (objectName: string, answer: string, userContext: UserContext): Promise<GuessResponse> => {
    if (!userContext.sessionToken) {
        return {
            success: false,
            message: 'You are not in a game session. Please login first.',
            error: 'Not authenticated',
            objectData: { name: objectName, unlocked: false, correctAnswer: false }
        };
    }

    if (!objectName || !answer) {
        return {
            success: false,
            message: 'Both object name and answer are required.',
            error: 'Missing parameters',
            objectData: { name: objectName, unlocked: false, correctAnswer: false }
        };
    }

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/game/guess?object=${encodeURIComponent(objectName)}&answer=${encodeURIComponent(answer)}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${userContext.sessionToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json() as any;
        console.log('=== CLI: /guess RESPONSE RECEIVED ===');
        console.log(JSON.stringify(data, null, 2));

        if (response.ok && data.object) {
            return {
                success: true,
                message: data.message,
                objectData: {
                    name: data.object.name,
                    unlocked: data.object.unlocked || false,
                    correctAnswer: data.object.unlocked || false
                }
            } as GuessResponse;
        } else {
            return {
                success: false,
                message: data.error || 'Failed to process guess.',
                error: data.error || 'Guess failed',
                objectData: { name: objectName, unlocked: false, correctAnswer: false }
            } as GuessResponse;
        }
    } catch (error) {
        console.error('=== CLI: /guess NETWORK ERROR ===');
        console.error(error);
        
        return {
            success: false,
            message: 'Network error occurred while processing guess',
            error: 'Network error',
            objectData: { name: objectName, unlocked: false, correctAnswer: false }
        } as GuessResponse;
    }
};

// Password Command Handler
export const handlePasswordCommand = async (password: string, userContext: UserContext): Promise<PasswordResponse> => {
    if (!userContext.sessionToken) {
        return {
            success: false,
            message: 'You are not in a game session. Please login first.',
            error: 'Not authenticated',
            gameResult: { escaped: false, gameCompleted: false }
        };
    }

    if (!password) {
        return {
            success: false,
            message: 'Password is required.',
            error: 'Missing password',
            gameResult: { escaped: false, gameCompleted: false }
        };
    }

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/game/password?password=${encodeURIComponent(password)}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${userContext.sessionToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json() as any;
        console.log('=== CLI: /password RESPONSE RECEIVED ===');
        console.log(JSON.stringify(data, null, 2));

        return {
            success: data.escaped || false,
            message: data.message + (data.timeElapsed ? `\nTime: ${data.timeElapsed} seconds` : ''),
            gameResult: {
                escaped: data.escaped || false,
                gameCompleted: data.gameCompleted || false,
                timeElapsed: data.timeElapsed,
                hintsUsed: data.hintsUsed
            }
        } as PasswordResponse;
    } catch (error) {
        console.error('=== CLI: /password NETWORK ERROR ===');
        console.error(error);
        
        return {
            success: false,
            message: 'Network error occurred while checking password',
            error: 'Network error',
            gameResult: { escaped: false, gameCompleted: false }
        } as PasswordResponse;
    }
};

// Hint Command Handler
export const handleHintCommand = async (userContext: UserContext): Promise<HintResponse> => {
    if (!userContext.sessionToken) {
        return {
            success: false,
            message: 'You are not in a game session. Please login first.',
            error: 'Not authenticated',
            hintData: { hint: '', hintsUsed: 0 }
        };
    }

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/game/hint`, {
            headers: { 'Authorization': `Bearer ${userContext.sessionToken}` }
        });

        const data = await response.json() as any;
        console.log('=== CLI: /hint RESPONSE RECEIVED ===');
        console.log(JSON.stringify(data, null, 2));

        let hintText = '';
        if (typeof data.hint === 'string') {
            hintText = data.hint;
        } else if (data.hint) {
            hintText = JSON.stringify(data.hint, null, 2);
        } else if (data.message) {
            hintText = typeof data.message === 'string' ? data.message : JSON.stringify(data.message, null, 2);
        } else {
            hintText = "No hints available.";
        }

        return {
            success: true,
            message: hintText,
            hintData: {
                hint: hintText,
                hintsUsed: data.hintsUsed || 0,
                hintType: 'general'
            }
        } as HintResponse;
    } catch (error) {
        console.error('=== CLI: /hint ERROR ===');
        console.error(error);
        
        return {
            success: false,
            message: 'Network error occurred while getting hint',
            error: 'Network error',
            hintData: { hint: '', hintsUsed: 0 }
        } as HintResponse;
    }
};

// New Game Command Handler
export const handleNewGameCommand = async (mode: string = 'single-room', userContext: UserContext): Promise<NewGameResponse> => {
    if (!userContext.sessionToken) {
        return {
            success: false,
            message: 'You are not in a game session. Please login first.',
            error: 'Not authenticated',
            gameData: { id: '', name: '', background: '', mode: '', currentRoom: 1, totalRooms: 1, objectCount: 0 }
        };
    }

    const requestedMode = (mode === 'multi-room') ? 'multi-room' : 'single-room';
    
    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/game/newgame`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userContext.sessionToken}`
            },
            body: JSON.stringify({ mode: requestedMode })
        });

        const data = await response.json() as any;
        console.log('=== CLI: api/game/newgame RESPONSE RECEIVED ===');
        console.log(JSON.stringify(data, null, 2));

        if (data.success && data.game) {
            const gameInfo = data.game;
            
            // Enhanced logging for debugging
            if (data.game.roomData) {
                console.log('=== CLI: ROOM DATA RECEIVED ===');
                console.log(`Room Name: ${data.game.roomData.name}`);
                console.log(`Room Password: ${data.game.roomData.password}`);
                console.log(`Room Hint: ${data.game.roomData.hint || 'No hint available'}`);
                console.log(`Objects:`, data.game.roomData.objects);
            }

            const gameMessage = `
New ${gameInfo.mode || 'custom'} game created successfully!
Room ${gameInfo.currentRoom || 1}${gameInfo.totalRooms && gameInfo.totalRooms > 1 ? ` of ${gameInfo.totalRooms}` : ''}: ${gameInfo.name}
${gameInfo.background || ""}
This room contains ${gameInfo.objectCount !== undefined ? gameInfo.objectCount : '?'} objects. Use /look to see them.
${data.game.roomData?.hint ? `\nHint: ${data.game.roomData.hint}` : ''}
Password needed to escape. Use /password [your_guess] when ready!`;

            return {
                success: true,
                message: gameMessage.trim(),
                gameData: {
                    id: gameInfo.id || '',
                    name: gameInfo.name || 'Untitled Room',
                    background: gameInfo.background || 'No description provided.',
                    mode: gameInfo.mode || requestedMode,
                    currentRoom: gameInfo.currentRoom || 1,
                    totalRooms: gameInfo.totalRooms || 1,
                    objectCount: gameInfo.objectCount || 0,
                    startTime: gameInfo.startTime
                }
            } as NewGameResponse;
        } else {
            console.error('=== CLI: NEWGAME FAILED ===');
            console.log('Response data:', data);
            
            return {
                success: false,
                message: `Failed to create new game: ${data.error || "Unknown error"}`,
                error: data.error || "Unknown error",
                gameData: { id: '', name: '', background: '', mode: '', currentRoom: 1, totalRooms: 1, objectCount: 0 }
            } as NewGameResponse;
        }
    } catch (error) {
        console.error('=== CLI: NEWGAME NETWORK ERROR ===');
        console.error(error);
        
        return {
            success: false,
            message: 'Network error occurred while creating new game',
            error: 'Network error',
            gameData: { id: '', name: '', background: '', mode: '', currentRoom: 1, totalRooms: 1, objectCount: 0 }
        } as NewGameResponse;
    }
};

// Leaderboard Command Handler
export const handleLeaderboardCommand = async (userContext: UserContext): Promise<LeaderboardResponse> => {
    if (!userContext.sessionToken) {
        return {
            success: false,
            message: 'You are not in a game session. Please login first.',
            error: 'Not authenticated',
            leaderboardData: { entries: [], count: 0, mode: 'all' }
        };
    }

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/game/leaderboard/games`, {
            headers: { 'Authorization': `Bearer ${userContext.sessionToken}` }
        });

        if (response.ok) {
            const data = await response.json() as any;
            console.log('=== CLI: /leaderboard RESPONSE RECEIVED ===');
            console.log(JSON.stringify(data, null, 2));

            if (data.leaderboard && data.leaderboard.length > 0) {
                const entries = data.leaderboard.map((entry: any, index: number) => ({
                    rank: index + 1,
                    userName: entry.userName,
                    timeElapsed: entry.timeElapsed,
                    hintsUsed: entry.hintsUsed,
                    gameMode: entry.gameMode,
                    completedAt: entry.completedAt
                }));

                let leaderboardText = "🏆 TOP 10 LEADERBOARD 🏆\n\n";
                leaderboardText += "Rank | Player | Time | Hints | Mode\n";
                leaderboardText += "─────┼────────┼──────┼───────┼─────────\n";
                
                entries.forEach((entry: any) => {
                    const rank = entry.rank.toString().padStart(4, ' ');
                    const player = entry.userName.substring(0, 8).padEnd(8, ' ');
                    const time = `${entry.timeElapsed}s`.padEnd(6, ' ');
                    const hints = entry.hintsUsed.toString().padStart(5, ' ');
                    const mode = entry.gameMode.substring(0, 9).padEnd(9, ' ');
                    leaderboardText += `${rank} │ ${player} │ ${time} │${hints} │ ${mode}\n`;
                });

                return {
                    success: true,
                    message: leaderboardText,
                    leaderboardData: {
                        entries,
                        count: entries.length,
                        mode: data.mode || 'all'
                    }
                } as LeaderboardResponse;
            } else {
                return {
                    success: true,
                    message: "No completed games found on the leaderboard yet. Be the first to complete a game!",
                    leaderboardData: { entries: [], count: 0, mode: 'all' }
                } as LeaderboardResponse;
            }
        } else {
            const errorData = await response.json() as any;
            return {
                success: false,
                message: 'Failed to fetch leaderboard',
                error: errorData.error || 'Unknown error',
                leaderboardData: { entries: [], count: 0, mode: 'all' }
            } as LeaderboardResponse;
        }
    } catch (error) {
        console.error('=== CLI: /leaderboard NETWORK ERROR ===');
        console.error(error);
        
        return {
            success: false,
            message: 'Network error occurred while fetching leaderboard',
            error: 'Network error',
            leaderboardData: { entries: [], count: 0, mode: 'all' }
        } as LeaderboardResponse;
    }
};

// Logout Command Handler
export const handleLogoutCommand = (): AuthResponse => {
    // Clear user config file if it exists
    if (fs.existsSync(USER_CONFIG_FILE)) {
        try {
            fs.unlinkSync(USER_CONFIG_FILE);
        } catch (error) {
            console.error('Error clearing config file:', error);
        }
    }

    return {
        success: true,
        message: "Logged out successfully."
    };
};

// Login Command Handler
export const handleLoginCommand = async (): Promise<AuthResponse> => {
    let configUserId: string | undefined;
    let configApiKey: string | undefined;
    let configName: string | undefined;
    let configProvider: 'openai' | 'anthropic' = 'openai';

    if (fs.existsSync(USER_CONFIG_FILE)) {
        try {
            const config = JSON.parse(fs.readFileSync(USER_CONFIG_FILE, 'utf-8'));
            configUserId = config.userId;
            configName = config.name;
            
            // Get API key from config
            if (config.apiKeys?.openai) {
                configApiKey = config.apiKeys.openai;
                configProvider = 'openai';
            } else if (config.apiKeys?.anthropic) {
                configApiKey = config.apiKeys.anthropic;
                configProvider = 'anthropic';
            }
        } catch (error) {
            return {
                success: false,
                message: 'Error reading config file',
                error: 'Config file corrupted'
            } as AuthResponse;
        }
    }

    if (configUserId) {
        console.log('=== CLI: Manual login attempt ===');
        console.log('UserId:', configUserId);
        console.log('API Key available:', !!configApiKey);
        console.log('Provider:', configProvider);

        try {
            // Import dynamically to avoid circular dependencies
            const { handleLogin } = await import('../components/UserRegistration.js');
            const loginResponse = await handleLogin(configUserId, configApiKey, configProvider);
            const loginData = await loginResponse.json() as any;
            
            if (loginResponse.ok && loginData.token) {
                return {
                    success: true,
                    message: "Logged in successfully.",
                    userData: {
                        userId: configUserId,
                        userName: configName || 'Unknown User',
                        token: loginData.token,
                        apiKey: configApiKey
                    }
                } as AuthResponse;
            } else {
                return {
                    success: false,
                    message: `Login failed: ${loginData.error || 'Unknown error'}`,
                    error: loginData.error || 'Unknown error'
                } as AuthResponse;
            }
        } catch (error) {
            return {
                success: false,
                message: 'Network error during login',
                error: 'Network error'
            } as AuthResponse;
        }
    } else {
        return {
            success: false,
            message: 'No user configuration found. Please register first.',
            error: 'No config found'
        } as AuthResponse;
    }
}; 