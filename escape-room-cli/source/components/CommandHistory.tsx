import React from 'react';
import {Box, Text} from 'ink';
import { HistoryItem } from '../utils/responseDisplay.js';
import { 
    HelpResponseComponent,
    LookResponseComponent,
    InspectResponseComponent,
    GuessResponseComponent,
    PasswordResponseComponent,
    HintResponseComponent,
    NewGameResponseComponent,
    LeaderboardResponseComponent,
    AuthResponseComponent,
    ErrorResponseComponent,
    SuccessResponseComponent,
    InfoResponseComponent,
    GenericResponseComponent
} from './ResponseComponents.js';
import { 
    HelpResponse, 
    LookResponse, 
    InspectResponse, 
    GuessResponse, 
    PasswordResponse, 
    HintResponse, 
    NewGameResponse, 
    LeaderboardResponse,
    AuthResponse 
} from '../utils/responseTypes.js';
// import Gradient from 'ink-gradient';

interface CommandHistoryProps {
	history: HistoryItem[];
	showHistory: boolean;
	useComponents?: boolean;
}

const renderResponseComponent = (item: HistoryItem): React.ReactElement | null => {
	if (!item.data || !item.responseType) return null;

	try {
		switch (item.responseType) {
			case 'help':
				return <HelpResponseComponent key={Math.random()} response={item.data as HelpResponse} />;
			case 'look':
				return <LookResponseComponent key={Math.random()} response={item.data as LookResponse} />;
			case 'inspect':
				return <InspectResponseComponent key={Math.random()} response={item.data as InspectResponse} />;
			case 'guess':
				return <GuessResponseComponent key={Math.random()} response={item.data as GuessResponse} />;
			case 'password':
				return <PasswordResponseComponent key={Math.random()} response={item.data as PasswordResponse} />;
			case 'hint':
				return <HintResponseComponent key={Math.random()} response={item.data as HintResponse} />;
			case 'newgame':
				return <NewGameResponseComponent key={Math.random()} response={item.data as NewGameResponse} />;
			case 'leaderboard':
				return <LeaderboardResponseComponent key={Math.random()} response={item.data as LeaderboardResponse} />;
			case 'auth':
				return <AuthResponseComponent key={Math.random()} response={item.data as AuthResponse} />;
			default:
				return null;
		}
	} catch (error) {
		console.error('Error rendering response component:', error);
		return null;
	}
};

const CommandHistory: React.FC<CommandHistoryProps> = ({history, showHistory, useComponents = true}) => {
	const itemsToShow = showHistory 
		? history 
		: history.length > 0 
			? history.slice(-2) // Show only the last command and its response
			: [];

	const renderHistoryHeader = () => {
		if (!showHistory) return null;
		return (
			<Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="cyan" padding={1}>
				<Text bold>Command History</Text>
			</Box>
		);
	};

	return (
		<Box flexDirection="column" marginBottom={1}>
			{renderHistoryHeader()}
			
			{itemsToShow.map((item, index) => {
				if (item.type === 'command') {
					return (
						<Box
							key={index}
							marginY={1}
							paddingX={1}
						>
							<Text color="yellow">❯ </Text>
							<Text bold color="yellow">{item.text || ''}</Text>
						</Box>
					);
				}

				if (useComponents && item.responseType && item.data) {
					const component = renderResponseComponent(item);
					if (component) {
						return (
							<Box key={index} flexDirection="column" marginY={0}>
								{component}
							</Box>
						);
					}
				}

				if (item.type === 'error') {
					return (
						<Box key={index} flexDirection="column" marginY={0}>
							<ErrorResponseComponent message={item.text} />
						</Box>
					);
				} else if (item.type === 'success') {
					return (
						<Box key={index} flexDirection="column" marginY={0}>
							<SuccessResponseComponent message={item.text} />
						</Box>
					);
				} else if (item.type === 'info') {
					return (
						<Box key={index} flexDirection="column" marginY={0}>
							<InfoResponseComponent message={item.text} />
						</Box>
					);
				} else {
					return (
						<Box key={index} flexDirection="column" marginY={0}>
							<GenericResponseComponent message={item.text} />
						</Box>
					);
				}
			})}
		</Box>
	);
};

export default CommandHistory;
