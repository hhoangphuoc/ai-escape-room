import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import CommandInput from './CommandInput.js';
import CommandHistory from './CommandHistory.js';
// import Title from './Title.js';
import ScrollableBox from './ScrollableBox.js';

// Define command types based on commands.ts
const COMMANDS = {
  '/help': {
    description: 'Shows available commands and their usage.',
    usage: '/help'
  },
  '/seek': {
    description: 'Lists all interactable objects in the current room.',
    usage: '/seek'
  },
  '/analyse': {
    description: 'Examine an object more closely for details or hints.',
    usage: '/analyse [object_name]'
  },
  '/password': {
    description: 'Submit a password guess for the current room.',
    usage: '/password [your_guess]'
  },
  '/newgame': {
    description: 'Starts a new game, resetting progress to the first room.',
    usage: '/newgame'
  },
  '/create-game': {
    description: 'Creates a simple custom game with one room.',
    usage: '/create-game "Concept Name" "object1,object2,..." "password(optional)"'
  }
};

const Terminal: React.FC = () => {
  const [history, setHistory] = useState<Array<{ type: 'command' | 'response', text: string }>>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  // const [showTitle, setShowTitle] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Add initial welcome message
  useEffect(() => {
    // Check connection to backend
    checkBackendConnection();

    // Add a short delay to simulate loading
    const timer = setTimeout(() => {
      // setShowTitle(false);
      setHistory([
        { type: 'response', text: 'Welcome to the Escape Room CLI!' },
        { type: 'response', text: 'Type /help to see available commands.' }
      ]);
    }, 3000);

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
        signal: controller.signal
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
        signal: controller.signal
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

  // Handle help command locally
  const handleHelpCommand = () => {
    return [
      'Available commands:',
      ...Object.entries(COMMANDS).map(([cmd, details]) => 
        `${cmd} - ${details.description}\n    Usage: ${details.usage}`
      ),
      '',
      isConnected ? 
        '✓ Connected to backend server' : 
        '⚠ Not connected to backend server. Only /help works offline.'
    ].join('\n');
  };

  const handleCommand = async (command: string) => {
    // Add user command to history
    setHistory(prev => [...prev, { type: 'command', text: command }]);
    
    // Strip leading slash if present, for command matching
    const normalizedCmd = command.startsWith('/') ? command : `/${command}`;
    const cmdParts = normalizedCmd.split(' ');
    const cmdBase = cmdParts.length > 0 && cmdParts[0] ? cmdParts[0].toLowerCase() : '';
    
    // Process the command
    let response;
    
    // Special handling for help command - provide immediate feedback
    if (cmdBase === '/help') {
      response = handleHelpCommand();
    } else {
      // Send other commands to the backend
      response = await sendCommand(normalizedCmd);
    }
    
    // Add response to history
    setHistory(prev => [...prev, { type: 'response', text: response }]);
  };

  return (
    <Box flexDirection="column" width="100%" height={25}>
      {/* {showTitle ? ( */}
        {/* <Title /> */}
      {/* ) : ( */}
        <>
          <ScrollableBox height={20}>
            <CommandHistory history={history} />
          </ScrollableBox>
          <Box marginTop={1}>
            <CommandInput 
              value={currentCommand} 
              onChange={setCurrentCommand} 
              onSubmit={handleCommand} 
            />
          </Box>
          {!isConnected && (
            <Box marginTop={1}>
              <Text color="red">⚠ Backend server not connected - run backend with 'cd ../backend && npm run start'</Text>
            </Box>
          )}
        </>
      {/* )} */}
    </Box>
  );
};

export default Terminal;