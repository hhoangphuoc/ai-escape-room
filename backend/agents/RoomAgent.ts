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
  private roomData!: LLMRoomData;
  private locked: boolean = true;
  private initPromise: Promise<void>;

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
    const res = await openai.responses.create({
      model: 'gpt-4.1',
      input: [
        {
          "role": "system",
          "content": [
            {
              "type": "input_text",
              "text": SYSTEM_PROMPT
            }
          ]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "input_text",
              "text": USER_MESSAGE
            }
          ]
        }
      ],
      text: {
        format: {
          "type": "text"
        }
      },
      reasoning: {},
      tools: [],
      temperature: 1,
      top_p: 1,
      max_output_tokens: 2048,
      store: true
    });
    try {
      const text = res.text || "";
      this.roomData = JSON.parse(String(text)) as LLMRoomData;
    } catch (err) {
      console.error('Failed to parse room JSON:', err, res.text);
      throw err;
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
    return { response: `Unknown command '${cmd}'. Try /look, /inspect <object>, /hint, or /guess <password>.` };
  }
}