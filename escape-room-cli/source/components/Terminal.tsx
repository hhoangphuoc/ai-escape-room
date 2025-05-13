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
interface TerminalProps {
	// mode: 'standard' | 'mcp';
	apiKey?: string;
	userId?: string;
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

const Terminal: React.FC<TerminalProps> = ({ apiKey: initialApiKey, userId: initialUserId }) => {
	const [history, setHistory] = useState<Array<HistoryItem>>([]);
	const [currentCommand, setCurrentCommand] = useState('');
	const [isConnected, setIsConnected] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [isLoadingGame, setIsLoadingGame] = useState(false);
	const [isProcessingCommand, setIsProcessingCommand] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState('');
	const [hasAICapability, setHasAICapability] = useState<boolean>(!!initialApiKey);
	const [showModelSelector, setShowModelSelector] = useState(false);
	const [selectedModel, setSelectedModel] = useState<ModelOption>(Object.values(MODELS_COLLECTION)[0] as ModelOption);

	// Add state for userId and apiKey obtained during registration
	const [userId, setUserId] = useState<string | undefined>(initialUserId);
	const [apiKey, setApiKey] = useState<string | undefined>(initialApiKey);

	// MCP RELATED STATE ------------------------------------------------------------
	const [mcpMode, setMcpMode] = useState(false);
	const [showMcpClient, setShowMcpClient] = useState(false);
	// -----------------------------------------------------------------------------

	// Game State - Managed primarily by backend, reflected here
	// const [currentRoom, setCurrentRoom] = useState(1); // Less relevant now
    const [currentGameId, setCurrentGameId] = useState<string | number | null>(null);
	const [currentRoomName, setCurrentRoomName] = useState('Loading...');
	const [currentRoomBackground, setCurrentRoomBackground] = useState('Please wait or type /help.');
    const [currentGameMode, setCurrentGameMode] = useState<'default' | 'single-custom' | 'multi-custom' | 'unknown'>('unknown');
    const [totalRooms, setTotalRooms] = useState<number>(1);

	// Check API capability (use state apiKey now)
	useEffect(() => {
		setHasAICapability(!!apiKey || !!process.env['ANTHROPIC_API_KEY'] || !!process.env['OPENAI_API_KEY']);
	}, [apiKey]);

	// Check backend connection
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
                // Fetch initial game state if connected AND userId is available
                if (userId) {
                    fetchGameState(userId);
                } else {
                    // If no userId yet (e.g. first run before registration), 
                    // UserRegistration component will handle getting it.
                    // We can set a default message or wait.
                    setCurrentRoomName('Ready');
                    setCurrentRoomBackground('Please register or type /help. User ID not yet available.');
                }
            } else {
                setCurrentRoomName('Connection Error');
                setCurrentRoomBackground(`Could not connect to backend at ${apiUrl}.`);
            }
		} catch (error) {
			setIsConnected(false);
            setCurrentRoomName('Connection Error');
            setCurrentRoomBackground('Could not connect to backend. Is it running? Try: cd ../backend && npm run start');
			console.error('Backend connection error:', error);
		}
	};

    // Fetch current game state from backend
    const fetchGameState = async (currentUserId: string) => {
        if (!currentUserId) {
            console.warn("fetchGameState called without a userId.");
            setCurrentRoomName('Auth Error');
            setCurrentRoomBackground('User ID is missing. Cannot fetch game state.');
            return;
        }
        try {
            const apiUrl = getApiUrl();
            // Corrected endpoint and added userId query parameter
            const response = await fetch(`${apiUrl}/api/game/state?userId=${currentUserId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setCurrentRoomName(data.currentRoomName || 'Unknown Room');
            setCurrentGameMode(data.gameMode || 'unknown');
            setCurrentGameId(data.gameId || null);
            setTotalRooms(data.totalRooms || 1);
            // The /api/game/state now should provide comprehensive state. 
            // If background is also sent, update it here.
            // setCurrentRoomBackground(data.background || 'Welcome! Type /help.'); 

        } catch (error) {
            console.error("Error fetching game state:", error);
            setCurrentRoomName('State Error');
            setCurrentRoomBackground('Could not fetch current game state from backend.');
        }
    };

	// Send generic command to the backend's /api/command endpoint
    const sendCommand = async (command: string): Promise<string> => {
        setIsProcessingCommand(true);
        setLoadingMessage('Processing...');
        let responseText = 'Error processing command.';
        const apiUrl = getApiUrl();

        // Ensure we have a userId before sending command
        if (!userId) {
            setIsProcessingCommand(false);
            return "Error: User ID not found. Please restart or re-register.";
        }

        try {
            const response = await fetch(`${apiUrl}/api/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Include userId in the body
                body: JSON.stringify({ command: command, userId: userId }),
            });

            if (!response.ok) {
                // Try to get error details from response body
                try {
                    const errorData = await response.json();
                    responseText = `Error: ${errorData.response || response.statusText}`;
                } catch { // Handle cases where body is not JSON or empty
                    responseText = `Error: Received status ${response.status}`;
                }
                console.error('Command API error:', responseText);
            } else {
                const data = await response.json();
                responseText = data.response || 'Action completed.';

                // IMPORTANT: Update local game state based on response from /api/command
                // The backend's /api/command might return changes to room, game completion, etc.
                // The `RoomCommandResponse` (data.data) from backend should be used here.
                if (data.data) {
                    const gameData = data.data;
                    if (gameData.room) {
                        setCurrentRoomName(gameData.room.name || 'Unknown Room');
                        if(gameData.room.background) {
                           setCurrentRoomBackground(gameData.room.background);
                        }
                        // Update other relevant state based on gameData.room if available
                        // e.g., setCurrentGameId, setCurrentGameMode, setTotalRooms if they change
                    }
                    if (gameData.nextRoom && gameData.unlocked) {
                        // If moving to a new room
                        setCurrentRoomName(gameData.nextRoom.name || 'Next Room');
                        // Potentially update background if provided, or fetch new state
                        // For now, a generic message or rely on next /look command
                        setCurrentRoomBackground(`Moved to ${gameData.nextRoom.name}. Type /look.`);
                    }
                    if (gameData.gameCompleted) {
                        responseText += "\n\nCongratulations! You've completed the game!";
                        setCurrentRoomName('Game Completed!');
                        setCurrentRoomBackground('You can start a new game with /newgame.');
                        setCurrentGameId(null); // Reset current game ID
                    }
                    // Reflect any other changes from gameData to the CLI's state here
                } else if (command.toLowerCase().startsWith('/look')) {
                    // If it was a /look command and no structured data, perhaps re-fetch full state?
                    // Or better, ensure /look from backend always returns structured room details.
                    if (userId) fetchGameState(userId); // Re-fetch state after a look if needed
                }
            }
        } catch (err) {
            console.error('Error sending command:', err);
            responseText = 'Network error: Could not communicate with the backend.';
            setIsConnected(false); // Assume connection lost
        } finally {
            setIsProcessingCommand(false);
            setLoadingMessage('');
        }
        return responseText;
    };

	// Process natural language input through an LLM if API key is available
	const processNaturalLanguage = async (text: string): Promise<string> => {
        // Use the apiKey from state
        const currentApiKey = apiKey || process.env['ANTHROPIC_API_KEY'] || process.env['OPENAI_API_KEY'];
		if (!currentApiKey) {
		    return "No API key configured or found.";
		}
        const apiUrl = getApiUrl();

		setIsProcessingCommand(true);
		setLoadingMessage(`Cooking with ${selectedModel.label}...`);

		try {
		const response = await fetch(`${apiUrl}/api/chat`, {
			method: 'POST',
			headers: { 
			'Content-Type': 'application/json',
            // Use the state apiKey for the bearer token
			'Authorization': `Bearer ${currentApiKey}`
			},
			body: JSON.stringify({ 
			message: text,
			model: selectedModel.value,
            // Include userId from state
			userId: userId 
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('API error:', errorData);
			return `Sorry, there was an error processing your request: ${errorData.error || 'Unknown error'}`;
		}

		const data = await response.json();
		return data.response || "I couldn't understand that. Please try a different command.";
		} catch (error) {
		console.error('Error processing natural language:', error);
		return "Error processing your request. The backend server may not be running or AI model failed.";
		} finally {
		setIsProcessingCommand(false);
		setLoadingMessage('');
		}
	};

	// Handle model selection ------------------------------------------------------------
	const handleModelSelect = (model: ModelOption) => {
		setSelectedModel(model);
		return `Model changed to ${model.label}. ${model.description || ''}`;
	};
	// --------------------------------------------------------------------------------------------
  

	// Welcome Message
	useEffect(() => {
		// Check connection to backend
		checkBackendConnection();

		// Add a short delay to simulate loading
		const timer = setTimeout(() => {
			setHistory([
				{ type: 'response', text: 'Welcome to the Escape Room CLI!' },
				...(hasAICapability ? [{ type: 'response' as const, text: 'AI assistance is enabled! You can use natural language to interact with the game.' }] : []),
			]);
		}, 1000);

		return () => clearTimeout(timer);
	}, [hasAICapability]);
	// --------------------------------------------------------------------------------------------
	// 						COMMAND HANDLERS HELPER FUNCTIONS
	// --------------------------------------------------------------------------------------------

	// `/help`
	const handleHelpCommand = () => {
		return [
		'Available commands:',
		'/help - Show this help message',
		'/look (or /seek) - Look around the room',
		'/inspect [object] (or /analyse) - Inspect an object',
		'/guess [password] (or /password) - Try a password',
		'/hint - Get a hint (uses RoomAgent logic)',
		// '/restart - Restart the current game (TODO: Implement backend support?)',
        '/newgame [single-room|multi-room] - Start a new AI-generated game (default: single-room)',
		'/history - Show command history',
        '/status - Show current game status (if supported by backend)',
		'/model - Change AI model (if AI enabled)',
		// '/mcp - Switch to MCP client mode (NOT IMPLEMENTED YET)',

		...(hasAICapability ? [
			'AI assistance is enabled! Type natural language queries.',
			`Current AI model: ${selectedModel.label}`
		] : []),
		`Current Room: "${currentRoomName}" (${currentGameMode})`
		].join('\n');
	};

	// `/newgame [mode]`
	const handleGenerateNewGame = async (mode: string = 'single-room'): Promise<string> => {
        const requestedMode = (mode === 'multi-room') ? 'multi-room' : 'single-room';
        const apiUrl = getApiUrl();

        // Ensure we have userId before starting a new game
        if (!userId) {
            return "Error: User ID not found. Cannot create a new game. Please restart or re-register.";
        }

		try {
			setIsLoadingGame(true);
			setLoadingMessage(`Preparing an AI-generated ${requestedMode} Escape Game...`);
			
			const response = await fetch(`${apiUrl}/api/newgame`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
                // Send the requested mode AND userId
                body: JSON.stringify({ mode: requestedMode, userId: userId })
			});
			
			const data = await response.json();
			
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
			console.error('Error generating new game:', error);
            setIsConnected(false); // Assume connection issue
			return 'Error communicating with the server. Please ensure the backend is running.';
		} finally {
			setIsLoadingGame(false);
			setLoadingMessage('');
		}
	};

	// `/mcp`
	const handleMcpCommand = async (command: string): Promise<string> => {
		if (command === '/exit-mcp' || command === '/standard') {
			setMcpMode(false);
			setShowMcpClient(false);
			return "Exiting MCP mode and returning to standard mode.";
		}
		
		if (command === '/help') {
			return [
				"MCP Mode Commands:",
				"/exit-mcp - Exit MCP mode and return to standard mode",
				"/help - Show this help message",
				"",
				"MCP Tools:",
				"/start_new_game - Start a new game",
				"/seek_objects - List objects in the current room",
				"/analyse_object [object] - Examine an object in detail",
				"/submit_password [password] - Submit a password to try to unlock the room"
			].join("\n");
		}
		
		// Forward the command to MCP component
		// In a real implementation, we'd call a method on the McpClientUI component
		return `MCP command processing not fully implemented yet: ${command}`;
	};

	// Handle Model Selector -----------------------------------------------------------------------
	const handleCloseModelSelector = () => {
		setShowModelSelector(false);
	};
	const handleSelectModel = (model: ModelOption) => {
		const response = handleModelSelect(model);
		setHistory(prev => [...prev, { type: 'response', text: response }]);
	};
	// --------------------------------------------------------------------------------------------


	// --------------------------------------------------------------------------------------------
	// 								MAIN COMMAND HANDLER
	// --------------------------------------------------------------------------------------------
	const handleCommand = async (command: string) => {
		// If model selector is shown, don't process commands
		if (showModelSelector) {
			return;
		}
		
		// Add user command to history
		setHistory(prev => [...prev, { type: 'command', text: command }]);

		// Turn off history display when running a new command (unless it's /history)
		if (command !== '/history') {
			setShowHistory(false);
		}

		// Check for special command /mcp to switch to MCP mode
		if (command === '/mcp') {
			const response = 'Switching to MCP client mode...';
			setHistory(prev => [...prev, { type: 'response', text: response }]);
			// Switch to MCP mode
			setMcpMode(true);
			setShowMcpClient(true);
			return;
		}

		// Process the command based on current mode
		let response: string;

		if (mcpMode) {
			// Handle commands in MCP mode
			response = await handleMcpCommand(command);
		} else {
		// Handle commands in standard mode (RoomAgent)
		// Check if it's a slash command or natural language
		if (command.startsWith('/')) {
			// It's a slash command
			const parts = command.trim().split(' ');
			const cmd = parts[0]?.toLowerCase();
			if (!cmd) {
				response = "Unknown command. Try '/help', '/look', '/inspect', '/guess', '/hint', or '/restart'.";
				setHistory(prev => [...prev, { type: 'response', text: response }]);
				return;
			}
			let resp: string;
			switch (cmd) {
				case '/help':
					resp = handleHelpCommand();
					break;
				case '/look':
					resp = await sendCommand('/look');
					break;
				case '/inspect':
					if (parts.length < 2) resp = 'Usage: inspect [object]';
					else resp = await sendCommand(`/inspect ${parts.slice(1).join(' ')}`);
					break;
				case '/guess':
					if (parts.length < 2) resp = 'Usage: guess [password]';
					else resp = await sendCommand(`/guess ${parts.slice(1).join(' ')}`);
					break;
				case '/hint':
					resp = await sendCommand('/hint');
					break;
				case '/restart':
					// Restart: go back to room 1
					setCurrentRoomName('Restarting...');
					setCurrentRoomBackground('The game is ended or not started yet.\nType /newgame to start a new game, or /help for available commands.');
					resp = 'Game restarted. Back to Room 1.';
					break;
				case '/newgame':
					// Extract mode if provided (e.g., /newgame multi-room)
					const modeArg = parts[1]?.toLowerCase();
					resp = await handleGenerateNewGame(modeArg);
					break;
				case '/history':
					setShowHistory(true);
					resp = 'Showing command history:';
					break;
				case '/status':
					// Send /status command to backend (needs backend implementation)
					resp = await sendCommand('/status');
					break;
				case '/model':
					if (hasAICapability) {
						setShowModelSelector(true);
						resp = 'Opening model selector...';
					} else {
						resp = 'AI assistance not enabled. Please set up an API key first.';
					}
					break;
				default:
					resp = "Unknown command. Try '/help', '/newgame', '/look', '/inspect', '/guess', '/hint', or '/restart'.";
			}
			response = resp;
		} else {
			// It's natural language - process with LLM if available
			response = await processNaturalLanguage(command);
		}
		}

		// Add response to history
		setHistory(prev => [...prev, { type: 'response', text: response }]);
	};
	// ---------------------------------------------------------------------------------------------
	
	// Add handler for registration complete
	const handleRegistrationComplete = (userData: { name: string; email?: string; apiKey?: string; userId?: string }) => {
		setUserId(userData.userId);
		setApiKey(userData.apiKey);
		// After registration, fetch initial game state if userId is present
		if (userData.userId) {
            fetchGameState(userData.userId);
        } else {
            checkBackendConnection(); // Fallback to general connection check if somehow no userId
        }
	};

	//RENDER COMPONENT
	if (!userId) {
		return <UserRegistration onRegistrationComplete={handleRegistrationComplete} username={initialUserId}/>;
	}
	return (
		<Box flexDirection="column" width="100%">
			<Box marginBottom={1} justifyContent="space-between">
                <Box>
                    <Text bold color={mcpMode ? 'magenta' : 'cyan'}>
                        [{mcpMode ? 'MCP Client Mode' : `${currentGameMode.toUpperCase()} Mode`}]
                    </Text>
                    {mcpMode && showMcpClient && (
                        <Box marginLeft={1}><Text color="cyan">Type /help for MCP commands</Text></Box>
                    )}
                    {hasAICapability && !mcpMode && (
                        <Box marginLeft={1}><Text color="green">✓ AI enabled: {selectedModel?.label}</Text></Box>
                    )}
                </Box>
                <Box>
                     <Text color={isConnected ? "green" : "red"}>{isConnected ? "● Connected" : "◌ Disconnected"}</Text>
                </Box>
			</Box>
			
			{/* GAME GENERAL INFO (NAME AND BACKGROUND) */}
			{!mcpMode && !isLoadingGame && !showModelSelector ? (
				<Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="gray" paddingX={4}>
					<Gradient name="vice">
						<Text bold>{currentRoomName || 'No game active'}</Text>
					</Gradient>
					<Text color="gray" wrap="wrap">
						{currentRoomBackground}</Text>
				</Box>
			) : (
				<Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="cyan" paddingX={4}>
					<Box>
						<Text color="cyan">
							<Spinner type="dots" />
						</Text>
						<Text color="cyan">
							Preparing AI-generated Escape Room...
						</Text>
					</Box>
				</Box>
			)}

			{showModelSelector ? (
				<ModelSelector 
					onSelect={handleSelectModel} 
					onClose={handleCloseModelSelector} 
				/>
			) : showMcpClient ? (
				<>
					{/* MCP CLIENT UI - FOR MCP MODE */}
					<McpClientUI 
						// userId={userId}
						onMessage={(message) => setHistory(prev => [...prev, { type: 'response', text: message }])}
					/>
					<ScrollableBox height={20}>
						<CommandHistory history={history} showHistory={showHistory} />
					</ScrollableBox>
					<Box marginTop={1}>
						<CommandInput
							value={currentCommand}
							onChange={setCurrentCommand}
							onSubmit={handleCommand}
							mode={mcpMode ? 'mcp' : 'standard'}
						/>
					</Box>
				</>
			) : (
				<>
					{/* COMMAND HISTORY - FOR BOTH MCP AND STANDARD MODE */}
					<ScrollableBox height={25}>
						<CommandHistory history={history} showHistory={showHistory} />
					</ScrollableBox>

					<Box flexDirection="column" marginTop={1}>
						<Text color="gray">
							Type /help for available commands or /newgame to start a new game.
						</Text>
						<CommandInput
							value={currentCommand}
							onChange={setCurrentCommand}
							onSubmit={handleCommand}
							mode={mcpMode ? 'mcp' : 'standard'}
						/>
					</Box>
				</>
			)}

			{/* LOADING SPINNER IF COMMAND IS BEING PROCESSED */}
			{isProcessingCommand && (
				<Box flexDirection="column" marginBottom={1} padding={1} borderStyle="round" borderColor="yellow">
					<Box>
						<Text color="green">
							<Spinner type="dots" />
						</Text>
						<Text color="yellow"> {loadingMessage}</Text>
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