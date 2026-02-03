import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';

dotenv.config();

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

function getCacheKey(resume: string, jobDescription: string): string {
    const content = `${resume}|${jobDescription}`;
    return crypto.createHash('sha256').update(content).digest('hex');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'API is running!' });
});

// Database health check
app.get('/db-health', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'Database connected',
            timestamp: result.rows[0].now,
        });
    } catch (error) {
        res.status(500).json({
            status: 'Database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Example API endpoint
app.get('/api/users', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM users LIMIT 10');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/api/gap-analysis', async (req: Request, res: Response) => {
    try {
        const { resume, jobDescription } = req.body;

        if (!resume || !jobDescription) {
            return res.status(400).json({
                error: 'Resume and job description are required',
            });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({
                error: 'AI service is not configured. Please set OPENROUTER_API_KEY.',
            });
        }

        const cacheKey = getCacheKey(resume, jobDescription);
        const cached = cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return res.json({ ...cached.result, cached: true });
        }

        const prompt = `Analyze the gap between this resume and job description. Return ONLY valid JSON with this exact structure:
{
  "missingSkills": ["skill1", "skill2"],
  "steps": "# Action Plan\\n- Step 1\\n- Step 2",
  "interviewQuestions": "# Interview Prep\\n- Question 1\\n- Question 2"
}

Resume:
${resume}

Job Description:
${jobDescription}`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.1-8b-instruct:free',
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!response.ok) {
            throw new Error(`AI service error: ${response.statusText}`);
        }

        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Invalid response from AI service');
        }

        let result;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            result = JSON.parse(jsonMatch[0]);

            if (!Array.isArray(result.missingSkills) || !result.steps || !result.interviewQuestions) {
                throw new Error('Response missing required fields');
            }
        } catch (parseError) {
            return res.status(500).json({
                error: 'The AI response was malformed. Please try again.',
                details: parseError instanceof Error ? parseError.message : 'Parse error',
            });
        }

        cache.set(cacheKey, { result, timestamp: Date.now() });

        res.json({ ...result, cached: false });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to analyze gap',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`🚀 API server running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    pool.end();
    process.exit(0);
});
