# JSON Format Improvements - SYSTEM_PROMPT Alignment

## Overview

This document outlines the comprehensive improvements made to align the AI Escape Room JSON response format with the SYSTEM_PROMPT specification. The changes ensure proper data flow from backend generation to CLI display.

## Key Issues Identified

1. **Data Structure Mismatch**: The original `RoomData` and `RoomObject` interfaces didn't match the SYSTEM_PROMPT format
2. **Missing Required Fields**: `hint`, `escape`, `puzzle`, `answer`, and `lock` fields were missing
3. **Inconsistent Object Structure**: Predefined rooms and generated rooms had different formats
4. **Limited Logging**: Insufficient visibility into JSON generation and parsing

## Changes Made

### 1. Updated RoomData Interface

**Before:**
```typescript
export interface RoomData {
  id?: number;
  sequence?: number | null;
  name: string;
  background: string;
  password: string;
  objects: RoomObject[] | Record<string, RoomObject>;
}
```

**After:**
```typescript
export interface RoomData {
  id?: number;
  sequence?: number | null;
  name: string;
  background: string;
  password: string;
  hint: string; // Password hint - now required to match SYSTEM_PROMPT
  escape: boolean; // Escape status - now required to match SYSTEM_PROMPT
  objects: RoomObject[] | Record<string, RoomObject>;
}
```

### 2. Updated RoomObject Interface

**Before:**
```typescript
export interface RoomObject {
  name: string;
  description: string;
  details: string[];
}
```

**After:**
```typescript
export interface RoomObject {
  name: string;
  description: string; // Description with only puzzle representation, NOT the puzzle answer
  puzzle: string; // Puzzle representation
  answer: string; // Puzzle answer
  lock: boolean; // Lock status
  details?: string[]; // Backward compatibility - optional details field
}
```

### 3. Enhanced JSON Generation Validation

Added comprehensive validation in `RoomAgent.generateSingleRoomData()`:

```typescript
// Validate SYSTEM_PROMPT format
const requiredFields = ['name', 'background', 'password', 'hint', 'objects', 'escape'];
const missingFields = requiredFields.filter(field => !(field in generatedData));

if (missingFields.length > 0) {
  console.error(`Generated JSON missing required fields for room ID ${this.roomId}:`, missingFields);
  console.log('Adding default values for missing fields...');
  
  // Add default values for missing fields
  if (!generatedData.hint) generatedData.hint = "Look for clues in the objects to find the password";
  if (!generatedData.escape) generatedData.escape = false;
  if (!generatedData.objects) generatedData.objects = [];
}

// Validate object structure
if (Array.isArray(generatedData.objects)) {
  const objectRequiredFields = ['name', 'description', 'puzzle', 'answer', 'lock'];
  generatedData.objects.forEach((obj: any, index: number) => {
    const objMissingFields = objectRequiredFields.filter(field => !(field in obj));
    if (objMissingFields.length > 0) {
      console.warn(`Object ${index} in room ${this.roomId} missing fields:`, objMissingFields);
      // Add default values
      if (!obj.puzzle) obj.puzzle = "Hidden puzzle within the description";
      if (!obj.answer) obj.answer = "unknown";
      if (obj.lock === undefined) obj.lock = false;
    }
  });
}
```

### 4. Updated Predefined Rooms

All predefined rooms in `constant/objects.ts` now include the required fields:

```typescript
{
  name: "The Foyer of Fading Secrets",
  sequence: 1,
  background: "You are in the foyer of a mansion...",
  password: "007",
  hint: "Look for references to a famous spy codename in the objects around you.",
  escape: false,
  objects: [
    {
      name: "Manual",
      description: "A faded manual titled 'Morse & Shadows' lies open. The manual contains cryptic Morse code notations: ----- ----- --...",
      puzzle: "Morse code: ----- ----- --...",
      answer: "000",
      lock: false,
      details: [
        "The manual contains cryptic Morse code notations: ----- ----- --...",
        "The binding is worn, suggesting frequent use.",
        "It references Chapter 3: 'Encoding Victory'."
      ]
    }
    // ... more objects
  ]
}
```

### 5. Enhanced Logging

#### Backend API Logging

Added comprehensive logging in `gameRoutes.ts`:

```typescript
console.log(`=== ROOM DATA GENERATED FOR ${actualGameMode.toUpperCase()} GAME ===`);
console.log(`Room ID: ${initialRoomData.id}`);
console.log(`Room Name: ${initialRoomData.name}`);
console.log(`Room Password: ${initialRoomData.password}`);
console.log(`Room Hint: ${initialRoomData.hint || 'NO HINT AVAILABLE'}`);
console.log(`Room Escape Status: ${initialRoomData.escape}`);
console.log(`Objects Count: ${Array.isArray(initialRoomData.objects) ? initialRoomData.objects.length : Object.keys(initialRoomData.objects).length}`);

if (Array.isArray(initialRoomData.objects)) {
  console.log(`=== OBJECTS ARRAY FORMAT ===`);
  initialRoomData.objects.forEach((obj, index) => {
    console.log(`Object ${index + 1}:`);
    console.log(`  Name: ${obj.name}`);
    console.log(`  Description: ${obj.description.substring(0, 100)}...`);
    console.log(`  Puzzle: ${obj.puzzle || 'NO PUZZLE'}`);
    console.log(`  Answer: ${obj.answer || 'NO ANSWER'}`);
    console.log(`  Lock: ${obj.lock}`);
    console.log(`  Details: ${obj.details ? obj.details.length + ' items' : 'NO DETAILS'}`);
  });
}

console.log(`=== FULL ROOM DATA JSON ===`);
console.log(JSON.stringify(initialRoomData, null, 2));
```

#### CLI Logging

Enhanced CLI logging in `Terminal.tsx`:

```typescript
console.log('=== CLI: /newgame RESPONSE RECEIVED ===');
console.log(JSON.stringify(data, null, 2));

if (data.game.roomData) {
  console.log('=== CLI: ROOM DATA RECEIVED ===');
  console.log(`Room Name: ${data.game.roomData.name}`);
  console.log(`Room Password: ${data.game.roomData.password}`);
  console.log(`Room Hint: ${data.game.roomData.hint || 'No hint available'}`);
  console.log(`Room Escape Status: ${data.game.roomData.escape}`);
  console.log(`Objects:`, data.game.roomData.objects);
  
  if (Array.isArray(data.game.roomData.objects)) {
    console.log(`=== CLI: OBJECTS STRUCTURE ===`);
    data.game.roomData.objects.forEach((obj: any, index: number) => {
      console.log(`Object ${index + 1}:`);
      console.log(`  Name: ${obj.name}`);
      console.log(`  Description: ${obj.description}`);
      console.log(`  Puzzle: ${obj.puzzle || 'NO PUZZLE'}`);
      console.log(`  Answer: ${obj.answer || 'NO ANSWER'}`);
      console.log(`  Lock: ${obj.lock}`);
    });
  }
}
```

### 6. Updated API Response Format

The `/newgame` endpoint now includes the complete room data in the response:

```typescript
const gameResponse = {
  success: true,
  message: `New ${actualGameMode} game started. Room ${responseInitialRoomSequence}: ${responseGameName}.`,
  game: {
    id: newGameSession.gameId,
    name: responseGameName,
    background: responseGameBackground,
    currentRoom: responseInitialRoomSequence,
    currentRoomName: newGameSession.currentRoomName,
    objectCount: initialRoomData.objects ? (Array.isArray(initialRoomData.objects) ? initialRoomData.objects.length : Object.keys(initialRoomData.objects).length) : 0,
    mode: actualGameMode, 
    totalRooms: responseTotalRooms,
    startTime: newGameSession.startTime.toISOString(),
    // Add room data for CLI debugging
    roomData: initialRoomData
  }
};
```

### 7. Fixed MultiRoomAgent Compatibility

Updated `MultiRoomAgent.ts` to use the new interface structure:
- Fixed import statements
- Added required fields to all fallback room objects
- Updated object definitions to include `puzzle`, `answer`, and `lock` fields

## Expected SYSTEM_PROMPT JSON Format

The system now generates and validates JSON in this exact format:

```json
{
  "name": "Escape Room Name",
  "background": "Theme description",
  "password": "Password",
  "hint": "Password hint",
  "objects": [
    {
      "name": "Object Name",
      "description": "Object description with only puzzle representation, NOT the puzzle answer",
      "puzzle": "Puzzle representation",
      "answer": "Puzzle answer",
      "lock": false
    }
  ],
  "escape": false
}
```

## Benefits

1. **Consistent Data Structure**: All room data now follows the same format
2. **Complete Validation**: Missing fields are automatically added with defaults
3. **Enhanced Debugging**: Comprehensive logging at every step
4. **Better Error Handling**: Fallback rooms include all required fields
5. **CLI Compatibility**: Frontend can properly parse and display all room data
6. **SYSTEM_PROMPT Compliance**: Generated rooms match the expected format exactly

## Testing

To test the improvements:

1. Start the backend: `npm run dev`
2. Start the CLI: `npm start`
3. Create a new game: `/newgame`
4. Check console logs for detailed JSON structure information
5. Use `/look` and `/inspect` commands to verify data flow

The logs will show the complete JSON structure at each step, making it easy to debug any parsing issues. 