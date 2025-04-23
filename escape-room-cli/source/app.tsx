import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Terminal from './components/Terminal.js';
import Title from './components/Title.js';

type Props = {
	name?: string;
};

type MenuItem = {
	label: string;
	value: string;
};

export default function App({ name = 'Adventurer' }: Props) {
	const [mode, setMode] = useState<'standard' | 'mcp'>('standard');

	const handleSelect = (item: MenuItem) => {
		setMode(item.value as 'standard' | 'mcp');
	};

	const items = [
		{
			label: 'Standard Mode',
			value: 'standard',
		},
		{
			label: 'MCP Client Mode',
			value: 'mcp',
		},
	];

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Welcome, {name}!
				</Text>
				<Title />
			</Box>

			{/* Mode selection */}
			<Box marginY={1}>
				<Text bold>Select Mode: </Text>
				<Box marginLeft={1} width={20}>
					<SelectInput items={items} onSelect={handleSelect} />
				</Box>
			</Box>

			<Terminal mode={mode} />
		</Box>
	);
}
