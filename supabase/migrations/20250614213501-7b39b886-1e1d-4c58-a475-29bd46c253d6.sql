
-- Create storage bucket for assessment recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment-recordings', 'assessment-recordings', false);

-- Create RLS policies for the assessment recordings bucket
CREATE POLICY "Users can upload their own recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assessment-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assessment-recordings' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM auth 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
);

-- Add recording_url column to submissions table to track the video file
ALTER TABLE submissions 
ADD COLUMN recording_url TEXT;
