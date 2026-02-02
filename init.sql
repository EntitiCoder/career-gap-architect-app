-- Initialize database schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO users (email, name) VALUES
    ('john.doe@example.com', 'John Doe'),
    ('jane.smith@example.com', 'Jane Smith')
ON CONFLICT (email) DO NOTHING;
