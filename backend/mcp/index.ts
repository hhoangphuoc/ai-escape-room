// backend/mcp/index.ts
import { McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ROOM_OBJECTS, type Room, type GameObject } from "../constant/objects.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface CustomGameData { room: number; rooms: Record<number, Room>; }
interface GameState       { currentRoom: number; isCustomGame: boolean; customGameData: CustomGameData | null; }

let gameState: GameState = { currentRoom: 1, isCustomGame: false, customGameData: null };

function getCurrentRoomData(): Room {
  if (gameState.isCustomGame && gameState.customGameData) {
    return gameState.customGameData.rooms[1];
  }
  return ROOM_OBJECTS[gameState.currentRoom];
}

function createTextResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

const server = new McpServer({
  name:         "escape-room-server",
  version:      "1.0.0",
  capabilities: { resources: {}, tools: {} }
});

//
// 1) /start_new_game
//
server.tool(
  "start_new_game",
  "Restart and go to Room 1.",
  {},
  async () => {
    gameState = { currentRoom: 1, isCustomGame: false, customGameData: null };
    const room = getCurrentRoomData();
    return createTextResult(`New game started. You're in room 1: ${room.name}.`);
  }
);

//
// 2) /seek_objects_in_room
//
server.tool(
  "seek_objects_in_room",
  "List all objects in the current room.",
  {},
  async () => {
    const room = getCurrentRoomData();
    const names = Object.values(room.objects).map((o: GameObject) => o.name);
    const text = names.length
      ? `Room '${room.name}' contains: ${names.join(", ")}.`
      : `The room '${room.name}' is empty.`;
    return createTextResult(text);
  }
);

//
// 3) /analyse_object
//
server.tool(
  "analyse_object",
  "Inspect an object for clues.",
  { object_name: z.string() },
  async ({ object_name }) => {
    const room = getCurrentRoomData();
    const key = Object.keys(room.objects).find(
      k => k.toLowerCase() === object_name.toLowerCase()
         || room.objects[k].name.toLowerCase() === object_name.toLowerCase()
    );
    if (!key) {
      return createTextResult(`No object '${object_name}' here. Use /seek_objects_in_room.`);
    }
    const obj = room.objects[key];
    return createTextResult(`${obj.name}: ${obj.description}\nDetails: ${obj.details.join(" ")}`);
  }
);

//
// 4) /submit_password
//
server.tool(
  "submit_password",
  "Try a password to unlock the room.",
  { password_guess: z.string() },
  async ({ password_guess }) => {
    const room = getCurrentRoomData();
    if (password_guess === room.password) {
      let resp = `Correct! Unlocked '${room.name}'.`;
      const next = gameState.currentRoom + 1;
      if (ROOM_OBJECTS[next]) {
        gameState.currentRoom = next;
        const nr = getCurrentRoomData();
        resp += ` Moving to room ${next}: ${nr.name}.`;
      } else {
        resp += ` You’ve escaped all rooms!`;
      }
      return createTextResult(resp);
    }
    return createTextResult(`Wrong password. Try again.`);
  }
);

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
