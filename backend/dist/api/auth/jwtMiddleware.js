"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret';
const jwtAuth = (req, res, next) => {
    console.log('[jwtAuth] EXECUTION STARTED');
    console.log('[jwtAuth] Middleware invoked for path:', req.path, 'originalUrl:', req.originalUrl);
    const authReq = req;
    const authHeader = authReq.headers.authorization;
    console.log('[jwtAuth] Authorization header:', authHeader);
    if (!authHeader?.startsWith('Bearer ')) {
        console.log('[jwtAuth] Failed: Missing or malformed Bearer token.');
        res.status(401).json({ message: 'Unauthorized: Missing or malformed Bearer token' });
        return;
    }
    const token = authHeader.slice(7);
    console.log('[jwtAuth] Extracted token:', token);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        console.log('[jwtAuth] Token verified successfully. Decoded payload:', decoded);
        authReq.user = decoded;
        next();
    }
    catch (err) {
        console.error('[jwtAuth] Token verification failed:', err.name, err.message);
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({ message: 'Unauthorized: Token expired', errorName: err.name });
        }
        else if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({ message: 'Unauthorized: Invalid token', errorName: err.name });
        }
        else {
            res.status(401).json({ message: 'Unauthorized: Token verification failed', errorName: err.name });
        }
    }
};
exports.jwtAuth = jwtAuth;
//# sourceMappingURL=jwtMiddleware.js.map