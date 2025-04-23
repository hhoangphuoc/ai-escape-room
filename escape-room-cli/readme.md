# Escape Room CLI

A command-line interface for the AI Escape Room game, built with Ink and React.

## Features

- Interactive terminal-based interface
- Command history with scrollable display
- Visual title screen
- Support for all game commands
- Real-time connection status to backend

## Installation

```bash
# Install dependencies
npm install

# Build the CLI
npm run build

# Run the CLI
npm run start
```

## Available Commands

- `/help` - Shows available commands and their usage
- `/seek` - Lists all interactable objects in the current room
- `/analyse [object_name]` - Examine an object more closely for details or hints
- `/password [your_guess]` - Submit a password guess for the current room
- `/newgame` - Starts a new game, resetting progress to the first room
- `/create-game "Concept Name" "object1,object2,..." "password(optional)"` - Creates a simple custom game

## Backend Requirements

The CLI connects to a backend server running at http://localhost:3001. To start the backend:

```bash
cd ../backend
npm run build
npm run start
```

## Development

```bash
# Run in watch mode for development
npm run dev
```
