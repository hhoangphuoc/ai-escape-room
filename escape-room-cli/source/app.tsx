import React from 'react';
import { Box, Text } from 'ink';
import Terminal from './components/Terminal.js';
import Title from './components/Title.js';

type Props = {
  name?: string;
};

export default function App({ name = 'Adventurer' }: Props) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Welcome, {name}!
        </Text>
        <Title />
      </Box>
      <Terminal />
    </Box>
  );
}