const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import the detailed room objects and command definitions
const { ROOM_OBJECTS } = require('./constant/objects'); // Use require
const { USER_COMMANDS } = require('./constant/commands'); // Use require

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initial game state - plain JavaScript object
let gameState = {
  currentRoom: 1,
  isCustomGame: false,
  customGameData: null
};

// Function to get the current room's data (handles custom vs standard)
function getCurrentRoomData() {
  if (gameState.isCustomGame && gameState.customGameData) {
    // Access the single room within the custom game data
    return gameState.customGameData.rooms[1];
  } else {
    return ROOM_OBJECTS[gameState.currentRoom];
  }
}

// Handle MCP commands via POST to /api/command - Remove TS types
app.post('/api/command', (req, res) => {
  const { command } = req.body;
  let responseText = '';

  if (!command) {
    return res.json({ response: 'No command received.' });
  }

  const currentRoomData = getCurrentRoomData();

  if (!currentRoomData) {
    // This case handles if the room number is somehow invalid
    gameState.currentRoom = 1; // Reset to avoid errors
    gameState.isCustomGame = false;
    gameState.customGameData = null;
    console.error("Error: Invalid room state detected. Resetting game.");
    return res.json({ response: 'Error: Invalid game state. Resetting to Room 1.' });
  }

  // Plain JS variables
  const roomName = currentRoomData.name;
  const roomObjects = currentRoomData.objects;
  const roomPassword = currentRoomData.password;

  // --- Command Handling --- 

  if (command.startsWith('/help')) {
    responseText = 'Available commands:\n' +
      Object.entries(USER_COMMANDS).map(([cmd, details]) =>
        `  ${cmd}: ${details.description} (Usage: ${details.usage})`
      ).join('\n');

  } else if (command.startsWith('/seek')) {
    // No explicit types needed
    const objectNames = Object.values(roomObjects).map(obj => obj.name || 'Unnamed Object');
    if (objectNames.length > 0) {
      responseText = `In the "${roomName}", you see: ${objectNames.join(', ')}. Use /analyse [object_name] to examine further.`;
    } else {
      responseText = `The "${roomName}" seems empty.`;
    }

  } else if (command.startsWith('/analyse')) {
    const parts = command.match(/\/analyse\s+(.+)/i);
    if (!parts || parts.length < 2) {
      responseText = 'Please specify which object to analyse. Usage: /analyse [object_name]';
    } else {
      const objectNameToAnalyse = parts[1].trim().toLowerCase();
      // No explicit types needed
      const foundObjectEntry = Object.entries(roomObjects).find(([key, obj]) =>
        obj.name.toLowerCase() === objectNameToAnalyse || key === objectNameToAnalyse
      );

      if (foundObjectEntry) {
        const [key, objectData] = foundObjectEntry; // Plain JS destructuring
        responseText = `${objectData.name}: ${objectData.description}\nDetails: ${objectData.details.join(' ')}`; 
      } else {
        responseText = `You don't see anything called "${parts[1].trim()}" here.`;
      }
    }

  } else if (command.startsWith('/password')) {
    const parts = command.split(' ');
    if (parts.length < 2) {
      responseText = 'Please provide a password guess. Usage: /password [your_guess]';
    } else {
      const guessedPassword = parts[1];
      if (guessedPassword === roomPassword) {
        responseText = `Correct! You have unlocked "${roomName}".`;
        if (gameState.isCustomGame) {
          responseText += ` Congratulations, you've completed the custom game! Use /newgame to play the standard rooms.`;
          // Reset after custom game completion
          gameState.currentRoom = 1;
          gameState.isCustomGame = false;
          gameState.customGameData = null;
        } else {
          const nextRoom = gameState.currentRoom + 1;
          if (ROOM_OBJECTS[nextRoom]) {
            gameState.currentRoom = nextRoom;
            responseText += ` Moving on to room ${gameState.currentRoom}: ${ROOM_OBJECTS[gameState.currentRoom].name}.`;
          } else {
            responseText += ` Congratulations, you've escaped all standard rooms! Use /newgame to start again.`;
            // Optional: Reset game state here too?
            // gameState.currentRoom = 1;
          }
        }
      } else {
        responseText = 'Incorrect password. Try again.';
      }
    }

  } else if (command.startsWith('/newgame')) {
    gameState.currentRoom = 1;
    gameState.isCustomGame = false;
    gameState.customGameData = null;
    responseText = `New standard game started. You are now in room ${gameState.currentRoom}: ${ROOM_OBJECTS[gameState.currentRoom].name}.`;

  } else if (command.startsWith('/create-game')) {
    const regex = /\/create-game\s+"([^"]+)"\s+"([^"]+)"(?:\s+"([^"]+)")?/;
    const match = command.match(regex);
    if (match) {
      const concept = match[1];
      const objectsList = match[2].split(',').map(item => item.trim());
      const customPassword = match[3] || 'default123';

      // Plain JS object
      const customObjects = {};
      objectsList.forEach(objName => {
        const key = objName.toLowerCase().replace(/\s+/g, '');
        customObjects[key] = {
          name: objName,
          description: `A custom object: ${objName} for the "${concept}" game.`,
          details: [`This is the ${objName}.`, `It seems important for the ${concept}.`]
        };
      });

      // Plain JS object assignment
      const newCustomGame = {
        room: 1, 
        rooms: {
          1: {
            name: concept,
            objects: customObjects,
            password: customPassword
          }
        }
      };
      
      gameState.customGameData = newCustomGame;
      gameState.isCustomGame = true;
      gameState.currentRoom = 1; 

      responseText = `Custom game "${concept}" created and started! Use /seek and /analyse to explore.`;
    } else {
      responseText = 'Invalid format for /create-game. Use: /create-game "Concept Name" "object1,object2,..." "password(optional)"';
    }

  } else {
    responseText = `Command not recognized: "${command}". Type /help for available commands.`;
  }

  res.json({ response: responseText });
});

// Use process.env.PORT or default to 3001
const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`Escape Room Server is running on port ${PORT}`);
});