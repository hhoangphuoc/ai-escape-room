import React, { useState } from 'react';
import { Box, Text } from 'ink';
// import SelectInput from 'ink-select-input';
import Terminal from './components/Terminal.js';
import Title from './components/Title.js';
import UserRegistration from './components/UserRegistration.js';

type Props = {
	name?: string;
	email?: string;
	register?: boolean;
};

// type MenuItem = {
// 	label: string;
// 	value: string;
// };

interface UserData {
	name: string;
	email?: string;
	apiKey?: string;
}

export default function App({ name = '', email = '', register = false }: Props) {
	const [registrationComplete, setRegistrationComplete] = useState<boolean>(!register && !name);
	const [userData, setUserData] = useState<UserData>({ name: name || 'Adventurer' });

	const handleRegistrationComplete = (data: UserData) => {
		setUserData(data);
		setRegistrationComplete(true);
	};

	// const [mode, setMode] = useState<'standard' | 'mcp'>('standard');

	// const handleSelect = (item: MenuItem) => {
	// 	setMode(item.value as 'standard' | 'mcp');
	// };

	// const items = [
	// 	{
	// 		label: 'Standard Mode',
	// 		value: 'standard',
	// 	},
	// 	{
	// 		label: 'MCP Client Mode',
	// 		value: 'mcp',
	// 	},
	// ];

	return (
		<Box flexDirection="column" padding={1}>
			{!registrationComplete ? (
				<UserRegistration 
					onRegistrationComplete={handleRegistrationComplete} 
					username={name}
					email={email}
				/>
			) : (
				<>
					<Box marginBottom={1}>
						<Text bold color="cyan">
							Welcome, {userData.name}!
						</Text>
						<Title />
					</Box>

					{/* Mode selection */}
					{/* <Box marginY={1}>
						<Text bold>Select Mode: </Text>
						<Box marginLeft={1} width={20}>
							<SelectInput items={items} onSelect={handleSelect} />
						</Box>
					</Box> */}

					<Terminal 
						mode={'standard'} 
						apiKey={userData.apiKey} 
					/>
				</>
			)}
		</Box>
	);
}
