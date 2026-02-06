-- NeonDB Schema for Schedule App
-- Run this in Neon Console SQL Editor

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(32) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  candidates JSONB NOT NULL DEFAULT '[]',
  fixed_candidate_id INTEGER DEFAULT NULL,
  venue JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Responses table
CREATE TABLE IF NOT EXISTS responses (
  id VARCHAR(32) PRIMARY KEY,
  event_id VARCHAR(32) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  comment TEXT DEFAULT '',
  answers JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_responses_event_id ON responses(event_id);

-- Optional: Auto-delete old events (run as scheduled job or manually)
-- DELETE FROM events WHERE created_at < NOW() - INTERVAL '30 days';
