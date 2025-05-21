"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/api/routes/userRoutes.ts
const express_1 = require("express");
const authController_1 = require("../auth/authController");
const jwtMiddleware_1 = require("../auth/jwtMiddleware");
const authController_2 = require("../auth/authController"); // Temporary for get-api-key
const router = (0, express_1.Router)();
// Public routes
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
// Protected routes (require JWT)
router.get('/me', jwtMiddleware_1.jwtAuth, async (req, res) => {
    await (0, authController_1.getUserProfile)(req, res);
});
// This endpoint seems to be for retrieving an API key based on a userId passed in the body.
// It doesn't seem to fit the standard "get my own API key" pattern which would use the token.
// Keeping its existing logic for now, but consider if this needs to be authenticated via JWT
// or if it's an admin-like operation.
router.post('/get-api-key', (req, res) => {
    const { userId, provider = 'openai' } = req.body;
    if (!userId || !authController_2.users[userId]) {
        res.status(401).json({ error: 'User not found' });
        return;
    }
    const user = authController_2.users[userId];
    const apiKeyVal = user.apiKeys?.[provider];
    if (!apiKeyVal) {
        res.status(404).json({ error: `No API key found for provider: ${provider}` });
        return;
    }
    console.log(`API: API key retrieved for user: ${user.name} (${userId}), provider: ${provider}`);
    res.json({ apiKey: apiKeyVal, provider });
});
// Authenticate user by JWT (essentially validates the token)
router.post('/auth', jwtMiddleware_1.jwtAuth, (req, res) => {
    const jwtPayload = req.user;
    const userFromToken = authController_2.users[jwtPayload.sub];
    if (!userFromToken) {
        res.status(404).json({ error: 'Authenticated user (from token) not found in system' });
        return;
    }
    const { apiKeys, passwordHash, ...userData } = userFromToken;
    console.log(`API: User authenticated: ${userData.name} (${jwtPayload.sub})`);
    res.json({ authenticated: true, user: userData });
});
// Test POST route - can be public or protected based on needs
router.post('/test-post', (req, res) => {
    console.log("API: Accessed /users/test-post successfully!", { body: req.body });
    res.status(200).json({ message: 'POST test to /users/test-post successful', receivedBody: req.body });
});
exports.default = router;
//# sourceMappingURL=userRoutes.js.map