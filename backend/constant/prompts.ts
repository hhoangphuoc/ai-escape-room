// export const SYSTEM_PROMPT = `
// Design an intricate and creative escape room scenario focusing on detailed storytelling and object design.

// Create a JSON object with the following elements:

// - **name**: A captivating title for the escape room that hints at its theme.
// - **background**: A detailed story setting the scene and creating an immersive atmosphere for participants.
// - **password**: A unique and interesting key that players must discover to escape. It should be either a sequence of a 4-digit number, or meaningful text (less than 10 characters), but not both. Note that the description of the objects can lead to the clues to find out the password, but these descriptions do not explicitly mention the password.
// - **objects**: 4-6 intricately designed items, each with:
//   - **name**: The item's name
//   - **description**: A vivid depiction of the item's appearance and purpose
//   - **details**: An array of intriguing features or clues associated with the item.

// Respond only with the JSON.

// Output Format

// Provide the response in a JSON format, focusing on creativity and detail in each component. 

// Notes

// - Ensure the escape room theme is consistent across the name, background, password, and objects.
// - Be imaginative in crafting the story and objects to enhance user engagement and challenge.
// `;
export const SYSTEM_PROMPT = `
Design an engaging escape room with a theme selected from language, food, country, or coding and AI. The room will have a name and background reflecting its theme. Develop puzzles and a password, ensuring creativity and relevance.

- **Theme Options**: language, food, country, coding and AI.
- **Room Elements**:
  - Name: Reflective of the room's theme.
  - Background: Descriptive and explaining the chosen theme.
  - Password: A meaningful word or short numeric sequence.
  - Hint: An explanatory description of the password.

- **Escape Room Objects**:
  - Contains 3-4 well-named objects.
  - Each object has a unique description and puzzle. The object description is inlong, descriptive paragraph, which cover in interesting story relevant to its puzzle. The puzzle representation is showed within this description, NOT the puzzle answer.
  - Puzzles should be easy to guess but tricky, following patterns: 
    - **Language**: Encoded in Vietnamese, Japanese, or Korean.
    - **Reorder**: Random order or palindrome (e.g., "Fruit" as "Truif").
    - **Code Patterns**: Morse, verbal, binary, or hexadecimal representation.

- **Puzzle Sequence**:
  - Each puzzle reveals a character or digit of the final password.
  - Solving each puzzle unlocks a lock.

- **Example**: 
  - Password "1608" with puzzles:
    - Puzzle 1: '1' -> "mot" (Vietnamese)
    - Puzzle 2: '6' -> "110" (binary)
    - Puzzle 3: '0' -> "khong" (Vietnamese)
    - Puzzle 4: '8' -> "thgie" (reverse of "eight")

# Output Format

The response will be in a JSON object format:

{
  "name": "Escape Room Name",
  "background": "Theme description",
  "password": "Password",
  "hint": "Password hint",
  "objects": [
    {
      "name": "Object Name",
      "description": "Object description  with only puzzle representation, NOT the puzzle answer",
      "puzzle": "Puzzle representation",
      "answer": "Puzzle answer",
      "lock": false
    }
  ],
  "escape": false
}

# Steps

1. Select a theme and craft a creative background.
2. Name the room to hint at the theme.
3. Develop a password with a descriptive hint.
4. Create 3-4 objects, each containing a puzzle with:
   - Language, reorder, or code patterns.
5. Ensure each puzzle contributes to unlocking another part of the password.
6. Develop a story that creates engagement but remains easy to navigate.

# API Interaction and Commands
- /newgame: to generate a new game
- /look: to look around the room and find all the object
- /inspect?object=object_name: to get details about an object.
- /guess?object=object_name&answer=puzzle: to submit puzzle answers.
- /password?password=[password]: to unlock the escape room.

# Notes

Ensure puzzles and room elements are related. Be creative and keep the narrative straightforward for user engagement.
`

export const USER_MESSAGE = `/newgame`;

export const MULTI_ROOM_PROMPT = `
Design a sequence of 3 interconnected escape rooms that form a coherent storyline. Players will progress through these rooms in order, with each room getting progressively more challenging.

For EACH room, create a JSON object with the following elements:
- **name**: A captivating title that hints at the room's theme and its place in the sequence
- **background**: Story setting that connects to the overall narrative and previous rooms (if applicable)
- **password**: A unique key players must discover to escape this room and enter the next
- **objects**: 4-6 intricately designed items, each with:
  - **name**: The item's name
  - **description**: A vivid depiction of the item's appearance
  - **details**: An array of intriguing features or clues associated with the item

The rooms should form a coherent story arc with the following structure:
1. Room 1: Introduction to the scenario and initial challenge (moderate difficulty)
2. Room 2: Development of the storyline with increased complexity (harder)
3. Room 3: Final room with the most challenging puzzles leading to escape (hardest)

Ensure each room contains subtle references to the overall story and connections to the other rooms. Make sure passwords become progressively more difficult to deduce.

Respond with a JSON array containing all three room objects.
`;