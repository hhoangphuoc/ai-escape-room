import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useStdin} from 'ink';
import type {Key} from 'ink';

// Define command types based on commands.ts in backend
// This matches the structure in backend/constant/commands.ts
interface CommandDetails {
	description: string;
	usage: string;
	aliases?: string[];
	args?: boolean;
}

interface CommandCollection {
	[key: string]: CommandDetails;
}

// Command list - kept in sync with backend/constant/commands.ts
export const COMMANDS: CommandCollection = {
	'/help': {
		description: 'Shows available commands and their usage.',
		usage: '/help',
	},
	'/seek': {
		description: 'Lists all interactable objects in the current room.',
		usage: '/seek',
	},
	'/analyse': {
		description: 'Examine an object more closely for details or hints.',
		usage: '/analyse [object_name]',
	},
	'/password': {
		description: 'Submit a password guess for the current room.',
		usage: '/password [your_guess]',
	},
	'/newgame': {
		description: 'Starts a new game, resetting progress to the first room.',
		usage: '/newgame',
	},
	'/create-game': {
		description: 'Creates a simple custom game with one room.',
		usage:
			'/create-game "Concept Name" "object1,object2,..." "password(optional)"',
	},
};

interface CommandInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (value: string) => void;
	mode?: 'standard' | 'mcp';
}

const CommandInput: React.FC<CommandInputProps> = ({
	value,
	onChange,
	onSubmit,
	mode = 'standard',
}) => {
	const {isRawModeSupported} = useStdin();
	const [cursorVisible, setCursorVisible] = useState(true);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [filteredCommands, setFilteredCommands] = useState<{
		[key: string]: {description: string; usage: string};
	}>({});

	// Blink cursor effect
	useEffect(() => {
		if (!isRawModeSupported) return;

		const timer = setInterval(() => {
			setCursorVisible(prev => !prev);
		}, 500);

		return () => clearInterval(timer);
	}, [isRawModeSupported]);

	// Filter commands based on user input and mode
	useEffect(() => {
		// Show suggestions when input starts with "/"
		if (value.startsWith('/')) {
			setShowSuggestions(true);

			// Define mode-specific commands
			let availableCommands = {...COMMANDS};
			
			// If in MCP mode, add MCP-specific commands and show only applicable ones
			if (mode === 'mcp') {
				// Add MCP-specific commands
				const mcpCommands: CommandCollection = {
					'/mcp-auth': {
						description: 'Set your MCP API key',
						usage: '/mcp-auth [your-api-key]',
					},
					'/disconnect': {
						description: 'Disconnect from MCP server',
						usage: '/disconnect',
					},
					'/help': {
						description: 'Shows available commands and their usage.',
						usage: '/help',
					},
				};
				
				// Override with MCP commands
				availableCommands = mcpCommands;
			}

			// Filter commands that match the current input
			const filtered = Object.entries(availableCommands).reduce(
				(acc, [cmd, details]) => {
					if (cmd.startsWith(value.toLowerCase())) {
						acc[cmd] = details;
					}
					return acc;
				},
				{} as {[key: string]: {description: string; usage: string}},
			);

			setFilteredCommands(filtered);
		} else {
			setShowSuggestions(false);
		}
	}, [value, mode]);

	// Handle keyboard input only if raw mode is supported
	useInput((input: string, key: Key) => {
		if (!isRawModeSupported) return;

		if (key.return) {
			if (value.trim() !== '') {
				onSubmit(value);
				onChange('');
			}
		} else if (key.backspace || key.delete) {
			onChange(value.slice(0, -1));
		} else if (!key.ctrl && !key.meta) {
			onChange(value + input);
		}
	});

	return (
		<Box flexDirection="column">
			<Box>
				<Text color="yellow">&gt; </Text>
				<Text>{value}</Text>
				{isRawModeSupported ? (
					<Text color="gray">{cursorVisible ? '█' : ' '}</Text>
				) : (
					<Text color="red">
						[Input disabled - run in interactive terminal]
					</Text>
				)}
			</Box>

			{showSuggestions && Object.keys(filteredCommands).length > 0 && (
				<Box
					flexDirection="column"
					marginLeft={2}
					marginTop={1}
					borderStyle="round"
					borderColor="gray"
				>
					<Box marginBottom={1}>
						<Text bold> Available Commands</Text>
					</Box>
					{Object.entries(filteredCommands).map(([cmd, details]) => (
						<Box key={cmd}>
							<Text
								color={cmd === value ? 'cyan' : 'white'}
								bold={cmd === value}
							>
								{cmd.padEnd(15)}
							</Text>
							<Text
								color={cmd === value ? 'cyan' : 'white'}
								bold={cmd === value}
							>
								{details.description}
							</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
};

export default CommandInput;