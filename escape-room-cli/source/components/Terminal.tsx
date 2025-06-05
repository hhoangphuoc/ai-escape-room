import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import CommandInput from './CommandInput.js';
import CommandHistory from './CommandHistory.js';
import ScrollableBox from './ScrollableBox.js';
import Gradient from 'ink-gradient';
import ModelSelector from './ModelSelector.js';
import McpClientUI from './McpClientUI.js';
import { MODELS_COLLECTION, type ModelOption } from '../utils/constants.js';
import { getApiUrl } from '../utils/apiConfig.js';
import UserRegistration  from './UserRegistration.js';
import { 
    handleHelpCommand,
    handleLookCommand,
    handleInspectCommand,
    handleGuessCommand,
    handlePasswordCommand,
    handleHintCommand,
    handleNewGameCommand,
    handleLeaderboardCommand,
    handleLogoutCommand,
    handleLoginCommand
} from '../utils/commandHandlers.js';
import { 
    displayResponse,
    // DisplayMode,
    type HistoryItem
} from '../utils/responseDisplay.js';
import { 
    UserContext, 
    GameContext 
} from '../utils/responseTypes.js';

// // --------------------------------------------------------------------------------------------------
interface TerminalProps {
	// mode: 'standard' | 'mcp';
	// These initial props might be less relevant if UserRegistration handles initial load
	// apiKey?: string; 
	// userId?: string;
}


// Structure expected from backend game endpoints (subset)
// interface GameInfo {
//     id?: string | number;
//     name?: string;
//     background?: string;
//     currentRoom?: number; // Sequence number
//     totalRooms?: number;
//     mode?: string;
//     objectCount?: number;
// }

const Terminal: React.FC<TerminalProps> = (/*{ apiKey: initialApiKey, userId: initialUserId }*/) => {
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [currentCommand, setCurrentCommand] = useState('');
	const [isConnected, setIsConnected] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
	const [isLoadingGame, setIsLoadingGame] = useState(false);
	const [isProcessingCommand, setIsProcessingCommand] = useState(false);
	const [hasAICapability] = useState<boolean>(false); // Determined by presence of API key in state
	const [showModelSelector, setShowModelSelector] = useState(false);
	const [selectedModel, setSelectedModel] = useState<ModelOption>(Object.values(MODELS_COLLECTION)[0] as ModelOption);

	// User and Auth State
	const [userId, setUserId] = useState<string | undefined>(undefined);
	const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
    const [userName, setUserName] = useState<string | undefined>(undefined);
    const [cliApiKey, setCliApiKey] = useState<string | undefined>(undefined); // API key for current session, if provided

	// MCP RELATED STATE
	const [mcpMode, setMcpMode] = useState(false);
	const [showMcpClient, setShowMcpClient] = useState(false);

	// Game State
    const [currentGameId, setCurrentGameId] = useState<string | number | null>(null);
	const [currentRoomName, setCurrentRoomName] = useState('Loading...');
	const [currentRoomBackground, setCurrentRoomBackground] = useState('Please wait or type /help.');
    const [currentGameMode, setCurrentGameMode] = useState<'default' | 'single-custom' | 'multi-custom' | 'unknown'>('unknown');
    const [unlockedObjects, setUnlockedObjects] = useState<Array<string>>([]);
    const [currentRoomObjects, setCurrentRoomObjects] = useState<Array<string>>([]); //TODO: Fetch list of objects names from the backend
    const [totalRooms, setTotalRooms] = useState<number>(1);
    //-------------------------------------------------------------------------------------------------

	const checkBackendConnection = async () => {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 1000);
			const apiUrl = getApiUrl();
			const response = await fetch(`${apiUrl}/api/health`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			setIsConnected(response.ok);
            if (response.ok) {
                if (userId && sessionToken) { // Only fetch game state if logged in
                    fetchGameState();
                } else {
					setCurrentRoomName('Instructions:');
					setCurrentRoomBackground(`This is the beginning of everything. Explore the AI Escape Room and solve the puzzle as fast as you can to escape.
						\nIn this room, you will have to find a password to unlock the door. There are several puzzles scattered around the room, underneath the objects. Every puzzle have it's own way, but don't worry, it all leads you to the password, one way or another ;) Discover them all to find out.
						\nYou can do it manually, ask the AI, or build your own strategy. Your choice ;)
						\nReady to challenge? Type /newgame to start. Or type /help for more information.
						
						\n PS: Use an AI is always easier, is it true?`);
                }
            } else {
                setCurrentRoomName('Connection Error');
                setCurrentRoomBackground(`Could not connect to backend at ${apiUrl}.`);
            }
		} catch (error) {
			setIsConnected(false);
            setCurrentRoomName('Connection Error');
            setCurrentRoomBackground('Could not connect to backend. Is it running?');
			console.error('Backend connection error:', error);
		}
	};

    // -------------------------------------------------------------------------------------------------
    // 								FETCH GAME STATE
    // -------------------------------------------------------------------------------------------------
    async function fetchGameState() {
        if (!sessionToken) {
            console.warn("fetchGameState called without a sessionToken.");
            return;
        }
        try {
            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/api/game/state`, { // No userId in query, uses token
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            if (!response.ok) {
                 const errorData = await response.json() as any; //FIXME: as { error: string };
                 throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Failed to fetch state'}`);
            }
            const data = await response.json() as any; //FIXME: as { currentRoomName: string; gameMode: string; gameId: string | number | null; totalRooms: number };
            setCurrentRoomName(data.currentRoomName || 'Unknown Room');
            setCurrentGameMode(data.gameMode || 'unknown');
            setCurrentGameId(data.gameId || null);
            setTotalRooms(data.totalRooms || 1);
            // setCurrentRoomBackground(data.background || 'Welcome! Type /help.'); 
        } catch (error) {
            console.error("Error fetching game state:", error);
            setCurrentRoomName('State Error');
            setCurrentRoomBackground('Could not fetch current game state from backend. Try start a new game with /newgame.');
        }
    };

    // -------------------------------------------------------------------------------------------------
    // 								SEND COMMAND
    // -------------------------------------------------------------------------------------------------
    async function sendCommand(command: string): Promise<string> {
        setIsProcessingCommand(true);
        setLoadingMessage('Processing...');
        let responseText = 'Error processing command.';
        const apiUrl = getApiUrl();

        if (!sessionToken) {
            setIsProcessingCommand(false);
            return "Error: Not authenticated. Please login or register.";
        }

        try {
            const response = await fetch(`${apiUrl}/api/game/command`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ command: command }), // No userId in body
            });
            // ... (rest of error handling and response parsing remains similar) ...
            if (!response.ok) {
                try {
                    const errorData = await response.json() as any; //FIXME: as { response: string; error: string };
                    responseText = `Error: ${errorData.response || errorData.error || response.statusText}`;
                } catch { 
                    responseText = `Error: Received status ${response.status}`;
                }
                console.error('Command API error:', responseText);
            } else {
                const data = await response.json() as any; //FIXME: as { response: string; data: { room: { name: string; background: string }; nextRoom: { name: string }; gameCompleted: boolean } };
                responseText = data.response || 'Action completed.';
                if (data.data) {
                    const gameData = data.data;

                    // Update room objects
                    if (gameData.objects) setCurrentRoomObjects(gameData.objects.map((obj: any) => obj.name));

                    // Update room name and background
                    if (gameData.room) {
                        setCurrentRoomName(gameData.room.name || 'Unknown Room');
                        if(gameData.room.background) setCurrentRoomBackground(gameData.room.background);
                    }

                    // Update room name and background if the room was escaped
                    if (gameData.nextRoom && gameData.escaped) {
                        setCurrentRoomName(gameData.nextRoom.name || 'Next Room');
                        setCurrentRoomBackground(`Moved to ${gameData.nextRoom.name}. Type /look to look around.`);
                         // Fetch full state for the new room if backend doesn't provide all details
                        fetchGameState();
                    }

                    // Update room name and background if the game was completed
                    if (gameData.gameCompleted) {
                        responseText += "\n\nCongratulations! You've completed the game!";
                        setCurrentRoomName('Congratulations!');
                        setCurrentRoomBackground('Game Completed. You can start try out with a new game [/newgame] or [/logout] to end your session.');
                        setCurrentGameId(null); 
                    }
                } 
                else if (command.toLowerCase().startsWith('/look')) {
                    fetchGameState(); 
                }
            }
        } catch (err) {
            console.error('Error sending command:', err);
            responseText = 'Network error: Could not communicate with the backend.';
            setIsConnected(false);
        } finally {
            setIsProcessingCommand(false);
            setLoadingMessage('');
        }
        return responseText;
    };

    // -------------------------------------------------------------------------------------------------
    // 								PROCESS NATURAL LANGUAGE
    // -------------------------------------------------------------------------------------------------
    async function processNaturalLanguage(text: string): Promise<string> {

		const apiKey = cliApiKey || process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'];
		if (!apiKey) return "Error: No API key available for AI chat.";

        if (!sessionToken) return "Error: Not authenticated for AI chat.";

        const apiUrl = getApiUrl();
		setIsProcessingCommand(true);
		setLoadingMessage(`Thinking with ${selectedModel.label}...`);
		try {
		    const response = await fetch(`${apiUrl}/api/game/chat`, {
			method: 'POST',
			headers: { 
			    'Content-Type': 'application/json',
			    'Authorization': `Bearer ${sessionToken}` // Authenticate the user session
			},
			body: JSON.stringify({ 
			    message: text,
			    model: selectedModel.value,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json() as any; //FIXME: as { error: string };
			return `AI Chat Error: ${errorData.error || 'Unknown error'}`;
		}
		const data = await response.json() as any; //FIXME: as { response: string; data: { room: { name: string; background: string }; nextRoom: { name: string }; gameCompleted: boolean } };
		return data.response || "AI couldn't understand that.";
		} catch (error) {
		    return "Error with AI chat request.";
		} finally {
		    setIsProcessingCommand(false);
		    setLoadingMessage('');
		}
	};

    // Helper function to create user and game context for help handlers
	const createUserContext = (): UserContext => ({
		userId,
		sessionToken,
		userName,
		cliApiKey,
		hasAICapability,
		selectedModel
	});

	const createGameContext = (): GameContext => ({
		currentGameId,
		currentRoomName,
		currentRoomBackground,
		currentGameMode,
		totalRooms,
		unlockedObjects,
		currentRoomObjects
	});
    //-------------------------------------------------------------------------------------------------

	// // `/newgame [mode]`
	// async function handleGenerateNewGame(mode: string = 'single-room'): Promise<string> {
    //     const requestedMode = (mode === 'multi-room') ? 'multi-room' : 'single-room';
    //     const apiUrl = getApiUrl();
    //     if (!sessionToken) {
    //         return "Error: Not authenticated. Please login or register.";
    //     }
	// 	try {
	// 		setIsLoadingGame(true);
	// 		setLoadingMessage(`Preparing an AI-generated [${requestedMode}] Escape Game...`);
	// 		const response = await fetch(`${apiUrl}/api/game/newgame`, {
	// 			method: 'POST',
	// 			headers: { 
    //                 'Content-Type': 'application/json',
    //                 'Authorization': `Bearer ${sessionToken}`
    //             },
    //             body: JSON.stringify({ mode: requestedMode }) // No userId in body
	// 		});
	// 		const data = await response.json() as any; //FIXME: as { success: boolean; game: GameInfo };
			
	// 		// Enhanced logging for debugging
	// 		console.log('=== CLI: api/game/newgame RESPONSE RECEIVED ===');
	// 		console.log(JSON.stringify(data, null, 2));
			
	// 		if (data.success && data.game) {
    //             const gameInfo: GameInfo = data.game;
                
    //             // Check if roomData is included in the response
    //             if (data.game.roomData) {
    //                 console.log('=== CLI: ROOM DATA RECEIVED ===');
    //                 console.log(`Room Name: ${data.game.roomData.name}`);
    //                 console.log(`Room Password: ${data.game.roomData.password}`);
    //                 console.log(`Room Hint: ${data.game.roomData.hint || 'No hint available'}`);
    //                 console.log(`Room Escape Status: ${data.game.roomData.escape}`);
    //                 console.log(`Objects:`, data.game.roomData.objects);
                    
    //                 if (Array.isArray(data.game.roomData.objects)) {
    //                     console.log(`=== CLI: OBJECTS STRUCTURE ===`);
    //                     data.game.roomData.objects.forEach((obj: any, index: number) => {
    //                         console.log(`Object ${index + 1}:`);
    //                         console.log(`  Name: ${obj.name}`);
    //                         console.log(`  Description: ${obj.description}`);
    //                         console.log(`  Puzzle: ${obj.puzzle || 'NO PUZZLE'}`);
    //                         console.log(`  Answer: ${obj.answer || 'NO ANSWER'}`);
    //                         console.log(`  Lock: ${obj.lock}`);
    //                     });
    //                 }
    //             }
                
	// 			// Update state based on response
    //             setCurrentGameId(gameInfo.id || null);
	// 			setCurrentRoomName(gameInfo.name || 'Untitled Room');
	// 			setCurrentRoomBackground(gameInfo.background || 'No description provided.');
    //             setCurrentGameMode(gameInfo.mode === 'multi-room' ? 'multi-custom' : 'single-custom');
    //             setTotalRooms(gameInfo.totalRooms || 1);

	// 			return `
	// 				New ${gameInfo.mode || 'custom'} game created successfully!
	// 				\nRoom ${gameInfo.currentRoom || 1}${gameInfo.totalRooms && gameInfo.totalRooms > 1 ? ` of ${gameInfo.totalRooms}` : ''}: ${gameInfo.name}
	// 				\n${gameInfo.background || ""}
	// 				\nThis room contains ${gameInfo.objectCount !== undefined ? gameInfo.objectCount : '?'} objects. Use /look to see them.
	// 				${data.game.roomData?.hint ? `\nHint: ${data.game.roomData.hint}` : ''}
	// 				\nPassword needed to escape. Use /password [your_guess] when ready!
	// 				`;
	// 		} else {
	// 		    console.error('=== CLI: NEWGAME FAILED ===');
	// 		    console.log('Response data:', data);
	// 			return `Failed to create new game: ${data.error || "Unknown error"}`;
	// 		}
	// 	} catch (error) {
	// 	    console.error('=== CLI: NEWGAME NETWORK ERROR ===');
	// 	    console.error(error);
	// 		setIsConnected(false);
	// 		return 'Error communicating with the server.';
	// 	} finally {
	// 		setIsLoadingGame(false);
	// 		setLoadingMessage('');
	// 	}
	// }


    // -------------------------------------------------------------------------------------------------
    // `/logout` command
    // async function handleLogout() {
    //     setUserId(undefined);
    //     setSessionToken(undefined);
    //     setUserName(undefined);
    //     setCliApiKey(undefined); // Clear session API key
    //     setCurrentGameId(null);
    //     setCurrentRoomBackground('You have been logged out. Type /register or /login');
    //     setCurrentGameMode('unknown');
	// 	setTotalRooms(0);
    //     return "Logged out successfully.";
    // }


    // -------------------------------------------------------------------------------------------------
    // // `/login` command
	// async function handleCliLogin() {
	// 	let configUserId: string | undefined;
	// 	let configApiKey: string | undefined;
	// 	let configProvider: 'openai' | 'anthropic' = 'openai';
		
	// 	if (fs.existsSync(USER_CONFIG_FILE)) {
	// 		const config = JSON.parse(fs.readFileSync(USER_CONFIG_FILE, 'utf-8'));
	// 		configUserId = config.userId;
	// 		setUserId(config.userId);
	// 		setUserName(config.name);
			
	// 		// Get API key from config
	// 		if (config.apiKeys?.openai) {
	// 			configApiKey = config.apiKeys.openai;
	// 			configProvider = 'openai';
	// 		} else if (config.apiKeys?.anthropic) {
	// 			configApiKey = config.apiKeys.anthropic;
	// 			configProvider = 'anthropic';
	// 		}
	// 		setCliApiKey(configApiKey);
	// 	}
		
	// 	if (configUserId) {
    //         console.log('=== CLI: Manual login attempt ===');
    //         console.log('UserId:', configUserId);
    //         console.log('API Key available:', !!configApiKey);
    //         console.log('Provider:', configProvider);
            
    //         const loginResponse = await handleLogin(configUserId, configApiKey, configProvider);
    //         const loginData = await loginResponse.json() as any; //FIXME: as { token: string; error?: string };
    //         if (loginResponse.ok && loginData.token) {
    //             setSessionToken(loginData.token);
    //             return "Logged in successfully.";
    //         } else {
    //             setCurrentRoomName('Login Error');
    //             return `Login failed: ${loginData.error || 'Unknown error'}`;
    //         }
	// 	} else {
	// 		setCurrentRoomName('Login Error');
	// 		setCurrentRoomBackground('Could not login. Please check your credentials and try again.');
	// 		return "Login Error: No user ID found.";
	// 	}
	// }
    //-------------------------------------------------------------------------------------------------


    // -------------------------------------------------------------------------------------------------
    // `/mcp` command
    //FIXME: MCP mode is not fully implemented yet.
    async function handleMcpCommand(command: string): Promise<string> {
		if (command === '/exit-mcp' || command === '/standard') {
			setMcpMode(false);
			setShowMcpClient(false);
			return "Exiting MCP mode and returning to standard mode.";
		}
		if (command === '/help') {
			return "MCP Help: ... TO BE IMPLEMENTED ...";
		}
		return `MCP command processing not fully implemented yet: ${command}`;
    }
    //-------------------------------------------------------------------------------------------------

    // -----------------------------------------------------------------------------------------------------------------------------------
	// 								                MAIN COMMAND HANDLER
	// -------------------------------------------------------------------------------------------------
	async function handleCommand(command: string) {
		if (showModelSelector) return;
		setHistory(prev => [...prev, { type: 'command', text: command }]);
		if (command !== '/history') setShowHistory(false);

		if (command === '/mcp') {
			setHistory(prev => [...prev, { type: 'response', text: 'Switching to MCP mode...' }]);
			setMcpMode(true);
			setShowMcpClient(true);
			return;
		}

		let response: string;
		if (mcpMode) {
			response = await handleMcpCommand(command);
		} else {
		    if (command.startsWith('/')) {
			    const parts = command.trim().split(' ');
			    const cmd = parts[0]?.toLowerCase();
			    if (!cmd) {
                    response = "Unknown command.";
                } else {
                    switch (cmd) {
                        case '/help': {
                            const helpResponse = handleHelpCommand(createUserContext(), createGameContext());
                            const displayItems = displayResponse(helpResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            return;
                        }
                        case '/logout': {
                            const logoutResponse = handleLogoutCommand();
                            const displayItems = displayResponse(logoutResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            // Clear user state after logout
                            setUserId(undefined);
                            setSessionToken(undefined);
                            setUserName(undefined);
                            setCliApiKey(undefined);
                            setCurrentGameId(null);
                            setCurrentRoomBackground('You have been logged out. Type /register or /login');
                            setCurrentGameMode('unknown');
                            setTotalRooms(0);
                            return;
                        }
                        case '/login': {
                            const loginResponse = await handleLoginCommand();
                            const displayItems = displayResponse(loginResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            if (loginResponse.success && loginResponse.userData) {
                                setUserId(loginResponse.userData.userId);
                                setUserName(loginResponse.userData.userName);
                                setSessionToken(loginResponse.userData.token);
                                setCliApiKey(loginResponse.userData.apiKey);
                                fetchGameState();
                            }
                            return;
                        }
                        case '/register':
                             response = "To register, please restart the application without a saved session, or use CLI flags.";
                             break;
                        // Protected commands below - require sessionToken
                        case '/look': {
                            const lookResponse = await handleLookCommand(createUserContext());
                            const displayItems = displayResponse(lookResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            
                            // Update room state if successful
                            if (lookResponse.success && lookResponse.roomData.name) {
                                setCurrentRoomName(lookResponse.roomData.name);
                                setCurrentRoomObjects(lookResponse.roomData.objects);
                            }
                            return;
                        }
                        case '/inspect': {
                            const objectName = parts.length >= 2 ? parts.slice(1).join(' ') : '';
                            const inspectResponse = await handleInspectCommand(objectName, createUserContext());
                            const displayItems = displayResponse(inspectResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            return;
                        }
                        case '/guess': {
                            const objectName = parts.length >= 2 ? parts[1] || '' : '';
                            const answer = parts.length >= 3 ? parts.slice(2).join(' ') : '';
                            const guessResponse = await handleGuessCommand(objectName, answer, createUserContext());
                            const displayItems = displayResponse(guessResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            
                            // Update unlocked objects if successful
                            if (guessResponse.success && guessResponse.objectData.unlocked) {
                                setUnlockedObjects(prev => [...prev, guessResponse.objectData.name]);
                            }
                            return;
                        }
                        case '/password': {
                            const password = parts.length >= 2 ? parts.slice(1).join(' ') : '';
                            const passwordResponse = await handlePasswordCommand(password, createUserContext());
                            const displayItems = displayResponse(passwordResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            
                            // Update game state if password was correct
                            if (passwordResponse.success && passwordResponse.gameResult.escaped) {
                                if (passwordResponse.gameResult.gameCompleted) {
                                    setCurrentRoomName('Congratulations!');
                                    setCurrentRoomBackground('Game Completed. You can start try out with a new game [/newgame] or [/logout] to end your session.');
                                    setCurrentGameId(null);
                                }
                            }
                            return;
                        }
                        case '/hint': {
                            const hintResponse = await handleHintCommand(createUserContext());
                            const displayItems = displayResponse(hintResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            return;
                        }
                        case '/restart':
                            if (!sessionToken) {
                                response = "You are not in a game session. Please login first.";
                            } else {
                                const apiUrl = getApiUrl();
                                try {
                                    const restartResponse = await fetch(`${apiUrl}/api/game/restart`, {
                                        method: 'POST',
                                        headers: { 
                                            'Authorization': `Bearer ${sessionToken}`,
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                    const data = await restartResponse.json() as any; //FIXME: as { success: boolean; message: string };
                                    if (data.success) {
                                        setCurrentGameId(null);
                                        setCurrentRoomName('Game Restarted');
                                        setCurrentRoomBackground('Use /newgame to start a new game.');
                                    }
                                    response = data.message || "Game restarted.";
                                } catch (error) {
                                    response = "Error: Could not restart game.";
                                }
                            }
                            break;
                        case '/newgame': {
                            const mode = parts[1]?.toLowerCase() || 'single-room';
                            setIsLoadingGame(true);
                            setLoadingMessage(`Preparing an AI-generated [${mode}] Escape Game...`);
                            const newGameResponse = await handleNewGameCommand(mode, createUserContext());
                            const displayItems = displayResponse(newGameResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            
                            // Update game state if successful
                            if (newGameResponse.success) {
                                console.log('=== CLI: NEWGAME RESPONSE RECEIVED ===');
                                setIsLoadingGame(false);
                                setCurrentGameId(newGameResponse.gameData.id);
                                setCurrentRoomName(newGameResponse.gameData.name);
                                setCurrentRoomBackground(newGameResponse.gameData.background);
                                setCurrentGameMode(newGameResponse.gameData.mode === 'multi-room' ? 'multi-custom' : 'single-custom');
                                setTotalRooms(newGameResponse.gameData.totalRooms);
                            }
                            return;
                        }
                        case '/status': response = sessionToken ? await sendCommand('/status') : "You are not in a game session. Please login first."; break;
                        case '/leaderboard': {
                            const leaderboardResponse = await handleLeaderboardCommand(createUserContext());
                            const displayItems = displayResponse(leaderboardResponse);
                            setHistory(prev => [...prev, ...displayItems]);
                            return;
                        }
                        case '/history': setShowHistory(true); response = 'Showing command history:'; break;
                        case '/model': 
                            if (hasAICapability) { setShowModelSelector(true); response = 'Opening model selector...'; }
                            else { response = 'AI features not available (no API key for session).'; }
                            break;
                        default: response = "Unknown command. Try /help.";
                    }
                }
		    } else {
                // Natural language - requires sessionToken for /api/chat
                response = sessionToken ? await processNaturalLanguage(command) : "Please login or register to use AI chat.";
            }
		}
		setHistory(prev => [...prev, { type: 'response', text: response }]);
	};
	// --------------------------------------------------------------------------------------------------------------------------------------------

    //======================================================= GAME STATES AND HANDLERS ============================================================

    // ----------------------------
	// 	INITIAL LOAD
	// ----------------------------
    useEffect(() => {
        checkBackendConnection();
        const timer = setTimeout(() => {
            setHistory([
                { type: 'response' as const, text: 'Welcome to the AI Escape Room CLI!' },
                ...(hasAICapability ? [{ type: 'response' as const, text: 'AI assistance is available for hints and interaction.' }] : []),
            ]);
        }, 500);
        return () => clearTimeout(timer);
    }, [hasAICapability]); // Rerun if AI capability changes (e.g. after registration with API key)



    // ----------------------------
    // 	MODEL SELECTOR
    // ----------------------------
    const handleCloseModelSelector = () => setShowModelSelector(false);

	const handleSelectModel = (model: ModelOption) => {
		setSelectedModel(model);
		setHistory(prev => [...prev, { type: 'response', text: `Model changed to ${model.label}` }]);
	};





    // ----------------------------
    // 	/register COMMAND
    // ----------------------------
	const handleRegistrationComplete = (userData: { 
        name: string; 
        email?: string; 
        userId?: string; 
        token?: string; 
        apiKey?: string 
    }) => {
		setUserId(userData.userId);
        setUserName(userData.name);
		setSessionToken(userData.token);
        setCliApiKey(userData.apiKey); // Store API key provided during this session registration/login
		if (userData.userId && userData.token) {
            fetchGameState(); // Fetch game state now that we are logged in
        } else {
            checkBackendConnection(); 
        }
	};


    // ================================================================================================================
    //                                                  UI RENDERING
    // ================================================================================================================

	if (!sessionToken || !userId) { // Show UserRegistration if no token or userId
		return <UserRegistration onRegistrationComplete={handleRegistrationComplete} />;
	}

	return (
		<Box flexDirection="column" width="100%">
			<Box marginBottom={1} justifyContent="space-between">
                <Box>
                    <Text bold color={mcpMode ? 'magenta' : 'cyan'}>
                        {userName ? `${userName}'s Escape Room Game` : 'Escape Room'} [{mcpMode ? 'MCP' : `${currentGameMode.toUpperCase()}`}]
                    </Text>
                    {mcpMode && showMcpClient && (
                        <Box marginLeft={1}><Text color="cyan">MCP Help: /help</Text></Box>
                    )}
                    {hasAICapability && !mcpMode && (
                        <Box marginLeft={1}><Text color="green">✓ AI enabled: {selectedModel?.label}</Text></Box>
                    )}
                </Box>
                <Box>
                     <Text color={isConnected ? "green" : "red"}>{isConnected ? "● Online" : "◌ Offline"}</Text>
                </Box>
			</Box>
			
			{/* GAME GENERAL INFO (NAME AND BACKGROUND) */}
			{!mcpMode && !isLoadingGame && !showModelSelector ? (
				<Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="gray" paddingX={1} paddingY={0}>
					<Gradient name="vice">
						<Text bold>{currentRoomName || (sessionToken ? 'No game active' : 'Please login')}</Text>
					</Gradient>
					<Text color="gray" wrap="wrap">{currentRoomBackground}</Text>
				</Box>
			) : isLoadingGame ? (
				<Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="cyan" paddingX={1}>
					<Box><Text color="cyan"><Spinner type="dots" />{loadingMessage}</Text></Box>
				</Box>
			) : null}

            {/* OBJECT LOCKED/UNLOCKED INDICATORS */}
            {currentGameId && (
                <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="gray" paddingX={1}>
                    <Text color="gray">Objects Solved:</Text>
                    <Box flexDirection="column" gap={0.5}>
                        {currentRoomObjects.map((objectName, index) => {
                            const isUnlocked = unlockedObjects.includes(objectName);
                            return (
                                <Text key={index} color={isUnlocked ? "green" : "red"}>
                                    {isUnlocked ? '●' : '◌'} {objectName}
                                </Text>
                            );
                        })}
                    </Box>
                </Box>
            )}

			{showModelSelector ? (
				<ModelSelector onSelect={handleSelectModel} onClose={handleCloseModelSelector} />
			) : showMcpClient ? (
				<>
					<McpClientUI onMessage={(message) => setHistory(prev => [...prev, { type: 'response', text: message }])}/>
					<ScrollableBox height={20}><CommandHistory history={history} showHistory={showHistory} /></ScrollableBox>
					<CommandInput value={currentCommand} onChange={setCurrentCommand} onSubmit={handleCommand} mode={'mcp'} />
				</>
			) : (
				<>
					<ScrollableBox height={25}><CommandHistory history={history} showHistory={showHistory} /></ScrollableBox>
					<CommandInput value={currentCommand} onChange={setCurrentCommand} onSubmit={handleCommand} mode={'standard'}/>
				</>
			)}

			{isProcessingCommand && isLoadingGame && (
				<Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="yellow" paddingX={1}>
					<Box>
						<Text color="yellow"><Spinner type="dots" /> {loadingMessage}</Text>
					</Box>
					<Box>
						<Text color="yellow">
							Use /help for available commands.
						</Text>
					</Box>
				</Box>
			)}

			{!mcpMode && !isConnected && !showModelSelector && (
				<Box marginTop={1} borderColor="red" borderStyle="round" paddingX={1}>
					<Text color="red">
						<Text bold>⚠ Backend server disconnected.</Text>
						Please ensure it's running at https://ai-escape-room-nedap.vercel.app or http://localhost:3001.
					</Text>
					<Text color="gray">
						Current game: {currentGameId ? `ID: ${currentGameId}` : 'No game active'} out of {totalRooms} rooms
					</Text>
					<Text color="gray">
						Current room: {currentRoomName}
					</Text>
				</Box>
			)}
		</Box>
	);
};

export default Terminal;