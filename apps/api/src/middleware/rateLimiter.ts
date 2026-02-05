import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import logger from '../utils/logger';

const RATE_LIMIT_POINTS = 60;
const RATE_LIMIT_DURATION = 60;

let rateLimiter: RateLimiterRedis | null = null;

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
    logger.info('Redis connected for rate limiting');
});

redis.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message });
});

try {
    rateLimiter = new RateLimiterRedis({
        storeClient: redis,
        points: RATE_LIMIT_POINTS,
        duration: RATE_LIMIT_DURATION,
        blockDuration: 0,
    });
} catch (error) {
    logger.error('Failed to initialize rate limiter', {
        error: error instanceof Error ? error.message : 'Unknown error',
    });
}

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!rateLimiter) {
        logger.warn('Rate limiter not initialized, allowing request');
        return next();
    }

    const ip = req.ip || 'unknown';

    try {
        await rateLimiter.consume(ip);
        return next();
    } catch (rejRes: any) {
        const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.set('Retry-After', String(retryAfter));
        
        logger.warn('Rate limit exceeded', {
            ip,
            retryAfter,
            endpoint: req.path,
        });

        return res.status(429).json({
            error: 'Too many requests. Please try again later.',
            retryAfter,
        });
    }
}

export { redis };
