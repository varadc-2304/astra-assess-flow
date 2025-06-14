
-- Add recording_url column to submissions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'submissions' 
        AND column_name = 'recording_url'
    ) THEN
        ALTER TABLE submissions ADD COLUMN recording_url TEXT;
    END IF;
END $$;

-- Create proctoring_recordings storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('proctoring_recordings', 'proctoring_recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can upload their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all recordings" ON storage.objects;

-- Create RLS policies for proctoring_recordings bucket
-- Allow authenticated users to upload their own recordings
CREATE POLICY "Users can upload their own recordings" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'proctoring_recordings' AND
    auth.uid()::text = split_part(name, '/', 1)
);

-- Allow authenticated users to view their own recordings
CREATE POLICY "Users can view their own recordings" ON storage.objects
FOR SELECT USING (
    bucket_id = 'proctoring_recordings' AND
    auth.uid()::text = split_part(name, '/', 1)
);

-- Allow admins to view all recordings
CREATE POLICY "Admins can view all recordings" ON storage.objects
FOR SELECT USING (
    bucket_id = 'proctoring_recordings' AND
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.email LIKE '%admin%'
    )
);
