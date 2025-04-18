// Remove interfaces CommandDetails, CommandCollection, ConceptDetails, ConceptCollection

const USER_COMMANDS = {
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
    // Removed unused commands 
}

// Plain JS object
const TOOL_CONCEPTS = {
    seek: {
        description: "Survey the room for interactable items."
    },
    analyse: {
        description: "Investigate a specific item for hidden details."
    }
};

// Use module.exports
module.exports = { USER_COMMANDS, TOOL_CONCEPTS }; 