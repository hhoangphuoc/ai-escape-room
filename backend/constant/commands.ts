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
    },
    '/create-game': {
        description: 'Creates a simple custom game with one room.',
        usage: '/create-game "Concept Name" "object1,object2,..." "password(optional)"'
    },
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