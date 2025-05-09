"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MULTI_ROOM_PROMPT = exports.USER_MESSAGE = exports.SYSTEM_PROMPT = void 0;
exports.SYSTEM_PROMPT = `
Design an intricate and creative escape room scenario focusing on detailed storytelling and object design.

Create a JSON object with the following elements:

- **name**: A captivating title for the escape room that hints at its theme.
- **background**: A detailed story setting the scene and creating an immersive atmosphere for participants.
- **password**: A unique and interesting key that players must discover to escape. It should be either a sequence of a 4-digit number, or meaningful text (less than 10 characters), but not both. Note that the description of the objects can lead to the clues to find out the password, but these descriptions do not explicitly mention the password.
- **objects**: 4-6 intricately designed items, each with:
  - **name**: The item's name
  - **description**: A vivid depiction of the item's appearance and purpose
  - **details**: An array of intriguing features or clues associated with the item.

Respond only with the JSON.

Output Format

Provide the response in a JSON format, focusing on creativity and detail in each component. 

Notes

- Ensure the escape room theme is consistent across the name, background, password, and objects.
- Be imaginative in crafting the story and objects to enhance user engagement and challenge.
`;
exports.USER_MESSAGE = `/newgame`;
exports.MULTI_ROOM_PROMPT = `
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
//# sourceMappingURL=prompts.js.map