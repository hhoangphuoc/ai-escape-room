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
    '/history': {
        description: 'Shows the history of commands and responses',
        usage: '/history'
    },
    '/look': {
        description: 'Look around the room',
        usage: '/look'
    },
    '/inspect': {
        description: 'Inspect an object for details or hints',
        usage: '/inspect [object_name]'
    },
    '/hint': {
        description: 'Get a hint for the current room',
        usage: '/hint'
    },
    '/restart': {
        description: 'Restart the game',
        usage: '/restart'
    },
    '/newgame': {
        description: 'Creates a completely new AI-generated escape room.',
        usage: '/newgame'
    }
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