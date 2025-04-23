"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_CONCEPTS = exports.USER_COMMANDS = void 0;
// Typed USER_COMMANDS
exports.USER_COMMANDS = {
    // Keep only used/relevant commands for simplicity
    '/help': {
        description: 'Shows available commands and their usage.',
        usage: '/help'
    },
    '/seek': {
        description: 'Lists all interactable objects in the current room.',
        usage: '/seek'
    },
    '/analyse': {
        description: 'Examine an object more closely for details or hints.',
        usage: '/analyse [object_name]'
    },
    '/password': {
        description: 'Submit a password guess for the current room.',
        usage: '/password [your_guess]'
    },
    '/newgame': {
        description: 'Starts a new game, resetting progress to the first room.',
        usage: '/newgame'
    },
    '/create-game': {
        description: 'Creates a simple custom game with one room.',
        usage: '/create-game "Concept Name" "object1,object2,..." "password(optional)"'
    },
    // Removed unused commands like /create-room, /delete-room, MCP stubs, tool-list
};
// Typed TOOL_CONCEPTS
exports.TOOL_CONCEPTS = {
    seek: {
        description: "Survey the room for interactable items."
    },
    analyse: {
        description: "Investigate a specific item for hidden details."
    }
};
//# sourceMappingURL=commands.js.map