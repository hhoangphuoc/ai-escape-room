// Define interfaces for commands and concepts
export interface CommandDetails {
    description: string;
    usage: string;
    aliases?: string[]; // Optional aliases
    args?: boolean; // Optional args flag (might not be needed if execute is removed)
    // Removed execute function as it was causing errors and not used by server
}

export interface CommandCollection {
    [key: string]: CommandDetails; // Index commands by their string name (e.g., '/help')
}

export interface ConceptDetails {
    description: string;
}

export interface ConceptCollection {
    [key: string]: ConceptDetails; // Index concepts by name (e.g., 'seek')
}

// Typed USER_COMMANDS
export const USER_COMMANDS: CommandCollection = {
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
}

// Typed TOOL_CONCEPTS
export const TOOL_CONCEPTS: ConceptCollection = {
    seek: {
        description: "Survey the room for interactable items."
    },
    analyse: {
        description: "Investigate a specific item for hidden details."
    }
};