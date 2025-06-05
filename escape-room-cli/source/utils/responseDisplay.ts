import React from 'react';
import { 
    BaseResponse, 
    HelpResponse, 
    LookResponse, 
    InspectResponse, 
    GuessResponse, 
    PasswordResponse, 
    HintResponse, 
    NewGameResponse, 
    LeaderboardResponse,
    AuthResponse
} from './responseTypes.js';

// Type for history items
export type HistoryItem = {
    type: 'command' | 'response' | 'error' | 'success' | 'info';
    text: string;
    data?: any; // Additional structured data for flexible display
    component?: React.ReactElement; // New: TSX component for rich display
    responseType?: 'help' | 'look' | 'inspect' | 'guess' | 'password' | 'hint' | 'newgame' | 'leaderboard' | 'auth' | 'generic'; // Response type identifier
};

// Display mode enum for flexible rendering
export enum DisplayMode {
    TEXT_ONLY = 'text_only',
    STRUCTURED = 'structured',
    ENHANCED = 'enhanced',
    COMPONENT = 'component' // New: Use TSX components for rich display
}

// Display Help Response
export const displayHelpResponse = (response: HelpResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    if (mode === DisplayMode.TEXT_ONLY) {
        let helpText = response.message + '\n';
        response.commands.forEach(cmd => {
            helpText += `${cmd.command} - ${cmd.description}\n`;
        });
        
        if (response.currentContext) {
            helpText += '\nCurrent Status:\n';
            if (response.currentContext.isAuthenticated) {
                helpText += `✓ Authenticated\n`;
                if (response.currentContext.currentRoom) {
                    helpText += `\n🏠 Room: ${response.currentContext.currentRoom}\n`;
                }
                if (response.currentContext.gameMode) {
                    helpText += `🎮 Mode: ${response.currentContext.gameMode}\n`;
                }
            } else {
                helpText += `✗ Not authenticated\n`;
            }
            
            if (response.currentContext.hasAI) {
                helpText += `🤖 AI: ${response.currentContext.currentModel || 'Available'}\n`;
            }
        }
        
        items.push({ type: 'response', text: helpText.trim(), responseType: 'help' });
    } else if (mode === DisplayMode.COMPONENT) {
        items.push({ 
            type: 'response', 
            text: response.message,
            responseType: 'help',
            data: response 
        });
    } else {
        items.push({ 
            type: 'response', 
            text: response.message,
            responseType: 'help',
            data: response 
        });
    }
    
    return items;
};

// Display Look Response
export const displayLookResponse = (response: LookResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    if (!response.success) {
        items.push({ type: 'error', text: response.message, responseType: 'generic' });
        return items;
    }
    
    if (mode === DisplayMode.TEXT_ONLY) {
        let lookText = response.message + '\n\n';
        lookText += `\n📍 ${response.roomData.name}\n`;
        if (response.roomData.background) {
            lookText += `${response.roomData.background}\n\n`;
        }
        
        if (response.roomData.objects.length > 0) {
            lookText += `\n🔍 Objects in this room:\n`;
            response.roomData.objects.forEach(obj => {
                lookText += `  • ${obj}\n`;
            });
        } else {
            lookText += `\n🔍 No objects visible in this room.\n`;
        }
        
        items.push({ type: 'response', text: lookText.trim(), responseType: 'look' });
    } else {
        items.push({ 
            type: 'response', 
            text: response.message,
            responseType: 'look',
            data: response 
        });
    }
    
    return items;
};

// Display Inspect Response
export const displayInspectResponse = (response: InspectResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    if (!response.success) {
        items.push({ type: 'error', text: response.message, responseType: 'generic' });
        return items;
    }
    
    if (mode === DisplayMode.TEXT_ONLY && response.objectData) {
        let inspectText = response.message + '\n\n';
        inspectText += `\n🔎 ${response.objectData.name}\n`;
        inspectText += `\n📝 ${response.objectData.description}\n`;
        
        if (response.objectData.puzzle) {
            inspectText += `\n🧩 Puzzle: ${response.objectData.puzzle}\n`;
        }
        
        if (response.objectData.unlocked) {
            inspectText += `\n🔓 Status: Unlocked\n`;
            if (response.objectData.answer) {
                inspectText += `\n✅ Answer: ${response.objectData.answer}\n`;
            }
        } else {
            inspectText += `\n🔒 Status: Locked\n`;
        }
        
        if (response.objectData.details && response.objectData.details.length > 0) {
            inspectText += `\n📋 Details:\n`;
            response.objectData.details.forEach(detail => {
                inspectText += `  • ${detail}\n`;
            });
        }
        
        items.push({ type: 'response', text: inspectText.trim(), responseType: 'inspect' });
    } else {
        items.push({ 
            type: 'response', 
            text: response.message,
            responseType: 'inspect',
            data: response 
        });
    }
    
    return items;
};

// Display Guess Response
export const displayGuessResponse = (response: GuessResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    const responseType = response.success ? (response.objectData.correctAnswer ? 'success' : 'response') : 'error';
    
    if (mode === DisplayMode.TEXT_ONLY) {
        let guessText = response.message;
        
        if (response.success && response.objectData.correctAnswer) {
            guessText += `\n\n🎉 Correct! ${response.objectData.name} is now unlocked!`;
        } else if (response.success && !response.objectData.correctAnswer) {
            guessText += `\n\n❌ Incorrect guess for ${response.objectData.name}. Try again!`;
        }
        
        items.push({ type: responseType, text: guessText, responseType: 'guess' });
    } else {
        items.push({ 
            type: responseType, 
            text: response.message,
            responseType: 'guess',
            data: response // Pass the full response object
        });
    }
    
    return items;
};

// Display Password Response
export const displayPasswordResponse = (response: PasswordResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    const responseType = response.success && response.gameResult.escaped ? 'success' : (response.success ? 'response' : 'error');
    
    if (mode === DisplayMode.TEXT_ONLY) {
        let passwordText = response.message;
        
        if (response.gameResult.escaped) {
            passwordText += '\n\n🎊 Congratulations! You escaped!\n';
            
            if (response.gameResult.timeElapsed) {
                passwordText += `\n⏱️  Time: ${response.gameResult.timeElapsed} seconds`;
            }
            
            if (response.gameResult.hintsUsed !== undefined) {
                passwordText += `\n💡 Hints used: ${response.gameResult.hintsUsed}`;
            }
            
            if (response.gameResult.gameCompleted) {
                passwordText += '\n\n🏆 Game completed! Well done!\n';
            }
        }
        
        items.push({ type: responseType, text: passwordText, responseType: 'password' });
    } else {
        items.push({ 
            type: responseType, 
            text: response.message,
            responseType: 'password',
            data: response // Pass the full response object
        });
    }
    
    return items;
};

// Display Hint Response
export const displayHintResponse = (response: HintResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    if (!response.success) {
        items.push({ type: 'error', text: response.message, responseType: 'generic' });
        return items;
    }
    
    if (mode === DisplayMode.TEXT_ONLY) {
        let hintText = `\n💡 Hint: ${response.hintData.hint}`;
        
        if (response.hintData.hintsUsed > 0) {
            hintText += `\n📊 Hints used so far: ${response.hintData.hintsUsed}`;
        }
        
        items.push({ type: 'info', text: hintText, responseType: 'hint' });
    } else {
        items.push({ 
            type: 'info', 
            text: response.message,
            responseType: 'hint',
            data: response // Pass the full response object
        });
    }
    
    return items;
};

// Display New Game Response
export const displayNewGameResponse = (response: NewGameResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    if (!response.success) {
        items.push({ type: 'error', text: response.message, responseType: 'generic' });
        return items;
    }
    
    if (mode === DisplayMode.TEXT_ONLY) {
        let gameText = `\n🎮 ${response.message}\n\n`;
        gameText += `🆔 Game ID: ${response.gameData.id}\n`;
        gameText += `🏠 Room: ${response.gameData.currentRoom}/${response.gameData.totalRooms}\n`;
        gameText += `📦 Objects: ${response.gameData.objectCount}\n`;
        gameText += `🎯 Mode: ${response.gameData.mode}\n`;
        
        if (response.gameData.startTime) {
            gameText += `\n ⏰ Started: ${new Date(response.gameData.startTime).toLocaleTimeString()}\n`;
        }
        
        items.push({ type: 'success', text: gameText.trim(), responseType: 'newgame' });
    } else {
        items.push({ 
            type: 'success', 
            text: response.message,
            responseType: 'newgame',
            data: response // Pass the full response object
        });
    }
    
    return items;
};

// Display Leaderboard Response
export const displayLeaderboardResponse = (response: LeaderboardResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    if (!response.success) {
        items.push({ type: 'error', text: response.message, responseType: 'generic' });
        return items;
    }
    
    if (mode === DisplayMode.TEXT_ONLY) {
        items.push({ type: 'response', text: response.message, responseType: 'leaderboard' });
    } else {
        items.push({ 
            type: 'response', 
            text: response.message,
            responseType: 'leaderboard',
            data: response // Pass the full response object
        });
    }
    
    return items;
};

// Display Auth Response
export const displayAuthResponse = (response: AuthResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    const items: HistoryItem[] = [];
    
    const responseType = response.success ? 'success' : 'error';
    
    if (mode === DisplayMode.TEXT_ONLY) {
        let authText = response.message;
        
        if (response.success && response.userData) {
            authText += `\n👤 Welcome, ${response.userData.userName}!`;
            authText += `\n🆔 User ID: ${response.userData.userId}`;
            
            if (response.userData.apiKey) {
                authText += `\n🔑 API key configured`;
            }
        }
        
        items.push({ type: responseType, text: authText, responseType: 'auth' });
    } else {
        items.push({ 
            type: responseType, 
            text: response.message,
            responseType: 'auth',
            data: response // Pass the full response object
        });
    }
    
    return items;
};

// Generic display function that routes to specific handlers
export const displayResponse = (response: BaseResponse, mode: DisplayMode = DisplayMode.COMPONENT): HistoryItem[] => {
    // Type guards to determine response type
    if ('commands' in response) {
        return displayHelpResponse(response as HelpResponse, mode);
    } else if ('roomData' in response) {
        return displayLookResponse(response as LookResponse, mode);
    } else if ('objectData' in response && 'objectData' in response && typeof (response as any).objectData === 'object' && 'unlocked' in (response as any).objectData) {
        if ('correctAnswer' in (response as any).objectData) {
            return displayGuessResponse(response as GuessResponse, mode);
        } else {
            return displayInspectResponse(response as InspectResponse, mode);
        }
    } else if ('gameResult' in response) {
        return displayPasswordResponse(response as PasswordResponse, mode);
    } else if ('hintData' in response) {
        return displayHintResponse(response as HintResponse, mode);
    } else if ('gameData' in response) {
        return displayNewGameResponse(response as NewGameResponse, mode);
    } else if ('leaderboardData' in response) {
        return displayLeaderboardResponse(response as LeaderboardResponse, mode);
    } else if ('userData' in response || response.message.includes('login') || response.message.includes('logout')) {
        return displayAuthResponse(response as AuthResponse, mode);
    } else {
        // Fallback for basic responses
        return [{ 
            type: response.success ? 'response' : 'error', 
            text: response.message,
            responseType: 'generic'
        }];
    }
}; 

// For response items, handle multi-line content with better formatting and colors
export const getColorForResponseType = (type: string) => {
    switch (type) {
        case 'error': return 'red';
        case 'success': return 'green';
        case 'info': return 'cyan';
        case 'response': return 'white';
        default: return 'white';
    }
};