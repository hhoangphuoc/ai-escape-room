// backend/api/server.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ROOM_OBJECTS, type Room, type GameObject } from '../constant/objects'; // Adjust path as necessary
import { RoomAgent, type RoomCommandResponse } from '../agents/RoomAgent';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

//-------------------------------- USER DATA --------------------------------
interface User {
  id: string;
  name: string;
  email?: string;
  apiKeys?: {
    anthropic?: string;
    openai?: string;
  };
  registeredAt: string;
}

// In-memory user store (replace with DB in production)
const users: Record<string, User> = {};

//-------------------------------- CUSTOM GAME DATA --------------------------------
interface CustomGameData {
    room: number;
    rooms: Record<number, Room>;
}

interface GameState {
    currentRoom: number;
    isCustomGame: boolean;
    customGameData: CustomGameData | null;
}

// --- Game State (In-Memory) ---
let gameState: GameState = {
    currentRoom: 1,
    isCustomGame: false,
    customGameData: null,
};


function getCurrentRoomData(): Room {
    if (gameState.isCustomGame && gameState.customGameData) {
        // Logic for custom games (if implemented later)
        return gameState.customGameData.rooms[gameState.currentRoom] || ROOM_OBJECTS[1]; // Fallback
    }
    // Ensure currentRoom is valid before accessing ROOM_OBJECTS
    const validRoomId = gameState.currentRoom in ROOM_OBJECTS ? gameState.currentRoom : 1;
     if (!(gameState.currentRoom in ROOM_OBJECTS)) {
        console.warn(`Invalid currentRoom ID: ${gameState.currentRoom}. Defaulting to room 1.`);
        gameState.currentRoom = 1; // Reset to default if invalid
    }
    return ROOM_OBJECTS[validRoomId];
}
//---------------------------------------------------------------------------------------------

// --- Initialize Room Agents ---
const agents: Record<number, RoomAgent> = {};
Object.keys(ROOM_OBJECTS).forEach(key => {
  const id = parseInt(key, 10);
  agents[id] = new RoomAgent(id);
});
//--------------------------------

// --- Express App Setup ---
const app: Application = express();
const port = process.env.API_PORT || 3001; // Use environment variable or default

app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(bodyParser.json()); // Parse JSON request bodies

// --- API Endpoints ---
// GET /rooms - list available rooms
app.get('/api/rooms', (req: Request, res: Response) => {
  const rooms = Object.entries(ROOM_OBJECTS).map(([id, room]) => ({ id: parseInt(id, 10), name: room.name }));
  res.json({ rooms });
});

// POST /rooms/:id/command - send a command to a room agent
app.post('/api/rooms/:id/command', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const agent = agents[id];
  if (!agent) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const { input } = req.body;
  if (typeof input !== 'string') {
    res.status(400).json({ error: 'Input must be a string' });
    return;
  }
  try {
    const result: RoomCommandResponse = await agent.process(input);
    res.json(result);
  } catch (err: any) {
    console.error('RoomAgent error:', err);
    res.status(500).json({ response: 'Internal error processing command.' });
  }
});

// GET /api/health - Health check endpoint for CLI connection
app.get('/api/health', (req: Request, res: Response) => {
    console.log("API: Received health check request");
    res.status(200).json({ status: 'healthy', message: 'Backend server is running' });
});

// POST /api/command - Process commands from CLI
app.post('/api/command', (req, res) => {
    console.log("API: Received /api/command request");
    const { command } = req.body;
    console.log(`API: Received command: ${command}`);
    
    if (!command) {
        res.status(400).json({ response: 'No command provided' });
        return;
    }
    
    // Process command
    const normalizedCommand = command.trim().toLowerCase();
    let response = '';
    
    if (normalizedCommand === '/help') {
        response = 'Available commands:\n' +
                  '/help - Shows this help message\n' +
                  '/seek - Lists all interactable objects in the current room\n' +
                  '/analyse [object_name] - Examine an object more closely for details or hints\n' +
                  '/password [your_guess] - Submit a password guess for the current room\n' +
                  '/newgame - Starts a new game, resetting progress to the first room';
    } 
    else if (normalizedCommand === '/seek') {
        try {
            const room = getCurrentRoomData();
            const objectNames = Object.values(room.objects).map((o: GameObject) => o.name);
            response = `You are in ${room.name}. Looking around, you see:\n` +
                      objectNames.map(name => `- ${name}`).join('\n');
        } catch (error) {
            response = 'Error: Could not retrieve room objects.';
        }
    }
    else if (normalizedCommand.startsWith('/analyse ')) {
        const objectName = normalizedCommand.substring('/analyse '.length).trim();
        try {
            const room = getCurrentRoomData();
            const key = Object.keys(room.objects).find(
                k => k.toLowerCase() === objectName.toLowerCase() ||
                    room.objects[k].name.toLowerCase() === objectName.toLowerCase()
            );
            
            if (!key) {
                response = `Object '${objectName}' not found in room.`;
            } else {
                const obj = room.objects[key];
                response = `${obj.name}: ${obj.description}\n\n${obj.details}`;
            }
        } catch (error) {
            response = 'Error: Could not analyse object.';
        }
    }
    else if (normalizedCommand.startsWith('/password ')) {
        const passwordGuess = normalizedCommand.substring('/password '.length).trim();
        try {
            const room = getCurrentRoomData();
            if (passwordGuess === room.password) {
                let message = `Correct! Unlocked '${room.name}'.`;
                const nextRoomId = gameState.currentRoom + 1;
                if (ROOM_OBJECTS[nextRoomId]) {
                    gameState.currentRoom = nextRoomId;
                    const nextRoom = getCurrentRoomData();
                    message += `\n\nMoving to room ${nextRoomId}: ${nextRoom.name}.`;
                } else {
                    message += `\n\nCongratulations! You've escaped all rooms!`;
                }
                response = message;
            } else {
                response = `Wrong password. Try again.`;
            }
        } catch (error) {
            response = 'Error: Could not process password.';
        }
    }
    else if (normalizedCommand === '/newgame') {
        gameState = { currentRoom: 1, isCustomGame: false, customGameData: null };
        try {
            const room = getCurrentRoomData();
            response = `New game started. You're in room 1: ${room.name}.`;
        } catch (error) {
            response = 'Error: Failed to start new game.';
        }
    }
    else {
        response = `Unknown command: ${command}. Type /help to see available commands.`;
    }
    
    res.json({ response });
});

// POST /game/start - Start a new game
app.post('/game/start', (req: Request, res: Response) => {
    console.log("API: Received /game/start request");
    gameState = { currentRoom: 1, isCustomGame: false, customGameData: null };
    try {
        const room = getCurrentRoomData();
        res.json({ message: `New game started. You're in room 1: ${room.name}.`, currentRoom: gameState.currentRoom, roomName: room.name });
    } catch (error) {
        console.error("API Error in /game/start:", error);
        res.status(500).json({ error: "Failed to start game. Could not load room data." });
    }
});

// POST /api/newgame - Create a new escape room using RoomAgent
app.post('/api/newgame', async (req: Request, res: Response) => {
    console.log("API: Received /api/newgame request");
    try {
        // Create a new RoomAgent instance
        const newRoomAgent = new RoomAgent(99); // Use a unique ID
        
        // Wait for the room to be generated
        const result = await newRoomAgent.process('/newgame');
        
        // Update gameState to use custom game
        gameState = {
            currentRoom: 99,
            isCustomGame: true,
            customGameData: {
                room: 99,
                rooms: {
                    99: (newRoomAgent as any).roomData // Access the generated room data
                }
            }
        };

        // Get the room data to return to the client
        const roomData = (newRoomAgent as any).roomData;
        
        // Add the agent to the agents collection
        agents[99] = newRoomAgent;
        
        res.json({
            success: true, 
            message: result.response,
            game: {
                name: roomData.name,
                background: roomData.description || roomData.background,
                currentRoom: 99,
                objectCount: roomData.objects.length
            }
        });
    } catch (error) {
        console.error("API Error in /api/newgame:", error);
        res.status(500).json({ 
            success: false,
            error: "Failed to create new game. Error generating room data."
        });
    }
});

// GET /game/state - Get current game state
app.get('/game/state', (req: Request, res: Response) => {
    console.log("API: Received /game/state request");
     try {
        const room = getCurrentRoomData();
        res.json({ currentRoom: gameState.currentRoom, roomName: room.name });
    } catch (error) {
        console.error("API Error in /game/state:", error);
        res.status(500).json({ error: "Failed to get game state. Could not load room data." });
    }
});

// GET /room/objects - List objects in the current room
app.get('/room/objects', (req: Request, res: Response) => {
    console.log("API: Received /room/objects request");
     try {
        const room = getCurrentRoomData();
        const objectNames = Object.values(room.objects).map((o: GameObject) => o.name);
        res.json({ roomName: room.name, objects: objectNames });
     } catch (error) {
        console.error("API Error in /room/objects:", error);
        res.status(500).json({ error: "Failed to get room objects. Could not load room data." });
    }
});

// GET /object/:object_name - Get details of a specific object
app.get('/object/:object_name', (req, res) => {
    const objectNameParam = req.params.object_name;
    console.log(`API: Received /object/${objectNameParam} request`);
     try {
        const room = getCurrentRoomData();
        const key = Object.keys(room.objects).find(
            k => k.toLowerCase() === objectNameParam.toLowerCase()
                || room.objects[k].name.toLowerCase() === objectNameParam.toLowerCase()
        );

        if (!key) {
            res.status(404).json({ error: `Object '${objectNameParam}' not found in room '${room.name}'.` });
            return;
        }
        const obj = room.objects[key];
        res.json({
            name: obj.name,
            description: obj.description,
            details: obj.details
        });
     } catch (error) {
        console.error(`API Error in /object/${objectNameParam}:`, error);
        res.status(500).json({ error: `Failed to get object details. Could not load room data.` });
    }
});

// POST /room/unlock - Attempt to unlock the room
app.post('/room/unlock', (req, res) => {
    const { password_guess } = req.body;
     console.log(`API: Received /room/unlock request with password: [REDACTED]`); // Avoid logging password directly

    if (typeof password_guess !== 'string') {
        res.status(400).json({ error: 'Password guess must be a string.' });
        return;
    }

     try {
        const room = getCurrentRoomData();
        if (password_guess === room.password) {
            let message = `Correct! Unlocked '${room.name}'.`;
            const nextRoomId = gameState.currentRoom + 1;
            if (ROOM_OBJECTS[nextRoomId]) {
                gameState.currentRoom = nextRoomId;
                const nextRoom = getCurrentRoomData(); // Get data for the new current room
                message += ` Moving to room ${nextRoomId}: ${nextRoom.name}.`;
                res.json({ unlocked: true, finished: false, message: message, nextRoom: { id: gameState.currentRoom, name: nextRoom.name } });
            } else {
                message += ` You've escaped all rooms!`;
                // Optional: Reset game state after winning?
                // gameState = { currentRoom: 1, isCustomGame: false, customGameData: null };
                res.json({ unlocked: true, finished: true, message: message });
            }
        } else {
            res.json({ unlocked: false, finished: false, message: `Wrong password. Try again.` });
        }
     } catch (error) {
        console.error("API Error in /room/unlock:", error);
        res.status(500).json({ error: "Failed to process unlock attempt. Could not load room data." });
    }
});

// --- User Management Endpoints ---

// Register user endpoint
app.post('/api/users/register', ((req: Request, res: Response) => {
  const { name, email, apiKey, provider = 'openai' } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const userId = Date.now().toString();
  
  users[userId] = {
    id: userId,
    name,
    email,
    apiKeys: apiKey ? { [provider]: apiKey } : undefined,
    registeredAt: new Date().toISOString()
  };
  
  console.log(`API: User registered: ${name} (${userId})`);
  
  res.json({ 
    userId,
    user: { name, email }
  });
}) as any);

// Authenticate user endpoint
app.post('/api/users/auth', ((req: Request, res: Response) => {
  const { userId } = req.body;
  
  if (!userId || !users[userId]) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // Return user data (excluding API keys)
  const { apiKeys, ...userData } = users[userId];
  
  console.log(`API: User authenticated: ${userData.name} (${userId})`);
  
  res.json({ 
    authenticated: true,
    user: userData
  });
}) as any);

// Get API key - secure endpoint that returns the API key for a given user and provider
app.post('/api/users/get-api-key', ((req: Request, res: Response) => {
  const { userId, provider = 'openai' } = req.body;
  
  if (!userId || !users[userId]) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  const user = users[userId];
  const apiKey = user.apiKeys?.[provider];
  
  if (!apiKey) {
    return res.status(404).json({ error: `No API key found for provider: ${provider}` });
  }
  
  console.log(`API: API key retrieved for user: ${user.name} (${userId}), provider: ${provider}`);
  
  res.json({ 
    apiKey,
    provider
  });
}) as any);

// --- Chat Endpoint ---
app.post('/api/chat', (async (req: Request, res: Response) => {
  const { message, currentRoom, model } = req.body;
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'API key is required' });
  }
  
  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    // Get current room context
    const room = getCurrentRoomData();
    const roomContext = `You are in ${room.name}. ${room.background || ''}`;
    const objectsContext = Object.values(room.objects)
      .map((o: GameObject) => `${o.name}: ${o.description}`)
      .join('\n');
    
    // Determine if it's an OpenAI or Anthropic model
    console.log(`API: Processing chat message with model: ${model}`);
    
    let response;
    const model_specs = {
      'gpt-4o': {
        max_completion_tokens: 4098,
      },
      'gpt-4o-mini': {
        max_completion_tokens: 1024,
      },
      'gpt-4.1':{
        max_completion_tokens: 4098,
      },
      'o3': {
        reasoning_effort: "medium",
      },
      'o3-mini': {
        reasoning_effort: "medium",
      },
      'o4-mini':{
        reasoning_effort: "medium",
      },
      'claude-3-7-sonnet': {
        max_completion_tokens: 4098,
      }
    }
    if (model.startsWith('gpt') || model.startsWith('o')) {
      // OpenAI models
      const openai = new OpenAI({ apiKey });
      response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You are an AI assistant in an escape room game. Help the player solve puzzles without giving away solutions directly.
                    Current room information:
                    ${roomContext}
                    Objects in room:
                    ${objectsContext}
                    `
          },
          { role: "user", content: message }
        ],
        ...model_specs[model] // Add model-specific parameters
      });
      res.json({ response: response.choices[0].message.content });

      //TODO: TRY WITH `openai.responses.create` ----------------------------------------------------------------
      // response = await openai.responses.create({
      //   model: model,
      //   input: [
      //       { role: "system", content: `You are an AI assistant in an escape room game. Help the player solve puzzles without giving away solutions directly.
      //       Current room information:
      //       ${roomContext}
      //       Objects in room:
      //       ${objectsContext}` },
      //       { role: "user", content: message }
      //   ],
      //   reasoning: {
      //     effort: model_specs[model].reasoning_effort,
      //     summary: "auto",
      //   },
      //   tools: [],
      //   store: false
      // })
      //---------------------------------------------------------------------------------------------------------
    } else {
      // Anthropic models (Claude)
      const Anthropic = require('@anthropic-ai/sdk').default;
      const anthropic = new Anthropic({ apiKey });
      response = await anthropic.messages.create({
        model,
        max_tokens: 500,
        system: `You are an AI assistant in an escape room game. Help the player solve puzzles without giving away solutions directly.
                  Current room information:
                  ${roomContext}
                  Objects in room:
                  ${objectsContext}
                `,
        messages: [{ role: "user", content: message }]
      });
      
      res.json({ response: response.content[0].text });
    }
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ 
      error: 'Error processing chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

// --- Error Handling Middleware (Basic) ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled API Error:", err.stack);
    res.status(500).json({ error: 'An internal server error occurred.' });
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
});