const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js"); // Use require
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js"); // Use require

// Import the detailed room objects using require
const { ROOM_OBJECTS } = require('../constant/objects.js'); 

// --- Game State Definition (Plain JS Object) ---
let gameState = {
  currentRoom: 1,
  isCustomGame: false,
  customGameData: null
};

// --- Helper Functions ---
function getCurrentRoomData() { // Removed type annotations
  if (gameState.isCustomGame && gameState.customGameData) {
    return gameState.customGameData.rooms[1];
  } else {
    return ROOM_OBJECTS[gameState.currentRoom];
  }
}

// Create a standard response format
function createTextResult(text) { // Removed type annotations
    return {
        content: [{ type: "text", text }]
    };
}

// --- MCP Server Setup ---
const server = new McpServer({
  name: "escape-room-mcp-server",
  version: "1.0.0",
  capabilities: {
    //MCP SERVER CAPABILITIES: Tools and Resources
    resources: {}, 
    tools: {},     
  },
});

// --------------------------------------------------- TOOL LIST ---------------------------------------------------

// Tool: Start New Game
server.tool(
  "start_new_game",
  "Starts a new standard escape room game from the beginning (Room 1).",
  {}, // No schema validation in JS version
  async () => {
    gameState.currentRoom = 1;
    gameState.isCustomGame = false;
    gameState.customGameData = null;
    const roomData = getCurrentRoomData();
    const roomName = roomData?.name || "Unknown Room";
    const responseText = `New standard game started. You are now in room ${gameState.currentRoom}: ${roomName}.`;
    return createTextResult(responseText);
  }
);

// Tool: Seek Objects
server.tool(
  "seek_objects_in_room",
  "Lists the interactable objects currently visible in the room.",
  {}, // No schema validation in JS version
  async () => {
    const currentRoomData = getCurrentRoomData();
    if (!currentRoomData) {
      return createTextResult('Error: Cannot determine current room state.');
    }
    
    const roomName = currentRoomData.name;
    const roomObjects = currentRoomData.objects;
    // Use plain JS map
    const objectNames = Object.values(roomObjects).map(obj => obj.name || 'Unnamed Object');
    
    let responseText; // Plain JS variable
    if (objectNames.length > 0) {
      responseText = `In the "${roomName}", you see: ${objectNames.join(', ')}. Use the 'analyse_object' tool to examine further.`;
    } else {
      responseText = `The "${roomName}" seems empty.`;
    }
    return createTextResult(responseText);
  }
);

// Tool: Analyse Object
server.tool(
  "analyse_object",
  "Examines a specific object in the current room to get its description and details.",
  // No Zod schema in JS version, rely on argument name matching
  {
     // Define expected arguments for documentation/clarity if needed,
     // but validation won't be automatic without Zod.
     // object_name: "The exact name of the object..."
  },
  async ({ object_name }) => { // Destructure argument directly
    if (!object_name) {
        return createTextResult('Error: Please provide the object_name argument.');
    }
    const currentRoomData = getCurrentRoomData();
    if (!currentRoomData) {
      return createTextResult('Error: Cannot determine current room state.');
    }

    const roomObjects = currentRoomData.objects;
    const objectNameToAnalyseLower = object_name.trim().toLowerCase();
    // Find without TS types
    const foundObjectEntry = Object.entries(roomObjects).find(([key, obj]) =>
        obj.name.toLowerCase() === objectNameToAnalyseLower || key.toLowerCase() === objectNameToAnalyseLower
    ); // No type assertion needed

    let responseText; // Plain JS variable
    if (foundObjectEntry) {
      const [_key, objectData] = foundObjectEntry; 
      responseText = `${objectData.name}: ${objectData.description}\nDetails: ${objectData.details.join(' ')}`; 
    } else {
      responseText = `You don't see anything called "${object_name.trim()}" here. Use 'seek_objects_in_room' to see available objects.`;
    }
    return createTextResult(responseText);
  }
);

// Tool: Submit Password
server.tool(
  "submit_password",
  "Submits a password guess to try and unlock the current room.",
  // No Zod schema in JS version
  {
      // password_guess: "The password you want to try..."
  },
  async ({ password_guess }) => { // Destructure argument
    if (!password_guess) {
        return createTextResult('Error: Please provide the password_guess argument.');
    }
    const currentRoomData = getCurrentRoomData();
     if (!currentRoomData) {
      return createTextResult('Error: Cannot determine current room state.');
    }

    const roomName = currentRoomData.name;
    const roomPassword = currentRoomData.password;
    let responseText; // Plain JS variable

    if (password_guess === roomPassword) {
      responseText = `Correct! You have unlocked "${roomName}".`;
      if (gameState.isCustomGame) {
          responseText += ` Congratulations, you've completed the custom game! Use 'start_new_game' to play the standard rooms.`;
          // Reset after custom game completion
          gameState.currentRoom = 1;
          gameState.isCustomGame = false;
          gameState.customGameData = null;
      } else {
          const nextRoom = gameState.currentRoom + 1;
          if (ROOM_OBJECTS[nextRoom]) {
              gameState.currentRoom = nextRoom;
              const nextRoomData = getCurrentRoomData();
              responseText += ` Moving on to room ${gameState.currentRoom}: ${nextRoomData?.name || 'Unknown Room'}.`;
          } else {
              responseText += ` Congratulations, you've escaped all standard rooms! Use 'start_new_game' to play again.`;
          }
      }
    } else {
      responseText = 'Incorrect password. Try again.';
    }
    return createTextResult(responseText);
  }
);


// --- Main Function (Server Runner) ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Escape Room MCP Server (JS) running on stdio..."); 
}

main().catch((error) => {
  console.error("Fatal error running MCP Server:", error);
  process.exit(1);
}); 