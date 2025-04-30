// COMMANDS ---------------------------------------------------------------------
export interface CommandDetails {
	description: string;
	usage: string;
	aliases?: string[];
	args?: boolean;
}

export interface CommandCollection {
	[key: string]: CommandDetails;
}

// Command list - kept in sync with backend/constant/commands.ts
export const COMMANDS: CommandCollection = {
	'/help': {
		description: 'Shows available commands and their usage.',
		usage: '/help',
	},
	'/newgame': {
		description: 'Starts a new game, resetting progress of the current room.',
		usage: '/newgame',
	},
	'/history': {
		description: 'Shows the history of commands and responses',
		usage: '/history',
	},
	'/look': {
		description: 'Look around the room',
		usage: '/look',
	},
	'/inspect': {
		description: 'Inspect an object for details or hints',
		usage: '/inspect [object_name]',
	},
	'/guess': {
		description: 'Guess a password for the current room',
		usage: '/guess [password]',
	},
	'/hint': {
		description: 'Get a hint for the current room',
		usage: '/hint',
	},
	'/restart': {
		description: 'Restart the game',
		usage: '/restart',
	},
	'/model': {
		description: 'Change AI model',
		usage: '/model',
	},
	'/mcp': {
		description: 'Switch to MCP client mode',
		usage: '/mcp',
	},
	'/exit-mcp': {
		description: 'Exit MCP client mode',
		usage: '/exit-mcp',
	}
};
// -----------------------------------------------------------------------------
// MODEL LIST
export type ModelOption = {
    label: string;    
    description?: string;
    value: string;
  };
  
export interface ModelCollection {
    [key: string]: ModelOption;
}
// Available model options
export const MODELS_COLLECTION: ModelCollection = {
    'gpt-4o': {
        label: 'gpt-4o',
        description: 'gpt-4o - OpenAI\'s most capable model (default)',
        value: 'gpt-4o',
    },
    'gpt-4o-mini': {
        label: 'gpt-4o-mini',
        description: 'gpt-4o-mini - OpenAI\'s affordable model, cheaper option',
        value: 'gpt-4o-mini',
    },
    'o4-mini': {
        label: 'o4-mini',
        description: 'o4-mini - OpenAI\'s faster reasoning model (expensive)',
        value: 'o4-mini',
    },
    'o3': {
        label: 'o3',
        description: 'o3 - OpenAI\'s reasoning model (most expensive)',
        value: 'o3',
    },
    'gpt-4.1-mini': {
        label: 'gpt-4.1-mini',
        description: 'gpt-4.1-mini - OpenAI\'s affordable model, balancing speed and intelligence',
        value: 'gpt-4.1-mini',
    }
}



// -----------------------------------------------------------------------------


// MCP RELATED CONSTANTS ------------------------------------------------------------
// export const MCP_API_KEY = process.env['MCP_API_KEY'];
// export const MCP_API_URL = process.env['MCP_API_URL'];
// export const MCP_API_VERSION = process.env['MCP_API_VERSION'];
// // -----------------------------------------------------------------------------