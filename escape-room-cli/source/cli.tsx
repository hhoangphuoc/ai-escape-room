#!/usr/bin/env node
// import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';
import dotenv from 'dotenv';

// Load environment variables from .env file if exists
dotenv.config();

const cli = meow(
	`
	Usage
	  $ escape-room-cli [options]

	Options
		--name        Your name
		--email       Your email (optional)
		--register    Register a new user

	Examples
	  $ escape-room-cli --name=Jane
	  $ escape-room-cli --register --name=Jane --email=jane@example.com
	  
	API Key Configuration
	  Export your API key as an environment variable:
	  $ export ANTHROPIC_API_KEY="your-api-key"
	  or
	  $ export OPENAI_API_KEY="your-api-key"
`,
	{
		importMeta: import.meta,
		flags: {
			name: {
				type: 'string',
			},
			email: {
				type: 'string',
			},
			register: {
				type: 'boolean',
				default: false,
			},
		},
	},
);

render(<App name={cli.flags.name} email={cli.flags.email} register={cli.flags.register} />);
