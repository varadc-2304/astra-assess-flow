
-- Ensure the proctoring-recordings bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('proctoring-recordings', 'proctoring-recordings', false, 52428800, ARRAY['video/webm', 'video/mp4', 'video/quicktime'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/webm', 'video/mp4', 'video/quicktime'];

-- Update RLS policies for the proctoring recordings bucket to be more permissive
DROP POLICY IF EXISTS "Users can upload their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own recordings" ON storage.objects;

-- Create more permissive policies for proctoring recordings
CREATE POLICY "Users can upload proctoring recordings" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'proctoring-recordings' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view proctoring recordings" ON storage.objects
FOR SELECT USING (
  bucket_id = 'proctoring-recordings' AND
  auth.uid() IS NOT NULL
);

-- Allow updates for metadata
CREATE POLICY "Users can update proctoring recordings" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'proctoring-recordings' AND
  auth.uid() IS NOT NULL
);
