
-- Add face_violations column to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS face_violations JSONB DEFAULT '[]';
