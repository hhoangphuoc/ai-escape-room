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
		description: 'Starts a new AI-generated escape room for you.',
		usage: '/newgame [single-room|multi-room]',
	},
	'/history': {
		description: 'Shows the history of commands and responses',
		usage: '/history',
	},
	'/look': {
		description: 'Look around the room for clues or objects',
		usage: '/look',
	},
	'/inspect': {
		description: 'Inspect an object for details or hints',
		usage: '/inspect [object_name]',
	},
	'/guess': {
		description: 'Decode a puzzle or riddle of an object',
		usage: '/guess [object_name] [puzzle]',
	},
	'/hint': {
		description: 'Get a hint for the password of this room',
		usage: '/hint',
	},
	'/password': {
		description: 'Get the password of the current room',
		usage: '/password [your_password]',
	},
	'/leaderboard': {
		description: 'Shows the top 10 leaderboard scorers.',
		usage: '/leaderboard',
	},
	'/leaderboard/me': {
		description: 'Shows your top 5 scores.',
		usage: '/leaderboard/me',
	},
	'/logout': {
		description: 'Logout to current session and your account.',
		usage: '/logout',
	},
	'/login': {
		description: 'Login to your account (if config exists, usually automatic)',
		usage: '/login',
	},
	'/register': {
		description: 'Register a new account, or re-register if you already have one.',
		usage: '/register',
	},
	'/model': {
		description: 'Change AI model that you want to use.',
		usage: '/model',
	},
	'/status': {
		description: 'Shows the current status of the game.',
		usage: '/status',
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
	'gpt-4.1': {
        label: 'gpt-4.1',
        description: 'gpt-4.1 - OpenAI\'s latest model, faster and more intelligent',
        value: 'gpt-4.1',
    },
	'gpt-4.1-mini': {
        label: 'gpt-4.1-mini',
        description: 'gpt-4.1-mini - OpenAI\'s affordable model, balancing speed and intelligence',
        value: 'gpt-4.1-mini',
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
	'o3-mini': {
        label: 'o3-mini',
        description: 'o3-mini - OpenAI\'s faster reasoning model (cheaper)',
        value: 'o3-mini',
    }
}



// -----------------------------------------------------------------------------


// MCP RELATED CONSTANTS ------------------------------------------------------------
// export const MCP_API_KEY = process.env['MCP_API_KEY'];
// export const MCP_API_URL = process.env['MCP_API_URL'];
// export const MCP_API_VERSION = process.env['MCP_API_VERSION'];
// // -----------------------------------------------------------------------------