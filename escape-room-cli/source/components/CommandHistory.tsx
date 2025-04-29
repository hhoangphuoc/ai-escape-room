import React from 'react';
import {Box, Text} from 'ink';
// import Gradient from 'ink-gradient';

interface CommandHistoryProps {
	history: Array<{type: 'command' | 'response'; text: string}>;
	showHistory: boolean;
}

const CommandHistory: React.FC<CommandHistoryProps> = ({history, showHistory}) => {
	// If not showing history and there are items, only show the last command-response pair
	const itemsToShow = showHistory 
		? history 
		: history.length > 0 
			? history.slice(-2) // Show only the last command and its response
			: [];

	// Special UI formatting for history mode
	const renderHistoryHeader = () => {
		if (!showHistory) return null;
		return (
			<Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="cyan" padding={1}>
				{/* <Gradient name="rainbow"> */}
					<Text bold>Command History</Text>
				{/* </Gradient> */}
			</Box>
		);
	};

	return (
		<Box flexDirection="column" marginBottom={1}>
			{renderHistoryHeader()}
			
			{itemsToShow.map((item, index) => {
				// For command items, render with a nice prompt
				if (item.type === 'command') {
					return (
						<Box
							key={index}
							marginY={1}
						>
							<Text color="yellow">❯ </Text>
							<Text bold color="yellow">{item.text || ''}</Text>
						</Box>
					);
				}

				// For response items, handle multi-line content with better formatting
				return (
					<Box key={index} flexDirection="column" marginY={1}>
						{(item.text || '').split('\n').map((line, lineIndex) => (
							<Text key={`${index}-${lineIndex}`} color="white">
								{line}
							</Text>
						))}
					</Box>
				);
			})}
		</Box>
	);
};

export default CommandHistory;
