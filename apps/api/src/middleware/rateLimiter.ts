import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
    count: number;
    windowStart: number;
}

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;
const requests = new Map<string, RateLimitEntry>();

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const entry = requests.get(ip);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
        requests.set(ip, { count: 1, windowStart: now });
        return next();
    }

    if (entry.count >= MAX_REQUESTS) {
        return res.status(429).json({
            error: 'Too many requests. Please try again later.',
        });
    }

    entry.count += 1;
    requests.set(ip, entry);
    return next();
}
