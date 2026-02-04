-- Initialize database schema for Career Gap Architect
-- This schema supports caching of AI-powered gap analysis results

CREATE TABLE IF NOT EXISTS gap_analyses (
    id SERIAL PRIMARY KEY,
    content_hash VARCHAR(64) NOT NULL,
    resume_text TEXT NOT NULL,
    job_description TEXT NOT NULL,
    result_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create unique index on content_hash for fast lookups and preventing duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_gap_analyses_content_hash ON gap_analyses(content_hash);

-- Create index on expires_at for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_gap_analyses_expires_at ON gap_analyses(expires_at);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_gap_analyses_created_at ON gap_analyses(created_at);
