import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import CommandInput from './CommandInput.js';
import CommandHistory from './CommandHistory.js';
import ScrollableBox from './ScrollableBox.js';
import Gradient from 'ink-gradient';
// import {MCPClient} from '../../mcp/index.js'
// import Anthropic from '@anthropic-ai/sdk';

interface TerminalProps {
	mode: 'standard' | 'mcp';
}

const Terminal: React.FC<TerminalProps> = ({ mode }) => {
	const [history, setHistory] = useState<Array<{ type: 'command' | 'response'; text: string }>>([]);
	const [currentCommand, setCurrentCommand] = useState('');
	const [isConnected, setIsConnected] = useState(false);
	// const [mcpConnected, setMcpConnected] = useState(false);
	// const [apiKey, setApiKey] = useState<string | null>(null);
	// const [mcpClient, setMcpClient] = useState<MCPClient | null>(null);
	// const [mcpTools, setMcpTools] = useState<string[]>([]);

  // Track current room
  const [currentRoom, setCurrentRoom] = useState(1);
  const [currentRoomName, setCurrentRoomName] = useState('');
  const [currentRoomBackground, setCurrentRoomBackground] = useState('');
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

  // Add initial welcome message
	useEffect(() => {
		// Check connection to backend
		checkBackendConnection();

		// Add a short delay to simulate loading
		const timer = setTimeout(() => {
			setHistory([
				{ type: 'response', text: 'Welcome to the Escape Room CLI!' },
				{ type: 'response', text: 'Type /help to see available commands.' },
			]);
		}, 1000);

		return () => clearTimeout(timer);
	}, []);

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
		'/newgame - Start a new game',
		// '/generatenewgame - Create a new AI-generated escape room',
		`Current room: ${currentRoom}`
		].join('\n');
	};
	
	// Handle generating a new game using the RoomAgent API
	const handleGenerateNewGame = async (): Promise<string> => {
		try {
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
		}
	};

	// Main command handler
	const handleCommand = async (command: string) => {
		// Add user command to history
		setHistory(prev => [...prev, { type: 'command', text: command }]);

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
		const parts = command.trim().split(' ');
		const cmd = parts[0]?.toLowerCase();
		if (!cmd) {
			response = "Unknown command. Try '/help', '/look', '/inspect', '/guess', '/hint', or '/restart'.";
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
			default:
				resp = "Unknown command. Try '/help', '/newgame', '/generatenewgame', '/look', '/inspect', '/guess', '/hint', or '/restart'.";
		}
		response = resp;
		}

		// Add response to history
		setHistory(prev => [...prev, { type: 'response', text: response }]);
	};

	return (
		<Box flexDirection="column" width="100%" height={25}>
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
			</Box>
			{mode === 'standard' && (
				<Box flexDirection="column" marginBottom={1}>
					<Gradient name="vice">
						<Text bold color="cyan">{currentRoomName}</Text>
					</Gradient>
					<Text color="gray" wrap="wrap">
						{currentRoomBackground}</Text>
				</Box>
			)}

			<ScrollableBox height={18}>
				<CommandHistory history={history} />
			</ScrollableBox>

			<Box marginTop={1}>
				<CommandInput
					value={currentCommand}
					onChange={setCurrentCommand}
					onSubmit={handleCommand}
					mode={mode}
				/>
			</Box>

			{mode === 'standard' && !isConnected && (
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