//--------------------------------------------------------------------------------------------------------
//  CODEBASE FOR MCP CLIENT
//--------------------------------------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// MCP Client Component
interface McpClientUIProps {
  userId?: string;
  onMessage: (message: string) => void;
}

const McpClientUI: React.FC<McpClientUIProps> = ({ onMessage }) => {
  const [mcpClient, setMcpClient] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Transport
  const transport = new StdioClientTransport({
    command: "mcp",
    args: ["--port", "3001"],
  });

  // Connect to MCP server
  const connectToMcp = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Create MCP client
      const client = new Client({
        name: "escape-room-cli",
        version: "0.1.0",
        url: "http://localhost:3001/mcp"
      });

      // Connect to server
      await client.connect(transport);
      
      // Get available tools
      const availableTools = await client.listTools();
      
      // Check if availableTools is an array before trying to map it
      if (Array.isArray(availableTools)) {
        setTools(availableTools.map((tool: any) => tool.name));
      } else {
        console.error("Expected availableTools to be an array but got:", availableTools);
        setTools([]);
      }
      
      setMcpClient(client);
      setIsConnected(true);
      onMessage("Connected to MCP server successfully!");
    } catch (error) {
      console.error("Error connecting to MCP server:", error);
      setError(`Failed to connect to MCP server: ${error instanceof Error ? error.message : "Unknown error"}`);
      onMessage("Failed to connect to MCP server. Make sure the backend is running.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Call MCP tool
  // const callTool = async (toolName: string, args: any = {}) => {
  //   if (!mcpClient || !isConnected) {
  //     return { error: "Not connected to MCP server" };
  //   }

  //   try {
  //     const result = await mcpClient.callTool(toolName, args);
  //     return result;
  //   } catch (error) {
  //     console.error(`Error calling tool ${toolName}:`, error);
  //     return { 
  //       error: `Error calling tool ${toolName}: ${error instanceof Error ? error.message : "Unknown error"}` 
  //     };
  //   }
  // };

  // Process MCP command (parse command and call appropriate tool) -----------------------------------
  // FIXME: NOT IMPLEMENTED YET
  // const processMcpCommand = async (command: string) => {
  //   if (!command.startsWith('/')) {
  //     return { error: "MCP commands must start with /" };
  //   }

  //   // Parse command
  //   const parts = command.substring(1).split(' ');
  //   const toolName = parts[0]; //TOOL NAME (get from MCP SERVER TOOLS)
    
  //   // Check if tool exists
  //   if (!toolName) {
  //     return { error: "No tool specified. Please provide a valid MCP tool." };
  //   }
    
  //   if (!tools.includes(toolName)) {
  //     return { 
  //       error: `Unknown MCP tool: ${toolName}. Available tools: ${tools.join(', ')}` 
  //     };
  //   }

  //   // Parse arguments
  //   let args = {};
  //   switch (toolName) {
  //     case 'analyse_object':
  //       if (parts.length > 1) {
  //         const objectName = parts.slice(1).join(' ');
  //         args = { object_name: objectName };
  //       } else {
  //         return { error: "Usage: /analyse_object [object_name]" };
  //       }
  //       break;
  //     case 'submit_password':
  //       if (parts.length > 1) {
  //         const passwordGuess = parts.slice(1).join(' ');
  //         args = { password_guess: passwordGuess };
  //       } else {
  //         return { error: "Usage: /submit_password [password]" };
  //       }
  //       break;
  //   }

  //   // Call tool
  //   return await callTool(toolName, args);
  // };
  //--------------------------------------------------------------------------------------------------------

  // Connect to MCP server on component mount
  useEffect(() => {
    connectToMcp();
    
    // Cleanup on unmount
    return () => {
      if (mcpClient && isConnected) {
        mcpClient.disconnect();
      }
    };
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      {isConnecting ? (
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> Connecting to MCP server...</Text>
        </Box>
      ) : isConnected ? (
        <Box>
          <Text color="green">✓ </Text>
          <Text>Connected to MCP server</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Text color="red">✗ </Text>
            <Text>Not connected to MCP server</Text>
          </Box>
          {error && (
            <Box marginTop={1}>
              <Text color="red">{error}</Text>
            </Box>
          )}
        </Box>
      )}

      {isConnected && tools.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Available MCP tools:</Text>
          {tools.map(tool => (
            <Text key={tool}> - /{tool}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default McpClientUI;