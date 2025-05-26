"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomAgent = void 0;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const prompts_1 = require("../constant/prompts");
const objects_1 = require("../constant/objects"); // Ensure ROOM_OBJECTS is imported
// import { v4 as uuidv4 } from 'uuid';
dotenv_1.default.config();
class RoomAgent {
    roomId;
    sequence;
    totalRooms;
    roomData = null;
    initPromise;
    isGenerating = false; // Flag to prevent concurrent generation
    constructor(roomId, sequence, totalRooms) {
        this.roomId = roomId;
        this.sequence = sequence ?? null;
        this.totalRooms = totalRooms ?? null;
        this.initPromise = this.initializeAgent();
    }
    // Initialize: Load data for known rooms immediately
    async initializeAgent() {
        if (this.roomId in objects_1.ROOM_OBJECTS) {
            console.log(`Initializing pre-defined RoomAgent for ID: ${this.roomId}`);
            // Make a deep copy to prevent modifications to the original constant
            this.roomData = JSON.parse(JSON.stringify(objects_1.ROOM_OBJECTS[this.roomId]));
            // Assign ID and sequence if missing in the constant data
            if (this.roomData) {
                this.roomData.id = this.roomId;
                this.roomData.sequence = this.sequence;
            }
        }
        else {
            console.log(`Custom RoomAgent ID: ${this.roomId}. Data will be generated on demand.`);
            // For custom rooms, data is generated lazily by getSingleRoomData
        }
    }
    // Public getter for room data. Returns null if not yet loaded/generated.
    getRoomData() {
        return this.roomData;
    }
    // Ensures room data is available, generating it if necessary.
    async ensureRoomData(apiKey) {
        await this.initPromise;
        if (this.roomData) {
            return this.roomData;
        }
        if (!(this.roomId in objects_1.ROOM_OBJECTS)) {
            // If generating, apiKey is required
            if (!apiKey) {
                console.error(`API key required to generate data for custom RoomAgent ID: ${this.roomId}`);
                this.setupFallbackRoom('API key missing for generation. Using the default room.');
                return this.roomData; // Return fallback
            }
            return await this.generateSingleRoomData(apiKey);
        }
        return null;
    }
    // Generate room data using OpenAI (only for custom rooms)
    // Requires apiKey.
    async generateSingleRoomData(apiKey) {
        if (this.isGenerating) {
            console.warn(`Generation already in progress for RoomAgent ID: ${this.roomId}. Waiting...`);
            // Basic wait mechanism (could be improved with a more robust lock/promise queue)
            await new Promise(resolve => setTimeout(resolve, 1000));
            return this.roomData;
        }
        this.isGenerating = true;
        console.log(`Generating room data for custom RoomAgent ID: ${this.roomId}`);
        const openai = new openai_1.default({ apiKey });
        try {
            let systemPrompt = prompts_1.SYSTEM_PROMPT;
            let userPrompt = prompts_1.USER_MESSAGE;
            if (this.sequence !== null && this.totalRooms !== null) {
                // systemPrompt = `You are designing Room ${this.sequence} of a ${this.totalRooms}-room escape game. Follow the main instructions but ensure the theme/difficulty fits this sequence number. ${SYSTEM_PROMPT}`;
                // userPrompt = `/generate_room_${this.sequence}_of_${this.totalRooms}`;
                // userPrompt = `Generate a room for the escape game.`;
                console.log(`Generating Room ${this.sequence}/${this.totalRooms} (ID: ${this.roomId})`);
            }
            else {
                console.log(`Generating single custom room (ID: ${this.roomId})`);
            }
            console.log(`=== OpenAI Request for Room ID: ${this.roomId} ===`);
            console.log(`System Prompt: ${systemPrompt.substring(0, 200)}...`);
            console.log(`User Prompt: ${userPrompt}`);
            const response = await openai.chat.completions.create({
                model: 'gpt-4.1', // Updated to use a more reliable model
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7,
                max_tokens: 10000,
            });
            const content = response.choices[0]?.message?.content;
            console.log(`=== OpenAI Response for Room ID: ${this.roomId} ===`);
            console.log(`Raw Content: ${content}`);
            if (content) {
                try {
                    const generatedData = JSON.parse(content);
                    console.log(`=== Parsed JSON for Room ID: ${this.roomId} ===`);
                    console.log(JSON.stringify(generatedData, null, 2));
                    // Validate SYSTEM_PROMPT format
                    const requiredFields = ['name', 'background', 'password', 'hint', 'objects', 'escape'];
                    const missingFields = requiredFields.filter(field => !(field in generatedData));
                    if (missingFields.length > 0) {
                        console.error(`Generated JSON missing required fields for room ID ${this.roomId}:`, missingFields);
                        console.log('Adding default values for missing fields...');
                        // Add default values for missing fields
                        if (!generatedData.hint)
                            generatedData.hint = "Look for clues in the objects to find the password";
                        if (!generatedData.escape)
                            generatedData.escape = false;
                        if (!generatedData.objects)
                            generatedData.objects = [];
                    }
                    // Validate object structure
                    if (Array.isArray(generatedData.objects)) {
                        const objectRequiredFields = ['name', 'description', 'puzzle', 'answer', 'lock'];
                        generatedData.objects.forEach((obj, index) => {
                            const objMissingFields = objectRequiredFields.filter(field => !(field in obj));
                            if (objMissingFields.length > 0) {
                                console.warn(`Object ${index} in room ${this.roomId} missing fields:`, objMissingFields);
                                // Add default values
                                if (!obj.puzzle)
                                    obj.puzzle = "Hidden puzzle within the description";
                                if (!obj.answer)
                                    obj.answer = "unknown";
                                if (obj.lock === undefined)
                                    obj.lock = false;
                            }
                        });
                    }
                    console.log(`=== Final Validated Data for Room ID: ${this.roomId} ===`);
                    console.log(JSON.stringify(generatedData, null, 2));
                    if (generatedData.name && generatedData.background && generatedData.password && generatedData.objects) {
                        this.roomData = { ...generatedData, id: this.roomId, sequence: this.sequence };
                        console.log(`✅ Successfully generated and validated room data for ID: ${this.roomId}`);
                        console.log(`Room Name: ${this.roomData.name}`);
                        console.log(`Password: ${this.roomData.password}`);
                        console.log(`Hint: ${this.roomData.hint}`);
                        console.log(`Objects Count: ${Array.isArray(this.roomData.objects) ? this.roomData.objects.length : Object.keys(this.roomData.objects).length}`);
                    }
                    else {
                        console.error('Generated JSON still lacks required fields after validation for room ID:', this.roomId);
                        this.setupFallbackRoom('Generated JSON lacks required fields even after validation.');
                    }
                }
                catch (parseError) {
                    console.error('Error: parsing JSON content for room ID:', this.roomId, parseError);
                    console.log('Content that failed to parse:', content);
                    this.setupFallbackRoom('Failed to parse generated JSON.');
                }
            }
            else {
                console.error('Error: OpenAI response content is null for room ID:', this.roomId);
                this.setupFallbackRoom('No content received from OpenAI.');
            }
        }
        catch (error) {
            console.error('Error: OpenAI API call failed for room ID:', this.roomId, error);
            this.setupFallbackRoom('OpenAI API call failed.');
        }
        this.isGenerating = false;
        return this.roomData;
    }
    setupFallbackRoom(reason) {
        console.warn(`Setting up fallback room for ID ${this.roomId} due to: ${reason}`);
        this.roomData = {
            id: this.roomId,
            sequence: this.sequence,
            name: `Fallback Room ${this.sequence ?? this.roomId}`,
            background: `This is a fallback room. Reason: ${reason}. The ID is ${this.roomId}.`,
            password: "fallback123",
            hint: "fallback hint",
            escape: false,
            // Ensure objects format matches RoomData (array or record)
            // Let's use array for fallback
            objects: [
                {
                    name: "Fallback Note",
                    description: "A note left behind due to an error.",
                    puzzle: "fallback puzzle",
                    answer: "fallback answer",
                    lock: false,
                    details: [
                        `An error occurred: ${reason}`,
                        `The password is \"fallback123\"`
                    ]
                }
            ]
        };
    }
    // Process input command for the room
    // Now requires apiKey to potentially trigger generation
    async process(input, apiKey) {
        // Ensure room data is loaded/generated before processing commands
        // Pass the apiKey down
        const currentRoomData = await this.ensureRoomData(apiKey);
        if (!currentRoomData) {
            // Updated error message if API key was the issue
            const errorMsg = !apiKey && !(this.roomId in objects_1.ROOM_OBJECTS) && !this.roomData
                ? "Error: API key required for custom room generation."
                : "Error: Room data could not be loaded or generated.";
            return { response: errorMsg, data: { message: errorMsg } };
        }
        const cmd = input.trim();
        const lc = cmd.toLowerCase();
        // --- Command Handling Logic --- (Keep existing logic like /look, /inspect, /hint, /guess)
        // Make sure to handle both array and record format for objects
        if (lc === '/look') {
            let objectList;
            if (Array.isArray(currentRoomData.objects)) {
                objectList = currentRoomData.objects.map(o => o.name).join('\n- ');
            }
            else {
                objectList = Object.values(currentRoomData.objects).map(o => o.name).join('\n- ');
            }
            return {
                data: {
                    message: `You are in ${currentRoomData.name}${currentRoomData.sequence ? ` (Room ${currentRoomData.sequence} of ${this.totalRooms})` : ''}.\n\n${currentRoomData.background}\n\nLooking around, you see:\n- ${objectList}`,
                    room: { id: this.roomId, name: currentRoomData.name, sequence: this.sequence },
                    objects: Array.isArray(currentRoomData.objects) ? currentRoomData.objects.map(o => o.name) : Object.values(currentRoomData.objects).map(o => o.name)
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
                const key = Object.keys(currentRoomData.objects).find(k => currentRoomData.objects[k].name.toLowerCase() === target);
                obj = key ? currentRoomData.objects[key] : undefined;
            }
            if (!obj) {
                return { data: { message: `No object named '${target}' found.` } };
            }
            const details = Array.isArray(obj.details) ? obj.details.join('\n') : obj.details;
            return { data: { message: `${obj.name}: ${obj.description}\n\n${details}`, object: obj } };
        }
        if (lc === '/hint') {
            let objArray;
            if (Array.isArray(currentRoomData.objects)) {
                objArray = currentRoomData.objects;
            }
            else {
                objArray = Object.values(currentRoomData.objects);
            }
            if (objArray.length === 0) {
                return { data: { message: "There are no objects to get hints from." } };
            }
            const obj = objArray[Math.floor(Math.random() * objArray.length)];
            let clue = "No details available for this object.";
            if (obj.details && obj.details.length > 0) {
                clue = obj.details[Math.floor(Math.random() * obj.details.length)];
            }
            return { data: { message: `Hint from ${obj.name}: ${clue}`, hint: { source: obj.name, content: clue } } };
        }
        if (lc.startsWith('/guess ')) {
            const guess = cmd.substring(7).trim();
            if (guess.toLowerCase() === currentRoomData.password.toLowerCase()) {
                const isLastRoom = this.sequence !== null && this.totalRooms !== null && this.sequence >= this.totalRooms;
                const message = `Correct! The password '${currentRoomData.password}' unlocks the door.` + (isLastRoom ? ` Congratulations, you've completed the final room!` : '');
                return {
                    data: {
                        message: message,
                        unlocked: true,
                        gameCompleted: isLastRoom,
                        room: { id: this.roomId, name: currentRoomData.name, sequence: this.sequence }
                    }
                };
            }
            else {
                return { data: { message: `Wrong password. Try again.` } };
            }
        }
        // Default response for unknown commands within the room context
        return { data: { message: `Unknown command in room: '${cmd}'. Try /look, /inspect <object>, /hint, or /guess <password>.` } };
    }
}
exports.RoomAgent = RoomAgent;
//# sourceMappingURL=RoomAgent.js.map