import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import type { Key } from 'ink';

interface CommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

const CommandInput: React.FC<CommandInputProps> = ({ value, onChange, onSubmit }) => {
  const { isRawModeSupported } = useStdin();
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blink cursor effect
  useEffect(() => {
    if (!isRawModeSupported) return;
    
    const timer = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    
    return () => clearInterval(timer);
  }, [isRawModeSupported]);

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
    <Box>
      <Text color="yellow">&gt; </Text>
      <Text>{value}</Text>
      {isRawModeSupported ? (
        <Text color="gray">{cursorVisible ? '█' : ' '}</Text>
      ) : (
        <Text color="red">[Input disabled - run in interactive terminal]</Text>
      )}
    </Box>
  );
};

export default CommandInput;