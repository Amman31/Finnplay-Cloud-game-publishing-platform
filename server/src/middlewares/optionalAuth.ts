import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/variables';
import * as domainService from '../services/domainService';

export interface AuthRequest extends Request {
    user?: any;
}

const JWT_SECRET = env.JWT_SECRET;

export const optionalAuthenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            // No token provided, continue without user
            next();
            return;
        }

        if (!JWT_SECRET) {
            next();
            return;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
        const user = await domainService.getUserByUUID(decoded.id);

        if (user) {
            req.user = user;
        }

        next();
    } catch (error) {
        // Invalid token, continue without user
        next();
    }
};
