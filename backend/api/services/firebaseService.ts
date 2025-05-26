import * as admin from 'firebase-admin';
import { User } from '../auth/authController';
import * as bcrypt from 'bcrypt';

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
            credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });

        console.log('Firebase Admin SDK initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
};

const firebaseInitialized = initializeFirebase();
const db = firebaseInitialized ? admin.firestore() : null;

// User collection reference
const usersCollection = db?.collection('users');
const leaderboardCollection = db?.collection('leaderboard');

// Hash API key before storing (for security)
const hashApiKey = (apiKey: string): string => {
    return bcrypt.hashSync(apiKey, 10);
};

// Firebase User Interface (extends the basic User interface)
interface FirebaseUser extends User {
    hashedApiKeys?: {
        [key: string]: string;
    };
}

// Save user to Firebase
export const saveUserToFirebase = async (user: User): Promise<boolean> => {
    if (!usersCollection) {
        console.warn('Firebase not initialized. User data not saved to cloud.');
        return false;
    }

    try {
        // Create a copy of user data for Firebase
        const firebaseUser: FirebaseUser = { ...user };
        
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
    } catch (error) {
        console.error('Error saving user to Firebase:', error);
        return false;
    }
};

// Get user from Firebase
export const getUserFromFirebase = async (userId: string): Promise<User | null> => {
    if (!usersCollection) {
        return null;
    }

    try {
        const doc = await usersCollection.doc(userId).get();
        if (!doc.exists) {
            return null;
        }

        const data = doc.data() as FirebaseUser;
        // Note: We don't return API keys from Firebase for security
        // API keys should be managed locally or through secure key management
        const { hashedApiKeys, ...userData } = data;
        return userData as User;
    } catch (error) {
        console.error('Error getting user from Firebase:', error);
        return null;
    }
};

// Check if email already exists
export const emailExistsInFirebase = async (email: string): Promise<boolean> => {
    if (!usersCollection || !email) {
        return false;
    }

    try {
        const snapshot = await usersCollection.where('email', '==', email).limit(1).get();
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking email existence:', error);
        return false;
    }
};

// Leaderboard functions
export interface LeaderboardEntry {
    userId: string;
    userName: string;
    gameId: string;
    gameMode: string;
    timeElapsed: number; // in seconds
    hintsUsed: number;
    submittedAt: string;
    rank?: number;
}

// Save score to leaderboard
export const saveScoreToLeaderboard = async (entry: LeaderboardEntry): Promise<boolean> => {
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
    } catch (error) {
        console.error('Error saving score to leaderboard:', error);
        return false;
    }
};

// Get leaderboard (top scores)
export const getLeaderboard = async (
    gameMode?: string, 
    limit: number = 10
): Promise<LeaderboardEntry[]> => {
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
        const entries: LeaderboardEntry[] = [];
        
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
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
};

// Get user's best scores
export const getUserBestScores = async (userId: string, limit: number = 5): Promise<LeaderboardEntry[]> => {
    if (!leaderboardCollection) {
        return [];
    }

    try {
        const snapshot = await leaderboardCollection
            .where('userId', '==', userId)
            .orderBy('timeElapsed', 'asc')
            .limit(limit)
            .get();

        const entries: LeaderboardEntry[] = [];
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
    } catch (error) {
        console.error('Error fetching user best scores:', error);
        return [];
    }
};

export default {
    saveUserToFirebase,
    getUserFromFirebase,
    emailExistsInFirebase,
    saveScoreToLeaderboard,
    getLeaderboard,
    getUserBestScores
}; 