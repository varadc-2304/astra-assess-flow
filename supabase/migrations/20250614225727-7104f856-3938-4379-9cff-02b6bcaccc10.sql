
-- Drop existing policies for the proctoring_recordings bucket
DROP POLICY IF EXISTS "Authenticated users can view recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload recordings" ON storage.objects;

-- Create more specific RLS policies for the proctoring_recordings bucket

-- Policy for viewing own recordings
CREATE POLICY "Users can view their own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proctoring_recordings' AND
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Policy for uploading own recordings
CREATE POLICY "Users can upload recordings to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proctoring_recordings' AND
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Policy for updating own recordings (for upsert)
CREATE POLICY "Users can update their own recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'proctoring_recordings' AND
  auth.uid() = (storage.foldername(name))[1]::uuid
);
