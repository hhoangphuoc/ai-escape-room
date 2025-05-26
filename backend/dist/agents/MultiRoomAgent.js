"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiRoomAgent = void 0;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const prompts_1 = require("../constant/prompts");
const uuid_1 = require("uuid");
dotenv_1.default.config();
/**
 * MultiRoomAgent is an agent that generates a 3-room escape game.
 * The level of difficulty will be higher for each subsequent room.
 * The agent will generate all 3 rooms at once.
 * The agent will also handle the game logic, including the player's progress through the rooms.
 */
class MultiRoomAgent {
    gameId;
    currentRoomIndex = 0; // 0-indexed (will be displayed as Room 1, 2, 3)
    roomsData = [];
    roomsUnlocked = [true, false, false]; // First room starts unlocked
    initPromise;
    constructor() {
        this.gameId = (0, uuid_1.v4)(); // Generate a unique game ID
        // Begin asynchronous generation of all 3 rooms
        // this.initPromise = this.generateMultiRoomGame();
    }
    getGameId() {
        return this.gameId;
    }
    getCurrentRoomIndex() {
        return this.currentRoomIndex;
    }
    getRoomsData() {
        return this.roomsData;
    }
    // Generate all three escape rooms at once via OpenAI
    async generateMultiRoomGame() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error('OPENAI_API_KEY not set');
        const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
        try {
            console.log('Generating multi-room escape game sequence...');
            const res = await openai.chat.completions.create({
                model: 'gpt-4.1',
                messages: [
                    {
                        role: "system",
                        content: prompts_1.SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: prompts_1.USER_MESSAGE
                    }
                ],
                temperature: 1,
                max_tokens: 4000, // Increased token limit for multi-room generation
            });
            if (typeof res.choices[0]?.message?.content === 'string') {
                // Handle the case where content is a string
                const content = res.choices[0].message.content.trim();
                // Remove markdown code block syntax if present
                let jsonContent = content;
                if (content.startsWith('```json')) {
                    jsonContent = content.replace(/```json\n/, '').replace(/\n```$/, '');
                }
                else if (content.startsWith('```')) {
                    jsonContent = content.replace(/```\n/, '').replace(/\n```$/, '');
                }
                try {
                    // Parse the JSON response - this could be an array or a single object with room arrays
                    const parsedContent = JSON.parse(jsonContent);
                    // Handle different possible formats returned by the LLM
                    if (Array.isArray(parsedContent)) {
                        // Direct array of rooms
                        this.roomsData = parsedContent;
                    }
                    else if (parsedContent.rooms && Array.isArray(parsedContent.rooms)) {
                        // Object with a "rooms" property containing an array
                        this.roomsData = parsedContent.rooms;
                    }
                    else {
                        // Single room object - create an array with just this room
                        // and we'll generate the others later as needed
                        this.roomsData = [parsedContent];
                        // Since we only got one room, we'll need to generate the others separately
                        await this.generateAdditionalRooms();
                    }
                    console.log(`Successfully generated ${this.roomsData.length} rooms for multi-room game`);
                }
                catch (parseError) {
                    console.error('Error parsing JSON content for multi-room game:', parseError);
                    console.log('Content that failed to parse:', jsonContent);
                    this.setupFallbackRooms();
                }
            }
            else {
                throw new Error('OpenAI API response has no text content');
            }
        }
        catch (err) {
            console.error('Failed to generate multi-room game:', err);
            this.setupFallbackRooms();
        }
    }
    // Generate additional rooms if we didn't get all three in the initial request
    async generateAdditionalRooms() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error('OPENAI_API_KEY not set');
        const openai = new openai_1.default({ apiKey });
        // How many more rooms do we need?
        const roomsNeeded = 3 - this.roomsData.length;
        if (roomsNeeded <= 0)
            return; // We already have enough rooms
        for (let i = this.roomsData.length; i < 3; i++) {
            try {
                const roomNumber = i + 1;
                const previousRoom = this.roomsData[i - 1];
                // Create a prompt that references the previous room for continuity
                const prompt = `
          This is room ${roomNumber} in a sequence of 3 escape rooms.
          
          ${roomNumber > 1 ? `The previous room was called "${previousRoom.name}" and had a background story: "${previousRoom.background}"` : ''}
          
          Design a ${roomNumber === 3 ? 'final' : 'new'} escape room that ${roomNumber > 1 ? 'continues this story' : 'starts an engaging story'} and has a difficulty level appropriate for room ${roomNumber} of 3 (${roomNumber === 3 ? 'most difficult' : roomNumber === 2 ? 'medium difficulty' : 'introductory difficulty'}).
          
          Create a JSON object with: name, background, password, and 4-6 objects (each with name, description, and details array).
        `;
                const res = await openai.chat.completions.create({
                    model: 'gpt-4.1',
                    messages: [
                        {
                            role: "system",
                            content: prompt
                        },
                        {
                            role: "user",
                            content: "/generate"
                        }
                    ],
                    temperature: 1,
                    max_tokens: 2048,
                });
                if (typeof res.choices[0]?.message?.content === 'string') {
                    // Handle the case where content is a string
                    const content = res.choices[0].message.content.trim();
                    // Remove markdown code block syntax if present
                    let jsonContent = content;
                    if (content.startsWith('```json')) {
                        jsonContent = content.replace(/```json\n/, '').replace(/\n```$/, '');
                    }
                    else if (content.startsWith('```')) {
                        jsonContent = content.replace(/```\n/, '').replace(/\n```$/, '');
                    }
                    try {
                        const roomData = JSON.parse(jsonContent);
                        this.roomsData.push(roomData);
                        console.log(`Generated room ${roomNumber} successfully`);
                    }
                    catch (parseError) {
                        console.error(`Error parsing JSON for room ${roomNumber}:`, parseError);
                        // Add a fallback room
                        const fallbackData = {
                            name: `Fallback Room ${roomNumber}`,
                            sequence: roomNumber,
                            background: `This is a fallback room due to generation failure. Room ${roomNumber} of 3.`,
                            password: roomNumber === 3 ? "finalkey" : `key${roomNumber}`,
                            hint: `The password is ${roomNumber === 3 ? "finalkey" : `key${roomNumber}`}`,
                            escape: false,
                            objects: [
                                {
                                    name: "Note",
                                    description: "A note with fallback information.",
                                    puzzle: "fallback puzzle",
                                    answer: `key${roomNumber}`,
                                    lock: false,
                                    details: [`The password to exit room ${roomNumber} is "${roomNumber === 3 ? "finalkey" : `key${roomNumber}`}".`]
                                }
                            ]
                        };
                        this.roomsData.push(fallbackData);
                    }
                }
            }
            catch (err) {
                console.error(`Failed to generate room ${i + 1}:`, err);
                // Add a fallback room
                this.roomsData.push({
                    name: `Error Room ${i + 1}`,
                    sequence: i + 1,
                    background: `This room was created when an error occurred.`,
                    password: i === 2 ? "finalkey" : `key${i + 1}`,
                    hint: `The password is ${i === 2 ? "finalkey" : `key${i + 1}`}`,
                    escape: false,
                    objects: [
                        {
                            name: "Error Note",
                            description: "A note explaining what went wrong.",
                            puzzle: "error puzzle",
                            answer: i === 2 ? "finalkey" : `key${i + 1}`,
                            lock: false,
                            details: [`An error occurred while generating the room. The password is "${i === 2 ? "finalkey" : `key${i + 1}`}".`]
                        }
                    ]
                });
            }
        }
    }
    // Set up fallback rooms in case of error
    // This is a dummy room object for when the LLM doesn't return a valid JSON object
    setupFallbackRooms() {
        this.roomsData = [
            {
                name: "Fallback Room 1",
                sequence: 1,
                background: "This is a fallback room generated when the API response couldn't be parsed correctly.",
                password: "key1",
                hint: "The password is 'key1'",
                escape: false,
                objects: [
                    {
                        name: "Error Note",
                        description: "A note explaining what went wrong.",
                        puzzle: "fallback puzzle",
                        answer: "key1",
                        lock: false,
                        details: ["The OpenAI API response wasn't in the expected format. The password is 'key1'."]
                    }
                ]
            },
            {
                name: "Fallback Room 2",
                sequence: 2,
                background: "This is the second fallback room.",
                password: "key2",
                hint: "The password is 'key2'",
                escape: false,
                objects: [
                    {
                        name: "Error Note",
                        description: "A note explaining what went wrong.",
                        puzzle: "fallback puzzle",
                        answer: "key2",
                        lock: false,
                        details: ["The OpenAI API response wasn't in the expected format. The password is 'key2'."]
                    }
                ]
            },
            {
                name: "Fallback Room 3",
                sequence: 3,
                background: "This is the final fallback room.",
                password: "escape",
                hint: "The password is 'escape'",
                escape: false,
                objects: [
                    {
                        name: "Error Note",
                        description: "A note explaining what went wrong.",
                        puzzle: "fallback puzzle",
                        answer: "escape",
                        lock: false,
                        details: ["The OpenAI API response wasn't in the expected format. The password is 'escape'."]
                    }
                ]
            }
        ];
    }
    // Process player commands
    async process(input) {
        const cmd = input.trim();
        const lc = cmd.toLowerCase();
        // If rooms aren't properly generated, handle that case
        if (!this.roomsData || this.roomsData.length === 0) {
            return {
                response: "The escape room is still being generated. Please try again in a moment.",
                data: {
                    message: "The escape room is still being generated. Please try again in a moment."
                }
            };
        }
        // Get current room data
        const currentRoomData = this.roomsData[this.currentRoomIndex];
        if (lc === '/newgame') {
            // Make sure rooms are generated before processing commands
            if (!this.roomsData || this.roomsData.length === 0) {
                this.initPromise = this.generateMultiRoomGame();
            }
            // Reset the game state
            this.currentRoomIndex = 0;
            this.roomsUnlocked = [true, false, false];
            return {
                // response: `
                // New game started.\n\n
                // You are in ${currentRoomData.name} (Room 1 of 3).\n\n
                // ${currentRoomData.background}`,
                data: {
                    message: `
          New game started.\n\n
          You are in ${currentRoomData.name} (Room 1 of 3).\n\n
          ${currentRoomData.background}`,
                    room: {
                        id: 1,
                        name: currentRoomData.name,
                        sequence: 1
                    }
                }
            };
        }
        if (lc === '/look') {
            // Get object names with proper formatting
            let objectList;
            if (Array.isArray(currentRoomData.objects)) {
                objectList = currentRoomData.objects.map(o => o.name).join('\n- ');
            }
            else {
                objectList = Object.values(currentRoomData.objects).map((o) => o.name).join('\n- ');
            }
            return {
                data: {
                    message: `
          You are in ${currentRoomData.name} (Room ${this.currentRoomIndex + 1} of 3).
          \n\n${currentRoomData.background}
          \n\nLooking around, you see:
          \n- ${objectList}`,
                    room: {
                        id: this.currentRoomIndex,
                        name: currentRoomData.name,
                        sequence: this.currentRoomIndex + 1,
                        background: currentRoomData.background
                    },
                    objects: objectList.split('\n- ').map(o => o.trim())
                }
            };
        }
        if (lc.startsWith('/inspect ')) {
            const target = cmd.substring(9).trim().toLowerCase();
            let obj;
            if (Array.isArray(currentRoomData.objects)) {
                obj = currentRoomData.objects.find(o => o.name.toLowerCase() === target);
            }
            else {
                obj = Object.values(currentRoomData.objects).find((o) => o.name.toLowerCase() === target);
            }
            if (!obj) {
                return {
                    response: `No object named '${target}' found. Try /look to see available objects.`,
                    data: {
                        message: `No object named '${target}' found. Try /look to see available objects.`
                    }
                };
            }
            // Handle both string and array details formats
            const details = Array.isArray(obj.details) ? obj.details.join('\n') : obj.details;
            return {
                data: {
                    message: `
            ${obj.name}: ${obj.description}
            \n\n${details}
          `,
                    object: {
                        name: obj.name,
                        description: obj.description,
                        details: details
                    }
                }
            };
        }
        if (lc === '/hint') {
            let objArray;
            if (Array.isArray(currentRoomData.objects)) {
                objArray = currentRoomData.objects;
            }
            else {
                objArray = Object.values(currentRoomData.objects);
            }
            // Get a random object from the room
            const obj = objArray[Math.floor(Math.random() * objArray.length)];
            // Get a random clue from the object
            let clue;
            if (Array.isArray(obj.details)) {
                clue = obj.details[Math.floor(Math.random() * obj.details.length)];
            }
            else {
                clue = obj.details;
            }
            return {
                data: {
                    message: `Hint from ${obj.name}: ${clue}`,
                    hint: {
                        source: obj.name,
                        content: clue
                    }
                }
            };
        }
        if (lc.startsWith('/guess ')) {
            const guess = cmd.substring(7).trim();
            // Check if the guess matches the current room's password
            if (guess.toLowerCase() === currentRoomData.password.toLowerCase()) {
                // Password correct!
                // Are there more rooms?
                if (this.currentRoomIndex < this.roomsData.length - 1) {
                    // Yes, unlock the next room
                    this.roomsUnlocked[this.currentRoomIndex + 1] = true;
                    const nextRoomIndex = this.currentRoomIndex + 1;
                    const nextRoom = this.roomsData[nextRoomIndex];
                    this.currentRoomIndex = nextRoomIndex; // Move to next room
                    return {
                        data: {
                            message: `
                Correct! The password '${currentRoomData.password}' unlocks the door. 
                You proceed to the next room: ${nextRoom.name} (Room ${nextRoomIndex + 1} of 3).\n\n${nextRoom.background}`,
                            unlocked: true,
                            nextRoom: {
                                id: nextRoomIndex,
                                name: nextRoom.name,
                            },
                            room: {
                                id: nextRoomIndex,
                                name: nextRoom.name,
                                sequence: nextRoomIndex + 1,
                                background: nextRoom.background
                            }
                        }
                    };
                }
                else {
                    // No more rooms, player has completed the game!
                    return {
                        data: {
                            message: `Correct! The password '${currentRoomData.password}' unlocks the final door. Congratulations, you've completed all 3 rooms and escaped the challenge!`,
                            unlocked: true,
                            gameCompleted: true,
                            room: {
                                id: this.currentRoomIndex,
                                name: this.roomsData[this.currentRoomIndex].name,
                                sequence: this.currentRoomIndex + 1
                            }
                        }
                    };
                }
            }
            else {
                // Wrong password
                return {
                    response: `Wrong password. Try again.`,
                    data: {
                        message: `Wrong password. Try again.`
                    }
                };
            }
        }
        if (lc === '/status') {
            // Show game progress
            let status = `Game Progress:\n`;
            for (let i = 0; i < this.roomsData.length; i++) {
                const roomStatus = i === this.currentRoomIndex ? "[CURRENT]" :
                    this.roomsUnlocked[i] ? "[UNLOCKED]" : "[LOCKED]";
                status += `- Room ${i + 1}: ${this.roomsData[i].name} ${roomStatus}\n`;
            }
            return {
                data: {
                    message: status,
                    room: {
                        id: this.currentRoomIndex,
                        name: this.roomsData[this.currentRoomIndex].name,
                        sequence: this.currentRoomIndex + 1
                    }
                }
            };
        }
        // Unknown command
        return {
            data: {
                message: `Unknown command '${cmd}'. Try /newgame, /look, /inspect <object>, /hint, /guess <password>, or /status.`,
                room: {
                    id: this.currentRoomIndex,
                    name: this.roomsData[this.currentRoomIndex].name,
                    sequence: this.currentRoomIndex + 1
                }
            }
        };
    }
    // Get the current room index (1-indexed for display)
    getCurrentRoomNumber() {
        return this.currentRoomIndex + 1;
    }
    // Get information about all rooms
    getRoomsSummary() {
        return this.roomsData.map((room, index) => ({
            id: index + 1,
            name: room.name,
            unlocked: this.roomsUnlocked[index]
        }));
    }
    // Get current room data
    getCurrentRoomData() {
        return this.roomsData[this.currentRoomIndex];
    }
}
exports.MultiRoomAgent = MultiRoomAgent;
//# sourceMappingURL=MultiRoomAgent.js.map