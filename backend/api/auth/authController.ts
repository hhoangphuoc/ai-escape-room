// backend/api/auth/authController.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { saveUserToFirebase, emailExistsInFirebase, getUserFromFirebase } from '../services/firebaseService';

// In-memory user store (replace with DB in production)
// This should be shared or passed to the controller, or use a proper service layer
// For now, let's define it here for simplicity, but it might need to be moved or managed centrally
export interface User {
  id: string;
  name: string;
  email?: string;
  apiKeys?: {
    [key: string]: string | undefined; // Allows for different providers
    anthropic?: string;
    openai?: string;
  };
  registeredAt: string;
  passwordHash?: string; //TODO: Implement password-based login
}

export const users: Record<string, User> = {}; // Export for now, ideally manage via a service

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret'; // Ensure this is consistent
const JWT_EXPIRES_IN = '24h';

// Register a new user
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, apiKey, provider = 'openai' } = req.body;
  console.log(`API: Registration attempt - name: ${name}, email: ${email}, provider: ${provider}`);
  
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  // Check if email already exists in Firebase
  if (email) {
    try {
      console.log(`API: Checking if email exists in Firebase: ${email}`);
      const emailExists = await emailExistsInFirebase(email);
      console.log(`API: Email check result: ${emailExists}`);
      
      if (emailExists) {
        console.log(`API: Email ${email} already registered - returning 409`);
        res.status(409).json({ error: 'Email already registered' });
        return;
      }
    } catch (firebaseError) {
      console.error('API: Firebase email check failed:', firebaseError);
      // Continue with registration if Firebase check fails
      console.log('API: Continuing with registration despite Firebase check failure');
    }
  }

  //-----------------------------------------------------------------------
  // CREATE NEW USER
  //-----------------------------------------------------------------------
  const userId = uuidv4();
  const newUser: User = {
    id: userId,
    name,
    email,
    apiKeys: apiKey ? { [provider]: apiKey } : undefined,
    registeredAt: new Date().toISOString(),
    // If using passwords, hash it here: passwordHash: bcrypt.hashSync(password, 10)
  };
  users[userId] = newUser;

  // Save to Firebase asynchronously with error handling
  saveUserToFirebase(newUser).catch(error => {
    console.error('Failed to save user to Firebase:', error);
    // Don't fail the registration if Firebase save fails
  });

  // Sign a token upon successful registration
  const payload = { sub: userId, name: name }; // 'sub' is standard for subject (user ID)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  console.log(`API: User registered successfully: ${name} (${userId})`);
  res.status(201).json({ 
    message: 'User registered successfully', 
    userId,
    name: newUser.name,
    email: newUser.email,
    token 
  });
}

// Login a user (current implementation is more like a token refresh or get user)
// Modify this if you implement password-based login as in the example
export async function login(req: Request, res: Response): Promise<void> {
    const { userId, apiKey, provider = 'openai' } = req.body; // Accept API key during login

    console.log('=== BACKEND: Login request received ===');
    console.log('UserId:', userId);
    console.log('API Key provided:', !!apiKey);
    console.log('Provider:', provider);

    if (!userId) {
        res.status(400).json({ error: 'userId is required for login.' });
        return;
    }

    //-----------------------------------------------------------------------
    // GET USER FROM FIREBASE AND POPULATE IN-MEMORY STORE
    //-----------------------------------------------------------------------
    const user = await getUserFromFirebase(userId);

    if (!user) {
        res.status(404).json({ error: 'User not found. Please register instead.' });
        return;
    }

    // CRITICAL FIX: Populate the in-memory users object for game routes
    // This ensures that game routes can find the user after login
    // Also restore API key if provided by CLI
    // Note: Firebase doesn't return API keys for security, so we need to restore them from the login request
    const userWithApiKey: User = {
        ...user,
        apiKeys: apiKey ? { [provider]: apiKey } : undefined // Don't use user.apiKeys since Firebase doesn't return them
    };
    users[userId] = userWithApiKey;

    // If implementing password-based login, you'd check username and password here:
    // const { username, password } = req.body;
    // if (username !== mockUser.username || !bcrypt.compareSync(password, mockUser.passwordHash)) {
    //   return res.status(401).json({ message: 'Invalid credentials' });
    // }

    const payload = { sub: user.id, name: user.name }; // 'sub' for subject (user ID)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`API: User logged in: ${user.name} (${user.id}) - Added to in-memory store`);
    console.log(`API: User API keys after login:`, userWithApiKey.apiKeys);
    res.json({ 
        message: 'Login successful', 
        userId: user.id, 
        name: user.name, 
        email: user.email, 
        token 
    });
}


// AuthRequest should be imported from jwtMiddleware
import { AuthRequest } from './jwtMiddleware'; 

// /me endpoint
export async function getUserProfile(req: AuthRequest, res: Response): Promise<void> {
    // req.user is populated by jwtAuth middleware
    // The type of req.user depends on your JWT payload structure
    const jwtPayload = req.user as { sub: string; name: string }; 
    const userIdFromToken = jwtPayload.sub;

    // const user = users[userIdFromToken];

    const user = await getUserFromFirebase(userIdFromToken);

    if (!user) {
        // This case should ideally not happen if token is valid and user exists
        res.status(404).json({ error: 'User not found based on token.'});
        return;
    }

    // Exclude sensitive information like apiKeys or passwordHash
    const { apiKeys, passwordHash, ...userData } = user;
    res.json(userData);
} 