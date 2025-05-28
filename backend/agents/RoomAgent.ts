import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { SYSTEM_PROMPT, USER_MESSAGE } from '../constant/prompts';
import { ROOM_OBJECTS } from '../constant/objects'; // Ensure ROOM_OBJECTS is imported
// import { v4 as uuidv4 } from 'uuid';
dotenv.config();

// Response shape for commands
export interface RoomCommandResponse {
  // Raw structured data for client-side formatting
  data: {
    message?: string;           // Raw message content
    room?: {                    // Room information
      id: number;
      name: string;
      sequence?: number;        // Position in a multi-room sequence (1-3)
      background?: string;
    };
    objects?: string[];         // List of object names
    object?: {                  // Specific object details
      name: string;
      description: string;
      puzzle?: string;          // Puzzle representation
      answer?: string;          // Puzzle answer
      unlocked?: boolean;           // Lock status
      details?: string[] | string; // Optional details for backward compatibility
    };
    escaped?: boolean;         // Whether a room was escaped
    nextRoom?: {                // Next room if applicable
      id: number;
      name: string;
    };
    gameCompleted?: boolean;    // Whether game is completed
    hint?: string;              // Hint for the password
    // hint?: {                    // Hint information
    //   source: string;           // Which object provided the hint
    //   content: string;          // The hint content
    // };
  };
  
  // Legacy fields for backward compatibility
  response?: string;
  unlocked?: boolean;
  roomId?: number;             // Room ID in a sequence
}

// Structure of a generated room ==================================================================
/**
 * The RoomAgent returns a JSON object as the room data matching SYSTEM_PROMPT format.
 * The JSON object has the following structure:
 * {
 *   "name": string; - Name of the room
 *   "background": string; - Background story of the room
 *   "password": string; - Password to unlock the room
 *   "hint": string; - Password hint
 *   "objects": Array<{
 *     "name": string; - Name of the object
 *     "description": string; - Description with puzzle representation, NOT the answer
 *     "puzzle": string; - Puzzle representation
 *     "answer": string; - Puzzle answer
 *     "unlocked": boolean; - Lock status
 *   }>;
 *   "escaped": boolean; - Escape status
 * }
 */
//===================================================================================================

export interface RoomData {
  id?: number; // Optional ID
  sequence?: number | null; // Optional sequence number
  name: string;
  background: string;
  password: string;
  hint: string; // Password hint - now required to match SYSTEM_PROMPT
  escaped: boolean; // Escape status - now required to match SYSTEM_PROMPT
  // Allow objects to be an array or a record, but array is preferred for SYSTEM_PROMPT format
  objects: RoomObject[] | Record<string, RoomObject>;
}

export interface RoomObject {
  name: string;
  description: string; // Description with only puzzle representation, NOT the puzzle answer
  puzzle: string; // Puzzle representation
  answer: string; // Puzzle answer
  unlocked: boolean; // Lock status
  details?: string[]; // Backward compatibility - optional details field
}

export class RoomAgent {
  private roomId: number;
  private sequence: number | null;
  private totalRooms: number | null;
  private roomData: RoomData | null = null;
  private initPromise: Promise<void>;
  private isGenerating: boolean = false; // Flag to prevent concurrent generation

  constructor(roomId: number, sequence?: number | null, totalRooms?: number | null) {
    this.roomId = roomId;
    this.sequence = sequence ?? null;
    this.totalRooms = totalRooms ?? null;
    this.initPromise = this.initializeAgent();
  }

  // Initialize: Load data for known rooms immediately
  private async initializeAgent(): Promise<void> {
    if (this.roomId in ROOM_OBJECTS) {
      console.log(`Initializing pre-defined RoomAgent for ID: ${this.roomId}`);
      // Make a deep copy to prevent modifications to the original constant
      this.roomData = JSON.parse(JSON.stringify(ROOM_OBJECTS[this.roomId]));
      // Assign ID and sequence if missing in the constant data
      if (this.roomData) {
          this.roomData.id = this.roomId;
          this.roomData.sequence = this.sequence;
      }
    } else {
      console.log(`Custom RoomAgent ID: ${this.roomId}. Data will be generated on demand.`);
      // For custom rooms, data is generated lazily by getSingleRoomData
    }
  }

  // Public getter for room data. Returns null if not yet loaded/generated.
  public getRoomData(): RoomData | null {
    return this.roomData;
  }

  // Ensures room data is available, generating it if necessary.
  public async ensureRoomData(apiKey?: string): Promise<RoomData | null> {
      await this.initPromise;
      if (this.roomData) {
          return this.roomData;
      }
      if (!(this.roomId in ROOM_OBJECTS)) {
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
  private async generateSingleRoomData(apiKey: string): Promise<RoomData | null> {
    if (this.isGenerating) {
        console.warn(`Generation already in progress for RoomAgent ID: ${this.roomId}. Waiting...`);
        // Basic wait mechanism (could be improved with a more robust lock/promise queue)
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.roomData;
    }
    this.isGenerating = true;

    console.log(`Generating room data for custom RoomAgent ID: ${this.roomId}`);
    const openai = new OpenAI({ apiKey });

    try {
      let systemPrompt = SYSTEM_PROMPT;
      let userPrompt = USER_MESSAGE;
      if (this.sequence !== null && this.totalRooms !== null) {
        systemPrompt = `You are designing Room ${this.sequence} of a ${this.totalRooms}-room escape game. Follow the main instructions but ensure the theme/difficulty fits this sequence number. ${SYSTEM_PROMPT}`;
        userPrompt = `/generate_room_${this.sequence}_of_${this.totalRooms}`;
        // userPrompt = `Generate a room for the escape game.`;
        console.log(`Generating Room ${this.sequence}/${this.totalRooms} (ID: ${this.roomId})`);
      } else {
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
          const requiredFields = ['name', 'background', 'password', 'hint', 'objects', 'escaped'];
          const missingFields = requiredFields.filter(field => !(field in generatedData));
          
          if (missingFields.length > 0) {
            console.error(`Generated JSON missing required fields for room ID ${this.roomId}:`, missingFields);
            console.log('Adding default values for missing fields...');
            
            // Add default values for missing fields
            if (!generatedData.hint) generatedData.hint = "Look for clues in the objects to find the password";
            if (!generatedData.escaped) generatedData.escaped = false;
            if (!generatedData.objects) generatedData.objects = [];
          }
          
          // Validate object structure
          if (Array.isArray(generatedData.objects)) {
            const objectRequiredFields = ['name', 'description', 'puzzle', 'answer', 'unlocked'];
            generatedData.objects.forEach((obj: any, index: number) => {
              const objMissingFields = objectRequiredFields.filter(field => !(field in obj));
              if (objMissingFields.length > 0) {
                console.warn(`Object ${index} in room ${this.roomId} missing fields:`, objMissingFields);
                // Add default values
                if (!obj.puzzle) obj.puzzle = "Hidden puzzle within the description";
                if (!obj.answer) obj.answer = "unknown";
                if (obj.unlocked === undefined) obj.unlocked = false;
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
          } else {
            console.error('Generated JSON still lacks required fields after validation for room ID:', this.roomId);
            this.setupFallbackRoom('Generated JSON lacks required fields even after validation.');
          }
        } catch (parseError) {
          console.error('Error: parsing JSON content for room ID:', this.roomId, parseError);
          console.log('Content that failed to parse:', content);
          this.setupFallbackRoom('Failed to parse generated JSON.');
        }
      } else {
        console.error('Error: OpenAI response content is null for room ID:', this.roomId);
        this.setupFallbackRoom('No content received from OpenAI.');
      }
    } catch (error) {
      console.error('Error: OpenAI API call failed for room ID:', this.roomId, error);
      this.setupFallbackRoom('OpenAI API call failed.');
    }

    this.isGenerating = false;
    return this.roomData;
  }

  private setupFallbackRoom(reason: string): void {
    console.warn(`Setting up fallback room for ID ${this.roomId} due to: ${reason}`);
    this.roomData = {
      id: this.roomId,
      sequence: this.sequence,
      name: `Fallback Room ${this.sequence ?? this.roomId}`,
      background: `This is a fallback room. Reason: ${reason}. The ID is ${this.roomId}.`,
      password: "fallback123",
      hint: "fallback hint",
      escaped: false,
      // Ensure objects format matches RoomData (array or record)
      // Let's use array for fallback
      objects: [
        {
          name: "Fallback Note",
          description: "A note left behind due to an error.",
          puzzle: "fallback puzzle",
          answer: "fallback answer",
          unlocked: false,
          details: [
            `An error occurred: ${reason}`,
            `The password is \"fallback123\"`
          ]
        }
      ]
    };
  }

  // Process input command for the room
  public async process(input: string, apiKey?: string): Promise<RoomCommandResponse> {
    // Ensure room data is loaded/generated before processing commands
    // Pass the apiKey down
    const currentRoomData = await this.ensureRoomData(apiKey);

    if (!currentRoomData) {
        // Updated error message if API key was the issue
        const errorMsg = !apiKey && !(this.roomId in ROOM_OBJECTS) && !this.roomData
                         ? "Error: API key required for custom room generation."
                         : "Error: Room data could not be loaded or generated.";
        return { response: errorMsg, data: { message: errorMsg } };
    }

    const cmd = input.trim();
    const lc = cmd.toLowerCase();

    // -------------------------------- Command Handling Logic ------------------------------------------
    // Available commands:
    //  /look, /inspect, /hint, /guess, /password
    // Make sure to handle both array and record format for objects
    // -------------------------------------------------------------------------------------------------



    // 								/hint
    // -------------------------------------------------------------------------------------------------
    if (lc === '/hint') {
      return { 
          data: { 
              message: `Hints for the password.`,
              hint: currentRoomData.hint
          }
      };
    }


    // 								/look
    // -------------------------------------------------------------------------------------------------
    if (lc === '/look') {
        let objectList: string;
        if (Array.isArray(currentRoomData.objects)) {
            objectList = currentRoomData.objects.map(o => o.name).join('\n- ');
        } else {
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


    // 								/inspect <object>
    // -------------------------------------------------------------------------------------------------
    if (lc.startsWith('/inspect ')) {
        const target = cmd.substring(9).trim().toLowerCase();
        let obj: RoomObject | undefined;
        if (Array.isArray(currentRoomData.objects)) {
            obj = currentRoomData.objects.find(o => o.name.toLowerCase() === target);
        } else {
            const key = Object.keys(currentRoomData.objects).find(k => currentRoomData.objects[k].name.toLowerCase() === target);
            obj = key ? currentRoomData.objects[key] : undefined;
        }

        if (!obj) {
            return { data: { message: `No object named '${target}' found.` } };
        }
        const details = Array.isArray(obj.details) ? obj.details.join('\n') : obj.details;
        return { data: { message: `${obj.name}: ${obj.description}\n\n${details}`, object: { ...obj} } };
    }


    // 								/guess <object> <puzzle>
    // -------------------------------------------------------------------------------------------------
    if (lc.startsWith('/guess ')) {
        // const target = cmd.substring(6).trim().toLowerCase();
        const [object, answer] = cmd.substring(6).trim().toLowerCase().split(' ');
        let obj: RoomObject | undefined;
        if (Array.isArray(currentRoomData.objects)) {
            obj = currentRoomData.objects.find(o => o.name.toLowerCase() === object);
        } else {
            const key = Object.keys(currentRoomData.objects).find(k => currentRoomData.objects[k].name.toLowerCase() === object);
            obj = key ? currentRoomData.objects[key] : undefined;
        }
        if (!obj) {
            return { data: { message: `No object named '${object}' found.` } };
        }

        if (answer.toLowerCase() === obj.answer.toLowerCase()) {
            return { 
              data: { 
                message: `Correct! The answer for ${obj.name}'s puzzle is: ${obj.answer}.`,
                object: {
                  ...obj,
                  unlocked: true, //correct answer unlock the object
                }
              } 
            };
        } else {
            return { 
              data: { 
                message: `Oops! Wrong answer. Try again.`, 
                object: { ...obj, unlocked: false } 
              } };
        }
    }


    // 								/password <password>
    // -------------------------------------------------------------------------------------------------
    if (lc.startsWith('/password ')) {
        const pass = cmd.substring(9).trim();
        console.log(`RoomAgent: Original password: ${currentRoomData.password}`);
        console.log(`RoomAgent: Received /password request with: ${pass}`);
        if (pass.toLowerCase() === currentRoomData.password.toLowerCase()) {
            const isLastRoom = this.sequence !== null && this.totalRooms !== null && this.sequence >= this.totalRooms;
            const message = `Correct! The password '${currentRoomData.password}' unlocks the door.` + (isLastRoom ? ` Congratulations, you've completed the final room!` : '');
            return {
                data: {
                    message: message,
                    escaped: true, // Correct password unlock the room
                    gameCompleted: isLastRoom,
                    room: { id: this.roomId, name: currentRoomData.name, sequence: this.sequence }
                }
            };
        } else {
            return { data: { message: `Wrong password. Try again.` } };
        }
    }

    // Default response for unknown commands within the room context
    return { 
      data: { 
        message: `Unknown command in room: '${cmd}'. \n
        Try /look, /inspect <object>, /hint, /guess <object> <puzzle>, or /password <password>.` 
      } 
    };
  }
}