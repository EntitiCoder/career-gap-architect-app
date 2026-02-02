import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'career_gap_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

// Middleware
app.use(cors());
app.use(express.json());

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
