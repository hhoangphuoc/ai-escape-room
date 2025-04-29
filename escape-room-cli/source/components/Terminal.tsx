import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import CommandInput from './CommandInput.js';
import CommandHistory from './CommandHistory.js';
import ScrollableBox from './ScrollableBox.js';
import Gradient from 'ink-gradient';
import ModelSelector from './ModelSelector.js';
import { ModelOption, MODELS_COLLECTION } from '../utils/constants.js';
// import {MCPClient} from '../../mcp/index.js'
// import Anthropic from '@anthropic-ai/sdk';

interface TerminalProps {
	mode: 'standard' | 'mcp';
	apiKey?: string;
}

// Define type for history items
type HistoryItem = {
	type: 'command' | 'response';
	text: string;
};

const Terminal: React.FC<TerminalProps> = ({ mode, apiKey }) => {
	const [history, setHistory] = useState<Array<HistoryItem>>([]);
	const [currentCommand, setCurrentCommand] = useState('');
	const [isConnected, setIsConnected] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState('');
	const [hasAICapability, setHasAICapability] = useState<boolean>(!!apiKey);
	const [showModelSelector, setShowModelSelector] = useState(false);
	const [selectedModel, setSelectedModel] = useState<ModelOption>(Object.values(MODELS_COLLECTION)[0] as ModelOption); // Default to first model

	// MCP RELATED STATE ------------------------------------------------------------
	// const [mcpConnected, setMcpConnected] = useState(false);
	// const [apiKey, setApiKey] = useState<string | null>(null);
	// const [mcpClient, setMcpClient] = useState<MCPClient | null>(null);
	// const [mcpTools, setMcpTools] = useState<string[]>([]);
	// -----------------------------------------------------------------------------

  // Track current room
  const [currentRoom, setCurrentRoom] = useState(1);
  const [currentRoomName, setCurrentRoomName] = useState('');
  const [currentRoomBackground, setCurrentRoomBackground] = useState('');

  // Check if we have API capability for LLM interactions
  useEffect(() => {
    setHasAICapability(!!apiKey || !!process.env['ANTHROPIC_API_KEY'] || !!process.env['OPENAI_API_KEY']);
  }, [apiKey]);

  // Send input to the RoomAgent backend
  const sendAgentInput = async (input: string): Promise<string> => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/rooms/${currentRoom}/command`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input }),
        }
      );
      const data = await response.json();
      let text = data.response;
      if (data.unlocked) {
        text += `\nCorrect! Moving to room ${currentRoom + 1}.`;
        setCurrentRoom(prev => prev + 1);
      }
      return text;
    } catch (err) {
      console.error('Error communicating with RoomAgent:', err);
      return 'Error communicating with room agent.';
    }
  };

  // Process natural language input through an LLM if API key is available
  const processNaturalLanguage = async (text: string): Promise<string> => {
    if (!hasAICapability) {
      return "No API key configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable to enable AI assistance.";
    }

    setIsLoading(true);
    setLoadingMessage(`Cooking with ${selectedModel.label}...`);

    try {
      // For now, we'll use a simple fetch to a local API endpoint
      // In a real implementation, you'd use the respective SDKs
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey || process.env['ANTHROPIC_API_KEY'] || process.env['OPENAI_API_KEY']}`
        },
        body: JSON.stringify({ 
          message: text,
          currentRoom: currentRoom,
          model: selectedModel.value
        }),
      });

      const data = await response.json();
      return data.response || "I couldn't understand that. Please try a different command.";
    } catch (error) {
      console.error('Error processing natural language:', error);
      return "Error processing your request. Try using direct commands like /look, /inspect, etc.";
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Handle model selection
  const handleModelSelect = (model: ModelOption) => {
    setSelectedModel(model);
    return `Model changed to ${model.label}. ${model.description || ''}`;
  };

  // Add initial welcome message
	useEffect(() => {
		// Check connection to backend
		checkBackendConnection();

		// Add a short delay to simulate loading
		const timer = setTimeout(() => {
			setHistory([
				{ type: 'response', text: 'Welcome to the Escape Room CLI!' },
				{ type: 'response', text: 'Type /help to see available commands.' },
				...(hasAICapability ? [{ type: 'response' as const, text: 'AI assistance is enabled! You can use natural language to interact with the game.' }] : []),
			]);
		}, 1000);

		return () => clearTimeout(timer);
	}, [hasAICapability]);

		// Check backend connection
		const checkBackendConnection = async () => {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 1000);
	
				const response = await fetch('http://localhost:3001/api/health', {
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
					signal: controller.signal,
				});
	
				clearTimeout(timeoutId);
				setIsConnected(response.ok);
			} catch (error) {
				setIsConnected(false);
				console.error('Backend connection error:', error);
			}
		};
	//-----------------------------------------------------------------------------------------
	// Handle help command locally for standard mode
	const handleHelpCommand = () => {
		return [
		'Available commands:',
		'/help - Show this help message',
		'/look - Look around the room',
		'/inspect [object] - Inspect an object for details',
		'/guess [password] - Try a password to unlock',
		'/hint - Get a hint',
		'/restart - Restart the game',
		'/newgame - Start a new AI-generated escape room',
		'/history - Show command history',
		'/model - Change AI model',

		...(hasAICapability ? [
			'\n',
			'AI assistance is enabled! Type natural language queries like "what do I see in this room?"',
			`Current AI model: ${selectedModel.label}`
		] : []),
		`Current room: ${currentRoom}`
		].join('\n');
	};
	
	// Handle generating a new game using the RoomAgent API
	const handleGenerateNewGame = async (): Promise<string> => {
		try {
			setIsLoading(true);
			setLoadingMessage('Creating a new AI-generated escape room...');
			
			const response = await fetch('http://localhost:3001/api/newgame', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});
			
			const data = await response.json();
			
			if (data.success) {
				setCurrentRoom(99); // Set to the custom room ID
				setCurrentRoomName(data.game.name);
				setCurrentRoomBackground(data.game.background);
				return `New game created!\n\nRoom: ${data.game.name}\n\n${data.game.background || ""}\n\nThis room contains ${data.game.objectCount} objects to examine. Use /look to see them.`;
			} else {
				return `Failed to create new game: ${data.error || "Unknown error"}`;
			}
		} catch (error) {
			console.error('Error generating new game:', error);
			return 'Error communicating with the server. Please ensure the backend is running.';
		} finally {
			setIsLoading(false);
			setLoadingMessage('');
		}
	};

	// Main command handler
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
			return;
		}

		// Process the command based on current mode
		let response: string;

		if (mode === 'mcp') {
			
		// Handle commands in MCP mode
		//   response = await handleMcpCommand(command);
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
					resp = await sendAgentInput('/look');
					break;
				case '/inspect':
					if (parts.length < 2) resp = 'Usage: inspect [object]';
					else resp = await sendAgentInput(`/inspect ${parts.slice(1).join(' ')}`);
					break;
				case '/guess':
					if (parts.length < 2) resp = 'Usage: guess [password]';
					else resp = await sendAgentInput(`/guess ${parts.slice(1).join(' ')}`);
					break;
				case '/hint':
					resp = await sendAgentInput('/hint');
					break;
				case '/restart':
					// Restart: go back to room 1
					setCurrentRoom(1);
					resp = 'Game restarted. Back to Room 1.';
					break;
				case '/newgame':
					resp = await handleGenerateNewGame();
					break;
				case '/history':
					setShowHistory(true);
					resp = 'Showing command history:';
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

	// Handle closing the model selector
	const handleCloseModelSelector = () => {
		setShowModelSelector(false);
	};

	// Handle selecting a model
	const handleSelectModel = (model: ModelOption) => {
		const response = handleModelSelect(model);
		setHistory(prev => [...prev, { type: 'response', text: response }]);
	};

	return (
		<Box flexDirection="column" width="100%">
			<Box marginBottom={1}>
				<Text bold color={mode === 'standard' ? 'green' : 'magenta'}>
					[{mode === 'standard' ? 'Standard Mode' : 'MCP Client Mode'}]
				</Text>
				{/* {mode === 'mcp' && (
					<Box marginLeft={1}>
						<Text color={mcpConnected ? 'green' : 'red'}>
							{mcpConnected ? '✓ Connected' : '✗ Not Connected'}
						</Text>
					</Box>
				)} */}
				{hasAICapability && (
					<Box marginLeft={1}>
						<Text color="green">
							✓ AI Assistance Enabled ({selectedModel?.value})
						</Text>
					</Box>
				)}
			</Box>
			
			{isLoading && (
				<Box flexDirection="column" marginBottom={1} padding={1} borderStyle="round" borderColor="yellow">
					<Box>
						<Text color="green">
							<Spinner type="dots" />
						</Text>
						<Text color="yellow"> {loadingMessage}</Text>
					</Box>
				</Box>
			)}
			
			{mode === 'standard' && !isLoading && !showModelSelector && (
				<Box flexDirection="column" marginBottom={1}>
					<Gradient name="vice">
						<Text bold color="cyan">{currentRoomName}</Text>
					</Gradient>
					<Text color="gray" wrap="wrap">
						{currentRoomBackground}</Text>
				</Box>
			)}

			{showModelSelector ? (
				<ModelSelector 
					onSelect={handleSelectModel} 
					onClose={handleCloseModelSelector} 
				/>
			) : (
				<>
					<ScrollableBox height={25}>
						<CommandHistory history={history} showHistory={showHistory} />
					</ScrollableBox>

					<Box marginTop={1}>
						<CommandInput
							value={currentCommand}
							onChange={setCurrentCommand}
							onSubmit={handleCommand}
							mode={mode}
						/>
					</Box>
				</>
			)}

			{mode === 'standard' && !isConnected && !showModelSelector && (
				<Box marginTop={1}>
					<Text color="red">
						⚠ Backend server not connected - run backend with 'cd ../backend && npm
						run start'
					</Text>
				</Box>
			)}
		</Box>
	);
};

export default Terminal;