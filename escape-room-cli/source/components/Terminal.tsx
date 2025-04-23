import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import CommandInput, { COMMANDS } from './CommandInput.js';
import CommandHistory from './CommandHistory.js';
import ScrollableBox from './ScrollableBox.js';
import {MCPClient} from '../../mcp/index.js'
import Anthropic from '@anthropic-ai/sdk';

interface TerminalProps {
	mode: 'standard' | 'mcp';
}

const Terminal: React.FC<TerminalProps> = ({ mode }) => {
	const [history, setHistory] = useState<
		Array<{ type: 'command' | 'response'; text: string }>
	>([]);
	const [currentCommand, setCurrentCommand] = useState('');
	const [isConnected, setIsConnected] = useState(false);
	const [mcpConnected, setMcpConnected] = useState(false);
	const [apiKey, setApiKey] = useState<string | null>(null);
	const [mcpClient, setMcpClient] = useState<MCPClient | null>(null);
	const [mcpTools, setMcpTools] = useState<string[]>([]);

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

	// Handle local storage in Node.js environment
	const getStoredApiKey = () => {
		try {
			if (typeof localStorage !== 'undefined') {
				return localStorage.getItem('mcpApiKey');
			}
			// For Node.js environment, we can't use localStorage
			return null;
		} catch (error) {
			console.error('Error accessing localStorage:', error);
			return null;
		}
	};

	const setStoredApiKey = (key: string) => {
		try {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('mcpApiKey', key);
				return true;
			}
			return false;
		} catch (error) {
			console.error('Error setting localStorage:', error);
			return false;
		}
	};

	// Effect to handle mode changes
	useEffect(() => {
		if (mode === 'mcp') {
			// Check if apiKey is already stored
			const storedApiKey = getStoredApiKey();
			if (storedApiKey) {
				setApiKey(storedApiKey);
				initializeMcpClient(storedApiKey);
			} else {
				// Prompt user for API key
				setHistory(prev => [
					...prev,
					{
						type: 'response',
						text: 'Please enter your MCP API key with /mcp-auth [your-api-key]',
					},
				]);
			}
		} else {
			// Disconnect MCP client if exists
			if (mcpClient) {
				disconnectMcpClient();
			}
		}
	}, [mode]);

	// Initialize MCP client
	const initializeMcpClient = async (apiKey: string) => {
		try {
			setHistory(prev => [
				...prev,
				{ type: 'response', text: 'Connecting to MCP server...' },
			]);

			const anthropic = new Anthropic({
				apiKey: apiKey,
			});

			// Create a new MCP client
			const mcpClient = new MCPClient(
			);

			// Get available tools
			const tools = await mcpClient.getTools();

			setMcpClient(mcpClient);
			setMcpTools(tools.map(tool => tool.name));
			setMcpConnected(true);

			setHistory(prev => [
				...prev,
				{
					type: 'response',
					text: `Connected to MCP server`,
				},
				{
					type: 'response',
					text: `Available tools: ${tools.join(', ')}`,
				},
			]);
		} catch (error) {
			console.error('MCP connection error:', error);
			setMcpConnected(false);
			setHistory(prev => [
				...prev,
				{
					type: 'response',
					text: `Error connecting to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
				},
			]);
		}
	};

	// Disconnect MCP client
	const disconnectMcpClient = () => {
		if (mcpClient) {
			try {
				// Close the connection
				mcpClient.disconnectFromServer();
				setMcpClient(null);
				setMcpConnected(false);
				setMcpTools([]);
			} catch (error) {
				console.error('Error disconnecting MCP client:', error);
			}
		}
	};

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

	// Send command to backend API
	const sendCommand = async (cmd: string) => {
		try {
			//Check connection first
			if (!isConnected) {
				await checkBackendConnection();
				if (!isConnected) {
					return 'Cannot connect to the backend server. Please ensure it is running on http://localhost:3001.';
				}
			}

			// Remove the leading slash if present for API compatibility
			const apiCommand = cmd.startsWith('/') ? cmd : `/${cmd}`;

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 3000);

			const response = await fetch('http://localhost:3001/api/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ command: apiCommand }),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			const data = await response.json();
			return data.response;
		} catch (error) {
			console.error('Error sending command:', error);
			setIsConnected(false);
			return 'Error communicating with server. Please ensure the backend is running.';
		}
	};

	// Handle MCP command
	const handleMcpCommand = async (command: string) => {
		// Process MCP-specific commands
		if (command.startsWith('/mcp-auth')) {
			const parts = command.split(' ');
			if (parts.length >= 2 && parts[1]) {
				const apiKey = parts[1].trim();
				setApiKey(apiKey);
				// Store API key
				const stored = setStoredApiKey(apiKey);
				if (!stored) {
					console.warn('Could not store API key for future sessions');
				}
				await initializeMcpClient(apiKey);
				return 'API key stored. Connecting to MCP server...';
			}
			return 'Please provide an API key: /mcp-auth [your-api-key]';
		}

		// Handle /help command in MCP mode
		if (command === '/help') {
			let helpText = 'MCP Client Mode Commands:\n';
			helpText += '- /mcp-auth [api-key] - Set your MCP API key\n';
			helpText += '- /disconnect - Disconnect from MCP server\n\n';

			if (mcpConnected && mcpTools.length > 0) {
				helpText += 'Available MCP Tools:\n';
				helpText += mcpTools.map(tool => `- /${tool}`).join('\n');
			} else {
				helpText += 'Not connected to MCP server';
			}

			return helpText;
		}

		if (command === '/disconnect') {
			disconnectMcpClient();
			return 'Disconnected from MCP server';
		}

		// If client exists and command matches a tool name
		if (mcpClient && mcpConnected) {
			// Extract the tool name (remove leading slash)
			const cmdParts = command.split(' ');
			const toolName = cmdParts[0] ? cmdParts[0].substring(1) : ''; // Remove the leading slash

			// Check if this is a valid tool
			if (mcpTools.includes(toolName)) {
				try {
					// Parse arguments based on the tool
					let args = {};

					// Handle specific tools with their parameters
					switch (toolName) {
						case 'analyse_object':
							// Get everything after the first space as the object name
							if (cmdParts.length > 1) {
								const object_name = command.substring(command.indexOf(' ') + 1);
								args = { object_name };
							} else {
								return 'Usage: /analyse_object [object_name]';
							}
							break;
						case 'submit_password':
							// Get everything after the first space as the password guess
							if (cmdParts.length > 1) {
								const password_guess = command.substring(command.indexOf(' ') + 1);
								args = { password_guess };
							} else {
								return 'Usage: /submit_password [your_guess]';
							}
							break;
						// No arguments for other tools
						case 'start_new_game':
						case 'seek_objects':
							args = {};
							break;
						default:
							return `Unknown MCP tool: ${toolName}`;
					}

					// Call the MCP tool
					const result = await mcpClient.processQuery(command);
					console.log(result);

					return result;
					//FIXME: ------------------------------------------------------------
					// THIS PART HANDLED IMPLICITLY BY THE MCP CLIENT
					// Extract text from the result
					// if (result.content && result.content.length > 0) {
					// 	// Find the first text content
					// 	const textContent = result.content.find((item: any) => item.type === 'text');
					// 	if (textContent && 'text' in textContent) {
					// 		return textContent.text;
					// 	}
					// }
					
					// return JSON.stringify(result);
					//----------------------------------------------------------------------

				} catch (error) {
					console.error(`Error calling MCP tool ${toolName}:`, error);
					return `Error calling MCP tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
				}
			} else {
				return `Unknown MCP tool: ${toolName}. Type /help to see available tools.`;
			}
		} else {
			return 'Not connected to MCP server. Use /mcp-auth [api-key] to connect.';
		}
	};

	// Handle help command locally using the imported COMMANDS
	const handleHelpCommand = () => {
		return [
			'Available commands:',
			...Object.entries(COMMANDS).map(
				([cmd, details]) =>
					`${cmd} - ${details.description}\n    Usage: ${details.usage}`,
			),
			'',
			isConnected
				? '✓ Connected to backend server'
				: '⚠ Not connected to backend server. Only /help works offline.',
		].join('\n');
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
		let response;

		if (mode === 'mcp') {
			// Handle commands in MCP mode
			response = await handleMcpCommand(command);
		} else {
			// Handle commands in standard mode
			// Strip leading slash if present, for command matching
			const normalizedCmd = command.startsWith('/') ? command : `/${command}`;
			const cmdParts = normalizedCmd.split(' ');
			const cmdBase =
				cmdParts.length > 0 && cmdParts[0] ? cmdParts[0].toLowerCase() : '';

			// Special handling for help command - provide immediate feedback
			if (cmdBase === '/help') {
				response = handleHelpCommand();
			} else {
				// Send other commands to the backend
				response = await sendCommand(normalizedCmd);
			}
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
				{mode === 'mcp' && (
					<Box marginLeft={1}>
						<Text color={mcpConnected ? 'green' : 'red'}>
							{mcpConnected ? '✓ Connected' : '✗ Not Connected'}
						</Text>
					</Box>
				)}
			</Box>

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