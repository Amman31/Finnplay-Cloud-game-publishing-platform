import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/variables';
import { isAdminRole } from '../utils/roleHelper';
import * as domainService from '../services/domainService';

export interface AuthRequest extends Request {
    user?: any;
}

const JWT_SECRET = env.JWT_SECRET;

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        if (!JWT_SECRET) {
            res.status(500).json({ message: 'Server configuration error' });
            return;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
        const user = await domainService.getUserByUUID(decoded.id);

        if (!user) {
            res.status(401).json({ message: 'User not found' });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

export const isAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    if (!isAdminRole(req.user.role)) {
        res.status(403).json({ message: 'Admin access required' });
        return;
    }

    next();
};

export { JWT_SECRET };
