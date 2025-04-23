"use strict";
// backend/mcp/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// import { McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const axios_1 = __importDefault(require("axios"));
// Define the base URL for the API server
const API_BASE_URL = process.env.API_URL || "http://localhost:3001";
const MCP_SERVER_VERSION = "0.1.0";
//--------------------------------
//  TOOLS DEFINITIONS
//--------------------------------
// Zod schemas for input validation within handlers
const AnalyseObjectInputSchema = zod_1.z.object({
    object_name: zod_1.z.string().min(1, "Object name cannot be empty"),
});
const SubmitPasswordInputSchema = zod_1.z.object({
    password_guess: zod_1.z.string().min(1, "Password guess cannot be empty"),
});
// Define input schemas as plain objects for Tool definition
const analyseObjectPlainSchema = {
    type: "object",
    properties: {
        object_name: { type: "string", description: "The exact name of the object to analyze" }
    },
    required: ["object_name"]
};
const submitPasswordPlainSchema = {
    type: "object",
    properties: {
        password_guess: { type: "string", description: "The password to try" }
    },
    required: ["password_guess"]
};
const START_NEW_GAME_TOOL = {
    name: "start_new_game",
    description: "Restart the game and go back to Room 1.",
};
const SEEK_OBJECTS_TOOL = {
    name: "seek_objects_in_room",
    description: "List all objects in the current room.",
};
const ANALYSE_OBJECT_TOOL = {
    name: "analyse_object",
    description: "Inspect an object in the current room for clues.",
    inputSchema: analyseObjectPlainSchema,
};
const SUBMIT_PASSWORD_TOOL = {
    name: "submit_password",
    description: "Try a password to unlock the current room.",
    inputSchema: submitPasswordPlainSchema,
};
// List of all tools
const ALL_TOOLS = [
    START_NEW_GAME_TOOL,
    SEEK_OBJECTS_TOOL,
    ANALYSE_OBJECT_TOOL,
    SUBMIT_PASSWORD_TOOL
];
//---------------------------------------------------------------------------------------------------
//                                    MCP Server Setup
//---------------------------------------------------------------------------------------------------
// Use the generic Server class to use setRequestHandler
const server = new index_js_1.Server({
    name: "escape-room-server",
    version: MCP_SERVER_VERSION,
    capabilities: {
        resources: {},
        // Tools list can be dynamically generated or manually listed if preferred
        tools: ALL_TOOLS.reduce((acc, tool) => {
            acc[tool.name] = tool;
            return acc;
        }, {})
    }
});
//---------------------------------------------------------------------------------------------------
//  Helper Functions
//---------------------------------------------------------------------------------------------------
function createTextResult(text) {
    return { content: [{ type: "text", text }] };
}
function createApiErrorResult(error, toolName) {
    let message = `Error calling tool '${toolName}'.`;
    if (error && typeof error === 'object' && error.isAxiosError) {
        const responseData = error.response?.data;
        message = `API Error for tool '${toolName}': ${error.response?.status} ${responseData?.error || error.message}`;
        console.error(`Axios error calling ${toolName}:`, error.message, error.response?.data);
    }
    else if (error instanceof Error) {
        message = `Unexpected error in tool '${toolName}': ${error.message}`;
        console.error(`Unexpected error calling ${toolName}:`, error);
    }
    else {
        message = `Unknown error in tool '${toolName}'.`;
        console.error(`Unknown error calling ${toolName}:`, error);
    }
    return createTextResult(message);
}
//---------------------------------------------------------------------------------------------------
//  FUNCTIONS FOR TOOLS
//---------------------------------------------------------------------------------------------------
async function handleStartNewGame() {
    const toolName = START_NEW_GAME_TOOL.name;
    console.log(`MCP: Handling /${toolName}`);
    try {
        const response = await axios_1.default.post(`${API_BASE_URL}/game/start`);
        return createTextResult(response.data.message || "New game started.");
    }
    catch (error) {
        return createApiErrorResult(error, toolName);
    }
}
async function handleSeekObjects() {
    const toolName = SEEK_OBJECTS_TOOL.name;
    console.log(`MCP: Handling /${toolName}`);
    try {
        const response = await axios_1.default.get(`${API_BASE_URL}/room/objects`);
        const { roomName = 'current room', objects = [] } = response.data;
        const text = objects.length
            ? `Room '${roomName}' contains: ${objects.join(", ")}.`
            : `The room '${roomName}' is empty.`;
        return createTextResult(text);
    }
    catch (error) {
        return createApiErrorResult(error, toolName);
    }
}
async function handleAnalyseObject(args) {
    const toolName = ANALYSE_OBJECT_TOOL.name;
    console.log(`MCP: Handling /${toolName}`, args);
    const parseResult = AnalyseObjectInputSchema.safeParse(args);
    if (!parseResult.success) {
        const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
        return createTextResult(`Invalid input for ${toolName}: ${errorMsg}`);
    }
    const { object_name } = parseResult.data;
    try {
        const encodedObjectName = encodeURIComponent(object_name);
        const response = await axios_1.default.get(`${API_BASE_URL}/object/${encodedObjectName}`);
        const { name = 'Object', description = 'No description.', details = [] } = response.data;
        return createTextResult(`${name}: ${description}\nDetails: ${details.join(" ")}`);
    }
    catch (error) {
        if (error && typeof error === 'object' && error.isAxiosError && error.response?.status === 404) {
            const responseData = error.response?.data;
            return createTextResult(responseData?.error || `Object '${object_name}' not found.`);
        }
        return createApiErrorResult(error, toolName);
    }
}
async function handleSubmitPassword(args) {
    const toolName = SUBMIT_PASSWORD_TOOL.name;
    console.log(`MCP: Handling /${toolName} with args: [REDACTED]`); // Avoid logging args if they contain password
    const parseResult = SubmitPasswordInputSchema.safeParse(args);
    if (!parseResult.success) {
        const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
        return createTextResult(`Invalid input for ${toolName}: ${errorMsg}`);
    }
    const { password_guess } = parseResult.data;
    try {
        const response = await axios_1.default.post(`${API_BASE_URL}/room/unlock`, { password_guess });
        return createTextResult(response.data.message || "Password submitted.");
    }
    catch (error) {
        return createApiErrorResult(error, toolName);
    }
}
//---------------------------------------------------------------------------------------------------
//  MCP Request Handlers
//---------------------------------------------------------------------------------------------------
// Handler for listing available tools
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS, // Return the array of tool definitions
}));
// Handler for calling a specific tool
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
    // Let TypeScript infer params type from schema
    const { name, arguments: args } = req.params;
    console.log(`MCP: Received tool call request for '${name}' with args:`, args);
    switch (name) {
        case START_NEW_GAME_TOOL.name:
            return handleStartNewGame();
        case SEEK_OBJECTS_TOOL.name:
            return handleSeekObjects();
        case ANALYSE_OBJECT_TOOL.name:
            return handleAnalyseObject(args);
        case SUBMIT_PASSWORD_TOOL.name:
            return handleSubmitPassword(args);
        default:
            console.error(`MCP: Unknown tool called: ${name}`);
            return createTextResult(`Error: Unknown tool '${name}'.`);
    }
});
//---------------------------------------------------------------------------------------------------
// Run the server
//---------------------------------------------------------------------------------------------------
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("Escape Room MCP Server running via stdio…");
}
main().catch(err => {
    console.error("Fatal MCP error:", err);
    if (typeof process !== 'undefined' && process.exit) {
        process.exit(1);
    }
    else {
        console.error("Could not exit process.");
    }
});
//# sourceMappingURL=index.js.map