﻿# AI Escape Room Game

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setup](#setup)
   - [Backend](#backend)
   - [CLI](#cli)
5. [Usage](#usage)
6. [Commands Reference](#commands-reference)
7. [API Reference](#api-reference)
8. [Extending & Customization](#extending--customization)
9. [License](#license)

---
## Overview
This project is a terminal-based escape room game powered by AI. Each room is dynamically generated by an LLM (GPT-4) via the OpenAI API and wrapped in a `RoomAgent` that provides:
- A unique room title and background story
- A set of artifacts (objects) with names, descriptions, and clues
- A secret password to unlock the room and progress

Players interact through a CLI (built with Ink/React) that communicates with an Express backend. The backend hosts multiple `RoomAgent` instances, each handling game logic for its room.

---
## Architecture
- **Backend** (`./backend`)
  - TypeScript + Express server
  - `RoomAgent` (in `backend/agents`): Calls GPT-4 to generate room JSON on startup
  - Endpoints:
    - `GET  /api/health` — Health check
    - `GET  /api/rooms` — List room IDs and names
    - `POST /api/rooms/:id/command` — Send a text command to a specific room
  - Uses `openai` SDK and `ROOM_OBJECTS` fallback

- **CLI** (`./escape-room-cli`)
  - Ink + React for a terminal UI
  - Mode selector: Standard or MCP client
  - **Standard Mode**: Natural commands (`look`, `inspect`, `hint`, `guess`, `restart`)
  - **MCP Mode**: Authenticate via `/mcp-auth` and call advanced tools (`start_new_game`, `seek_objects`, etc.)

---
## Prerequisites
- Node.js >= 16.x
- npm (or yarn)
- OpenAI API key with GPT-4 access (`OPENAI_API_KEY`)

---
## Setup

### Backend
```bash
cd backend
npm install
# Set your OpenAI API key:
export OPENAI_API_KEY="your_api_key_here"
npm run build     # Compile TypeScript
npm start         # Launch API and MCP servers
```

### CLI
```bash
cd escape-room-cli
npm install
npm start         # Launch the terminal UI
```
Optionally link globally:
```bash
cd escape-room-cli
npm link
escape-room-cli --name="Agent007"
```

---
## Usage
1. Ensure the backend is running (see Setup).
2. Run the CLI and enter your name.
3. Select **Standard Mode** to play or **MCP Client Mode** for tool-based interactions.
4. In Standard Mode:
   - `help` — Show all commands
   - `look` — List objects in the current room
   - `inspect [object]` — Examine an object
   - `hint` — Get a contextual hint
   - `guess [password]` — Try to unlock the room
   - `restart` — Restart at room 1
5. Correct `guess` advances you to the next room.

---
## Commands Reference
### Standard Mode
- `help`
- `look`
- `inspect [object]`
- `hint`
- `guess [password]`
- `restart`

### MCP Client Mode
- `/mcp-auth [api-key]`
- `/help`
- `/disconnect`
- `/start_new_game`, `/seek_objects`, `/analyse_object`, `/submit_password`

---
## API Reference
### Health Check
```http
GET /api/health
Response: { status: 'healthy' }
```

### List Rooms
```http
GET /api/rooms
Response: { rooms: [{ id: 1, name: 'Room Title' }, ...] }
```

### Room Command
```http
POST /api/rooms/:id/command
Body: { input: 'look' }
Response: { response: string; unlocked?: boolean }
```

---
## Extending & Customization
- **RoomAgent Prompt**: Edit `backend/agents/RoomAgent.ts` to tweak GPT-4 prompts
- **Command Logic**: Adjust or add commands in `RoomAgent.process` and the CLI handler
- **UI/Styling**: Modify Ink components in `escape-room-cli/source/components`

---