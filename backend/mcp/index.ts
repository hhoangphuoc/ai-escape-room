// backend/mcp/index.ts

// import { McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ROOM_OBJECTS, type Room, type GameObject } from "../constant/objects.js";

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  CallToolRequest,
  ListToolsRequest
} from "@modelcontextprotocol/sdk/types.js";

//--------------------------------
//  TOOLS DEFINITIONS
//--------------------------------

const EXPLORE_ROOM_TOOL: Tool = {
  name: "explore_room",
  description: "Explore the current room for clues.",
  inputSchema: {
    type: "object",
    properties: {
      room_name: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      room_name: { type: "string" }
    }
  }
};

const SUBMIT_PASSWORD_TOOL: Tool = {
  name: "submit_password",
  description: "Submit a password to unlock the current room.",
  inputSchema: {
    type: "object",
    properties: {
      password_guess: { type: "string" }
    }
  },
  outputSchema: {
    type: "object", 
    properties: {
      room_name: { type: "string" }
    }
  }
};

const SEEK_OBJECTS_TOOL: Tool = {
  name: "seek_objects_in_room",
  description: "Seek objects in the current room.",
  inputSchema: {
    type: "object",
    properties: {
      room_name: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      room_name: { type: "string" }
    }
  }
};

const ANALYSE_OBJECT_TOOL: Tool = {
  name: "analyse_object",
  description: "Analyse an object for clues.",
  inputSchema: {
    type: "object",
    properties: {
      object_name: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      object_name: { type: "string" }
    }
  }
};


//---------------------------------------------------------------------------------------------------
//                                    MCP Server Setup
//---------------------------------------------------------------------------------------------------

function createTextResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

const server = new Server({
  name:         "escape-room-server",
  version:      "1.0.0",
  capabilities: { 
    resources: {}, 
    tools: {
      explore_room: EXPLORE_ROOM_TOOL,
      submit_password: SUBMIT_PASSWORD_TOOL,
      seek_objects_in_room: SEEK_OBJECTS_TOOL,
      analyse_object: ANALYSE_OBJECT_TOOL,
    }
  }
});


//---------------------------------------------------------------------------------------------------
//  INTERFACE FOR DATA AND STATE
//---------------------------------------------------------------------------------------------------

interface CustomGameData { room: number; rooms: Record<number, Room>; }
interface GameState       { currentRoom: number; isCustomGame: boolean; customGameData: CustomGameData | null; }

let gameState: GameState = { currentRoom: 1, isCustomGame: false, customGameData: null };

function getCurrentRoomData(): Room {
  if (gameState.isCustomGame && gameState.customGameData) {
    return gameState.customGameData.rooms[1];
  }
  return ROOM_OBJECTS[gameState.currentRoom];
}

//---------------------------------------------------------------------------------------------------
//  TOOLS HANDLERS
//---------------------------------------------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    EXPLORE_ROOM_TOOL,
    SUBMIT_PASSWORD_TOOL,
    SEEK_OBJECTS_TOOL,
    ANALYSE_OBJECT_TOOL
  ]
}));

// server.setRequestHandler(CallToolRequestSchema, async (req: CallToolRequest) => {
//   return { result: createTextResult("Tool called") };
// });


// server.tool(
//   "start_new_game",
//   "Restart and go to Room 1.",
//   {},
//   async () => {
//     gameState = { currentRoom: 1, isCustomGame: false, customGameData: null };
//     const room = getCurrentRoomData();
//     return createTextResult(`New game started. You're in room 1: ${room.name}.`);
//   }
// );

// //
// // 2) /seek_objects_in_room
// //
// server.tool(
//   "seek_objects_in_room",
//   "List all objects in the current room.",
//   {},
//   async () => {
//     const room = getCurrentRoomData();
//     const names = Object.values(room.objects).map((o: GameObject) => o.name);
//     const text = names.length
//       ? `Room '${room.name}' contains: ${names.join(", ")}.`
//       : `The room '${room.name}' is empty.`;
//     return createTextResult(text);
//   }
// );

// //
// // 3) /analyse_object
// //
// server.tool(
//   "analyse_object",
//   "Inspect an object for clues.",
//   { object_name: z.string() },
//   async ({ object_name }) => {
//     const room = getCurrentRoomData();
//     const key = Object.keys(room.objects).find(
//       k => k.toLowerCase() === object_name.toLowerCase()
//          || room.objects[k].name.toLowerCase() === object_name.toLowerCase()
//     );
//     if (!key) {
//       return createTextResult(`No object '${object_name}' here. Use /seek_objects_in_room.`);
//     }
//     const obj = room.objects[key];
//     return createTextResult(`${obj.name}: ${obj.description}\nDetails: ${obj.details.join(" ")}`);
//   }
// );

// //
// // 4) /submit_password
// //
// server.tool(
//   "submit_password",
//   "Try a password to unlock the room.",
//   { password_guess: z.string() },
//   async ({ password_guess }) => {
//     const room = getCurrentRoomData();
//     if (password_guess === room.password) {
//       let resp = `Correct! Unlocked '${room.name}'.`;
//       const next = gameState.currentRoom + 1;
//       if (ROOM_OBJECTS[next]) {
//         gameState.currentRoom = next;
//         const nr = getCurrentRoomData();
//         resp += ` Moving to room ${next}: ${nr.name}.`;
//       } else {
//         resp += ` You've escaped all rooms!`;
//       }
//       return createTextResult(resp);
//     }
//     return createTextResult(`Wrong password. Try again.`);
//   }
// );

//
// Run the server
//
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Escape Room MCP Server running via stdio…");
}

main().catch(err => {
  console.error("Fatal MCP error:", err);
  process.exit(1);
});
