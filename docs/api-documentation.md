# AI Escape Room API Documentation

## Base URL
- Local: `http://localhost:3001/api`
- Production: Configure in `backend/constant/apiConfig.ts`

## Authentication
All game endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

## Authentication Endpoints

### POST /api/users/register
Register a new user.
```json
Request:
{
  "name": "string",
  "email": "string (optional)",
  "apiKey": "string (optional)",
  "provider": "openai | anthropic (default: openai)"
}

Response:
{
  "message": "User registered successfully",
  "userId": "uuid",
  "name": "string",
  "email": "string",
  "token": "jwt-token"
}
```

### POST /api/users/login
Login an existing user.
```json
Request:
{
  "userId": "uuid"
}

Response:
{
  "message": "Login successful",
  "userId": "uuid",
  "name": "string",
  "email": "string",
  "token": "jwt-token"
}
```

### GET /api/users/me
Get current user profile (requires authentication).
```json
Response:
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "registeredAt": "ISO date string"
}
```

## Game Endpoints

### POST /api/game/newgame
Create a new escape room game.
```json
Request:
{
  "mode": "single-room | multi-room (default: single-room)",
  "roomCount": "number (for multi-room, optional)",
  "gameTheme": "string (optional)"
}

Response:
{
  "success": true,
  "message": "New game started...",
  "game": {
    "id": "string",
    "name": "string",
    "background": "string",
    "currentRoom": 1,
    "currentRoomName": "string",
    "objectCount": 3,
    "mode": "single-custom | multi-custom",
    "totalRooms": 1,
    "startTime": "ISO date string"
  }
}
```

### GET /api/game/look
Look around the current room.
```json
Response:
{
  "roomName": "string",
  "objects": ["object1", "object2", "object3"],
  "message": "Full description of the room..."
}
```

### GET /api/game/inspect?object=objectName
Inspect a specific object in the room.
```json
Response:
{
  "object": {
    "name": "string",
    "description": "string",
    "details": ["detail1", "detail2"]
  },
  "message": "Object description..."
}
```

### POST /api/game/guess?object=objectName&answer=puzzleAnswer
Guess the puzzle answer for a specific object.
```json
Response:
{
  "correct": false,
  "message": "Wrong answer. Try again.",
  "unlockedObjects": []
}
```
Note: Individual object puzzle solving is not fully implemented in the current RoomAgent.

### POST /api/game/password?password=your_password
Submit the final password to escape the room.
```json
Response:
{
  "escaped": true,
  "correct": true,
  "message": "Congratulations! You escaped!",
  "gameCompleted": true,
  "timeElapsed": 300,
  "hintsUsed": 2
}
```

### GET /api/game/hint
Get a hint for the current room.
```json
Response:
{
  "hint": "Hint content...",
  "hintsUsed": 3
}
```

### POST /api/game/restart
Restart the current game.
```json
Response:
{
  "message": "Game restarted. Use /newgame to start a new game.",
  "success": true
}
```

### GET /api/game/state
Get the current game state.
```json
Response:
{
  "gameId": "string",
  "currentRoom": 1,
  "currentRoomName": "string",
  "totalRooms": 1,
  "gameMode": "single-custom"
}
```

### POST /api/game/command
Send a raw command to the game engine (fallback endpoint).
```json
Request:
{
  "command": "/look"
}

Response:
{
  "response": "Command result...",
  "data": { ... }
}
```

## Leaderboard Endpoints

### GET /api/game/leaderboard?mode=all&limit=10
Get the global leaderboard.
```json
Response:
{
  "leaderboard": [
    {
      "userId": "uuid",
      "userName": "string",
      "gameId": "string",
      "gameMode": "single-custom",
      "timeElapsed": 300,
      "hintsUsed": 2,
      "submittedAt": "ISO date string",
      "rank": 1
    }
  ],
  "count": 10,
  "mode": "all"
}
```

### GET /api/game/leaderboard/me?limit=5
Get current user's best scores.
```json
Response:
{
  "scores": [
    {
      "userId": "uuid",
      "userName": "string",
      "gameId": "string",
      "gameMode": "single-custom",
      "timeElapsed": 300,
      "hintsUsed": 2,
      "submittedAt": "ISO date string"
    }
  ],
  "count": 5,
  "userId": "uuid"
}
```

### POST /api/game/leaderboard/submit
Submit a score to the leaderboard.
```json
Request:
{
  "gameId": "string",
  "timeElapsed": 300,
  "hintsUsed": 2,
  "gameMode": "single-custom"
}

Response:
{
  "success": true,
  "message": "Score submitted successfully to leaderboard"
}
```

## Chat Endpoint

### POST /api/game/chat
Chat with AI using the user's API key.
```json
Request:
{
  "message": "Help me solve this puzzle",
  "model": "gpt-4o-mini | gpt-4o | o3 | o3-mini"
}

Response:
{
  "response": "AI response text..."
}
```

## Error Responses

All endpoints may return error responses in the following format:
```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 500: Internal Server Error 