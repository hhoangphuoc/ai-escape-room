// Response types for command handlers
export interface BaseResponse {
    success: boolean;
    message: string;
    error?: string;
}

export interface HelpResponse extends BaseResponse {
    commands: Array<{
        command: string;
        description: string;
        usage?: string;
    }>;
    currentContext?: {
        hasAI: boolean;
        currentModel?: string;
        currentRoom?: string;
        gameMode?: string;
        isAuthenticated: boolean;
    };
}

export interface LookResponse extends BaseResponse {
    roomData: {
        name: string;
        background?: string;
        objects: string[];
    };
}

export interface InspectResponse extends BaseResponse {
    objectData?: {
        name: string;
        description: string;
        puzzle?: string;
        answer?: string;
        unlocked: boolean;
        details?: string[];
    };
}

export interface GuessResponse extends BaseResponse {
    objectData: {
        name: string;
        unlocked: boolean;
        correctAnswer: boolean;
    };
}

export interface PasswordResponse extends BaseResponse {
    gameResult: {
        escaped: boolean;
        gameCompleted: boolean;
        timeElapsed?: number;
        hintsUsed?: number;
    };
}

export interface HintResponse extends BaseResponse {
    hintData: {
        hint: string;
        hintsUsed: number;
        hintType?: 'general' | 'object-specific' | 'puzzle-hint';
    };
}

export interface NewGameResponse extends BaseResponse {
    gameData: {
        id: string | number;
        name: string;
        background: string;
        mode: string;
        currentRoom: number;
        totalRooms: number;
        objectCount: number;
        startTime?: string;
    };
}

export interface LeaderboardResponse extends BaseResponse {
    leaderboardData: {
        entries: Array<{
            rank: number;
            userName: string;
            timeElapsed: number;
            hintsUsed: number;
            gameMode: string;
            completedAt?: string;
        }>;
        count: number;
        mode: string;
    };
}

export interface AuthResponse extends BaseResponse {
    userData?: {
        userId: string;
        userName: string;
        token: string;
        apiKey?: string;
    };
}

// Game state types
export interface GameInfo {
    id?: string | number;
    name?: string;
    background?: string;
    currentRoom?: number;
    totalRooms?: number;
    mode?: string;
    objectCount?: number;
}

export interface UserContext {
    userId?: string;
    sessionToken?: string;
    userName?: string;
    cliApiKey?: string;
    hasAICapability: boolean;
    selectedModel?: any;
}

export interface GameContext {
    currentGameId: string | number | null;
    currentRoomName: string;
    currentRoomBackground: string;
    currentGameMode: 'default' | 'single-custom' | 'multi-custom' | 'unknown';
    totalRooms: number;
    unlockedObjects: string[];
    currentRoomObjects: string[];
} 