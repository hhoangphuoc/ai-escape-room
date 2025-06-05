import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { 
    HelpResponse, 
    LookResponse, 
    InspectResponse, 
    GuessResponse, 
    PasswordResponse, 
    HintResponse, 
    NewGameResponse, 
    LeaderboardResponse,
    AuthResponse 
} from '../utils/responseTypes.js';

// Help Response Component
export const HelpResponseComponent: React.FC<{ response: HelpResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="cyan" paddingX={1}>
        <Gradient name="rainbow">
            <Text bold>🎮 Available Commands</Text>
        </Gradient>
        <Box flexDirection="column" marginTop={1}>
            {response.commands.map((cmd, index) => (
                <Box key={index} marginY={0}>
                    <Text color="cyan" bold>{cmd.command}</Text>
                    <Text color="white"> - {cmd.description}</Text>
                </Box>
            ))}
        </Box>
        {response.currentContext && (
            <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                <Text color="yellow" bold>📊 Current Status</Text>
                {response.currentContext.isAuthenticated ? (
                    <>
                        <Text color="green">✓ Authenticated</Text>
                        {response.currentContext.currentRoom && (
                            <Text color="blue">🏠 Room: {response.currentContext.currentRoom}</Text>
                        )}
                        {response.currentContext.gameMode && (
                            <Text color="magenta">🎮 Mode: {response.currentContext.gameMode}</Text>
                        )}
                    </>
                ) : (
                    <Text color="red">✗ Not authenticated</Text>
                )}
                {response.currentContext.hasAI && (
                    <Text color="purple">🤖 AI: {response.currentContext.currentModel || 'Available'}</Text>
                )}
            </Box>
        )}
    </Box>
);

// Look Response Component
export const LookResponseComponent: React.FC<{ response: LookResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="cyan" paddingX={1}>
        <Gradient name="vice">
            <Text bold>📍 {response.roomData.name}</Text>
        </Gradient>
        {response.roomData.background && (
            <Box marginTop={1}>
                <Text color="gray" wrap="wrap">{response.roomData.background}</Text>
            </Box>
        )}
        <Text color="magenta" bold>🔍 Objects found:</Text>
        <Box flexDirection="column" marginTop={1} rowGap={1}>
            {response.roomData.objects.length > 0 ? (
                response.roomData.objects.map((obj, index) => (
                    <Box key={index} marginLeft={2}>
                        <Text color="gray">• {obj}</Text>
                    </Box>
                ))
            ) : (
                <Box marginLeft={2}>
                    <Text color="gray" italic>No objects visible in this room.</Text>
                </Box>
            )}
        </Box>
    </Box>
);

// Inspect Response Component
export const InspectResponseComponent: React.FC<{ response: InspectResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="cyan" paddingX={1}>
        {response.objectData && (
            <>
                <Gradient name="fruit">
                    <Text bold>🔎 {response.objectData.name}</Text>
                </Gradient>
                <Box marginTop={1}>
                    <Text color="white" wrap="wrap">📝 {response.objectData.description}</Text>
                </Box>
                {/* {response.objectData.puzzle && (
                    <Box marginTop={1} borderStyle="single" borderColor="orange" paddingX={1}>
                        <Text color="orange" bold>🧩 Puzzle: </Text>
                        <Text color="yellow" wrap="wrap">{response.objectData.puzzle}</Text>
                    </Box>
                )} */}
                <Box marginTop={1} flexDirection="row" alignItems="center">
                    <Text color={response.objectData.unlocked ? "green" : "red"} bold>
                        {response.objectData.unlocked ? "🔓 Status: Unlocked" : "🔒 Status: Locked"}
                    </Text>
                </Box>
                {response.objectData.unlocked && response.objectData.answer && (
                    <Box marginTop={1}>
                        <Text color="green">✅ Answer: {response.objectData.answer}</Text>
                    </Box>
                )}
                {response.objectData.details && response.objectData.details.length > 0 && (
                    <Box marginTop={1}>
                        <Text color="cyan" bold>📋 Details:</Text>
                        {response.objectData.details.map((detail, index) => (
                            <Box key={index} marginLeft={2}>
                                <Text color="gray">• {detail}</Text>
                            </Box>
                        ))}
                    </Box>
                )}
            </>
        )}
    </Box>
);

// Guess Response Component
export const GuessResponseComponent: React.FC<{ response: GuessResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor={response.success && response.objectData.correctAnswer ? "green" : "red"} paddingX={1}>
        {response.success && response.objectData.correctAnswer ? (
            <Gradient name="summer">
                <Text bold>🎉 Correct Answer!</Text>
            </Gradient>
        ) : (
            <Text color="red" bold>❌ Incorrect Guess</Text>
        )}
        <Box marginTop={1}>
            <Text color="white">{response.message}</Text>
        </Box>
        <Box marginTop={1}>
            <Text color="cyan">🎯 Object: {response.objectData.name}</Text>
            {response.success && response.objectData.correctAnswer && (
                <Text color="green">🔓 The object is now unlocked!</Text>
            )}
        </Box>
    </Box>
);

// Password Response Component
export const PasswordResponseComponent: React.FC<{ response: PasswordResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor={response.gameResult.escaped ? "green" : "red"} paddingX={1}>
        {response.gameResult.escaped ? (
            <>
                <Gradient name="summer">
                    <Text bold>🎊 Congratulations! You Escaped!</Text>
                </Gradient>
                <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="green" paddingX={1} rowGap={0.25}>
                    <Text color="yellow" bold>🏆 Escape Summary</Text>
                    {response.gameResult.timeElapsed && (
                        <Text color="cyan">⏱️  Time: {response.gameResult.timeElapsed} seconds</Text>
                    )}
                    {response.gameResult.hintsUsed !== undefined && (
                        <Text color="yellow">💡 Hints used: {response.gameResult.hintsUsed}</Text>
                    )}
                    {response.gameResult.gameCompleted && (
                        <Text color="green" bold>🎮 Game completed! Well done!</Text>
                    )}
                </Box>
            </>
        ) : (
            <>
                <Text color="red" bold>❌ Password Incorrect</Text>
                <Box marginTop={1}>
                    <Text color="white">{response.message}</Text>
                </Box>
            </>
        )}
    </Box>
);

// Hint Response Component
export const HintResponseComponent: React.FC<{ response: HintResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="cyan" paddingX={1} rowGap={0.25}>
        <Text color="cyan" bold>💡 Hint</Text>
        <Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1}>
            <Text color="yellow" wrap="wrap">{response.hintData.hint}</Text>
        </Box>
        {response.hintData.hintsUsed > 0 && (
            <Box marginTop={1}>
                <Text color="gray">📊 Hints used so far: {response.hintData.hintsUsed}</Text>
            </Box>
        )}
    </Box>
);

// New Game Response Component
export const NewGameResponseComponent: React.FC<{ response: NewGameResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="cyan" paddingX={1} rowGap={0.5}>
        <Text color="gray" bold> New Game Created!</Text>
        <Gradient name="vice">
            <Text bold>🎮 {response.gameData.name}</Text>
        </Gradient>
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="green" paddingX={1} rowGap={0.25}>
            {/* <Text color="white" bold>🎯 Game Details</Text> */}
            <Text color="cyan">🆔 Game ID: {response.gameData.id}</Text>
            <Text color="blue">🏠 Room: {response.gameData.currentRoom}/{response.gameData.totalRooms}</Text>
            <Text color="yellow">📦 Objects: {response.gameData.objectCount}</Text>
            <Text color="magenta">🎯 Mode: {response.gameData.mode}</Text>
            {response.gameData.startTime && (
                <Text color="gray">⏰ Started: {new Date(response.gameData.startTime).toLocaleTimeString()}</Text>
            )}

        </Box>
        <Box marginTop={1}>
            <Text color="gray" wrap="wrap">{response.gameData.background}</Text>
        </Box>
    </Box>
);

// Leaderboard Response Component
export const LeaderboardResponseComponent: React.FC<{ response: LeaderboardResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="yellow" paddingX={1}>
        <Gradient name="teen">
            <Text bold>🏆 Leaderboard</Text>
        </Gradient>
        <Box marginTop={1}>
            <Text color="white" wrap="wrap">{response.message}</Text>
        </Box>
    </Box>
);

// Auth Response Component
export const AuthResponseComponent: React.FC<{ response: AuthResponse }> = ({ response }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor={response.success ? "green" : "red"} paddingX={1}>
        {response.success ? (
            <>
                <Gradient name="morning">
                    <Text bold>🔐 Authentication Successful</Text>
                </Gradient>
                {response.userData && (
                    <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="green" paddingX={1}>
                        <Text color="green">👤 Welcome, {response.userData.userName}!</Text>
                        <Text color="cyan">🆔 User ID: {response.userData.userId}</Text>
                        {response.userData.apiKey && (
                            <Text color="purple">🔑 API key configured</Text>
                        )}
                    </Box>
                )}
            </>
        ) : (
            <>
                <Text color="red" bold>❌ Authentication Failed</Text>
                <Box marginTop={1}>
                    <Text color="red">{response.message}</Text>
                </Box>
            </>
        )}
    </Box>
);

// Error Response Component
export const ErrorResponseComponent: React.FC<{ message: string }> = ({ message }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="red" paddingX={1}>
        <Text color="red" bold>❌ Error</Text>
        <Box marginTop={1}>
            <Text color="red" wrap="wrap">{message}</Text>
        </Box>
    </Box>
);

// Success Response Component
export const SuccessResponseComponent: React.FC<{ message: string }> = ({ message }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="green" paddingX={1}>
        <Text color="green" bold>✅ Success</Text>
        <Box marginTop={1}>
            <Text color="green" wrap="wrap">{message}</Text>
        </Box>
    </Box>
);

// Info Response Component
export const InfoResponseComponent: React.FC<{ message: string }> = ({ message }) => (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>ℹ️  Information</Text>
        <Box marginTop={1}>
            <Text color="cyan" wrap="wrap">{message}</Text>
        </Box>
    </Box>
);

// Generic Response Component
export const GenericResponseComponent: React.FC<{ message: string }> = ({ message }) => (
    <Box flexDirection="column" marginY={1} paddingX={1}>
        <Text color="white" wrap="wrap">{message}</Text>
    </Box>
); 