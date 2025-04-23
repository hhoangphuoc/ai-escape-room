import React from 'react';
import { Box, Text } from 'ink';

interface CommandHistoryProps {
  history: Array<{ type: 'command' | 'response', text: string }>;
}

const CommandHistory: React.FC<CommandHistoryProps> = ({ history }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {history.map((item, index) => {
        // For command items, render on a single line
        if (item.type === 'command') {
          return (
            <Box key={index} borderStyle="round" marginRight={1} borderColor="yellow">
              <Text color="yellow">&gt; </Text>
              <Text>{item.text}</Text>
            </Box>
          );
        }
        
        // For response items, handle multi-line content
        return (
          <Box key={index} flexDirection="column">
            {item.text.split('\n').map((line, lineIndex) => (
              <Text key={`${index}-${lineIndex}`} color="green">
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