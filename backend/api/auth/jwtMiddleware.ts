// backend/api/auth/jwtMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret'; 

export interface UserJwtPayload extends JwtPayload {
  sub: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: UserJwtPayload;
}

export const jwtAuth = (req: Request, res: Response, next: NextFunction): void => {
  console.log('[jwtAuth] EXECUTION STARTED');
  console.log('[jwtAuth] Middleware invoked for path:', req.path, 'originalUrl:', req.originalUrl);
  const authReq = req as AuthRequest;
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
    const decoded = jwt.verify(token, JWT_SECRET) as UserJwtPayload;
    console.log('[jwtAuth] Token verified successfully. Decoded payload:', decoded);
    authReq.user = decoded; 
    next(); 
  } catch (err) {
    console.error('[jwtAuth] Token verification failed:', err.name, err.message);
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: 'Unauthorized: Token expired', errorName: err.name });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: 'Unauthorized: Invalid token', errorName: err.name });
    } else {
      res.status(401).json({ message: 'Unauthorized: Token verification failed', errorName: err.name });
    }
  }
};
