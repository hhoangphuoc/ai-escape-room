// backend/mcp/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import { getApiBaseUrl } from "../constant/apiConfig";

// Define the base URL for the API server
const API_BASE_URL = getApiBaseUrl();
const MCP_SERVER_VERSION = "0.1.0";

// --- Interfaces for API Responses ---
interface StartGameResponse { message?: string; }
interface RoomObjectsResponse { roomName?: string; objects?: string[]; }
interface AnalyseObjectResponse { name?: string; description?: string; details?: string[]; error?: string; }
interface UnlockRoomResponse { message?: string; unlocked?: boolean; finished?: boolean; error?: string; }

//---------------------------------------------------------------------------------------------------
//  Helper Functions
//---------------------------------------------------------------------------------------------------

function createTextResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function createApiErrorResult(error: any, toolName: string): CallToolResult {
    let message = `Error calling tool '${toolName}'.`;
    if (error && typeof error === 'object' && error.isAxiosError) {
        const responseData = error.response?.data as { error?: string } | undefined;
        message = `API Error for tool '${toolName}': ${error.response?.status} ${responseData?.error || error.message}`;
        console.error(`Axios error calling ${toolName}:`, error.message, error.response?.data);
    } else if (error instanceof Error) {
        message = `Unexpected error in tool '${toolName}': ${error.message}`;
        console.error(`Unexpected error calling ${toolName}:`, error);
    } else {
        message = `Unknown error in tool '${toolName}'.`;
         console.error(`Unknown error calling ${toolName}:`, error);
    }
    return createTextResult(message);
}

// --- MCP Server Setup ---
const server = new McpServer({
  name: "mcp-ai-escape-room",
  version: MCP_SERVER_VERSION,
  capabilities: { resources: {}, tools: {} }
});

//---------------------------------------------------------------------------------------------------
//                                        FUNCTIONS FOR TOOLS
//---------------------------------------------------------------------------------------------------

// 1) /start_new_game
server.tool(
  "start_new_game",
  "Restart the game and go back to Room 1.",
  z.object({}).shape,
  async () => {
    const toolName = 'start_new_game';
    console.log(`MCP: Received /${toolName}`);
    try {
      const response = await axios.post<StartGameResponse>(`${API_BASE_URL}/game/start`);
      return createTextResult(response.data.message || "New game started.");
    } catch (error) {
      return createApiErrorResult(error, toolName);
    }
  }
);

// 2) /seek_objects
server.tool(
  "seek_objects",
  "List all objects in the current room.",
  z.object({}).shape,
  async () => {
    const toolName = 'seek_objects';
    console.log(`MCP: Received /${toolName}`);
    try {
      const response = await axios.get<RoomObjectsResponse>(`${API_BASE_URL}/room/objects`);
      const { roomName = 'current room', objects = [] } = response.data;
      const text = objects.length
        ? `Room '${roomName}' contains: ${objects.join(", ")}.`
        : `The room '${roomName}' is empty.`;
      return createTextResult(text);
    } catch (error) {
      return createApiErrorResult(error, toolName);
    }
  }
);

// 3) /analyse_object
server.tool(
  "analyse_object",
  "Inspect an object in the current room for clues.",
  z.object({
      object_name: z.string().min(1, "Object name cannot be empty").describe("The exact name of the object to analyze"),
  }).shape,
  async ({ object_name }) => {
    const toolName = 'analyse_object';
    console.log(`MCP: Received /${toolName} for object: ${object_name}`);
    try {
      const encodedObjectName = encodeURIComponent(object_name);
      const response = await axios.get<AnalyseObjectResponse>(`${API_BASE_URL}/object/${encodedObjectName}`);
      const { name = 'Object', description = 'No description.', details = [] } = response.data;
      return createTextResult(`${name}: ${description}\nDetails: ${details.join(" ")}`);
    } catch (error: any) {
       if (error && typeof error === 'object' && error.isAxiosError && error.response?.status === 404) {
           const responseData = error.response?.data as { error?: string } | undefined;
           return createTextResult(responseData?.error || `Object '${object_name}' not found.`);
       }
      return createApiErrorResult(error, toolName);
    }
  }
);

// 4) /submit_password
server.tool(
  "submit_password",
  "Try a password to unlock the current room.",
  z.object({
      password_guess: z.string().min(1, "Password guess cannot be empty").describe("The password to try"),
  }).shape,
  async ({ password_guess }) => {
    const toolName = 'submit_password';
    console.log(`MCP: Handling /${toolName} with password: [REDACTED]`);
    try {
        const response = await axios.post<UnlockRoomResponse>(`${API_BASE_URL}/room/unlock`, { password_guess });
        return createTextResult(response.data.message || "Password submitted.");
    } catch (error) {
        return createApiErrorResult(error, toolName);
    }
  }
);

//---------------------------------------------------------------------------------------------------
// Run the server
//---------------------------------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Escape Room MCP Server running via stdio…");
}

main().catch(err => {
  console.error("Fatal MCP error:", err);
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  } else {
      console.error("Could not exit process.");
  }
});
