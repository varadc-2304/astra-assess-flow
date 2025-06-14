
-- Create a storage bucket for proctoring recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('proctoring-recordings', 'proctoring-recordings', false);

-- Create RLS policies for the proctoring recordings bucket
CREATE POLICY "Users can upload their own recordings" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'proctoring-recordings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all recordings" ON storage.objects
FOR SELECT USING (
  bucket_id = 'proctoring-recordings' AND
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email LIKE '%admin%'
  )
);

CREATE POLICY "Users can view their own recordings" ON storage.objects
FOR SELECT USING (
  bucket_id = 'proctoring-recordings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Update proctoring_sessions table to track recording status
ALTER TABLE proctoring_sessions 
ADD COLUMN IF NOT EXISTS recording_blob_url text,
ADD COLUMN IF NOT EXISTS recording_size_mb numeric(10,2),
ADD COLUMN IF NOT EXISTS recording_duration_seconds integer;

-- Update submissions table to link with proctoring session
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS proctoring_session_id uuid REFERENCES proctoring_sessions(id);
