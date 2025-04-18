// Remove interfaces GameObject, Room, RoomCollection

const ROOM_OBJECTS = {
  1: { // The Foyer of Fading Secrets
    name: "The Foyer of Fading Secrets", 
    objects: {
      manual: {
        name: "Manual",
        description: "A faded manual titled 'Morse & Shadows' lies open.",
        details: [
          "The manual contains cryptic Morse code notations: ----- ----- --...", // Morse for 007
          "The binding is worn, suggesting frequent use.",
          "It references Chapter 3: 'Encoding Victory'."
        ]
      },
      chest: {
        name: "Chest",
        description: "A locked chest that gently creaks, sealed with a combination lock.",
        details: [
          "The brass handle bears intricate patterns resembling a spy's insignia.",
          "It feels heavy; something rattles inside.",
          "The lock seems sturdy, probably needs a specific 3-digit combination." // Hint towards 007 length
        ]
      },
      book: {
        name: "Book",
        description: "A leather-bound notebook sits on a small table.",
        details: [
          "Annotations reference historic espionage cases.",
          "A bookmark points to a page discussing famous spy codenames, like '007'.", // Direct hint
          "The spine is slightly damaged."
        ]
      }
    },
    password: "007"
  },
  2: { // The Study of Shadows
    name: "The Study of Shadows",
    objects: {
      diary: {
        name: "Diary",
        description: "An encrypted diary lies open on a mahogany desk.",
        details: [
          "Filled with cryptic entries referencing 'the alpha code' and 'the second secret'.", // Hint for Alpha, 2
          "The handwriting is hurried, almost frantic.",
          "A date 'October 2nd' is circled multiple times." // Hint for 2
        ]
      },
      safe: {
        name: "Safe",
        description: "A miniature safe is tucked away behind an oil painting.",
        details: [
          "A high-security vault that likely requires a unique passcode, possibly combining letters and numbers.", // Hint for Alpha-2 format
          "It seems very old but well-maintained.",
          "There are faint scratch marks near the dial."
        ]
      },
      portrait: {
        name: "Portrait",
        description: "An oil painting of a long-forgotten operative hangs on the wall.",
        details: [
          "The mysterious image subtly highlights a numeral sequence hidden in its frame: 'II'.", // Hint for 2
          "The eyes seem to follow you around the room.",
          "A small plaque below reads 'Agent Alpha'." // Hint for Alpha
        ]
      }
    },
    password: "Alpha-2"
  },
  3: { // The Crypt of Coded Whispers
    name: "The Crypt of Coded Whispers",
    objects: {
      radio: {
        name: "Radio Transceiver",
        description: "Continuously emits a faded, crackling signal.",
        details: [
          "The signal contains hidden numeric patterns. You faintly hear '... three ... three ...'.", // Hint for 3
          "It crackles with static, but occasionally a clear number emerges.",
          "Seems tuned to a specific, obscure frequency mentioned in Project 'Cipher'." // Hint for Cipher
        ]
      },
      blueprints: {
        name: "Blueprints",
        description: "Rolled-up blueprints of secret facilities rest on a dusty table.",
        details: [
          "Markings indicate safe spots and hidden chambers.",
          "One large section details a 'Cipher Room'.", // Hint for Cipher
          "There are three distinct layers to the blueprints." // Hint for 3
        ]
      },
      documents: {
        name: "Documents",
        description: "Scattered confidential files with redacted portions.",
        details: [
          "Redacted portions hint at a recurring numerical motif, often appearing in groups of three.", // Hint for 3
          "Mentions of 'Project Cipher' appear frequently throughout the documents.", // Hint for Cipher
          "There are three distinct piles of documents." // Hint for 3
        ]
      }
    },
    password: "Cipher3"
  }
};

// Use module.exports
module.exports = { ROOM_OBJECTS }; 