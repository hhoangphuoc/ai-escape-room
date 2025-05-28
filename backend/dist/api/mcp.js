"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = exports.GET = void 0;
const mcp_adapter_1 = require("@vercel/mcp-adapter");
const zod_1 = require("zod");
const authController_1 = require("../api/auth/authController");
const RoomAgent_1 = require("../agents/RoomAgent");
const MultiRoomGame_1 = require("../agents/MultiRoomGame");
const uuid_1 = require("uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
const mcpGameSessions = {};
const handler = (0, mcp_adapter_1.createMcpHandler)(async (server) => {
    // Tool 1: Generate a game with API key, username, and email
    server.tool('generate_game', 'Generate a new escape room game with user credentials and API key', {
        apiKey: zod_1.z.string().describe('OpenAI or Anthropic API key for game generation'),
        userName: zod_1.z.string().describe('User name for the game'),
        userEmail: zod_1.z.string().email().describe('User email address'),
        gameMode: zod_1.z.enum(['single-room', 'multi-room']).default('single-room').describe('Type of game to generate'),
        roomCount: zod_1.z.number().int().min(2).max(10).optional().describe('Number of rooms for multi-room game'),
        gameTheme: zod_1.z.string().optional().describe('Theme for the game (e.g., "horror", "sci-fi", "mystery")')
    }, async ({ apiKey, userName, userEmail, gameMode, roomCount, gameTheme }) => {
        try {
            // Generate a unique session ID for this MCP session
            const sessionId = (0, uuid_1.v4)();
            const userId = (0, uuid_1.v4)();
            // Create a temporary user for this session if not exists
            let user = Object.values(authController_1.users).find(u => u.email === userEmail);
            if (!user) {
                // Create a temporary user directly in the users object
                const tempPassword = (0, uuid_1.v4)();
                const hashedPassword = await bcrypt_1.default.hash(tempPassword, 10);
                const newUser = {
                    id: userId,
                    name: userName,
                    email: userEmail,
                    passwordHash: hashedPassword,
                    apiKeys: { openai: apiKey },
                    registeredAt: new Date().toISOString()
                };
                authController_1.users[userId] = newUser;
                user = newUser;
            }
            else {
                // Update API key if user exists
                user.apiKeys = { ...user.apiKeys, openai: apiKey };
            }
            let gameInstance;
            let actualGameMode;
            let initialRoomData;
            let currentRoomSequence = 1;
            let totalRooms = 1;
            if (gameMode === 'single-room') {
                actualGameMode = 'single-custom';
                const agentIdNum = Date.now();
                gameInstance = new RoomAgent_1.RoomAgent(agentIdNum, 1, 1);
                initialRoomData = await gameInstance.ensureRoomData(apiKey);
                currentRoomSequence = 1;
                totalRooms = 1;
            }
            else {
                actualGameMode = 'multi-custom';
                const gameId = (0, uuid_1.v4)();
                gameInstance = new MultiRoomGame_1.MultiRoomGame(gameId, apiKey, roomCount || 3);
                await gameInstance.waitUntilReady();
                const firstRoomAgent = gameInstance.getCurrentRoom();
                initialRoomData = firstRoomAgent.getRoomData();
                currentRoomSequence = gameInstance.getCurrentRoomNumber();
                totalRooms = gameInstance.getTotalRooms();
            }
            if (!initialRoomData) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Failed to generate game. Could not create valid room data.`
                        }]
                };
            }
            // Store the session
            mcpGameSessions[sessionId] = {
                gameInstance,
                gameMode: actualGameMode,
                gameId: sessionId,
                userId: user.id,
                apiKey,
                userName,
                userEmail,
                currentRoomName: initialRoomData.name,
                currentRoomSequence,
                totalRooms
            };
            return {
                content: [{
                        type: 'text',
                        text: `🎮 Game Successfully Generated!

**Game ID**: ${sessionId}
**Player**: ${userName} (${userEmail})
**Mode**: ${actualGameMode}
**Current Room**: ${initialRoomData.name}
**Total Rooms**: ${totalRooms}

**Game Background**: ${initialRoomData.background || 'A mysterious challenge awaits...'}

**Objects in Room**: ${Array.isArray(initialRoomData.objects)
                            ? initialRoomData.objects.length
                            : Object.keys(initialRoomData.objects).length} objects to discover

Your escape room adventure has begun! Use the other MCP tools to explore the game content and objects.`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error generating game: ${error instanceof Error ? error.message : String(error)}`
                    }]
            };
        }
    });
    // Tool 2: Get game contents including name, background, hint, and list of objects
    server.tool('get_game_contents', 'Get the current game contents including room name, background, hint, and list of objects', {
        gameId: zod_1.z.string().describe('Game session ID returned from generate_game')
    }, async ({ gameId }) => {
        try {
            const session = mcpGameSessions[gameId];
            if (!session) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Game session not found. Please generate a game first using the generate_game tool.`
                        }]
                };
            }
            const { gameInstance } = session;
            let currentRoomData;
            if (gameInstance instanceof MultiRoomGame_1.MultiRoomGame) {
                currentRoomData = gameInstance.getCurrentRoom().getRoomData();
            }
            else {
                currentRoomData = gameInstance.getRoomData();
            }
            if (!currentRoomData) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Could not retrieve room data for game ${gameId}`
                        }]
                };
            }
            // Get object names
            const objects = Array.isArray(currentRoomData.objects)
                ? currentRoomData.objects
                : Object.values(currentRoomData.objects);
            const objectNames = objects.map(obj => obj.name);
            return {
                content: [{
                        type: 'text',
                        text: `🏠 **${currentRoomData.name}** (Room ${session.currentRoomSequence}/${session.totalRooms})

**Background**: ${currentRoomData.background || 'No background available'}

**Hint**: ${currentRoomData.hint || 'No hint available'}

**Room Password**: ${currentRoomData.password || 'Unknown'}

**Objects in Room** (${objectNames.length}):
${objectNames.map(name => `• ${name}`).join('\n')}

**Escape Status**: ${currentRoomData.escaped ? '✅ Escaped!' : '🔒 Still locked'}

**Player**: ${session.userName} (${session.userEmail})
**Game Mode**: ${session.gameMode}`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error retrieving game contents: ${error instanceof Error ? error.message : String(error)}`
                    }]
            };
        }
    });
    // Tool 3: Get all contents of objects inside current game
    server.tool('get_objects_contents', 'Get detailed information about all objects in the current game room', {
        gameId: zod_1.z.string().describe('Game session ID returned from generate_game')
    }, async ({ gameId }) => {
        try {
            const session = mcpGameSessions[gameId];
            if (!session) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Game session not found. Please generate a game first using the generate_game tool.`
                        }]
                };
            }
            const { gameInstance } = session;
            let currentRoomData;
            if (gameInstance instanceof MultiRoomGame_1.MultiRoomGame) {
                currentRoomData = gameInstance.getCurrentRoom().getRoomData();
            }
            else {
                currentRoomData = gameInstance.getRoomData();
            }
            if (!currentRoomData) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Could not retrieve room data for game ${gameId}`
                        }]
                };
            }
            // Get all objects
            const objects = Array.isArray(currentRoomData.objects)
                ? currentRoomData.objects
                : Object.values(currentRoomData.objects);
            if (objects.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `🔍 **Objects in ${currentRoomData.name}**

No objects found in this room.`
                        }]
                };
            }
            const objectsDetails = objects.map((obj, index) => {
                const details = obj.details && Array.isArray(obj.details)
                    ? obj.details.map(detail => `    - ${detail}`).join('\n')
                    : '    - No additional details';
                return `**${index + 1}. ${obj.name}** ${obj.unlocked ? '🔓' : '🔒'}
  **Description**: ${obj.description}
  **Puzzle**: ${obj.puzzle || 'No puzzle'}
  **Answer**: ${obj.unlocked ? (obj.answer || 'No answer') : '🔒 Hidden'}
  **Status**: ${obj.unlocked ? 'Unlocked' : 'Locked'}
  **Details**:
${details}`;
            }).join('\n\n');
            return {
                content: [{
                        type: 'text',
                        text: `🔍 **All Objects in ${currentRoomData.name}** (${objects.length} total)

${objectsDetails}

**Room Password**: ${currentRoomData.password}
**Game Session**: ${gameId}
**Player**: ${session.userName}`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error retrieving objects contents: ${error instanceof Error ? error.message : String(error)}`
                    }]
            };
        }
    });
});
exports.GET = handler;
exports.POST = handler;
exports.DELETE = handler;
//# sourceMappingURL=mcp.js.map