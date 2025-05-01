import { RoomData } from "../agents/RoomAgent";

// constant/objects.ts
  
  // export interface Room {
  //   name: string;
  //   sequence: number;
  //   background: string;
  //   objects: Record<string, GameObject>;
  //   password: string;
  // }
  
  export const ROOM_OBJECTS: Record<number, RoomData> = {
    1: {
      name: "The Foyer of Fading Secrets",
      sequence: 1,
      background: "You are in the foyer of a mansion. The walls are covered in old wallpaper, and the floor is covered in a thick layer of dust. The air is thick with the scent of old wood and mold.",
      objects: [
        {
          name: "Manual",
          description: "A faded manual titled 'Morse & Shadows' lies open.",
          details: [
            "The manual contains cryptic Morse code notations: ----- ----- --...",
            "The binding is worn, suggesting frequent use.",
            "It references Chapter 3: 'Encoding Victory'."
          ]
        },
        {
          name: "Chest",
          description: "A locked chest that gently creaks, sealed with a combination lock.",
          details: [
            "The brass handle bears intricate patterns resembling a spy's insignia.",
            "It feels heavy; something rattles inside.",
            "The lock seems sturdy, probably needs a specific 3‑digit combination."
          ]
        },
        {
          name: "Book",
          description: "A leather‑bound notebook sits on a small table.",
          details: [
            "Annotations reference historic espionage cases.",
            "A bookmark points to a page discussing famous spy codenames, like '007'.",
            "The spine is slightly damaged."
          ]
        }
      ],
      password: "007"
    },
    2: {
      name: "The Study of Shadows",
      sequence: 2,
      background: "You are in a study of a mansion. The walls are covered in old wallpaper, and the floor is covered in a thick layer of dust. The air is thick with the scent of old wood and mold.",
      objects: [
        {
          name: "Diary",
          description: "An encrypted diary lies open on a mahogany desk.",
          details: [
            "Filled with cryptic entries referencing 'the alpha code' and 'the second secret'.",
            "The handwriting is hurried, almost frantic.",
            "A date 'October 2nd' is circled multiple times."
          ]
        },
        {
          name: "Safe",
          description: "A miniature safe is tucked away behind an oil painting.",
          details: [
            "A high‑security vault that likely requires a unique passcode, possibly combining letters and numbers.",
            "It seems very old but well‑maintained.",
            "There are faint scratch marks near the dial."
          ]
        },
        {
          name: "Portrait",
          description: "An oil painting of a long‑forgotten operative hangs on the wall.",
          details: [
            "The mysterious image subtly highlights a numeral sequence hidden in its frame: 'II'.",
            "The eyes seem to follow you around the room.",
            "A small plaque below reads 'Agent Alpha'."
          ]
        }
      ],
      password: "Alpha-2"
    },
    3: {
      name: "The Crypt of Coded Whispers",
      sequence: 3,
      background: "You are in a crypt of a mansion. The walls are covered in old wallpaper, and the floor is covered in a thick layer of dust. The air is thick with the scent of old wood and mold.",
      objects: [
        {
          name: "Radio Transceiver",
          description: "Continuously emits a faded, crackling signal.",
          details: [
            "The signal contains hidden numeric patterns. You faintly hear '... three ... three ...'.",
            "It crackles with static, but occasionally a clear number emerges.",
            "Seems tuned to a specific, obscure frequency mentioned in Project 'Cipher'."
          ]
        },
        {
          name: "Blueprints",
          description: "Rolled‑up blueprints of secret facilities rest on a dusty table.",
          details: [
            "Markings indicate safe spots and hidden chambers.",
            "One large section details a 'Cipher Room'.",
            "There are three distinct layers to the blueprints."
          ]
        },
        {
          name: "Documents",
          description: "Scattered confidential files with redacted portions.",
          details: [
            "Redacted portions hint at a recurring numerical motif, often appearing in groups of three.",
            "Mentions of 'Project Cipher' appear frequently throughout the documents.",
            "There are three distinct piles of documents."
          ]
        }
      ],
      password: "Cipher3"
    }
  };