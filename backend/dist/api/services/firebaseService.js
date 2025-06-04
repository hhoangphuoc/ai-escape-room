"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameLeaderboard = exports.updateGameCompletion = exports.saveGameToFirebase = exports.getUserBestScores = exports.getLeaderboard = exports.saveScoreToLeaderboard = exports.emailExistsInFirebase = exports.getUserFromFirebase = exports.saveUserToFirebase = void 0;
const admin = __importStar(require("firebase-admin"));
const bcrypt = __importStar(require("bcrypt"));
// Initialize Firebase Admin SDK
// You'll need to set up Firebase service account credentials
// Either through environment variables or a service account key file
const initializeFirebase = () => {
    try {
        // Option 1: Using service account key file (download from Firebase Console)
        // const serviceAccount = require('./path-to-service-account-key.json');
        // admin.initializeApp({
        //     credential: admin.credential.cert(serviceAccount),
        //     databaseURL: process.env.FIREBASE_DATABASE_URL
        // });
        // Option 2: Using environment variables
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        };
        if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            console.warn('Firebase credentials not found in environment variables. Firebase features will be disabled.');
            return false;
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        console.log('Firebase Admin SDK initialized successfully');
        return true;
    }
    catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
};
const firebaseInitialized = initializeFirebase();
const db = firebaseInitialized ? admin.firestore() : null;
// User collection reference
const usersCollection = db?.collection('users');
const leaderboardCollection = db?.collection('leaderboard');
const gamesCollection = db?.collection('games');
// Hash API key before storing (for security)
const hashApiKey = (apiKey) => {
    return bcrypt.hashSync(apiKey, 10);
};
// Save user to Firebase
const saveUserToFirebase = async (user) => {
    if (!usersCollection) {
        console.warn('Firebase not initialized. User data not saved to cloud.');
        return false;
    }
    try {
        // Create a copy of user data for Firebase
        const firebaseUser = { ...user };
        // Hash API keys before storing
        if (user.apiKeys) {
            firebaseUser.hashedApiKeys = {};
            delete firebaseUser.apiKeys; // Remove plain text API keys
            for (const [provider, apiKey] of Object.entries(user.apiKeys)) {
                if (apiKey) {
                    firebaseUser.hashedApiKeys[provider] = hashApiKey(apiKey);
                }
            }
        }
        // Save to Firebase
        await usersCollection.doc(user.id).set({
            ...firebaseUser,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`User ${user.id} saved to Firebase successfully`);
        return true;
    }
    catch (error) {
        console.error('Error saving user to Firebase:', error);
        return false;
    }
};
exports.saveUserToFirebase = saveUserToFirebase;
// Get user from Firebase
const getUserFromFirebase = async (userId) => {
    if (!usersCollection) {
        return null;
    }
    try {
        const doc = await usersCollection.doc(userId).get();
        if (!doc.exists) {
            return null;
        }
        const data = doc.data();
        // Note: We don't return API keys from Firebase for security
        // API keys should be managed locally or through secure key management
        const { hashedApiKeys, ...userData } = data;
        return userData;
    }
    catch (error) {
        console.error('Error getting user from Firebase:', error);
        return null;
    }
};
exports.getUserFromFirebase = getUserFromFirebase;
// Check if email already exists
const emailExistsInFirebase = async (email) => {
    if (!usersCollection || !email) {
        console.log('Firebase not initialized or empty email provided');
        return false;
    }
    try {
        console.log(`Firebase: Starting email existence check for: ${email}`);
        // Add a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firebase email check timeout')), 10000); // 10 second timeout
        });
        const queryPromise = usersCollection.where('email', '==', email).limit(1).get();
        const snapshot = await Promise.race([queryPromise, timeoutPromise]);
        const exists = !snapshot.empty;
        console.log(`Firebase: Email existence check completed. Email ${email} exists: ${exists}`);
        return exists;
    }
    catch (error) {
        console.error('Error checking email existence:', error);
        // If Firebase is unreachable or has issues, we should allow registration to continue
        // rather than blocking users. Log the error but return false to not block registration.
        if (error instanceof Error) {
            console.error(`Firebase error details: ${error.message}`);
        }
        console.log('Returning false to allow registration to continue despite Firebase error');
        return false;
    }
};
exports.emailExistsInFirebase = emailExistsInFirebase;
// Save score to leaderboard
const saveScoreToLeaderboard = async (entry) => {
    if (!leaderboardCollection) {
        console.warn('Firebase not initialized. Score not saved to leaderboard.');
        return false;
    }
    try {
        await leaderboardCollection.add({
            ...entry,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Score for user ${entry.userId} saved to leaderboard`);
        return true;
    }
    catch (error) {
        console.error('Error saving score to leaderboard:', error);
        return false;
    }
};
exports.saveScoreToLeaderboard = saveScoreToLeaderboard;
// Get leaderboard (top scores)
const getLeaderboard = async (gameMode, limit = 10) => {
    if (!leaderboardCollection) {
        return [];
    }
    try {
        let query = leaderboardCollection
            .orderBy('timeElapsed', 'asc')
            .limit(limit);
        if (gameMode && gameMode !== 'all') {
            query = query.where('gameMode', '==', gameMode);
        }
        const snapshot = await query.get();
        const entries = [];
        let index = 0;
        snapshot.forEach((doc) => {
            const data = doc.data();
            entries.push({
                userId: data.userId,
                userName: data.userName,
                gameId: data.gameId,
                gameMode: data.gameMode,
                timeElapsed: data.timeElapsed,
                hintsUsed: data.hintsUsed,
                submittedAt: data.submittedAt,
                rank: index + 1
            });
            index++;
        });
        return entries;
    }
    catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
};
exports.getLeaderboard = getLeaderboard;
// Get user's best scores
const getUserBestScores = async (userId, limit = 5) => {
    if (!leaderboardCollection) {
        return [];
    }
    try {
        const snapshot = await leaderboardCollection
            .where('userId', '==', userId)
            .orderBy('timeElapsed', 'asc')
            .limit(limit)
            .get();
        const entries = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            entries.push({
                userId: data.userId,
                userName: data.userName,
                gameId: data.gameId,
                gameMode: data.gameMode,
                timeElapsed: data.timeElapsed,
                hintsUsed: data.hintsUsed,
                submittedAt: data.submittedAt
            });
        });
        return entries;
    }
    catch (error) {
        console.error('Error fetching user best scores:', error);
        return [];
    }
};
exports.getUserBestScores = getUserBestScores;
// Game data interface for Firebase storage
// Save game data to Firebase
const saveGameToFirebase = async (gameData) => {
    if (!gamesCollection) {
        console.warn('Firebase not initialized. Game data not saved to cloud.');
        return false;
    }
    try {
        await gamesCollection.doc(gameData.gameId).set({
            ...gameData,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Game ${gameData.gameId} saved to Firebase successfully`);
        return true;
    }
    catch (error) {
        console.error('Error saving game to Firebase:', error);
        return false;
    }
};
exports.saveGameToFirebase = saveGameToFirebase;
// Update game completion data
const updateGameCompletion = async (gameId, timeElapsed, hintsUsed) => {
    if (!gamesCollection) {
        console.warn('Firebase not initialized. Game completion not updated.');
        return false;
    }
    try {
        await gamesCollection.doc(gameId).update({
            endTime: new Date().toISOString(),
            completed: true,
            timeElapsed,
            hintsUsed,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Game ${gameId} completion updated in Firebase`);
        return true;
    }
    catch (error) {
        console.error('Error updating game completion:', error);
        return false;
    }
};
exports.updateGameCompletion = updateGameCompletion;
// Get leaderboard from games collection (top 10 fastest completed games)
const getGameLeaderboard = async (gameMode, limit = 10) => {
    if (!gamesCollection || !usersCollection) {
        return [];
    }
    try {
        let query = gamesCollection
            .where('completed', '==', true)
            .orderBy('timeElapsed', 'asc')
            .limit(limit);
        if (gameMode && gameMode !== 'all') {
            query = query.where('gameMode', '==', gameMode);
        }
        const snapshot = await query.get();
        const entries = [];
        // Get user data for each game entry
        for (let i = 0; i < snapshot.docs.length; i++) {
            const doc = snapshot.docs[i];
            const gameData = doc.data();
            // Get username from users collection
            let userName = 'Unknown User';
            try {
                const userDoc = await usersCollection.doc(gameData.userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    userName = userData?.name || userName;
                }
            }
            catch (error) {
                console.error(`Error fetching user data for userId ${gameData.userId}:`, error);
            }
            entries.push({
                userId: gameData.userId,
                userName: userName,
                gameId: gameData.gameId,
                gameMode: gameData.gameMode,
                timeElapsed: gameData.timeElapsed,
                hintsUsed: gameData.hintsUsed || 0,
                submittedAt: gameData.endTime || gameData.createdAt,
                rank: i + 1
            });
        }
        return entries;
    }
    catch (error) {
        console.error('Error fetching game leaderboard:', error);
        return [];
    }
};
exports.getGameLeaderboard = getGameLeaderboard;
exports.default = {
    saveUserToFirebase: exports.saveUserToFirebase,
    getUserFromFirebase: exports.getUserFromFirebase,
    emailExistsInFirebase: exports.emailExistsInFirebase,
    saveScoreToLeaderboard: exports.saveScoreToLeaderboard,
    getLeaderboard: exports.getLeaderboard,
    getUserBestScores: exports.getUserBestScores,
    saveGameToFirebase: exports.saveGameToFirebase,
    updateGameCompletion: exports.updateGameCompletion,
    getGameLeaderboard: exports.getGameLeaderboard
};
//# sourceMappingURL=firebaseService.js.map