// backend/api/server.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ROOM_OBJECTS, type Room, type GameObject } from '../constant/objects'; // Adjust path as necessary

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

// --- Express App Setup ---
const app: Application = express();
const port = process.env.API_PORT || 3001; // Use environment variable or default

app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(bodyParser.json()); // Parse JSON request bodies

// --- API Endpoints ---

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

// --- Error Handling Middleware (Basic) ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled API Error:", err.stack);
    res.status(500).json({ error: 'An internal server error occurred.' });
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
}); 