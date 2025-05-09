"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiRoomGame = void 0;
const RoomAgent_1 = require("./RoomAgent");
/**
 * MultiRoomGame manages a sequence of 3 rooms as a complete escape room game.
 * It handles progression between rooms and maintains game state.
 */
class MultiRoomGame {
    gameId;
    rooms = [];
    currentRoomIndex = 0;
    totalRooms = 3;
    initPromise;
    isReady = false;
    apiKey; // Store the API key
    constructor(gameId, apiKey, totalRooms = 3) {
        this.gameId = gameId;
        this.apiKey = apiKey; // Store the key
        this.totalRooms = totalRooms;
        this.initPromise = this.initializeRooms().then(() => {
            this.isReady = true;
            console.log(`MultiRoomGame ${this.gameId} is ready.`);
        }).catch(error => {
            console.error(`MultiRoomGame ${this.gameId} failed to initialize:`, error);
        });
    }
    /**
     * Initialize all rooms for the game. This will create a total of `totalRooms` RoomAgent instances
     */
    async initializeRooms() {
        // Create rooms in sequence
        for (let i = 0; i < this.totalRooms; i++) {
            console.log(`Creating room ${i + 1} for game ${this.gameId}`);
            // Room ID format: gameId_roomSequence (e.g., game123_1 for first room)
            const roomId = parseInt(`${this.gameId.slice(-4)}${i + 1}`);
            this.rooms[i] = new RoomAgent_1.RoomAgent(roomId, i + 1, this.totalRooms);
        }
        // Trigger initial generation/load for the first room, passing the key
        await this.rooms[0].process('/look', this.apiKey);
    }
    /**
     * Get current room
     */
    getCurrentRoom() {
        return this.rooms[this.currentRoomIndex];
    }
    /**
     * Process command for the current room
     */
    async process(input) {
        await this.waitUntilReady();
        // Process command in current room, passing the stored API key
        const result = await this.getCurrentRoom().process(input, this.apiKey);
        // Check if room was unlocked and advance to next room if not the last
        if (result.data?.unlocked && !result.data?.gameCompleted && this.currentRoomIndex < this.totalRooms - 1) {
            // Move to next room
            this.currentRoomIndex++;
            // Get information about the next room
            const nextRoom = this.rooms[this.currentRoomIndex];
            // Trigger look in the next room to ensure its data is generated/loaded, passing the key
            const nextRoomInfo = await nextRoom.process('/look', this.apiKey);
            // Enhance result with next room information
            result.data.nextRoom = {
                id: this.currentRoomIndex + 1, // 1-based room number
                name: nextRoomInfo.data.room?.name || `Room ${this.currentRoomIndex + 1}`
            };
            // Update the text response for backward compatibility
            result.response = (result.response || result.data.message || '') + // Preserve original response text if any
                `\n\nMoving to room ${this.currentRoomIndex + 1} of ${this.totalRooms}: ${result.data.nextRoom.name}.`;
            // Also update the main message for consistency
            result.data.message = result.response;
        }
        return result;
    }
    /**
     * Get status information for the game
     */
    getStatus() {
        return {
            gameId: this.gameId,
            currentRoom: this.currentRoomIndex + 1, // 1-based room number
            totalRooms: this.totalRooms,
            progress: Math.round(((this.currentRoomIndex) / this.totalRooms) * 100)
        };
    }
    // Add a public getter for the current room number (1-based)
    getCurrentRoomNumber() {
        return this.currentRoomIndex + 1;
    }
    async waitUntilReady() {
        if (this.isReady) {
            return Promise.resolve();
        }
        await this.initPromise;
    }
    getTotalRooms() {
        return this.totalRooms;
    }
}
exports.MultiRoomGame = MultiRoomGame;
//# sourceMappingURL=MultiRoomGame.js.map