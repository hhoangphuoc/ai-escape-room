// backend/api/auth/authController.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// In-memory user store (replace with DB in production)
// This should be shared or passed to the controller, or use a proper service layer
// For now, let's define it here for simplicity, but it might need to be moved or managed centrally
interface User {
  id: string;
  name: string;
  email?: string;
  apiKeys?: {
    [key: string]: string | undefined; // Allows for different providers
    anthropic?: string;
    openai?: string;
  };
  registeredAt: string;
  // Add passwordHash if you implement password-based login
  passwordHash?: string; 
}

export const users: Record<string, User> = {}; // Export for now, ideally manage via a service

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret'; // Ensure this is consistent
const JWT_EXPIRES_IN = '24h';

// Register a new user
export function register(req: Request, res: Response): void {
  const { name, email, apiKey, provider = 'openai' } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  // Optional: Check if user already exists by email or name if they should be unique
  // For example: if (Object.values(users).some(u => u.email === email)) { ... }

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

  // Sign a token upon successful registration
  const payload = { sub: userId, name: name }; // 'sub' is standard for subject (user ID)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  console.log(`API: User registered: ${name} (${userId})`);
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
export function login(req: Request, res: Response): void {
    const { userId } = req.body; // Assuming login by existing userId for simplicity

    if (!userId) {
        res.status(400).json({ error: 'userId is required for login.' });
        return;
    }

    const user = users[userId];
    if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
    }

    // If implementing password-based login, you'd check username and password here:
    // const { username, password } = req.body;
    // if (username !== mockUser.username || !bcrypt.compareSync(password, mockUser.passwordHash)) {
    //   return res.status(401).json({ message: 'Invalid credentials' });
    // }

    const payload = { sub: user.id, name: user.name }; // 'sub' for subject (user ID)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`API: User logged in: ${user.name} (${user.id})`);
    res.json({ 
        message: 'Login successful', 
        userId: user.id, 
        name: user.name, 
        email: user.email, 
        token 
    });
}

// Example of fetching user data - adapt as needed
// AuthRequest should be imported from jwtMiddleware
import { AuthRequest } from './jwtMiddleware'; 

export async function getUserProfile(req: AuthRequest, res: Response): Promise<void> {
    // req.user is populated by jwtAuth middleware
    // The type of req.user depends on your JWT payload structure
    const jwtPayload = req.user as { sub: string; name: string }; 
    const userIdFromToken = jwtPayload.sub;

    const user = users[userIdFromToken];
    if (!user) {
        // This case should ideally not happen if token is valid and user exists
        res.status(404).json({ error: 'User not found based on token.'});
        return;
    }

    // Exclude sensitive information like apiKeys or passwordHash
    const { apiKeys, passwordHash, ...userData } = user;
    res.json(userData);
} 