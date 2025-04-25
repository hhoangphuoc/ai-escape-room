import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Response shape for commands
export interface RoomCommandResponse {
  response: string;
  unlocked?: boolean;
}

// Structure of a generated room
/**
 * The RoomAgent return a JSON object as the room data.
 * The JSON object has the following structure:
 * {
 *   "name": string; - Name of the room
 *   "background": string; - Background story of the room
 *   "password": string; - Password to unlock the room
 *   "objects": Array<{
 *     "name": string; - Name of the object
 *     "description": string; - Description of the object
 *     "details": string[]; - Details of the object
 *   }>;
 * }
 */
interface LLMRoomData {
  name: string;
  background: string;
  password: string;
  objects: Array<{
    name: string;
    description: string;
    details: string[];
  }>;
}

export class RoomAgent {
  private id: number;
  private locked: boolean = true;
  private initPromise: Promise<void>;
  
  // Change from private to public to allow access from server.ts
  public roomData!: LLMRoomData;

  constructor(id: number) {
    this.id = id;
    // Begin asynchronous generation
    this.initPromise = this.generateRoom();
  }

  // Generate the escape room details via OpenAI
  private async generateRoom(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const SYSTEM_PROMPT = "Design an intricate and creative escape room scenario focusing on detailed storytelling and object design.\n\nCreate a JSON object with the following elements:\n\n- **name**: A captivating title for the escape room that hints at its theme.\n- **background**: A detailed story setting the scene and creating an immersive atmosphere for participants.\n- **password**: A unique and interesting key that players must discover to escape. It should be either a sequence of a 4-digit number, a chemical formula, or meaningful text, but not both. Note that the description of the objects can lead to the clues to find out the password, but these descriptions do not explicitly mention the password.\n- **objects**: 4-6 intricately designed items, each with:\n  - **name**: The item's name\n  - **description**: A vivid depiction of the item's appearance and purpose\n  - **details**: An array of intriguing features or clues associated with the item.\n\nRespond only with the JSON.\n\n# Output Format\n\nProvide the response in a JSON format, focusing on creativity and detail in each component. \n\n# Notes\n\n- Ensure the escape room theme is consistent across the name, background, password, and objects.\n- Be imaginative in crafting the story and objects to enhance user engagement and challenge."

    const USER_MESSAGE = "/newgame"
    const res = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: USER_MESSAGE
        }
      ],
      temperature: 1,
      max_tokens: 2048,
    });
    try {
      // Log the full response (carefully) to see its structure
      console.log('OpenAI Response Structure:', 
        JSON.stringify({
          hasText: !!res.choices[0]?.message?.content,
          textType: typeof res.choices[0]?.message?.content,
          responseKeys: Object.keys(res.choices[0]?.message?.content || {}),
          responseType: typeof res.choices[0]?.message?.content
        }, null, 2)
      );
      
      // First, attempt to handle the case where res.text is an object instead of a string
      if (res.choices[0]?.message?.content && typeof res.choices[0]?.message?.content === 'object') {
        // Convert the full response to a string for debugging
        console.log('Full Response:', JSON.stringify(res, null, 2));
        
        // Try to extract JSON content from the response
        const jsonString = JSON.stringify(res.choices[0]?.message?.content);
        
        // Parse the JSON string into our room data
        this.roomData = {
          name: "Fallback Room",
          background: "This is a fallback room generated when the API response couldn't be parsed correctly.",
          password: "openai",
          objects: [
            {
              name: "Error Note",
              description: "A note explaining what went wrong.",
              details: ["The OpenAI API response wasn't in the expected format."]
            }
          ]
        };
        
        console.log('Using fallback room data due to unexpected API response format');
      } else if (typeof res.choices[0]?.message?.content === 'string') {
        // Handle the case where content is a string
        const content = res.choices[0].message.content.trim();
        
        // Sometimes the API returns the JSON with markdown code blocks, so we need to clean it
        let jsonContent = content;
        
        // Remove markdown code block syntax if present
        if (content.startsWith('```json')) {
          jsonContent = content.replace(/```json\n/, '').replace(/\n```$/, '');
        } else if (content.startsWith('```')) {
          jsonContent = content.replace(/```\n/, '').replace(/\n```$/, '');
        }
        
        try {
          this.roomData = JSON.parse(jsonContent) as LLMRoomData;
        } catch (parseError) {
          console.error('Error parsing JSON content:', parseError);
          console.log('Content that failed to parse:', jsonContent);
          throw parseError;
        }
      } else {
        // In case res.text is undefined or null
        throw new Error('OpenAI API response has no text content');
      }
    } catch (err) {
      console.error('Failed to parse room JSON:', err, 'Raw Response:', res);
      // Create fallback room data to avoid breaking the application
      this.roomData = {
        name: "Error Room",
        background: "This room was created when an error occurred.",
        password: "error",
        objects: [
          {
            name: "Error Note",
            description: "A note explaining what went wrong.",
            details: ["An error occurred while generating the room: " + err.message]
          }
        ]
      };
    }
  }

  // Handle commands: look, inspect, hint, guess
  public async process(input: string): Promise<RoomCommandResponse> {
    await this.initPromise;
    const cmd = input.trim();
    const lc = cmd.toLowerCase();
    //TODO: Handle the /newgame command to generate a new room (RoomAgent)
    if (lc === '/newgame') {
      this.initPromise = this.generateRoom();
      return { response: 'New game started.' };
    }

    //------------------------------- GAME COMMANDS --------------------------------------------
    if (lc === '/look') {
      const names = this.roomData.objects.map(o => o.name).join(', ');
      return { response: `You are in ${this.roomData.name}. You see: ${names}.` };
    }
    if (lc.startsWith('/inspect ')) {
      const target = cmd.substring(8).trim().toLowerCase();
      const obj = this.roomData.objects.find(o => o.name.toLowerCase() === target);
      if (!obj) return { response: `No object named '${target}' found.` };
      const details = obj.details.join('\n');
      return { response: `${obj.name}: ${obj.description}\n${details}` };
    }
    if (lc === '/hint') {
      const objs = this.roomData.objects;
      const obj = objs[Math.floor(Math.random() * objs.length)];
      const clue = obj.details[Math.floor(Math.random() * obj.details.length)];
      return { response: `Hint from ${obj.name}: ${clue}` };
    }
    if (lc.startsWith('/guess ')) {
      const guess = cmd.substring(6).trim();
      if (guess === this.roomData.password) {
        this.locked = false;
        return { response: `Correct! The password '${guess}' unlocks the door.`, unlocked: true };
      } else {
        return { response: `Wrong password. Try again.` };
      }
    }
    //------------------------------- END GAME COMMANDS ------------------------------------------
    return { response: `Unknown command '${cmd}'. Try /newgame, /look, /inspect <object>, /hint, or /guess <password>.` };
  }
}