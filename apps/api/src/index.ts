import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import { Pool } from 'pg';
import { ZodError } from 'zod';
import { inputValidatorMiddleware } from './middleware/inputValidator';
import { rateLimitMiddleware } from './middleware/rateLimiter';
import { callAIService } from './services/analysisService';
import { AnalysisRequest, AnalysisResult, ErrorResponse } from './types/analysis';
import { AIServiceError, ParseError, TimeoutError, ValidationError } from './utils/errors';
import logger, { logAICall, logCache, logDatabase, logRequest } from './utils/logger';
import {
	formatValidationErrors,
	validateAnalysisRequest,
} from './utils/validators';

// Try multiple paths for .env file
const envPaths = [
    path.resolve(__dirname, '../../.env'),           // For compiled code in dist/
    path.resolve(process.cwd(), '.env'),             // Current working directory
    path.resolve(process.cwd(), '../../.env'),       // Two levels up from apps/api
];
let envLoaded = false;
for (const envPath of envPaths) {
    const result = dotenv.config({ path: envPath });
    if (result.error === undefined) {
        logger.info('[STARTUP] Loaded .env', { path: envPath });
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    logger.warn('[STARTUP] Could not find .env file', { paths: envPaths });
}

const app = express();
const port = process.env.PORT || 4000;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'career_gap_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

interface CacheEntry {
    result: any;
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 60;

// Request tracking interface
interface RequestContext {
    requestId: string;
    startTime: number;
    ip?: string;
}

// Store request context
const requestContextMap = new WeakMap<Request, RequestContext>();

function getCacheKey(resume: string, jobDescription: string): string {
    const content = `${resume}|${jobDescription}`;
    return crypto.createHash('sha256').update(content).digest('hex');
}

// Generate a simple request ID
function generateRequestId(): string {
    return crypto.randomBytes(8).toString('hex');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request tracking middleware
app.use((req: Request, res: Response, next: Function) => {
    const requestId = generateRequestId();
    const context: RequestContext = {
        requestId,
        startTime: Date.now(),
        ip: req.ip,
    };
    requestContextMap.set(req, context);
    res.setHeader('X-Request-ID', requestId);
    next();
});

app.use(rateLimitMiddleware);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    const context = requestContextMap.get(req);
    logRequest('GET', '/health', {
        requestId: context?.requestId,
    });
    res.json({ status: 'API is running!' });
});

// Database health check
app.get('/db-health', async (req: Request, res: Response) => {
    const context = requestContextMap.get(req);
    try {
        logDatabase('ping', 'start', { requestId: context?.requestId });
        const result = await pool.query('SELECT NOW()');
        logDatabase('ping', 'success', { requestId: context?.requestId });
        res.json({
            status: 'Database connected',
            timestamp: result.rows[0].now,
        });
    } catch (error) {
        logDatabase('ping', 'error', {
            requestId: context?.requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            status: 'Database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/api/gap-analysis', inputValidatorMiddleware, async (req: Request, res: Response) => {
    const context = requestContextMap.get(req);
    const requestId = context?.requestId || 'unknown';
    const requestStartTime = context?.startTime || Date.now();
    let cacheSource: 'memory' | 'database' | 'ai' | null = null;

    try {
        logRequest('POST', '/api/gap-analysis', { requestId });

        // Validate incoming request
        let validatedRequest: AnalysisRequest;
        try {
            validatedRequest = validateAnalysisRequest(req.body);
        } catch (error) {
            logger.info('Validation error', {
                requestId,
                endpoint: '/api/gap-analysis',
                status: 'failed',
            });
            if (error instanceof ZodError) {
                const errorResponse: ErrorResponse = {
                    error: 'Validation failed',
                    validationErrors: formatValidationErrors(error),
                };
                return res.status(400).json(errorResponse);
            }
            throw error;
        }

        const { resume, jobDescription } = validatedRequest;

        if (!process.env.OPENROUTER_API_KEY) {
            logger.error('OPENROUTER_API_KEY not configured', { requestId });
            return res.status(500).json({
                error: 'AI service is not configured. Please set OPENROUTER_API_KEY.',
            });
        }

        const cacheKey = getCacheKey(resume, jobDescription);

        // Check in-memory cache first (L1 cache)
        const memoryCached = cache.get(cacheKey);
        if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL) {
            logCache('hit', 'memory', {
                requestId,
                cacheKeyHash: cacheKey.substring(0, 8),
            });
            cacheSource = 'memory';
            const processingTime = Date.now() - requestStartTime;
            const response = {
                ...memoryCached.result,
                cached: true,
                metadata: {
                    processingTime,
                    cacheSource,
                    model: 'meta-llama/llama-3.1-8b-instruct:free',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                },
            };
            logger.info('Gap analysis response sent (from memory cache)', {
                requestId,
                processingTime,
            });
            return res.json(response);
        }

        logCache('miss', 'memory', { requestId, cacheKeyHash: cacheKey.substring(0, 8) });

        // Check database cache (L2 cache)
        try {
            logDatabase('cache lookup', 'start', {
                requestId,
                cacheKeyHash: cacheKey.substring(0, 8),
            });
            const dbResult = await pool.query(
                `SELECT result_json, created_at, expires_at 
                 FROM gap_analyses 
                 WHERE content_hash = $1 AND expires_at > NOW()`,
                [cacheKey]
            );

            if (dbResult.rows.length > 0) {
                logDatabase('cache lookup', 'success', { requestId });
                logCache('hit', 'database', {
                    requestId,
                    cacheKeyHash: cacheKey.substring(0, 8),
                });
                cacheSource = 'database';
                const cachedResult = dbResult.rows[0].result_json;
                // Populate in-memory cache for faster subsequent access
                cache.set(cacheKey, {
                    result: cachedResult,
                    timestamp: new Date(dbResult.rows[0].created_at).getTime(),
                });
                const processingTime = Date.now() - requestStartTime;
                const response = {
                    ...cachedResult,
                    cached: true,
                    metadata: {
                        processingTime,
                        cacheSource,
                        model: 'meta-llama/llama-3.1-8b-instruct:free',
                        timestamp: new Date().toISOString(),
                        version: '1.0.0',
                    },
                };
                logger.info('Gap analysis response sent (from database cache)', {
                    requestId,
                    processingTime,
                });
                return res.json(response);
            }
            logCache('miss', 'database', { requestId });
        } catch (dbError) {
            // Log database error but continue with AI request
            logDatabase('cache lookup', 'error', {
                requestId,
                error: dbError instanceof Error ? dbError.message : 'Unknown error',
            });
        }

        // Call AI service with retry logic
        let result: AnalysisResult;
        try {
            logAICall('arcee-ai/trinity-large-preview:free', 'start', {
                requestId,
            });
            result = await callAIService(resume, jobDescription, process.env.OPENROUTER_API_KEY);
            logAICall('arcee-ai/trinity-large-preview:free', 'success', {
                requestId,
            });
            cacheSource = 'ai';
        } catch (error) {
            // Handle specific error types
            if (error instanceof AIServiceError) {
                logAICall('arcee-ai/trinity-large-preview:free', 'error', {
                    requestId,
                    code: error.code,
                    statusCode: error.statusCode,
                    message: error.message,
                });
                return res.status(error.statusCode || 500).json({
                    error: 'AI service request failed',
                    details: error.message,
                    code: error.code,
                });
            }

            if (error instanceof ParseError) {
                logger.error('AI response parsing error', {
                    requestId,
                    code: error.code,
                    message: error.message,
                });
                return res.status(500).json({
                    error: 'Failed to parse AI response',
                    details: error.message,
                    code: error.code,
                });
            }

            if (error instanceof ValidationError) {
                logger.warn('AI response validation failed', {
                    requestId,
                    code: error.code,
                    message: error.message,
                    validationErrors: error.details,
                });
                return res.status(500).json({
                    error: 'AI response validation failed',
                    details: error.message,
                    code: error.code,
                    validationErrors: error.details,
                });
            }

            if (error instanceof TimeoutError) {
                logger.warn('AI request timeout', {
                    requestId,
                    code: error.code,
                    message: error.message,
                });
                return res.status(504).json({
                    error: 'Request timed out',
                    details: error.message,
                    code: error.code,
                });
            }

            // Generic error fallback
            logger.error('Failed to analyze gap', {
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            return res.status(500).json({
                error: 'Failed to analyze gap',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        // Store in in-memory cache
        cache.set(cacheKey, { result, timestamp: Date.now() });

        // Store in database cache
        try {
            logDatabase('insert cache', 'start', { requestId });
            await pool.query(
                `INSERT INTO gap_analyses (content_hash, resume_text, job_description, result_json)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (content_hash) 
                 DO UPDATE SET 
                    result_json = EXCLUDED.result_json,
                    created_at = NOW(),
                    expires_at = NOW() + INTERVAL '24 hours'`,
                [cacheKey, resume, jobDescription, JSON.stringify(result)]
            );
            logDatabase('insert cache', 'success', { requestId });
        } catch (dbError) {
            // Log database error but don't fail the request
            logDatabase('insert cache', 'error', {
                requestId,
                error: dbError instanceof Error ? dbError.message : 'Unknown error',
            });
        }

        const processingTime = Date.now() - requestStartTime;
        const response = {
            ...result,
            cached: false,
            metadata: {
                processingTime,
                cacheSource,
                model: 'meta-llama/llama-3.1-8b-instruct:free',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
            },
        };
        logger.info('Gap analysis response sent (from AI)', {
            requestId,
            processingTime,
        });
        res.json(response);
    } catch (error) {
        const context = requestContextMap.get(req);
        const requestId = context?.requestId || 'unknown';
        logger.error('Unhandled error in gap-analysis endpoint', {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(500).json({
            error: 'Failed to analyze gap',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Start server
app.listen(port, () => {
    logger.info(`API server starting`, {
        port,
        environment: process.env.NODE_ENV || 'development',
    });
    logger.info(`🚀 API server running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    pool.end();
    logger.info('Database pool closed, exiting process');
    process.exit(0);
});
