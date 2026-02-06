-- NeonDB Schema for Schedule App
-- Run this in Neon Console SQL Editor

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(32) PRIMARY KEY,
  title TEXT NOT NULL,
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
  name TEXT NOT NULL,
  comment TEXT DEFAULT '',
  answers JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_responses_event_id ON responses(event_id);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(32) PRIMARY KEY,
  event_id VARCHAR(32) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_organizer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_event_id ON chat_messages(event_id);

-- Direct messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id VARCHAR(32) PRIMARY KEY,
  event_id VARCHAR(32) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  to_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_event_id ON direct_messages(event_id);

-- Optional: Auto-delete old events (run as scheduled job or manually)
-- DELETE FROM events WHERE created_at < NOW() - INTERVAL '30 days';
