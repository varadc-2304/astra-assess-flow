
-- Create a new storage bucket for proctoring recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('proctoring_recordings', 'proctoring_recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for the new bucket
-- Policy for viewing recordings
CREATE POLICY "Authenticated users can view recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'proctoring_recordings');

-- Policy for uploading recordings
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proctoring_recordings');
