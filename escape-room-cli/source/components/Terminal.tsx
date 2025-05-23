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
import UserRegistration from './UserRegistration.js';

// FOR LOGOUT ----------------------------------------------------------------------------------------
import fs from 'fs'; // For logout config clear
import path from 'path'; // For logout config clear
import os from 'os'; // For logout config clear

const USER_CONFIG_FILE = path.join(os.homedir(), '.escape-room-config.json'); // For logout
// --------------------------------------------------------------------------------------------------
interface TerminalProps {
	// mode: 'standard' | 'mcp';
	// These initial props might be less relevant if UserRegistration handles initial load
	// apiKey?: string; 
	// userId?: string;
}

// Define type for history items
type HistoryItem = {
	type: 'command' | 'response';
	text: string;
};

// Structure expected from backend game endpoints (subset)
interface GameInfo {
    id?: string | number;
    name?: string;
    background?: string;
    currentRoom?: number; // Sequence number
    totalRooms?: number;
    mode?: string;
    objectCount?: number;
}

const Terminal: React.FC<TerminalProps> = (/*{ apiKey: initialApiKey, userId: initialUserId }*/) => {
	const [history, setHistory] = useState<Array<HistoryItem>>([]);
	const [currentCommand, setCurrentCommand] = useState('');
	const [isConnected, setIsConnected] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [isLoadingGame, setIsLoadingGame] = useState(false);
	const [isProcessingCommand, setIsProcessingCommand] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState('');
	// const [hasAICapability, setHasAICapability] = useState<boolean>(!!initialApiKey)
	const [hasAICapability, setHasAICapability] = useState<boolean>(false); // Determined by presence of API key in state
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
    const [totalRooms, setTotalRooms] = useState<number>(1);

	useEffect(() => {
		setHasAICapability(!!cliApiKey || !!process.env['OPENAI_API_KEY'] || !!process.env['ANTHROPIC_API_KEY']); // AI capability now depends on the session's API key state
	}, [cliApiKey]);

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
                if (sessionToken && userId) { // Only fetch game state if logged in
                    fetchGameState();
                } else {
                    // setCurrentRoomName('Logged In. Game Not Created');
                    // setCurrentRoomBackground('Please create a new game with /newgame. Type /help for more info.');
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

    const fetchGameState = async () => {
        if (!sessionToken) {
            console.warn("fetchGameState called without a sessionToken.");
            //FIXME: ------------------------------------------------
            // setCurrentRoomName('Instructions:');
            // setCurrentRoomBackground(`This is the beginning of everything. Explore the AI Escape Room and solve the puzzle as fast as you can to escape.
			// 	\nIn this room, you will have to find a password to unlock the door. There are several puzzles scattered around the room, underneath the objects. Every puzzle have it's own way, but don't worry, it all leads you to the password, one way or another ;) Discover them all to find out.
			// 	\nYou can do it manually, ask the AI, or build your own strategy. Your choice ;)
			// 	\nReady to challenge? Type /newgame to start. Or type /help for more information.
				
			// 	\n PS: Use an AI is always easier, is it true?`);
            // ------------------------------------------------------
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

    const sendCommand = async (command: string): Promise<string> => {
        setIsProcessingCommand(true);
        setLoadingMessage('Processing...');
        let responseText = 'Error processing command.';
        const apiUrl = getApiUrl();

        if (!sessionToken) {
            setIsProcessingCommand(false);
            return "Error: Not authenticated. Please login or register.";
        }

        try {
            const response = await fetch(`${apiUrl}/api/command`, {
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
                    if (gameData.room) {
                        setCurrentRoomName(gameData.room.name || 'Unknown Room');
                        if(gameData.room.background) setCurrentRoomBackground(gameData.room.background);
                    }
                    if (gameData.nextRoom && gameData.unlocked) {
                        setCurrentRoomName(gameData.nextRoom.name || 'Next Room');
                        setCurrentRoomBackground(`Moved to ${gameData.nextRoom.name}. Type /look.`);
                         // Fetch full state for the new room if backend doesn't provide all details
                        fetchGameState();
                    }
                    if (gameData.gameCompleted) {
                        responseText += "\n\nCongratulations! You've completed the game!";
                        setCurrentRoomName('Congratulations!');
                        setCurrentRoomBackground('Game Completed. You can start try out with a new game [/newgame] or [/logout] to end your session.');
                        setCurrentGameId(null); 
                    }
                } else if (command.toLowerCase().startsWith('/look')) {
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

	// Process natural language input through an LLM if API key is available
	const processNaturalLanguage = async (text: string): Promise<string> => {

		const apiKey = cliApiKey || process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'];
		if (!apiKey) return "Error: No API key available for AI chat.";

        if (!sessionToken) return "Error: Not authenticated for AI chat.";

        const apiUrl = getApiUrl();
		setIsProcessingCommand(true);
		setLoadingMessage(`Thinking with ${selectedModel.label}...`);
		try {
		    const response = await fetch(`${apiUrl}/api/chat`, {
			method: 'POST',
			headers: { 
			    'Content-Type': 'application/json',
			    'Authorization': `Bearer ${sessionToken}` // Authenticate the user session
			},
			body: JSON.stringify({ 
			    message: text,
			    model: selectedModel.value,
                // No userId here, backend gets it from token
                // No apiKey here, backend uses user's stored key
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

	// --------------------------------------------------------------------------------------------
	// 								INITIAL LOAD
	// --------------------------------------------------------------------------------------------
	useEffect(() => {
		checkBackendConnection();
		const timer = setTimeout(() => {
			setHistory([
				{ type: 'response', text: 'Welcome to the AI Escape Room CLI!' },
				...(hasAICapability ? [{ type: 'response' as const, text: 'AI assistance is available for hints and interaction.' }] : []),
			]);
		}, 500);
		return () => clearTimeout(timer);
	}, [hasAICapability]); // Rerun if AI capability changes (e.g. after registration with API key)


	//-------------------------------------------------------------------------------------------------
	// 				COMMAND HELPER FUNCTION
	//-------------------------------------------------------------------------------------------------


    // `/help` command
	const handleHelpCommand = () => {
		return [
		'Available commands:',
		'/help - Show help message',
        ...(sessionToken ? [
			'/newgame [single-room|multi-room] - Start a new AI-generated game',
            '/look - Look around the room',
            '/inspect [object] - Inspect an object',
            '/guess [object] [answer] - Guess the puzzle answer for an object',
			'/password [password] - Submit the password to unlock the door',
            '/hint - Get a hint about the password',
            '/logout - End your current session',
        ] : [
            '/register - Start the registration process (or use CLI flags)',
            '/login - Login to the new game (if config exists, loaded automatically)',
        ]),
		'/history - Show command history',
		'/model - Change AI model (if AI enabled)',
		// '/mcp - Switch to MCP client mode (NOT IMPLEMENTED YET)',

		...(hasAICapability ? [
			`Current AI model: ${selectedModel.label}`
		] : []),
        ...(sessionToken && currentRoomName !== 'Loading...' ? [
            `Current Room: "${currentRoomName}" (${currentGameMode})`
        ] : [
            'Not currently in a game session.'
        ]),
		].join('\n');
	};
    //-------------------------------------------------------------------------------------------------

	// `/newgame [mode]`
	const handleGenerateNewGame = async (mode: string = 'single-room'): Promise<string> => {
        const requestedMode = (mode === 'multi-room') ? 'multi-room' : 'single-room';
        const apiUrl = getApiUrl();
        if (!sessionToken) {
            return "Error: Not authenticated. Please login or register.";
        }
		try {
			setIsLoadingGame(true);
			setLoadingMessage(`Preparing an AI-generated [${requestedMode}] Escape Game...`);
			const response = await fetch(`${apiUrl}/api/newgame`, {
				method: 'POST',
				headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ mode: requestedMode }) // No userId in body
			});
			const data = await response.json() as any; //FIXME: as { success: boolean; game: GameInfo };
			if (data.success && data.game) {
                const gameInfo: GameInfo = data.game;
				// Update state based on response
                setCurrentGameId(gameInfo.id || null);
				setCurrentRoomName(gameInfo.name || 'Untitled Room');
				setCurrentRoomBackground(gameInfo.background || 'No description provided.');
                setCurrentGameMode(gameInfo.mode === 'multi-room' ? 'multi-custom' : 'single-custom');
                setTotalRooms(gameInfo.totalRooms || 1);

				return `
					New ${gameInfo.mode || 'custom'} game created!
					\nRoom ${gameInfo.currentRoom || 1}${gameInfo.totalRooms && gameInfo.totalRooms > 1 ? ` of ${gameInfo.totalRooms}` : ''}: ${gameInfo.name}
					\n${gameInfo.background || ""}
					\nThis room contains ${gameInfo.objectCount !== undefined ? gameInfo.objectCount : '?'} objects. Use /look to see them.
					`;
			} else {
				return `Failed to create new game: ${data.error || "Unknown error"}`;
			}
		} catch (error) {
			setIsConnected(false);
			return 'Error communicating with the server.';
		} finally {
			setIsLoadingGame(false);
			setLoadingMessage('');
		}
	};
    //-------------------------------------------------------------------------------------------------

    // -------------------------------------------------------------------------------------------------
    // `/logout` command
	//FIXME: Logout only clears the session token, not the entire registered user data.
    const handleLogout = () => {
        setUserId(undefined);
        setSessionToken(undefined);
        setUserName(undefined);
        setCliApiKey(undefined); // Clear session API key
        setCurrentGameId(null);
        setCurrentRoomBackground('You have been logged out. Type /register or /login');
        setCurrentGameMode('unknown');
		setTotalRooms(0);
        return "Logged out successfully.";
    };
    //-------------------------------------------------------------------------------------------------

    // -------------------------------------------------------------------------------------------------
    // `/login` command
	const handleLogin = () => {
		if (fs.existsSync(USER_CONFIG_FILE)) {
			const config = JSON.parse(fs.readFileSync(USER_CONFIG_FILE, 'utf-8'));
			setUserId(config.userId);
			setSessionToken(config.token);
			setUserName(config.name);
			setCliApiKey(config.apiKey);
		}
		if (userId && sessionToken) {
			fetchGameState();
		} else {
			setCurrentRoomName('Login Error');
			setCurrentRoomBackground('Could not login. Please check your credentials and try again.');
		}
		return "Logged in successfully.";
	};
    //-------------------------------------------------------------------------------------------------


    // -------------------------------------------------------------------------------------------------
    // `/mcp` command
    //FIXME: MCP mode is not fully implemented yet.
    const handleMcpCommand = async (command: string): Promise<string> => {
		if (command === '/exit-mcp' || command === '/standard') {
			setMcpMode(false);
			setShowMcpClient(false);
			return "Exiting MCP mode and returning to standard mode.";
		}
		if (command === '/help') {
			return "MCP Help: ... TO BE IMPLEMENTED ...";
		}
		return `MCP command processing not fully implemented yet: ${command}`;
	};
    //-------------------------------------------------------------------------------------------------


    // `/model` command
    const handleCloseModelSelector = () => setShowModelSelector(false);

	const handleSelectModel = (model: ModelOption) => {
		setSelectedModel(model);
		setHistory(prev => [...prev, { type: 'response', text: `Model changed to ${model.label}` }]);
	};


	// --------------------------------------------------------------------------------------------------------------------------
	// 								                MAIN COMMAND HANDLER
	// --------------------------------------------------------------------------------------------------------------------------
	const handleCommand = async (command: string) => {
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
                        case '/help': response = handleHelpCommand(); break;
                        case '/logout': response = handleLogout(); break;
                        case '/login': response = handleLogin(); break;
                        case '/register':
                             response = "To register, please restart the application without a saved session, or use CLI flags.";
                             break;
                        // Protected commands below - require sessionToken
                        case '/look': case '/seek': 
                            if (!sessionToken) {
                                response = "Please login first.";
                            } else {
                                // Use the new GET /look endpoint
                                const apiUrl = getApiUrl();
                                try {
                                    const lookResponse = await fetch(`${apiUrl}/api/game/look`, {
                                        headers: { 'Authorization': `Bearer ${sessionToken}` }
                                    });
                                    if (lookResponse.ok) {
                                        const data = await lookResponse.json() as any; //FIXME: as { message: string; roomName: string; objects: string[] };
                                        response = data.message || `Room: ${data.roomName}\nObjects: ${data.objects.join(', ')}`;
                                    } else {
                                        response = "Failed to look around.";
                                    }
                                } catch (error) {
                                    response = "Error: Could not look around.";
                                }
                            }
                            break;
                        case '/inspect': case '/analyse': 
                            if (!sessionToken) {
                                response = "Please login first.";
                            } else if (parts.length < 2) {
                                response = 'Usage: /inspect [object]';
                            } else {
                                // Use the new GET /inspect endpoint
                                const objectName = parts.slice(1).join(' ');
                                const apiUrl = getApiUrl();
                                try {
                                    const inspectResponse = await fetch(`${apiUrl}/api/game/inspect?object=${encodeURIComponent(objectName)}`, {
                                        headers: { 'Authorization': `Bearer ${sessionToken}` }
                                    });
                                    const data = await inspectResponse.json() as any; //FIXME: as { message: string; error: string };
                                    if (inspectResponse.ok) {
                                        response = data.message || `Inspecting ${objectName}...`;
                                    } else {
                                        response = data.error || `Could not inspect ${objectName}.`;
                                    }
                                } catch (error) {
                                    response = "Error: Could not inspect object.";
                                }
                            }
                            break;
                        case '/guess':
                            if (!sessionToken) {
                                response = "Please login first.";
                            } else if (parts.length < 3) {
                                response = 'Usage: /guess [object] [answer]';
                            } else {
                                // Parse object and answer from command
                                const objectName = parts[1] || '';
                                const answer = parts.slice(2).join(' ');
                                const apiUrl = getApiUrl();
                                try {
                                    const guessResponse = await fetch(`${apiUrl}/api/game/guess?object=${encodeURIComponent(objectName)}&answer=${encodeURIComponent(answer)}`, {
                                        method: 'POST',
                                        headers: { 
                                            'Authorization': `Bearer ${sessionToken}`,
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                    const data = await guessResponse.json() as any; //FIXME: as { message: string; correct: boolean };
                                    response = data.message || (data.correct ? "Correct!" : "Wrong answer.");
                                } catch (error) {
                                    response = "Error: Could not process guess.";
                                }
                            }
                            break;
                        case '/password':
                            if (!sessionToken) {
                                response = "Please login first.";
                            } else if (parts.length < 2) {
                                response = 'Usage: /password [password]';
                            } else {
                                const password = parts.slice(1).join(' ');
                                const apiUrl = getApiUrl();
                                try {
                                    const passwordResponse = await fetch(`${apiUrl}/api/game/password?password=${encodeURIComponent(password)}`, {
                                        method: 'POST',
                                        headers: { 
                                            'Authorization': `Bearer ${sessionToken}`,
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                    const data = await passwordResponse.json() as any; //FIXME: as { message: string; escaped: boolean; timeElapsed: number; gameCompleted: boolean };
                                    if (data.escaped) {
                                        response = data.message + (data.timeElapsed ? `\nTime: ${data.timeElapsed} seconds` : '');
                                        if (data.gameCompleted) {
                                            setCurrentRoomName('Congratulations!');
                                            setCurrentRoomBackground('Game Completed. You can start a new game with /newgame.');
                                            setCurrentGameId(null);
                                        }
                                    } else {
                                        response = data.message || "Wrong password.";
                                    }
                                } catch (error) {
                                    response = "Error: Could not check password.";
                                }
                            }
                            break;
                        case '/hint': 
                            if (!sessionToken) {
                                response = "Please login first.";
                            } else {
                                const apiUrl = getApiUrl();
                                try {
                                    const hintResponse = await fetch(`${apiUrl}/api/game/hint`, {
                                        headers: { 'Authorization': `Bearer ${sessionToken}` }
                                    });
                                    const data = await hintResponse.json() as any; //FIXME: as { hint: string };
                                    response = data.hint || "No hints available.";
                                } catch (error) {
                                    response = "Error: Could not get hint.";
                                }
                            }
                            break;
                        case '/restart':
                            if (!sessionToken) {
                                response = "Please login first.";
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
                        case '/newgame': response = sessionToken ? await handleGenerateNewGame(parts[1]?.toLowerCase()) : "Please login first."; break;
                        case '/status': response = sessionToken ? await sendCommand('/status') : "Please login first."; break;
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
	// -------------------------------------------------------------------------------------------------


    // -------------------------------------------------------------------------------------------------
    // `/register` command
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
    //-------------------------------------------------------------------------------------------------


    // --------------------------------------------------------------------------------------------------------------------------
    //                                                  UI RENDERING
    // --------------------------------------------------------------------------------------------------------------------------

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
					<Box><Text color="cyan"><Spinner type="dots" /> {loadingMessage}</Text></Box>
				</Box>
			) : null}

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

			{isProcessingCommand && !isLoadingGame && (
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
						Please ensure it's running at https://ai-escape-room-backend.vercel.app or http://localhost:3001.
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