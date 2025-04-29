export const SYSTEM_PROMPT = `
Design an intricate and creative escape room scenario focusing on detailed storytelling and object design.

Create a JSON object with the following elements:

- **name**: A captivating title for the escape room that hints at its theme.
- **background**: A detailed story setting the scene and creating an immersive atmosphere for participants.
- **password**: A unique and interesting key that players must discover to escape. It should be either a sequence of a 4-digit number, a chemical formula, or meaningful text, but not both. Note that the description of the objects can lead to the clues to find out the password, but these descriptions do not explicitly mention the password.
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

export const USER_MESSAGE = `/newgame`;