# 1. Creative Narrative: The Spy Escape Room

## Story Overview

Imagine a secretive organization known only as The Umbra Agency. You are an undercover spy thrust into a labyrinth of rooms where every chamber conceals hidden clues, cryptic objects, and encrypted messages. Each room is designed with an escalating difficulty level and brims with artifacts that carry pieces of a covert history—from forgotten diaries and intricate chests to dusty manuals and mysterious books.

Detailed Room Narratives & Hidden Passwords

### Room 1: The Foyer of Fading Secrets

- Theme: Introduction to espionage and an enigmatic past

- Story:
You step into an abandoned mansion’s foyer and are immediately confronted with a nostalgic atmosphere. In one corner, a faded manual titled “Morse & Shadows” lies open beside an antique telephone and a locked chest that gently creaks. The manual contains cryptic Morse code notations hinting toward a hidden sequence.

- Objects & Their Stories:
    - Manual: Contains an encoded series of dots and dashes.
    
    - Chest: Sealed with a combination lock; its brass handle bears intricate patterns resembling a spy’s insignia.
    
    - Book: A leather-bound notebook with annotations that reference historic espionage cases.
    
    - Tool Commands: /get-manual, /open-chest, /read-book
    
- Hidden Password: "007" (Clue: The manual’s Morse code spells out “0-0-7”, a legendary spy codename.)

---

### Room 2: The Study of Shadows

- Theme: Delve deeper into the spy’s hidden archive

- Story:
You now enter a secluded study lined with dark wood paneling and a haze of mystery. Here, the artifacts are more intricate—an encrypted diary lies on a mahogany desk, and a miniature safe is tucked away behind an oil painting of a long-forgotten operative. The diary hints at secret rendezvous and covert missions, where every detail matters.

- Objects & Their Stories:
    - Diary: Filled with cryptic entries referencing “the alpha code” and “the second secret”.
    - Safe: A high-security vault that requires a unique passcode deduced by combining clues from the diary and surrounding objects.
    - Portrait: A mysterious image that subtly highlights a numeral sequence hidden in its frame.
    
- Tool Commands: /read-diary, /open-safe, /examine-portrait

- Hidden Password: "Alpha-2" (Clue: The diary mentions “Alpha” as the beginning and “2” as the next in the sequence of secrets.)

---

### Room 3: The Crypt of Coded Whispers (Optional Advanced Room)
Theme: The final challenge with layered puzzles

Story:
In the depths of the mansion lies an underground crypt where old radio transmissions, cryptic blueprints, and scattered documents converge. Rumor has it that the true mastermind of The Umbra Agency embedded the ultimate exit code in these relics.

- Objects & Their Stories:
    - Radio Transceiver: Continuously emits a faded signal containing hidden numeric patterns.
    - Blueprints: Blueprints of secret facilities with markings that indicate safe spots and hidden chambers.
    - Documents: Confidential files with redacted portions that hint at a recurring numerical motif.
    - Tool Commands: /tune-radio, /analyze-blueprints, /decrypt-documents
	•	Hidden Password: "Cipher3"
(Clue: The combination of “Cipher” for code and the number three reflects this room’s position and thematic depth.)

---

# 2. Command and Tool System

All interactions occur through a terminal-like interface where players enter commands. Here is an overview:
	•	Core Command Examples:
	•	/help: Lists all available commands.
	•	/tool-list: Displays the current room’s tools available (e.g., /get-manual, /read-diary).
	•	/password [input]: Submits a guessed password for the current room.
	•	/newgame: Initiates a new game instance by requesting a fresh narrative from the LLM through the server.
	•	Object-specific commands: /get-manual, /open-chest, /read-book, /tune-radio, etc., which provide hints or short story snippets related to the object.
	•	Tool Functionality & Limits:
	•	Time-Based Constraints: Each room can impose a time limit on tool usage. Once a room is unlocked, tool usage resets for the subsequent room.
	•	Purpose Limitation: Each tool is purpose-built to provide hints without revealing the complete secret, thus preserving game difficulty and resource management (limiting the abuse of LLM reasoning tokens).


---

# 3. Technical Architecture & Implementation Plan

## Client Side (ReactJS + TailwindCSS + MCP Client)
- UI Components & Structure:

    - Terminal Component:
        - Input Field: A text input styled with TailwindCSS that captures user commands.
        - History Window: A scrollable log area showing previous commands and server responses.
        - Command Parser: A utility function that interprets commands (e.g., detects /password, /help, etc.) and triggers appropriate actions.
    - State Management:
        - Game State: Track current room, objects, hints, password status, and available tools.
        - Command Queue: Manage user-entered commands and server responses.
        - MCP Client Library Integration:
            - Wraps the low-level network communication (WebSocket or HTTP REST calls) between the terminal UI and the server
            - Handles server responses asynchronously and updates the game state accordingly.

## Server Side (JavaScript MCP Server)

Server Responsibilities:
- Command Parsing & Routing:
    - An endpoint (or WebSocket handler) listens for incoming commands.
    - Commands such as /password, /tool-list, and /newgame are parsed, and the appropriate game logic is executed.
    
- Game State Management:
    - Store game configurations and room states in-memory or in a database (JSON configuration files are acceptable for a prototype).- Maintain active sessions for each user’s game progress.
    - Tool Calling & LLM Integration:
    - When a command like /newgame or /create-game ... is received, the server contacts the LLM API to generate a customized game narrative and room configuration.
    - Ensure each tool command (e.g., /get-manual) triggers a function that retrieves the corresponding object’s story snippet or hint.

## 3. Implementation Plan

### Phase 1: Build the Template (Prototype)
- Set Up the Client:
    - Create a new React project.
    - Install TailwindCSS and configure styles.
    - Develop the TerminalUI component with input history and command parsing.
    - Integrate the MCP client to send commands (using fetch/AJAX or WebSocket).
- Set Up the Server:
    - Create a Node.js (Express) server.
    - Implement core endpoints for MCP commands.
    - Define a simple JSON structure for game state (start with Room 1 as outlined above).
    - Test the communication between the client and server via terminal commands.

### Phase 2: Integrate Game Logic & Tools

- Implement Tool Functions:
    - Create functions for each object (manual, chest, book) that return a descriptive hint.
    - Enforce time limits on tools: for example, block repeat calls after 60 seconds or until the room is unlocked.
    
- Custom Game Creation:
    - Add command parsing for /create-game.
    - Optionally integrate with an LLM API (if available) to generate room narratives dynamically.
    - Store custom game configurations in a JSON file or in memory.

### Phase 3: Finalize and Test
- User Experience:
    - Ensure smooth UX in the terminal UI—clear command feedback, error messages, and hints.
    - Add help documentation triggered by /help.
- Testing:
    - Simulate an entire game session:
    - Room 1: Use /tool-list to show available hints, then /get-manual to retrieve the clue for the password.
    - Submit the correct password via /password 007 to unlock the room.
    Iterate on game logic and refine narratives as needed.

---

# 4. Summary & Concluding Remarks
- Creative Narrative:
The game is set in a shadowy mansion filled with secrets. Each room (e.g., The Foyer of Fading Secrets, The Study of Shadows, etc.) comes with its own set of objects that deliver narrative hints. Hidden passwords like "007", "Alpha-2", and "Cipher3" provide the challenge and progression mechanism.

- Command & Tool System:
Users interact using text commands (e.g., /help, /tool-list, /password) to gather clues. A dedicated command /create-game "Concept" "object1,object2,..." "password" empowers customization.

- Technical Implementation:
    - Frontend: ReactJS and TailwindCSS for a sleek terminal UI
    - Backend: Node.js for handling MCP commands, game state management, and integration with AI APIs for dynamic content generation.
    - Communication: A terminal-like UI facilitates all interactions between clients and the MCP server.
- Demo Plan:
Start with a single-room prototype, simulate full command flows (from retrieving tools to entering the password), and then expand to support multi-room custom games.

This detailed guideline should serve as a strong blueprint for developing your AI-powered Spy Escape Room game, merging creative storytelling with an engaging terminal-based interface and robust technical architecture.


---
# Resources