-- Migration: Create gap_analyses table for caching gap analysis results
-- Created: 2026-02-04
-- Create the gap_analyses table
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
CREATE UNIQUE INDEX idx_gap_analyses_content_hash ON gap_analyses(content_hash);
-- Create index on expires_at for efficient cleanup queries
CREATE INDEX idx_gap_analyses_expires_at ON gap_analyses(expires_at);
-- Create index on created_at for time-based queries
CREATE INDEX idx_gap_analyses_created_at ON gap_analyses(created_at);
-- Optional: Create a function to automatically clean up expired records
CREATE OR REPLACE FUNCTION cleanup_expired_gap_analyses() RETURNS void AS $$ BEGIN
DELETE FROM gap_analyses
WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
-- Optional: Add a comment to the table
COMMENT ON TABLE gap_analyses IS 'Caches gap analysis results with 24-hour TTL';
COMMENT ON COLUMN gap_analyses.content_hash IS 'SHA-256 hash of resume and job description for cache lookup';
COMMENT ON COLUMN gap_analyses.result_json IS 'JSON object containing missingSkills, steps, and interviewQuestions';
COMMENT ON COLUMN gap_analyses.expires_at IS 'Timestamp when this cache entry expires (24 hours from creation)';