# Firebase Setup Guide

This guide explains how to set up Firebase for the AI Escape Room project.

## Prerequisites

1. A Google/Firebase account
2. A Firebase project created at [Firebase Console](https://console.firebase.google.com)

## Setup Steps

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Enter a project name (e.g., "ai-escape-room")
4. Follow the setup wizard

### 2. Enable Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode"
4. Select a location closest to your users

### 3. Generate Service Account Credentials

1. Go to Project Settings (gear icon) > Service accounts
2. Click "Generate new private key"
3. Save the downloaded JSON file securely

### 4. Configure Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# JWT Configuration
JWT_SECRET=your-very-secure-secret-key-here

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-firebase-private-key-here\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

You can find these values in the service account JSON file:
- `FIREBASE_PROJECT_ID`: The "project_id" field
- `FIREBASE_CLIENT_EMAIL`: The "client_email" field
- `FIREBASE_PRIVATE_KEY`: The "private_key" field (keep the quotes and newlines)
- `FIREBASE_DATABASE_URL`: Usually `https://[project-id].firebaseio.com`

### 5. Firestore Security Rules

For production, update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - only authenticated servers can read/write
    match /users/{userId} {
      allow read, write: if false; // Only server-side access via Admin SDK
    }
    
    // Leaderboard collection - public read, server write only
    match /leaderboard/{document} {
      allow read: if true;
      allow write: if false; // Only server-side access via Admin SDK
    }
  }
}
```

## Data Structure

### Users Collection
```json
{
  "id": "uuid",
  "name": "Player Name",
  "email": "player@example.com",
  "hashedApiKeys": {
    "openai": "hashed-api-key"
  },
  "registeredAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Leaderboard Collection
```json
{
  "userId": "uuid",
  "userName": "Player Name",
  "gameId": "game-uuid",
  "gameMode": "single-custom",
  "timeElapsed": 300,
  "hintsUsed": 2,
  "submittedAt": "2024-01-01T00:00:00Z",
  "timestamp": "server-timestamp"
}
```

## Testing Firebase Integration

1. Start the backend server with Firebase credentials configured
2. Register a new user - check Firebase Console to see if user data is saved
3. Complete a game and check if scores appear in the leaderboard collection

## Troubleshooting

- **Firebase not initialized**: Check that all environment variables are set correctly
- **Permission denied**: Ensure your service account has the necessary permissions
- **Network errors**: Check your Firebase project settings and database URL 